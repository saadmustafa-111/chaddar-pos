import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Coil,
  InventoryStatus,
  ProcessingStatus,
} from './entities/coil.entity';
import { UpdateCoilProcessingDto } from './dto/update-coil-processing.dto';
import { UpdateCoilDto } from './dto/update-coil.dto';
import {
  InventoryMovement,
  MovementType,
} from '../inventory-movements/entities/inventory-movement.entity';
import { LandingExpensesService } from '../landing-expenses/landing-expenses.service';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import {
  coilKgPerFoot,
  CoilHistoryRow,
  CoilSpecForFeet,
} from '../cutting-batches/calculation';

export interface CoilFilters {
  search?: string;
  supplierId?: number;
  status?: InventoryStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface FinishedCostSummary {
  coilId: number;
  coilCode: string;
  purchaseCostPaisa: number;
  additionalExpensesPaisa: number;
  totalInvestedCostPaisa: number;
  originalWeightKg: number;
  wastageWeightKg: number;
  remainingUsableWeightKg: number;
  finishedCostPerKgPaisa: number;
}

@Injectable()
export class CoilsService {
  constructor(
    @InjectRepository(Coil)
    private readonly coilRepository: Repository<Coil>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepository: Repository<InventoryMovement>,
    @InjectRepository(FinishedChaddarStock)
    private readonly stockRepository: Repository<FinishedChaddarStock>,
    private readonly dataSource: DataSource,
    private readonly landingExpensesService: LandingExpensesService,
  ) {}

  async findAll(filters?: CoilFilters): Promise<Coil[]> {
    const queryBuilder = this.coilRepository
      .createQueryBuilder('coil')
      .leftJoinAndSelect('coil.supplier', 'supplier')
      .leftJoinAndSelect('coil.purchase', 'purchase')
      .leftJoinAndSelect('coil.materialFamily', 'materialFamily')
      .leftJoinAndSelect('coil.priceCategory', 'priceCategory')
      .orderBy('coil.createdAt', 'DESC');

    if (filters?.supplierId) {
      queryBuilder.andWhere('coil.supplierId = :supplierId', {
        supplierId: filters.supplierId,
      });
    }

    if (filters?.status) {
      queryBuilder.andWhere('coil.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.dateFrom) {
      queryBuilder.andWhere('coil.createdAt >= :dateFrom', {
        dateFrom: new Date(filters.dateFrom),
      });
    }

    if (filters?.dateTo) {
      queryBuilder.andWhere('coil.createdAt <= :dateTo', {
        dateTo: new Date(filters.dateTo),
      });
    }

    if (filters?.search) {
      const search = `%${filters.search}%`;
      queryBuilder.andWhere(
        '(coil.code LIKE :search OR coil.batchNumber LIKE :search OR purchase.code LIKE :search OR supplier.name LIKE :search)',
        { search },
      );
    }

    const coils = await queryBuilder.getMany();
    // Attach the lightweight kg/foot snapshot in one batch - keeps
    // the list view snappy and avoids N+1 round-trips per row.
    return Promise.all(coils.map((coil) => this.attachKgPerFoot(coil)));
  }

  async findOne(id: number): Promise<Coil> {
    const coil = await this.coilRepository.findOne({
      where: { id },
      relations: {
        supplier: true,
        purchase: true,
        materialFamily: true,
        priceCategory: true,
      },
    });

    if (!coil) {
      throw new NotFoundException('Coil not found');
    }

    return this.attachKgPerFoot(coil);
  }

  /**
   * Lightweight helper used by the Move-to-Plane UI to show a sensible
   * feet preview before the operator commits. Returns the kg/foot for
   * a coil - prefers measured history, falls back to theoretical
   * density.
   */
  async getKgPerFoot(coilId: number): Promise<number | null> {
    const coil = await this.coilRepository.findOne({
      where: { id: coilId },
    });
    if (!coil) {
      throw new NotFoundException('Coil not found');
    }
    const history = await this.loadHistory(coil.id);
    const spec: CoilSpecForFeet = {
      widthMm: coil.width != null ? Number(coil.width) : null,
      thicknessMm: coil.thicknessMm != null ? Number(coil.thicknessMm) : null,
    };
    return coilKgPerFoot(spec, history);
  }

  private async attachKgPerFoot(coil: Coil): Promise<Coil> {
    const history = await this.loadHistory(coil.id);
    const spec: CoilSpecForFeet = {
      widthMm: coil.width != null ? Number(coil.width) : null,
      thicknessMm: coil.thicknessMm != null ? Number(coil.thicknessMm) : null,
    };
    (coil as Coil & { lastKgPerFoot?: number | null }).lastKgPerFoot =
      coilKgPerFoot(spec, history);
    return coil;
  }

  private async loadHistory(coilId: number): Promise<CoilHistoryRow[]> {
    const rows = await this.stockRepository.find({
      where: { sourceCoilId: coilId },
      order: { productionDate: 'DESC', id: 'DESC' },
      take: 20,
    });
    return rows.map((r) => ({
      weightPerPieceKg:
        r.weightPerPieceKg != null ? Number(r.weightPerPieceKg) : null,
      lengthFt: r.lengthFt != null ? Number(r.lengthFt) : null,
    }));
  }

  async getMovements(coilId: number): Promise<InventoryMovement[]> {
    const coil = await this.findOne(coilId);

    return this.movementRepository.find({
      where: { coilId: coil.id },
      order: { createdAt: 'ASC' },
    });
  }

  async updateProcessing(
    coilId: number,
    dto: UpdateCoilProcessingDto,
  ): Promise<Coil> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const coil = await queryRunner.manager.findOne(Coil, {
        where: { id: coilId },
      });

      if (!coil) {
        throw new NotFoundException('Coil not found');
      }

      const oldWastage = Number(coil.wastageWeight ?? 0);
      const newWastage =
        dto.wastageWeight !== undefined
          ? Number(dto.wastageWeight)
          : oldWastage;

      if (newWastage < 0) {
        throw new BadRequestException('Wastage weight cannot be negative');
      }

      const currentWeight = Number(coil.currentWeight);
      const maxAvailable = currentWeight + oldWastage;

      if (newWastage > maxAvailable) {
        throw new BadRequestException(
          `Wastage (${newWastage.toFixed(3)} KG) cannot exceed available coil weight (${maxAvailable.toFixed(3)} KG)`,
        );
      }

      const delta = newWastage - oldWastage;

      if (delta !== 0) {
        const newCurrentWeight = currentWeight - delta;
        coil.currentWeight = Math.round(newCurrentWeight * 1000) / 1000;

        const movementType =
          delta > 0 ? MovementType.SCRAP : MovementType.ADJUSTMENT;
        const movement = queryRunner.manager.create(InventoryMovement, {
          coilId: coil.id,
          type: movementType,
          weightDelta: -delta,
          weightBalance: coil.currentWeight,
          referenceType: 'PROCESSING',
          referenceId: coil.id,
          referenceCode: coil.code,
          notes:
            delta > 0
              ? `Processing wastage recorded: ${newWastage.toFixed(3)} KG`
              : `Processing wastage adjusted: ${(-delta).toFixed(3)} KG returned to stock`,
          createdBy: null,
        });

        await queryRunner.manager.save(movement);
      }

      if (dto.processingStatus !== undefined) {
        coil.processingStatus = dto.processingStatus;
      }

      if (dto.processingDate !== undefined) {
        coil.processingDate = dto.processingDate
          ? new Date(dto.processingDate)
          : null;
      }

      if (dto.processingNote !== undefined) {
        coil.processingNote =
          dto.processingNote && dto.processingNote.trim().length > 0
            ? dto.processingNote.trim()
            : null;
      }

      coil.wastageWeight = Math.round(newWastage * 1000) / 1000;

      const nextProcessingStatus =
        dto.processingStatus ?? coil.processingStatus;

      if (
        nextProcessingStatus === ProcessingStatus.COMPLETED &&
        Number(coil.wastageWeight) > 0
      ) {
        coil.status = InventoryStatus.FINISHED;
      } else if (
        nextProcessingStatus === ProcessingStatus.IN_PROGRESS &&
        coil.status === InventoryStatus.RAW
      ) {
        coil.status = InventoryStatus.IN_PROCESS;
      } else if (
        nextProcessingStatus === ProcessingStatus.NOT_STARTED &&
        coil.status !== InventoryStatus.DEPLETED
      ) {
        coil.status = InventoryStatus.RAW;
      }

      const saved = await queryRunner.manager.save(coil);
      await queryRunner.commitTransaction();

      return this.findOne(saved.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getFinishedCost(coilId: number): Promise<FinishedCostSummary> {
    const coil = await this.findOne(coilId);

    const additionalExpensesPaisa =
      await this.landingExpensesService.calculateTotalLandingExpenses(coilId);

    const purchaseCostPaisa = Number(coil.purchaseAmountPaisa);
    const totalInvestedCostPaisa = purchaseCostPaisa + additionalExpensesPaisa;

    const originalWeightKg = Number(coil.purchaseWeight);
    const wastageWeightKg = Number(coil.wastageWeight);
    const remainingUsableWeightKg = Math.max(0, Number(coil.currentWeight));

    const finishedCostPerKgPaisa =
      remainingUsableWeightKg > 0
        ? Math.round(totalInvestedCostPaisa / remainingUsableWeightKg)
        : 0;

    return {
      coilId: coil.id,
      coilCode: coil.code,
      purchaseCostPaisa,
      additionalExpensesPaisa,
      totalInvestedCostPaisa,
      originalWeightKg,
      wastageWeightKg,
      remainingUsableWeightKg,
      finishedCostPerKgPaisa,
    };
  }

  async update(id: number, dto: UpdateCoilDto): Promise<Coil> {
    const coil = await this.coilRepository.findOne({ where: { id } });
    if (!coil) {
      throw new NotFoundException('Coil not found');
    }

    if (dto.location !== undefined) {
      coil.location = dto.location;
    }
    if (dto.notes !== undefined) {
      coil.notes = dto.notes;
    }

    return this.coilRepository.save(coil);
  }

  async delete(id: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const coil = await queryRunner.manager.findOne(Coil, {
        where: { id },
        relations: {
          cuttingBatches: true,
          finishedStocks: true,
          planeStocks: true,
        },
      });

      if (!coil) {
        throw new NotFoundException('Coil not found');
      }

      if (coil.cuttingBatches && coil.cuttingBatches.length > 0) {
        throw new BadRequestException(
          `Cannot delete coil ${coil.code} because it has cutting history`,
        );
      }

      if (coil.finishedStocks && coil.finishedStocks.length > 0) {
        throw new BadRequestException(
          `Cannot delete coil ${coil.code} because it has finished stock entries`,
        );
      }

      if (coil.planeStocks && coil.planeStocks.length > 0) {
        throw new BadRequestException(
          `Cannot delete coil ${coil.code} because it has plane stock entries`,
        );
      }

      const movements = await queryRunner.manager.find(InventoryMovement, {
        where: { coilId: id },
      });

      const nonPurchaseMovements = movements.filter(
        (m) => m.type !== MovementType.PURCHASE_RECEIPT,
      );

      if (nonPurchaseMovements.length > 0) {
        throw new BadRequestException(
          `Cannot delete coil ${coil.code} because it has inventory movements other than the initial purchase receipt`,
        );
      }

      await queryRunner.manager.remove(coil);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
