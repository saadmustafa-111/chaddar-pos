import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CuttingBatch } from './entities/cutting-batch.entity';
import { CreateCuttingBatchDto } from './dto/create-cutting-batch.dto';
import { Coil, InventoryStatus } from '../coils/entities/coil.entity';
import {
  InventoryMovement,
  MovementType,
} from '../inventory-movements/entities/inventory-movement.entity';
import {
  FinishedChaddarStock,
  FinishedChaddarStatus,
} from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { CoilsService } from '../coils/coils.service';
import { PriceCategoriesService } from '../price-categories/price-categories.service';
import {
  CuttingPlan,
  ResolvedCuttingRow,
  ROUND_KG,
  defaultSizeLabelForRow,
  normalizeCuttingRows,
  planCutting,
} from './calculation';

export interface CuttingBatchWithStock {
  cuttingBatch: CuttingBatch;
  finishedStock: FinishedChaddarStock;
}

export interface WeightPerPieceSuggestion {
  sizeLabel: string;
  weightPerPieceKg: number | null;
  source: 'HISTORY' | 'NONE';
  sampleCount: number;
}

interface PersistedRowSummary {
  row: ResolvedCuttingRow;
  stock: FinishedChaddarStock;
}

@Injectable()
export class CuttingBatchesService {
  constructor(
    @InjectRepository(CuttingBatch)
    private readonly cuttingBatchRepository: Repository<CuttingBatch>,
    @InjectRepository(FinishedChaddarStock)
    private readonly finishedStockRepository: Repository<FinishedChaddarStock>,
    private readonly dataSource: DataSource,
    private readonly coilsService: CoilsService,
    private readonly priceCategoriesService: PriceCategoriesService,
  ) {}

  private async generateCuttingBatchCode(queryRunner: {
    query: (sql: string, params?: unknown[]) => Promise<unknown>;
  }): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CUT-${year}-`;

    const result = (await queryRunner.query(
      `SELECT MAX(CAST(SUBSTR(code, LENGTH('${prefix}') + 1) AS INTEGER)) as max_num
       FROM cutting_batches
       WHERE code LIKE '${prefix}%'`,
    )) as Array<{ max_num: number | null }>;
    const maxNum = result[0]?.max_num ?? 0;
    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(5, '0')}`;
  }

  private async generateFinishedStockCode(queryRunner: {
    query: (sql: string, params?: unknown[]) => Promise<unknown>;
  }): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FCS-${year}-`;

    const result = (await queryRunner.query(
      `SELECT MAX(CAST(SUBSTR(code, LENGTH('${prefix}') + 1) AS INTEGER)) as max_num
       FROM finished_chaddar_stock
       WHERE code LIKE '${prefix}%'`,
    )) as Array<{ max_num: number | null }>;
    const maxNum = result[0]?.max_num ?? 0;
    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(5, '0')}`;
  }

  /**
   * Suggest a reliable weight-per-piece for a given size label based on
   * prior production history. Returns null when there is no usable history
   * so the caller can fall back to asking the operator for a weight value.
   */
  async suggestWeightPerPiece(
    sourceCoilId: number,
    sizeLabel: string,
  ): Promise<WeightPerPieceSuggestion> {
    const trimmed = (sizeLabel ?? '').trim();
    if (!trimmed) {
      return {
        sizeLabel: trimmed,
        weightPerPieceKg: null,
        source: 'NONE',
        sampleCount: 0,
      };
    }

    const rows = await this.finishedStockRepository
      .createQueryBuilder('s')
      .select('s.weight_per_piece_kg', 'weightPerPieceKg')
      .addSelect('s.total_weight_kg', 'totalWeightKg')
      .addSelect('s.pieces_produced', 'piecesProduced')
      .where('s.size_label = :sizeLabel', { sizeLabel: trimmed })
      .andWhere('s.pieces_produced > 0')
      .orderBy('s.production_date', 'DESC')
      .addOrderBy('s.id', 'DESC')
      .limit(20)
      .getRawMany<{
        weightPerPieceKg: string | number | null;
        totalWeightKg: string | number | null;
        piecesProduced: string | number;
      }>();

    if (rows.length === 0) {
      return {
        sizeLabel: trimmed,
        weightPerPieceKg: null,
        source: 'NONE',
        sampleCount: 0,
      };
    }

    let totalWpp = 0;
    let totalPieces = 0;
    let sampleCount = 0;
    for (const r of rows) {
      const pieces = Number(r.piecesProduced);
      if (!pieces || pieces <= 0) continue;
      const explicit =
        r.weightPerPieceKg != null ? Number(r.weightPerPieceKg) : null;
      const total = Number(r.totalWeightKg);
      const wpp = explicit != null && explicit > 0 ? explicit : total / pieces;
      if (!wpp || wpp <= 0) continue;
      totalWpp += wpp * pieces;
      totalPieces += pieces;
      sampleCount++;
    }

    if (totalPieces === 0) {
      return {
        sizeLabel: trimmed,
        weightPerPieceKg: null,
        source: 'NONE',
        sampleCount: 0,
      };
    }

    const wpp = ROUND_KG(totalWpp / totalPieces);
    void sourceCoilId;
    return {
      sizeLabel: trimmed,
      weightPerPieceKg: wpp,
      source: 'HISTORY',
      sampleCount,
    };
  }

  /**
   * Validate the planned total against the coil's currently-remaining
   * weight (treating the finished-cost "remainingUsableWeightKg" as the
   * source of truth).
   *
   * With per-row 3-decimal rounding the plan can be a few milligrams
   * above the input weight on adversarial inputs (e.g. a single piece
   * at a non-10ft size). The actual coil deduction is clamped to the
   * remaining weight so we never run stock negative, so this check is
   * only used to refuse truly under-sized coils - we use a generous
   * 1g tolerance for the rounding noise.
   */
  private ensurePlanFitsCoil(plan: CuttingPlan, currentWeightKg: number): void {
    const overshootKg = plan.totalProducedWeightKg - currentWeightKg;
    if (overshootKg > 1) {
      throw new BadRequestException(
        `Planned production weight ${plan.totalProducedWeightKg.toFixed(3)} KG exceeds the coil's remaining usable weight ${currentWeightKg.toFixed(3)} KG by ${overshootKg.toFixed(3)} KG. Add fewer pieces or split this batch.`,
      );
    }
  }

  /**
   * Public: create a multi-row cutting batch with one
   * FinishedChaddarStock row per requested size. Backwards compatible
   * with the legacy single-size endpoint payload when only one row is
   * supplied.
   *
   * The full flow runs inside one DB transaction. If any insert /
   * update / save fails the entire batch is rolled back so the source
   * coil and finished-stock rows stay consistent.
   */
  async create(
    sourceCoilId: number,
    dto: CreateCuttingBatchDto,
    createdBy?: string,
  ): Promise<CuttingBatchWithStock> {
    const normalizedRows = normalizeCuttingRows(dto.rows);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const coil = await queryRunner.manager.findOne(Coil, {
        where: { id: sourceCoilId },
      });

      if (!coil) {
        throw new NotFoundException('Source coil not found');
      }

      // Idempotency guard: if the operator (or a flaky double-click)
      // submits the exact same payload twice within 10 seconds against
      // the same coil, return the previously-created batch instead of
      // creating a duplicate. Replays with materially different rows
      // are not deduped.
      const recentDuplicate = await this.cuttingBatchRepository
        .createQueryBuilder('batch')
        .where('batch.sourceCoilId = :coilId', { coilId: coil.id })
        .andWhere('batch.productionDate = :productionDate', {
          productionDate: new Date(dto.productionDate),
        })
        .andWhere('batch.createdAt >= :windowStart', {
          windowStart: new Date(Date.now() - 10_000),
        })
        .orderBy('batch.createdAt', 'DESC')
        .getOne();
      if (
        recentDuplicate &&
        recentDuplicate.cutRowsJson ===
          JSON.stringify(
            normalizedRows.map((r) => ({
              lengthFt: r.lengthFt,
              quantity: r.quantity,
            })),
          )
      ) {
        await queryRunner.rollbackTransaction();
        const existingStock = await this.finishedStockRepository.findOne({
          where: { cuttingBatchId: recentDuplicate.id },
          order: { lengthFt: 'ASC' },
        });
        return {
          cuttingBatch: recentDuplicate,
          finishedStock: existingStock!,
        };
      }

      const finishedCost = await this.coilsService.getFinishedCost(coil.id);

      if (finishedCost.remainingUsableWeightKg <= 0) {
        throw new BadRequestException(
          'Usable coil weight is zero or negative. Record processing wastage and at least one additional expense before cutting.',
        );
      }
      if (finishedCost.finishedCostPerKgPaisa <= 0) {
        throw new BadRequestException(
          'Finished cost is not available. Record processing/wastage and at least one additional expense before cutting.',
        );
      }

      const usableCoilWeightKg =
        dto.usableCoilWeightKg !== undefined && dto.usableCoilWeightKg > 0
          ? Math.min(
              dto.usableCoilWeightKg,
              finishedCost.remainingUsableWeightKg,
            )
          : finishedCost.remainingUsableWeightKg;

      const plan = planCutting({
        rows: normalizedRows,
        usableCoilWeightKg,
      });

      // Defence in depth: refuse the cut only if the planned total is
      // dramatically above the coil's current weight. Tiny per-row
      // 3-decimal rounding drift is absorbed downstream by clamping
      // the actual deduction to the remaining coil weight.
      this.ensurePlanFitsCoil(plan, Number(coil.currentWeight));

      const headlineLabel = buildHeadlineLabel(dto.sizeLabel, plan);

      const totalPieces = normalizedRows.reduce(
        (sum, r) => sum + r.quantity,
        0,
      );
      const batchWeightPerPieceKg =
        totalPieces > 0 ? plan.totalProducedWeightKg / totalPieces : null;

      const totalProductionCostPaisa = Math.round(
        plan.totalProducedWeightKg * finishedCost.finishedCostPerKgPaisa,
      );

      const cuttingBatchCode = await this.generateCuttingBatchCode(queryRunner);
      const finishedStockBaseCode =
        await this.generateFinishedStockCode(queryRunner);
      const stockCodeForRow = (rowIndex: number): string => {
        if (plan.rows.length === 1) {
          return finishedStockBaseCode;
        }
        const suffix = String(rowIndex + 1).padStart(2, '0');
        return `${finishedStockBaseCode}-${suffix}`;
      };

      const cuttingBatch = queryRunner.manager.create(CuttingBatch, {
        code: cuttingBatchCode,
        sourceCoilId: coil.id,
        priceCategoryId: coil.priceCategoryId ?? null,
        sizeLabel: headlineLabel,
        widthMm: coil.width ? Number(coil.width) : null,
        thicknessMm: coil.thicknessMm ? Number(coil.thicknessMm) : null,
        color: coil.color,
        brand: coil.brand,
        piecesProduced: totalPieces,
        cuttingWeightKg: plan.totalProducedWeightKg,
        weightPerPieceKg:
          batchWeightPerPieceKg != null
            ? ROUND_KG(batchWeightPerPieceKg)
            : null,
        tenFtEquivalentQty: plan.tenFtEquivalentQty,
        avg10ftPieceWeightKg: plan.avg10ftPieceWeightKg,
        usableCoilWeightKg: plan.usableCoilWeightKg,
        cutRowsJson: JSON.stringify(plan.rows),
        finishedCostPerKgPaisa: finishedCost.finishedCostPerKgPaisa,
        totalProductionCostPaisa,
        productionDate: new Date(dto.productionDate),
        note: dto.note ?? null,
        createdBy: createdBy ?? null,
      });

      const savedBatch = await queryRunner.manager.save(cuttingBatch);

      const summaries: PersistedRowSummary[] = [];
      for (let i = 0; i < plan.rows.length; i++) {
        const r = plan.rows[i];
        const perRowProductionCostPaisa = Math.round(
          r.totalWeightKg * finishedCost.finishedCostPerKgPaisa,
        );

        const stockRow = queryRunner.manager.create(FinishedChaddarStock, {
          code: stockCodeForRow(i),
          cuttingBatchId: savedBatch.id,
          sourceCoilId: coil.id,
          priceCategoryId: coil.priceCategoryId ?? null,
          sizeLabel: defaultSizeLabelForRow(r),
          widthMm: cuttingBatch.widthMm,
          thicknessMm: cuttingBatch.thicknessMm,
          color: coil.color,
          brand: coil.brand,
          lengthFt: r.lengthFt,
          piecesProduced: r.quantity,
          totalWeightKg: r.totalWeightKg,
          remainingPieces: r.quantity,
          remainingWeightKg: r.totalWeightKg,
          weightPerPieceKg: r.pieceWeightKg,
          finishedCostPerKgPaisa: finishedCost.finishedCostPerKgPaisa,
          totalProductionCostPaisa: perRowProductionCostPaisa,
          status: FinishedChaddarStatus.AVAILABLE,
          productionDate: cuttingBatch.productionDate,
        });

        const savedStock = await queryRunner.manager.save(stockRow);
        summaries.push({ row: r, stock: savedStock });
      }

      const newCurrentWeight = ROUND_KG(
        Number(coil.currentWeight) - plan.totalProducedWeightKg,
      );

      // Clamp to zero: per-row 3-dp rounding can occasionally push the
      // rounded sum a few milligrams above the input weight. We never
      // let a coil's currentWeight go negative.
      const safeRemaining = Math.max(0, newCurrentWeight);
      coil.currentWeight = safeRemaining;

      if (safeRemaining <= 0) {
        coil.status = InventoryStatus.DEPLETED;
      } else if (coil.status === InventoryStatus.RAW) {
        coil.status = InventoryStatus.IN_PROCESS;
      }

      await queryRunner.manager.save(coil);

      const movement = queryRunner.manager.create(InventoryMovement, {
        coilId: coil.id,
        type: MovementType.CUTTING_CONSUMPTION,
        weightDelta: -plan.totalProducedWeightKg,
        weightBalance: safeRemaining,
        referenceType: 'CUTTING_BATCH',
        referenceId: savedBatch.id,
        referenceCode: savedBatch.code,
        notes: `Cutting: ${savedBatch.sizeLabel} | ${savedBatch.piecesProduced} pieces, ${plan.totalProducedWeightKg.toFixed(3)} KG`,
        createdBy: createdBy ?? null,
      });

      await queryRunner.manager.save(movement);

      // Emit a tiny SCRAP movement for any per-row rounding leftover
      // (typically 0 or a few milligrams) so the audit trail matches
      // the planned weight to the gram. Skip zero entries.
      if (plan.wastageFromRoundingKg > 0) {
        const scrapMovement = queryRunner.manager.create(InventoryMovement, {
          coilId: coil.id,
          type: MovementType.SCRAP,
          weightDelta: -plan.wastageFromRoundingKg,
          weightBalance: safeRemaining,
          referenceType: 'CUTTING_BATCH',
          referenceId: savedBatch.id,
          referenceCode: savedBatch.code,
          notes: `Rounding scrap from cutting ${savedBatch.code}: ${plan.wastageFromRoundingKg.toFixed(3)} KG`,
          createdBy: createdBy ?? null,
        });
        await queryRunner.manager.save(scrapMovement);
      }

      await queryRunner.commitTransaction();

      const first = summaries[0];
      const tail: FinishedChaddarStock[] = summaries
        .slice(1)
        .map((s) => s.stock);
      const mergedStock: FinishedChaddarStock = first.stock;
      const enrichedBatch: CuttingBatch = Object.assign(savedBatch, {
        finishedStocks: [first.stock, ...tail],
      });
      void enrichedBatch;

      return {
        cuttingBatch: savedBatch,
        finishedStock: mergedStock,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Backwards-compat alias kept so old single-size service callers keep
   * working. Internally forwards to the new multi-row `create`.
   */
  async createLegacySingleSize(
    sourceCoilId: number,
    payload: {
      sizeLabel: string;
      piecesProduced: number;
      cuttingWeightKg?: number;
      weightPerPieceKg?: number;
      productionDate: string;
      note?: string;
    },
    createdBy?: string,
  ): Promise<CuttingBatchWithStock> {
    const rows = normalizeCuttingRows([
      {
        lengthFt: 10,
        quantity: payload.piecesProduced,
      },
    ]);

    const newDto: CreateCuttingBatchDto = {
      sizeLabel: payload.sizeLabel,
      rows: rows.map((r) => ({
        lengthFt: r.lengthFt,
        quantity: r.quantity,
      })),
      productionDate: payload.productionDate,
      note: payload.note,
    };

    if (payload.cuttingWeightKg != null) {
      newDto.usableCoilWeightKg = payload.cuttingWeightKg;
    } else if (payload.weightPerPieceKg != null) {
      newDto.usableCoilWeightKg =
        payload.weightPerPieceKg * payload.piecesProduced;
    }

    return this.create(sourceCoilId, newDto, createdBy);
  }

  async adjustStockWeight(
    stockId: number,
    newRemainingWeightKg: number,
    createdBy?: string,
  ): Promise<FinishedChaddarStock> {
    if (!(newRemainingWeightKg >= 0)) {
      throw new BadRequestException('New weight must be zero or greater');
    }
    if (!Number.isFinite(newRemainingWeightKg)) {
      throw new BadRequestException('New weight must be a finite number');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const stock = await queryRunner.manager.findOne(FinishedChaddarStock, {
        where: { id: stockId },
      });
      if (!stock) {
        throw new NotFoundException('Finished chaddar stock not found');
      }

      const adjusted = ROUND_KG(newRemainingWeightKg);
      const previous = Number(stock.remainingWeightKg);
      const delta = ROUND_KG(adjusted - previous);

      stock.remainingWeightKg = adjusted;

      const pieces = stock.remainingPieces || stock.piecesProduced;
      if (pieces > 0) {
        stock.weightPerPieceKg = ROUND_KG(adjusted / pieces);
      }

      if (stock.remainingPieces <= 0 || adjusted <= 0) {
        stock.status = FinishedChaddarStatus.SOLD_OUT;
      } else if (stock.remainingPieces < stock.piecesProduced) {
        stock.status = FinishedChaddarStatus.PARTIALLY_SOLD;
      } else {
        stock.status = FinishedChaddarStatus.AVAILABLE;
      }

      const saved = await queryRunner.manager.save(stock);

      const movement = queryRunner.manager.create(InventoryMovement, {
        coilId: stock.sourceCoilId,
        type: MovementType.ADJUSTMENT,
        weightDelta: delta,
        weightBalance: Number(
          (
            await queryRunner.manager.findOne(Coil, {
              where: { id: stock.sourceCoilId },
            })
          )?.currentWeight ?? 0,
        ),
        referenceType: 'FINISHED_STOCK_ADJUSTMENT',
        referenceId: stock.id,
        referenceCode: stock.code,
        notes: `Adjusted weight on ${stock.code}: ${previous.toFixed(3)} → ${adjusted.toFixed(3)} KG`,
        createdBy: createdBy ?? null,
      });
      await queryRunner.manager.save(movement);

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findByCoil(sourceCoilId: number): Promise<CuttingBatchWithStock[]> {
    const batches = await this.cuttingBatchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.finishedStocks', 'stock')
      .leftJoinAndSelect('batch.priceCategory', 'priceCategory')
      .leftJoinAndSelect('stock.priceCategory', 'stockPriceCategory')
      .where('batch.sourceCoilId = :sourceCoilId', { sourceCoilId })
      .orderBy('batch.productionDate', 'DESC')
      .addOrderBy('batch.createdAt', 'DESC')
      .getMany();

    return batches.map((batch) => {
      const stocks = (batch.finishedStocks ?? []).slice();
      stocks.sort((a, b) => {
        const la = (a as unknown as { lengthFt?: number | null }).lengthFt ?? 0;
        const lb = (b as unknown as { lengthFt?: number | null }).lengthFt ?? 0;
        return la - lb;
      });
      const first = stocks[0];
      if (!first) {
        throw new Error(
          `Finished stock missing for cutting batch ${batch.code}. Data integrity error.`,
        );
      }
      return { cuttingBatch: batch, finishedStock: first };
    });
  }

  async findAll(): Promise<FinishedChaddarStock[]> {
    return this.finishedStockRepository.find({
      relations: { priceCategory: true },
      order: { productionDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOneStock(id: number): Promise<FinishedChaddarStock> {
    const stock = await this.finishedStockRepository.findOne({
      where: { id },
      relations: { priceCategory: true },
    });
    if (!stock) {
      throw new NotFoundException('Finished chaddar stock not found');
    }
    return stock;
  }

  async findOneBatch(id: number): Promise<CuttingBatch> {
    const batch = await this.cuttingBatchRepository.findOne({
      where: { id },
      relations: { finishedStocks: true },
    });
    if (!batch) {
      throw new NotFoundException('Cutting batch not found');
    }
    return batch;
  }

  /** Backwards-compat: price category lookup still used by the controller if needed. */
  getPriceCategorySnapshot(ratePaisa: number): number {
    return Number(ratePaisa);
  }

  /** Resolve the default selling rate for a stock (uses category if present). */
  async getDefaultSellingRatePaisa(
    stock: FinishedChaddarStock,
  ): Promise<number> {
    if (!stock.priceCategoryId) return 0;
    const cats = await this.priceCategoriesService.findAll();
    const cat = cats.find((c) => c.id === stock.priceCategoryId);
    return cat ? Number(cat.sellingRatePaisa) : 0;
  }
}

function buildHeadlineLabel(requested: string, plan: CuttingPlan): string {
  const trimmed = (requested ?? '').trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  const lengths = plan.rows.map((r) => `${r.lengthFt}ft`).join(', ');
  return `Multi (${lengths})`;
}
