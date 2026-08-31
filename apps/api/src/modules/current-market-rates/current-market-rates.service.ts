import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentMarketRate } from './entities/current-market-rate.entity';
import { MarketRateHistory } from './entities/market-rate-history.entity';
import { UpdateMarketRateDto } from './dto/update-market-rate.dto';
import { Coil, InventoryStatus } from '../coils/entities/coil.entity';
import { CoilLandingExpense } from '../landing-expenses/entities/coil-landing-expense.entity';
import { MaterialFamiliesService } from '../material-families/material-families.service';

export interface MarketRateWithFamily {
  id: number;
  materialFamilyId: number;
  familyCode: string;
  familyName: string;
  rawMaterialRatePaisa: number;
  effectiveFrom: string;
  notes: string | null;
  updatedAt: string;
}

export interface ReplacementCostResult {
  rawMaterialRatePaisa: number;
  avgLandedCostPerKgPaisa: number | null;
  replacementCostPerKgPaisa: number;
}

export interface MarketRateHistoryEntry {
  id: number;
  rawMaterialRatePaisa: number;
  effectiveFrom: string;
  notes: string | null;
  createdAt: string;
}

export interface MarketRateDisplayRow {
  materialFamilyId: number;
  familyCode: string;
  familyName: string;
  rawMaterialRatePaisa: number;
  effectiveFrom: string | null;
  notes: string | null;
  updatedAt: string | null;
  hasRate: boolean;
}

@Injectable()
export class CurrentMarketRatesService {
  constructor(
    @InjectRepository(CurrentMarketRate)
    private readonly rateRepository: Repository<CurrentMarketRate>,
    @InjectRepository(MarketRateHistory)
    private readonly historyRepository: Repository<MarketRateHistory>,
    @InjectRepository(Coil)
    private readonly coilRepository: Repository<Coil>,
    @InjectRepository(CoilLandingExpense)
    private readonly landingExpenseRepository: Repository<CoilLandingExpense>,
    private readonly materialFamiliesService: MaterialFamiliesService,
  ) {}

  async getRateByFamily(familyId: number): Promise<CurrentMarketRate | null> {
    return this.rateRepository.findOne({
      where: { materialFamilyId: familyId },
    });
  }

  async upsertRate(
    familyId: number,
    dto: UpdateMarketRateDto,
  ): Promise<CurrentMarketRate> {
    let rate = await this.rateRepository.findOne({
      where: { materialFamilyId: familyId },
    });

    const effectiveFrom =
      dto.effectiveFrom ?? new Date().toISOString().split('T')[0];

    if (!rate) {
      rate = this.rateRepository.create({
        materialFamilyId: familyId,
      });
    }

    if (dto.rawMaterialRatePaisa !== undefined) {
      const historyEntry = this.historyRepository.create({
        materialFamilyId: familyId,
        rawMaterialRatePaisa: dto.rawMaterialRatePaisa,
        effectiveFrom,
        notes: dto.notes ?? null,
      });
      await this.historyRepository.save(historyEntry);

      rate.rawMaterialRatePaisa = dto.rawMaterialRatePaisa;
      rate.effectiveFrom = effectiveFrom;
      rate.notes = dto.notes ?? null;
    } else {
      if (dto.effectiveFrom !== undefined) {
        rate.effectiveFrom = dto.effectiveFrom;
      } else if (!rate.effectiveFrom) {
        rate.effectiveFrom = effectiveFrom;
      }
      if (dto.notes !== undefined) {
        rate.notes = dto.notes ?? null;
      }
    }

    return this.rateRepository.save(rate);
  }

  async findAll(): Promise<MarketRateWithFamily[]> {
    const rates = await this.rateRepository.find({
      order: { materialFamilyId: 'ASC' },
    });

    return rates.map((r) => ({
      id: r.id,
      materialFamilyId: r.materialFamilyId,
      familyCode: r.materialFamily?.code ?? String(r.materialFamilyId),
      familyName: r.materialFamily?.name ?? 'Unknown',
      rawMaterialRatePaisa: Number(r.rawMaterialRatePaisa),
      effectiveFrom: r.effectiveFrom,
      notes: r.notes,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async findAllForDisplay(): Promise<MarketRateDisplayRow[]> {
    const families = await this.materialFamiliesService.findActive();
    const rates = await this.rateRepository.find();

    const rateByFamily = new Map(rates.map((r) => [r.materialFamilyId, r]));

    return families.map((f) => {
      const rate = rateByFamily.get(f.id);
      return {
        materialFamilyId: f.id,
        familyCode: f.code,
        familyName: f.name,
        rawMaterialRatePaisa: rate ? Number(rate.rawMaterialRatePaisa) : 0,
        effectiveFrom: rate?.effectiveFrom ?? null,
        notes: rate?.notes ?? null,
        updatedAt: rate?.updatedAt ? rate.updatedAt.toISOString() : null,
        hasRate: !!rate,
      };
    });
  }

  async getHistory(familyId: number): Promise<MarketRateHistoryEntry[]> {
    const entries = await this.historyRepository.find({
      where: { materialFamilyId: familyId },
      order: { effectiveFrom: 'DESC', createdAt: 'DESC' },
    });

    return entries.map((e) => ({
      id: e.id,
      rawMaterialRatePaisa: Number(e.rawMaterialRatePaisa),
      effectiveFrom: e.effectiveFrom,
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async getReplacementCostForFamily(
    familyId: number,
  ): Promise<ReplacementCostResult> {
    const rate = await this.getRateByFamily(familyId);
    const rawRatePaisa = rate ? Number(rate.rawMaterialRatePaisa) : 0;

    if (rawRatePaisa === 0) {
      return {
        rawMaterialRatePaisa: 0,
        avgLandedCostPerKgPaisa: null,
        replacementCostPerKgPaisa: 0,
      };
    }

    const { avgLandedCostPerKg, avgPurchaseRatePerKg } =
      await this.computeLandedCostBreakdownForFamily(familyId);

    let replacementCostPerKgPaisa: number;
    if (avgLandedCostPerKg !== null && avgPurchaseRatePerKg !== null) {
      const avgLandingOverheadPerKg = avgLandedCostPerKg - avgPurchaseRatePerKg;
      replacementCostPerKgPaisa = rawRatePaisa + avgLandingOverheadPerKg;
    } else {
      replacementCostPerKgPaisa = rawRatePaisa;
    }

    return {
      rawMaterialRatePaisa: rawRatePaisa,
      avgLandedCostPerKgPaisa: avgLandedCostPerKg,
      replacementCostPerKgPaisa,
    };
  }

  private async computeLandedCostBreakdownForFamily(familyId: number): Promise<{
    avgLandedCostPerKg: number | null;
    avgPurchaseRatePerKg: number | null;
  }> {
    const coils = await this.coilRepository.find({
      where: {
        materialFamilyId: familyId,
        status: InventoryStatus.RAW,
      },
    });

    if (coils.length === 0) {
      return { avgLandedCostPerKg: null, avgPurchaseRatePerKg: null };
    }

    let totalLandedCostPaisa = 0;
    let totalPurchaseCostPaisa = 0;
    let totalWeightKg = 0;

    for (const coil of coils) {
      const purchaseRatePaisa = Number(coil.purchaseRatePaisa);
      const purchaseWeight = Number(coil.purchaseWeight);

      if (purchaseWeight <= 0 || isNaN(purchaseRatePaisa)) continue;

      const purchaseCostPaisa = purchaseRatePaisa * purchaseWeight;

      const landingExpenses = await this.landingExpenseRepository
        .createQueryBuilder('exp')
        .select('COALESCE(SUM(exp.amount_paisa), 0)', 'totalLanding')
        .where('exp.coil_id = :coilId', { coilId: coil.id })
        .getRawOne<{ totalLanding: string | number }>();

      const landedCostPaisa =
        purchaseCostPaisa + Number(landingExpenses?.totalLanding ?? 0);

      totalLandedCostPaisa += landedCostPaisa;
      totalPurchaseCostPaisa += purchaseCostPaisa;
      totalWeightKg += purchaseWeight;
    }

    if (totalWeightKg <= 0) {
      return { avgLandedCostPerKg: null, avgPurchaseRatePerKg: null };
    }

    return {
      avgLandedCostPerKg: Math.round(totalLandedCostPaisa / totalWeightKg),
      avgPurchaseRatePerKg: Math.round(totalPurchaseCostPaisa / totalWeightKg),
    };
  }
}
