import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Coil, InventoryStatus } from '../coils/entities/coil.entity';
import {
  FinishedChaddarStock,
  FinishedChaddarStatus,
} from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { PriceCategory } from '../price-categories/entities/price-category.entity';

export interface InventorySummary {
  rawCoils: {
    totalCoils: number;
    activeCoils: number;
    depletedCoils: number;
    totalCurrentWeightKg: number;
    totalWastageWeightKg: number;
    totalPurchaseAmountPaisa: number;
    totalRemainingCostValuePaisa: number;
  };
  finishedChaddar: {
    totalStockRows: number;
    sellableRows: number;
    partialRows: number;
    soldOutRows: number;
    totalRemainingPieces: number;
    totalRemainingWeightKg: number;
    totalFinishedCostValuePaisa: number;
  };
}

export interface FinishedStockRow {
  id: number;
  code: string;
  sizeLabel: string;
  thicknessMm: number | null;
  color: string | null;
  brand: string | null;
  sourceCoilId: number;
  sourceCoilCode: string | null;
  cuttingBatchId: number;
  remainingPieces: number;
  remainingWeightKg: number;
  totalWeightKg: number;
  weightPerPieceKg: number | null;
  finishedCostPerKgPaisa: number;
  totalProductionCostPaisa: number;
  remainingCostValuePaisa: number;
  status: FinishedChaddarStatus;
  productionDate: string;
  priceCategoryId: number | null;
  priceCategoryName: string | null;
  priceCategoryCode: string | null;
}

export interface FinishedStockFilters {
  search?: string;
  categoryId?: number;
  sizeLabel?: string;
  thicknessMm?: number;
  status?: FinishedChaddarStatus;
  coilId?: number;
}

export interface RawCoilRow {
  id: number;
  code: string;
  batchNumber: string | null;
  supplierId: number;
  supplierName: string | null;
  priceCategoryId: number | null;
  priceCategoryName: string | null;
  brand: string | null;
  color: string | null;
  width: number;
  thicknessMm: number | null;
  purchaseWeight: number;
  currentWeight: number;
  wastageWeight: number;
  purchaseRatePaisa: number;
  purchaseAmountPaisa: number;
  status: InventoryStatus;
  processingStatus: string;
  createdAt: string;
}

export interface RawCoilFilters {
  search?: string;
  supplierId?: number;
  status?: InventoryStatus;
  categoryId?: number;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Coil)
    private readonly coilRepository: Repository<Coil>,
    @InjectRepository(FinishedChaddarStock)
    private readonly stockRepository: Repository<FinishedChaddarStock>,
    @InjectRepository(PriceCategory)
    private readonly categoryRepository: Repository<PriceCategory>,
  ) {}

  /**
   * Returns screen-ready totals derived from persisted backend state. Uses
   * SQL aggregation so we never load all rows into Node just to add them up.
   */
  async getSummary(): Promise<InventorySummary> {
    const raw = await this.coilRepository
      .createQueryBuilder('c')
      .select('COUNT(*)', 'totalCoils')
      .addSelect(
        'SUM(CASE WHEN c.status <> :depleted THEN 1 ELSE 0 END)',
        'activeCoils',
      )
      .addSelect(
        'SUM(CASE WHEN c.status = :depleted THEN 1 ELSE 0 END)',
        'depletedCoils',
      )
      .addSelect('COALESCE(SUM(c.current_weight), 0)', 'totalCurrentWeightKg')
      .addSelect('COALESCE(SUM(c.wastage_weight), 0)', 'totalWastageWeightKg')
      .addSelect(
        'COALESCE(SUM(c.purchase_amount_paisa), 0)',
        'totalPurchaseAmountPaisa',
      )
      .setParameter('depleted', InventoryStatus.DEPLETED)
      .getRawOne<{
        totalCoils: string;
        activeCoils: string;
        depletedCoils: string;
        totalCurrentWeightKg: string;
        totalWastageWeightKg: string;
        totalPurchaseAmountPaisa: string;
      }>();

    // Finished-stock cost value is computed as
    // SUM(remaining_weight_kg × finished_cost_per_kg_paisa). SQLite returns
    // big integers so we round through Number for the JSON response.
    const finished = await this.stockRepository
      .createQueryBuilder('s')
      .select('COUNT(*)', 'totalStockRows')
      .addSelect(
        'SUM(CASE WHEN s.status = :available THEN 1 ELSE 0 END)',
        'sellableRows',
      )
      .addSelect(
        'SUM(CASE WHEN s.status = :partial THEN 1 ELSE 0 END)',
        'partialRows',
      )
      .addSelect(
        'SUM(CASE WHEN s.status = :soldOut THEN 1 ELSE 0 END)',
        'soldOutRows',
      )
      .addSelect('COALESCE(SUM(s.remaining_pieces), 0)', 'totalRemainingPieces')
      .addSelect(
        'COALESCE(SUM(s.remaining_weight_kg), 0)',
        'totalRemainingWeightKg',
      )
      .addSelect(
        'COALESCE(SUM(s.remaining_weight_kg * s.finished_cost_per_kg_paisa), 0)',
        'totalFinishedCostValuePaisa',
      )
      .setParameter('available', FinishedChaddarStatus.AVAILABLE)
      .setParameter('partial', FinishedChaddarStatus.PARTIALLY_SOLD)
      .setParameter('soldOut', FinishedChaddarStatus.SOLD_OUT)
      .getRawOne<{
        totalStockRows: string;
        sellableRows: string;
        partialRows: string;
        soldOutRows: string;
        totalRemainingPieces: string;
        totalRemainingWeightKg: string;
        totalFinishedCostValuePaisa: string;
      }>();

    return {
      rawCoils: {
        totalCoils: Number(raw?.totalCoils ?? 0),
        activeCoils: Number(raw?.activeCoils ?? 0),
        depletedCoils: Number(raw?.depletedCoils ?? 0),
        totalCurrentWeightKg: Number(raw?.totalCurrentWeightKg ?? 0),
        totalWastageWeightKg: Number(raw?.totalWastageWeightKg ?? 0),
        totalPurchaseAmountPaisa: Number(raw?.totalPurchaseAmountPaisa ?? 0),
        totalRemainingCostValuePaisa: Number(
          raw?.totalPurchaseAmountPaisa ?? 0,
        ),
      },
      finishedChaddar: {
        totalStockRows: Number(finished?.totalStockRows ?? 0),
        sellableRows: Number(finished?.sellableRows ?? 0),
        partialRows: Number(finished?.partialRows ?? 0),
        soldOutRows: Number(finished?.soldOutRows ?? 0),
        totalRemainingPieces: Number(finished?.totalRemainingPieces ?? 0),
        totalRemainingWeightKg: Number(finished?.totalRemainingWeightKg ?? 0),
        totalFinishedCostValuePaisa: Number(
          finished?.totalFinishedCostValuePaisa ?? 0,
        ),
      },
    };
  }

  /**
   * List finished chaddar stock with all filters the operator needs to
   * find a specific batch. Returns screen-ready rows with category names
   * already resolved so the UI does not need to join anything.
   */
  async listFinishedStock(
    filters: FinishedStockFilters,
  ): Promise<FinishedStockRow[]> {
    const qb = this.stockRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.priceCategory', 'priceCategory')
      .leftJoin('s.sourceCoil', 'coil')
      .addSelect(['coil.id', 'coil.code'])
      .orderBy('s.production_date', 'DESC')
      .addOrderBy('s.id', 'DESC');

    this.applyFinishedFilters(qb, filters);

    const rows = await qb.getMany();

    return rows.map((s) => {
      const remainingCostValuePaisa = Math.round(
        Number(s.remainingWeightKg) * Number(s.finishedCostPerKgPaisa),
      );
      return {
        id: s.id,
        code: s.code,
        sizeLabel: s.sizeLabel,
        thicknessMm: s.thicknessMm != null ? Number(s.thicknessMm) : null,
        color: s.color,
        brand: s.brand,
        sourceCoilId: s.sourceCoilId,
        sourceCoilCode: s.sourceCoil ? s.sourceCoil.code : null,
        cuttingBatchId: s.cuttingBatchId,
        remainingPieces: s.remainingPieces,
        remainingWeightKg: Number(s.remainingWeightKg),
        totalWeightKg: Number(s.totalWeightKg),
        weightPerPieceKg:
          s.weightPerPieceKg != null ? Number(s.weightPerPieceKg) : null,
        finishedCostPerKgPaisa: Number(s.finishedCostPerKgPaisa),
        totalProductionCostPaisa: Number(s.totalProductionCostPaisa),
        remainingCostValuePaisa,
        status: s.status,
        productionDate: new Date(s.productionDate).toISOString().split('T')[0],
        priceCategoryId: s.priceCategoryId,
        priceCategoryName: s.priceCategory?.name ?? null,
        priceCategoryCode: s.priceCategory?.code ?? null,
      };
    });
  }

  /**
   * Lightweight aggregation used to populate the size / gauge filters.
   * Returns the unique size labels and thickness values currently in stock
   * so the dropdown is data-driven.
   */
  async getFinishedStockFacets(): Promise<{
    sizeLabels: string[];
    thicknessMm: number[];
  }> {
    const sizes = await this.stockRepository
      .createQueryBuilder('s')
      .select('DISTINCT s.size_label', 'sizeLabel')
      .where('s.remaining_weight_kg > 0')
      .orderBy('sizeLabel', 'ASC')
      .getRawMany<{ sizeLabel: string }>();

    const thicknesses = await this.stockRepository
      .createQueryBuilder('s')
      .select('DISTINCT s.thickness_mm', 'thicknessMm')
      .where('s.remaining_weight_kg > 0')
      .andWhere('s.thickness_mm IS NOT NULL')
      .orderBy('thicknessMm', 'ASC')
      .getRawMany<{ thicknessMm: string | number }>();

    return {
      sizeLabels: sizes.map((s) => s.sizeLabel).filter(Boolean),
      thicknessMm: thicknesses
        .map((t) => Number(t.thicknessMm))
        .filter((n) => Number.isFinite(n)),
    };
  }

  /**
   * List raw coils in screen-ready form (no nested relations the UI doesn't
   * need). Used by the inventory overview when the operator wants to scan
   * raw material quickly without leaving the page.
   */
  async listRawCoils(filters: RawCoilFilters): Promise<RawCoilRow[]> {
    const qb = this.coilRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.supplier', 'supplier')
      .leftJoinAndSelect('c.priceCategory', 'priceCategory')
      .orderBy('c.created_at', 'DESC');

    if (filters.supplierId) {
      qb.andWhere('c.supplier_id = :supplierId', {
        supplierId: filters.supplierId,
      });
    }
    if (filters.status) {
      qb.andWhere('c.status = :status', { status: filters.status });
    }
    if (filters.categoryId) {
      qb.andWhere('c.price_category_id = :categoryId', {
        categoryId: filters.categoryId,
      });
    } else if (filters.search) {
      const search = `%${filters.search}%`;
      qb.andWhere(
        '(c.code LIKE :search OR c.batch_number LIKE :search OR supplier.name LIKE :search)',
        { search },
      );
    }

    const coils = await qb.getMany();

    return coils.map((c) => ({
      id: c.id,
      code: c.code,
      batchNumber: c.batchNumber,
      supplierId: c.supplierId,
      supplierName: c.supplier?.name ?? null,
      priceCategoryId: c.priceCategoryId,
      priceCategoryName: c.priceCategory?.name ?? null,
      brand: c.brand,
      color: c.color,
      width: Number(c.width ?? 0),
      thicknessMm: c.thicknessMm != null ? Number(c.thicknessMm) : null,
      purchaseWeight: Number(c.purchaseWeight),
      currentWeight: Number(c.currentWeight),
      wastageWeight: Number(c.wastageWeight),
      purchaseRatePaisa: Number(c.purchaseRatePaisa),
      purchaseAmountPaisa: Number(c.purchaseAmountPaisa),
      status: c.status,
      processingStatus: c.processingStatus,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  private applyFinishedFilters(
    qb: SelectQueryBuilder<FinishedChaddarStock>,
    filters: FinishedStockFilters,
  ): void {
    if (filters.status) {
      qb.andWhere('s.status = :status', { status: filters.status });
    }
    if (filters.categoryId) {
      qb.andWhere('s.price_category_id = :categoryId', {
        categoryId: filters.categoryId,
      });
    }
    if (filters.sizeLabel && filters.sizeLabel.trim().length > 0) {
      qb.andWhere('s.size_label = :sizeLabel', {
        sizeLabel: filters.sizeLabel.trim(),
      });
    }
    if (filters.thicknessMm != null && Number.isFinite(filters.thicknessMm)) {
      qb.andWhere('s.thickness_mm = :thicknessMm', {
        thicknessMm: filters.thicknessMm,
      });
    }
    if (filters.coilId) {
      qb.andWhere('s.source_coil_id = :coilId', { coilId: filters.coilId });
    }
    if (filters.search && filters.search.trim().length > 0) {
      const search = `%${filters.search.trim()}%`;
      qb.andWhere(
        '(s.code LIKE :search OR s.size_label LIKE :search OR s.color LIKE :search)',
        { search },
      );
    }
  }
}
