import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Coil, InventoryStatus } from '../coils/entities/coil.entity';
import {
  FinishedChaddarStock,
  FinishedChaddarStatus,
} from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { PriceCategory } from '../price-categories/entities/price-category.entity';
import { CurrentMarketRatesService } from '../current-market-rates/current-market-rates.service';

export interface InventorySummary {
  rawCoils: {
    totalCoils: number;
    activeCoils: number;
    depletedCoils: number;
    totalCurrentWeightKg: number;
    totalWastageWeightKg: number;
    totalPurchaseAmountPaisa: number;
    totalRemainingCostValuePaisa: number;
    totalReplacementValuePaisa: number;
  };
  finishedChaddar: {
    totalStockRows: number;
    sellableRows: number;
    partialRows: number;
    soldOutRows: number;
    totalRemainingPieces: number;
    totalRemainingWeightKg: number;
    totalFinishedCostValuePaisa: number;
    totalReplacementValuePaisa: number;
  };
}

export interface FinishedStockRow {
  id: number;
  code: string;
  heatNumber: string | null;
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
  replacementCostPerKgPaisa: number;
  replacementValuePaisa: number;
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
  replacementCostPerKgPaisa: number;
  replacementValuePaisa: number;
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
    private readonly marketRatesService: CurrentMarketRatesService,
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

    const rawReplacementValue = await this.computeRawCoilsReplacementValue();
    const finishedReplacementValue =
      await this.computeFinishedStockReplacementValue();

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
        totalReplacementValuePaisa: rawReplacementValue,
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
        totalReplacementValuePaisa: finishedReplacementValue,
      },
    };
  }

  private async computeRawCoilsReplacementValue(): Promise<number> {
    type CoilRawRow = { materialFamilyId: number; currentWeight: number };

    const rawCoils: any[] = await this.coilRepository
      .createQueryBuilder('c')
      .select('c.material_family_id', 'materialFamilyId')
      .addSelect('c.current_weight', 'currentWeight')
      .where('c.status <> :depleted', { depleted: InventoryStatus.DEPLETED })
      .andWhere('c.material_family_id IS NOT NULL')
      .getRawMany();

    const coils = rawCoils as CoilRawRow[];

    if (coils.length === 0) return 0;

    const familyIds = [...new Set(coils.map((c) => c.materialFamilyId))];
    const familyCosts = await Promise.all(
      familyIds.map((id) =>
        this.marketRatesService.getReplacementCostForFamily(id),
      ),
    );
    const costByFamily: Record<number, number> = Object.fromEntries(
      familyIds.map((id, i) => [id, familyCosts[i].replacementCostPerKgPaisa]),
    );

    let total = 0;
    for (const coil of coils) {
      const cost = costByFamily[coil.materialFamilyId] ?? 0;
      total += Number(coil.currentWeight) * cost;
    }
    return Math.round(total);
  }

  private async computeFinishedStockReplacementValue(): Promise<number> {
    type StockRawRow = {
      materialFamilyId: number | null;
      remainingWeight: number;
    };

    const rawRows: any[] = await this.stockRepository
      .createQueryBuilder('s')
      .select('coil.material_family_id', 'materialFamilyId')
      .addSelect('s.remaining_weight_kg', 'remainingWeight')
      .leftJoin('s.sourceCoil', 'coil')
      .where('s.remaining_weight_kg > 0')
      .getRawMany();

    const rows = rawRows as StockRawRow[];

    if (rows.length === 0) return 0;

    const familyIds = rows
      .map((r) => r.materialFamilyId)
      .filter((id): id is number => id !== null && id !== undefined);
    const uniqueFamilyIds = [...new Set(familyIds)];
    const familyCosts = await Promise.all(
      uniqueFamilyIds.map((id) =>
        this.marketRatesService.getReplacementCostForFamily(id),
      ),
    );
    const costByFamily: Record<number, number> = Object.fromEntries(
      uniqueFamilyIds.map((id, i) => [
        id,
        familyCosts[i].replacementCostPerKgPaisa,
      ]),
    );

    let total = 0;
    for (const row of rows) {
      if (!row.materialFamilyId) continue;
      const cost = costByFamily[row.materialFamilyId] ?? 0;
      total += Number(row.remainingWeight) * cost;
    }
    return Math.round(total);
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
      .addSelect(['coil.id', 'coil.code', 'coil.material_family_id'])
      .orderBy('s.production_date', 'DESC')
      .addOrderBy('s.id', 'DESC');

    this.applyFinishedFilters(qb, filters);

    const rows = await qb.getMany();

    const results: FinishedStockRow[] = [];

    for (const s of rows) {
      const remainingCostValuePaisa = Math.round(
        Number(s.remainingWeightKg) * Number(s.finishedCostPerKgPaisa),
      );

      const familyId = s.sourceCoil?.materialFamilyId ?? 0;
      let replacementCostPerKgPaisa = 0;
      if (familyId > 0) {
        const { replacementCostPerKgPaisa: rcp } =
          await this.marketRatesService.getReplacementCostForFamily(familyId);
        replacementCostPerKgPaisa = rcp;
      }
      const replacementValuePaisa =
        replacementCostPerKgPaisa > 0
          ? Math.round(Number(s.remainingWeightKg) * replacementCostPerKgPaisa)
          : 0;

      results.push({
        id: s.id,
        code: s.code,
        heatNumber: s.heatNumber,
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
        replacementCostPerKgPaisa,
        replacementValuePaisa,
        status: s.status,
        productionDate: new Date(s.productionDate).toISOString().split('T')[0],
        priceCategoryId: s.priceCategoryId,
        priceCategoryName: s.priceCategory?.name ?? null,
        priceCategoryCode: s.priceCategory?.code ?? null,
      });
    }

    return results;
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

    const results: RawCoilRow[] = [];

    for (const c of coils) {
      const familyId = c.materialFamilyId ?? 0;
      let replacementCostPerKgPaisa = 0;
      if (familyId > 0) {
        const { replacementCostPerKgPaisa: rcp } =
          await this.marketRatesService.getReplacementCostForFamily(familyId);
        replacementCostPerKgPaisa = rcp;
      }
      const replacementValuePaisa =
        replacementCostPerKgPaisa > 0
          ? Math.round(Number(c.purchaseWeight) * replacementCostPerKgPaisa)
          : 0;

      results.push({
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
        replacementCostPerKgPaisa,
        replacementValuePaisa,
      });
    }

    return results;
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
      const exactSearch = filters.search.trim();
      qb.andWhere(
        '(s.code LIKE :search OR s.size_label LIKE :search OR s.color LIKE :search OR s.heat_number LIKE :search)',
        { search },
      );
      qb.orderBy(
        `(CASE WHEN s.heat_number = '${exactSearch}' THEN 0 ELSE 1 END)`,
      );
    }
  }
}
