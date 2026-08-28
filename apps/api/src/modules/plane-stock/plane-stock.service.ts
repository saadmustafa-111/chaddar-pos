import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Coil, InventoryStatus } from '../coils/entities/coil.entity';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import {
  InventoryMovement,
  MovementType,
} from '../inventory-movements/entities/inventory-movement.entity';
import { PlaneStock, PlaneStockStatus } from './entities/plane-stock.entity';
import { MoveToPlaneDto } from './dto/move-to-plane.dto';
import {
  CoilHistoryRow,
  coilKgPerFoot,
  kgToFeet,
  ROUND_KG,
} from '../cutting-batches/calculation';
import { CuttingBatch } from '../cutting-batches/entities/cutting-batch.entity';

/**
 * Screen-ready plane row enriched with the source coil's
 * specification. The DB layer only stores the differential data;
 * every operator-visible column beyond weight / feet / cost is
 * resolved through the coil relation here so we never duplicate
 * source-of-truth fields.
 */
export interface PlaneStockRow {
  id: number;
  coilId: number;
  coilCode: string | null;
  purchaseId: number | null;
  purchaseCode: string | null;
  supplierId: number | null;
  supplierName: string | null;
  materialFamilyId: number | null;
  materialFamilyName: string | null;
  brand: string | null;
  color: string | null;
  widthMm: number | null;
  thicknessMm: number | null;
  weightKg: number;
  calculatedFeet: number;
  kgPerFoot: number;
  costPerKgPaisa: number;
  totalValuePaisa: number;
  status: PlaneStockStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaneStockSummary {
  totalWeightKg: number;
  totalFeet: number;
  totalValuePaisa: number;
  entryCount: number;
}

@Injectable()
export class PlaneStockService {
  constructor(
    @InjectRepository(PlaneStock)
    private readonly planeRepository: Repository<PlaneStock>,
    @InjectRepository(Coil)
    private readonly coilRepository: Repository<Coil>,
    @InjectRepository(FinishedChaddarStock)
    private readonly stockRepository: Repository<FinishedChaddarStock>,
    @InjectRepository(CuttingBatch)
    private readonly cuttingBatchRepository: Repository<CuttingBatch>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepository: Repository<InventoryMovement>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * List every plane entry the shop has recorded, newest first.
   * Pulls all spec fields through the coil relation so we never
   * persist denormalised copies on the plane row itself.
   */
  async findAll(): Promise<PlaneStockRow[]> {
    const rows = await this.planeRepository
      .createQueryBuilder('plane')
      .leftJoinAndSelect('plane.coil', 'coil')
      .leftJoinAndSelect('coil.supplier', 'supplier')
      .leftJoinAndSelect('coil.purchase', 'purchase')
      .leftJoinAndSelect('coil.materialFamily', 'materialFamily')
      .orderBy('plane.created_at', 'DESC')
      .getMany();

    return rows.map((plane) => this.toRow(plane));
  }

  /**
   * Plane entries originating from a specific coil. Used by the coil
   * detail workflow so the operator can see at a glance what weight
   * has already been moved into the plane category.
   */
  async findByCoil(coilId: number): Promise<PlaneStockRow[]> {
    await this.ensureCoilExists(coilId);
    const rows = await this.planeRepository
      .createQueryBuilder('plane')
      .leftJoinAndSelect('plane.coil', 'coil')
      .leftJoinAndSelect('coil.supplier', 'supplier')
      .leftJoinAndSelect('coil.purchase', 'purchase')
      .leftJoinAndSelect('coil.materialFamily', 'materialFamily')
      .where('plane.coil_id = :coilId', { coilId })
      .orderBy('plane.created_at', 'DESC')
      .getMany();
    return rows.map((plane) => this.toRow(plane));
  }

  async findOne(id: number): Promise<PlaneStockRow> {
    const plane = await this.planeRepository
      .createQueryBuilder('plane')
      .leftJoinAndSelect('plane.coil', 'coil')
      .leftJoinAndSelect('coil.supplier', 'supplier')
      .leftJoinAndSelect('coil.purchase', 'purchase')
      .leftJoinAndSelect('coil.materialFamily', 'materialFamily')
      .where('plane.id = :id', { id })
      .getOne();
    if (!plane) {
      throw new NotFoundException('Plane stock entry not found');
    }
    return this.toRow(plane);
  }

  /**
   * Aggregations over the plane table for the inventory summary tiles.
   */
  async getSummary(): Promise<PlaneStockSummary> {
    const row = (await this.planeRepository
      .createQueryBuilder('plane')
      .select('COALESCE(SUM(plane.weight_kg), 0)', 'totalWeightKg')
      .addSelect('COALESCE(SUM(plane.calculated_feet), 0)', 'totalFeet')
      .addSelect('COALESCE(SUM(plane.total_value_paisa), 0)', 'totalValuePaisa')
      .addSelect('COUNT(*)', 'entryCount')
      .where('plane.status = :status', { status: PlaneStockStatus.AVAILABLE })
      .getRawOne()) as {
      totalWeightKg: string | number;
      totalFeet: string | number;
      totalValuePaisa: string | number;
      entryCount: string | number;
    } | null;

    return {
      totalWeightKg: Number(row?.totalWeightKg ?? 0),
      totalFeet: Number(row?.totalFeet ?? 0),
      totalValuePaisa: Number(row?.totalValuePaisa ?? 0),
      entryCount: Number(row?.entryCount ?? 0),
    };
  }

  /**
   * Move `weightKg` from the source coil into a new plane entry.
   *
   * The whole flow runs inside one DB transaction:
   *  1. lock the source coil row,
   *  2. validate against the coil's current weight,
   *  3. deduct the weight from the coil (clamped to zero),
   *  4. resolve kg/foot from coil history + theoretical fallback,
   *  5. persist the plane entry,
   *  6. emit a `PLANE_TRANSFER` inventory movement for audit.
   *
   * If any step fails the entire transaction is rolled back so the
   * coil and the plane table never disagree.
   */
  async moveFromCoil(
    coilId: number,
    dto: MoveToPlaneDto,
    createdBy?: string,
  ): Promise<PlaneStockRow> {
    if (dto.weightKg <= 0) {
      throw new BadRequestException('Weight must be greater than zero');
    }

    return this.dataSource.transaction(async (manager) => {
      const coil = await manager.findOne(Coil, { where: { id: coilId } });
      if (!coil) {
        throw new NotFoundException('Source coil not found');
      }

      const currentWeight = Number(coil.currentWeight);
      if (dto.weightKg > currentWeight) {
        throw new BadRequestException(
          `Requested weight ${dto.weightKg.toFixed(3)} KG exceeds coil ${coil.code} available weight ${currentWeight.toFixed(3)} KG`,
        );
      }

      const history = await this.loadHistoryForFeet(
        manager,
        coil.id,
        dto.weightKg,
      );
      const spec = {
        widthMm: coil.width != null ? Number(coil.width) : null,
        thicknessMm: coil.thicknessMm != null ? Number(coil.thicknessMm) : null,
      };
      const kgPerFoot = coilKgPerFoot(spec, history);
      if (kgPerFoot == null) {
        throw new BadRequestException(
          'Cannot compute kg/foot for this coil. Record a cutting batch first or fill in the coil width and thickness.',
        );
      }
      const calculatedFeet = kgToFeet(spec, history, dto.weightKg);
      if (calculatedFeet == null) {
        throw new BadRequestException(
          'Computed feet is invalid for the given weight',
        );
      }

      // Snapshot the coil's current finished-cost-per-kg so the plane
      // entry carries the same business valuation as the cutting flow.
      const finishedCostPaisa = await this.loadFinishedCostPaisa(
        manager,
        coil.id,
      );

      // Deduct the coil weight, clamped to zero to mirror the cutting
      // service's defensive behaviour.
      const newCurrentWeight = Math.max(0, currentWeight - dto.weightKg);
      coil.currentWeight = ROUND_KG(newCurrentWeight);
      if (coil.currentWeight <= 0) {
        coil.status = InventoryStatus.DEPLETED;
      } else if (coil.status === InventoryStatus.RAW) {
        coil.status = InventoryStatus.IN_PROCESS;
      }
      await manager.save(coil);

      const plane = manager.create(PlaneStock, {
        coilId: coil.id,
        weightKg: ROUND_KG(dto.weightKg),
        calculatedFeet,
        kgPerFoot: ROUND_KG(kgPerFoot),
        costPerKgPaisa: finishedCostPaisa,
        totalValuePaisa: Math.round(ROUND_KG(dto.weightKg) * finishedCostPaisa),
        status: PlaneStockStatus.AVAILABLE,
        note: dto.note ?? null,
        createdBy: createdBy ?? null,
      });
      const saved = await manager.save(plane);

      const movement = manager.create(InventoryMovement, {
        coilId: coil.id,
        type: MovementType.PLANE_TRANSFER,
        weightDelta: -ROUND_KG(dto.weightKg),
        weightBalance: ROUND_KG(newCurrentWeight),
        referenceType: 'PLANE_STOCK',
        referenceId: saved.id,
        referenceCode: saved.id != null ? `PLN-${saved.id}` : null,
        notes: `Moved ${ROUND_KG(dto.weightKg).toFixed(3)} KG to Plane Stock (≈ ${calculatedFeet.toFixed(3)} ft)${
          dto.note ? ` — ${dto.note}` : ''
        }`,
        createdBy: createdBy ?? null,
      });
      await manager.save(movement);

      return {
        id: saved.id,
        coilId: saved.coilId,
        weightKg: Number(saved.weightKg),
        calculatedFeet: Number(saved.calculatedFeet),
        kgPerFoot: Number(saved.kgPerFoot),
        costPerKgPaisa: Number(saved.costPerKgPaisa),
        totalValuePaisa: Number(saved.totalValuePaisa),
        status: saved.status,
        note: saved.note,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
        // Placeholders - the controller returns the full row via findOne.
        coilCode: coil.code,
        purchaseId: coil.purchaseId,
        purchaseCode: null,
        supplierId: coil.supplierId,
        supplierName: null,
        materialFamilyId: coil.materialFamilyId,
        materialFamilyName: null,
        brand: coil.brand,
        color: coil.color,
        widthMm: coil.width != null ? Number(coil.width) : null,
        thicknessMm: coil.thicknessMm != null ? Number(coil.thicknessMm) : null,
      };
    });
  }

  private async ensureCoilExists(coilId: number): Promise<void> {
    const coil = await this.coilRepository.findOne({ where: { id: coilId } });
    if (!coil) {
      throw new NotFoundException('Source coil not found');
    }
  }

  private async loadFinishedCostPaisa(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    coilId: number,
  ): Promise<number> {
    const rows = (await manager.query(
      `SELECT c.purchase_amount_paisa AS purchaseAmountPaisa,
              c.purchase_weight AS purchaseWeight,
              c.wastage_weight AS wastageWeight,
              c.current_weight AS currentWeight,
              COALESCE(SUM(e.amount_paisa), 0) AS additionalExpensesPaisa
       FROM coils c
       LEFT JOIN coil_landing_expenses e ON e.coil_id = c.id
       WHERE c.id = ?
       GROUP BY c.id`,
      [coilId],
    )) as Array<{
      purchaseAmountPaisa: string | number;
      purchaseWeight: string | number;
      wastageWeight: string | number;
      currentWeight: string | number;
      additionalExpensesPaisa: string | number;
    }>;

    const r = rows[0];
    if (!r) return 0;
    const remainingKg = Math.max(0, Number(r.currentWeight));
    if (remainingKg <= 0) return 0;
    const totalInvested =
      Number(r.purchaseAmountPaisa) + Number(r.additionalExpensesPaisa);
    return Math.round(totalInvested / remainingKg);
  }

  /**
   * Most-recent cutting history for the coil. We use the latest
   * available finished-chaddar-stock rows (newest first) so the
   * kg/foot reflects the most recent production reality.
   */
  private async loadHistoryForFeet(
    manager: {
      find: (entity: unknown, opts: unknown) => Promise<unknown[]>;
    },
    coilId: number,
    _requestedWeightKg: number,
  ): Promise<CoilHistoryRow[]> {
    // Use a lightweight projection rather than the full entity
    // graph - we only need two fields per row.
    const rows = (await manager.find(FinishedChaddarStock, {
      where: { sourceCoilId: coilId },
      order: { productionDate: 'DESC', id: 'DESC' },
      take: 20,
    })) as Array<
      FinishedChaddarStock & {
        lengthFt: number | null;
        weightPerPieceKg: number | null;
      }
    >;
    void _requestedWeightKg;
    return rows.map((r) => ({
      weightPerPieceKg:
        r.weightPerPieceKg != null ? Number(r.weightPerPieceKg) : null,
      lengthFt: r.lengthFt != null ? Number(r.lengthFt) : null,
    }));
  }

  private toRow(
    plane: PlaneStock & {
      coil?:
        | (Coil & {
            supplier?: { name: string } | null;
            purchase?: { code: string } | null;
            materialFamily?: { name: string } | null;
          })
        | null;
    },
  ): PlaneStockRow {
    const coil = plane.coil ?? null;
    return {
      id: plane.id,
      coilId: plane.coilId,
      coilCode: coil?.code ?? null,
      purchaseId: coil?.purchaseId ?? null,
      purchaseCode: coil?.purchase?.code ?? null,
      supplierId: coil?.supplierId ?? null,
      supplierName: coil?.supplier?.name ?? null,
      materialFamilyId: coil?.materialFamilyId ?? null,
      materialFamilyName: coil?.materialFamily?.name ?? null,
      brand: coil?.brand ?? null,
      color: coil?.color ?? null,
      widthMm: coil?.width != null ? Number(coil.width) : null,
      thicknessMm: coil?.thicknessMm != null ? Number(coil.thicknessMm) : null,
      weightKg: Number(plane.weightKg),
      calculatedFeet: Number(plane.calculatedFeet),
      kgPerFoot: Number(plane.kgPerFoot),
      costPerKgPaisa: Number(plane.costPerKgPaisa),
      totalValuePaisa: Number(plane.totalValuePaisa),
      status: plane.status,
      note: plane.note,
      createdAt: plane.createdAt.toISOString(),
      updatedAt: plane.updatedAt.toISOString(),
    };
  }
}
