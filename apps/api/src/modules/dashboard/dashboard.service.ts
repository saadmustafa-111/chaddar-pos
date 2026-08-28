import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Coil } from '../coils/entities/coil.entity';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { PlaneStock } from '../plane-stock/entities/plane-stock.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CustomerLedgerEntry } from '../customers/entities/customer-ledger-entry.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SupplierLedgerEntry } from '../suppliers/entities/supplier-ledger-entry.entity';
import { CustomersService } from '../customers/customers.service';
import { ExpensesService } from '../expenses/expenses.service';

/**
 * Lightweight view-models returned by the analytics endpoint. All money
 * values are in paisa; all weights in KG.
 */
export interface DashboardKpis {
  totalSalesPaisa: number;
  totalProfitPaisa: number;
  totalReceivedPaisa: number;
  totalReceivablePaisa: number;
  totalPayablePaisa: number;
  inventoryValuePaisa: number;
  totalSalesCount: number;
  todaysSalesPaisa: number;
  todaysSalesCount: number;
  todaysProfitPaisa: number;
  rawCoilKg: number;
  finishedStockKg: number;
  planeStockKg: number;
  totalExpensesPaisa: number;
  periodExpensesPaisa: number;
  netProfitPaisa: number;
}

export interface DashboardTimeSeriesPoint {
  /** YYYY-MM-DD for daily, YYYY-Www for weekly, YYYY-MM for monthly. */
  bucket: string;
  /** Human-friendly label, e.g. "Mon 25" or "Aug 25". */
  label: string;
  salesPaisa: number;
  profitPaisa: number;
  salesCount: number;
}

export interface DashboardRecentSale {
  id: number;
  code: string;
  customerId: number | null;
  customerName: string | null;
  totalAmountPaisa: number;
  paidAmountPaisa: number;
  dueAmountPaisa: number;
  paymentStatus: string;
  saleDate: string;
}

export interface DashboardTopCustomer {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  outstandingPaisa: number;
  totalSalesPaisa: number;
}

export interface DashboardTopSupplier {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  outstandingPaisa: number;
  totalPurchasePaisa: number;
}

export interface DashboardReceivablesSummary {
  totalOutstandingPaisa: number;
  customersWithBalance: number;
  top: DashboardTopCustomer[];
}

export interface DashboardPayablesSummary {
  totalOutstandingPaisa: number;
  suppliersWithBalance: number;
  top: DashboardTopSupplier[];
}

interface RawPeriodRow {
  d: string;
  sales: string | number;
  cost: string | number;
  saleCount: string | number;
}

interface RawReceivableCustomerRow {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  outstanding: string | number;
  totalSales: string | number;
}

interface RawPayableSupplierRow {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  outstanding: string | number;
  totalPurchases: string | number;
}

export interface DashboardInventorySnapshot {
  rawCoilKg: number;
  finishedStockKg: number;
  planeStockKg: number;
  /** Total weighted KG across all three buckets (informational only). */
  totalKg: number;
  /** Sum of weighted value: raw coil @ purchase cost + plane @ finished cost + finished stock @ finished cost. */
  totalValuePaisa: number;
  /** Cash that has been received from customers (PAYMENT ledger total). */
  cashReceivedPaisa: number;
  /** Money owed to us by customers (current balance sum). */
  receivablePaisa: number;
  /** Money we owe to suppliers (current balance sum). */
  payablePaisa: number;
}

export interface DashboardSummary {
  range: '7d' | '30d' | '3m' | '6m' | '1y';
  rangeStart: string;
  rangeEnd: string;
  kpis: DashboardKpis;
  timeSeries: DashboardTimeSeriesPoint[];
  recentSales: DashboardRecentSale[];
  receivables: DashboardReceivablesSummary;
  payables: DashboardPayablesSummary;
  inventory: DashboardInventorySnapshot;
}

export type DashboardRange = '7d' | '30d' | '3m' | '6m' | '1y';

const VALID_RANGES = new Set<DashboardRange>(['7d', '30d', '3m', '6m', '1y']);

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Coil)
    private readonly coilRepository: Repository<Coil>,
    @InjectRepository(FinishedChaddarStock)
    private readonly stockRepository: Repository<FinishedChaddarStock>,
    @InjectRepository(PlaneStock)
    private readonly planeRepository: Repository<PlaneStock>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerLedgerEntry)
    private readonly customerLedgerRepository: Repository<CustomerLedgerEntry>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(SupplierLedgerEntry)
    private readonly supplierLedgerRepository: Repository<SupplierLedgerEntry>,
    private readonly customersService: CustomersService,
    private readonly expensesService: ExpensesService,
  ) {}

  /**
   * Resolve the analytics window. We always anchor the window to the
   * current business date so the chart buckets are stable regardless of
   * when the operator refreshes the dashboard.
   */
  private resolveWindow(range: DashboardRange): {
    start: Date;
    end: Date;
    bucket: 'day' | 'week' | 'month';
    rangeStart: string;
    rangeEnd: string;
  } {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);

    if (range === '7d') {
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return {
        start,
        end,
        bucket: 'day',
        rangeStart: this.toIsoDate(start),
        rangeEnd: this.toIsoDate(end),
      };
    }
    if (range === '30d') {
      start.setDate(end.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return {
        start,
        end,
        bucket: 'day',
        rangeStart: this.toIsoDate(start),
        rangeEnd: this.toIsoDate(end),
      };
    }
    if (range === '3m') {
      start.setMonth(end.getMonth() - 2);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return {
        start,
        end,
        bucket: 'week',
        rangeStart: this.toIsoDate(start),
        rangeEnd: this.toIsoDate(end),
      };
    }
    if (range === '6m') {
      start.setMonth(end.getMonth() - 5);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return {
        start,
        end,
        bucket: 'week',
        rangeStart: this.toIsoDate(start),
        rangeEnd: this.toIsoDate(end),
      };
    }
    // 1y
    const yStart = new Date(end.getFullYear(), 0, 1, 0, 0, 0, 0);
    return {
      start: yStart,
      end,
      bucket: 'month',
      rangeStart: this.toIsoDate(yStart),
      rangeEnd: this.toIsoDate(end),
    };
  }

  /**
   * Main entry point used by the dashboard controller. Every figure on
   * the dashboard is sourced from this call so the UI never has to
   * call multiple endpoints and stitch numbers together.
   */
  async getSummary(rangeInput: string): Promise<DashboardSummary> {
    const range = (
      VALID_RANGES.has(rangeInput as DashboardRange) ? rangeInput : '30d'
    ) as DashboardRange;
    const window = this.resolveWindow(range);

    const [kpis, timeSeries, recentSales, receivables, payables, inventory] =
      await Promise.all([
        this.computeKpis(window),
        this.computeTimeSeries(window),
        this.fetchRecentSales(10),
        this.computeReceivables(),
        this.computePayables(),
        this.computeInventorySnapshot(),
      ]);

    return {
      range,
      rangeStart: window.rangeStart,
      rangeEnd: window.rangeEnd,
      kpis,
      timeSeries,
      recentSales,
      receivables,
      payables,
      inventory,
    };
  }

  private async computeKpis(window: {
    rangeStart: string;
    rangeEnd: string;
  }): Promise<DashboardKpis> {
    // All sales / profit numbers come from sale items so the cost
    // basis is the actual finished-cost-per-kg snapshot that was
    // frozen at sale time. Historical profit never drifts when the
    // shop later changes purchase / landing / processing costs.
    const lifetimeRow = (await this.saleItemRepository
      .createQueryBuilder('item')
      .select('COALESCE(SUM(item.line_revenue_paisa), 0)', 'sales')
      .addSelect('COALESCE(SUM(item.line_cost_paisa), 0)', 'cost')
      .addSelect('COUNT(DISTINCT item.sale_id)', 'saleCount')
      .getRawOne()) as {
      sales: string | number;
      cost: string | number;
      saleCount: string | number;
    } | null;
    const totalSales = Number(lifetimeRow?.sales ?? 0);
    const totalCost = Number(lifetimeRow?.cost ?? 0);
    const totalProfit = totalSales - totalCost;

    const lifetimePaymentRow = (await this.customerLedgerRepository
      .createQueryBuilder('entry')
      .select('COALESCE(SUM(entry.amount_paisa), 0)', 'received')
      .where('entry.entry_type = :t', {
        t: 'PAYMENT',
      })
      .getRawOne()) as { received: string | number };
    const totalReceived = Number(lifetimePaymentRow.received ?? 0);

    const receivablesRow = (await this.customerRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.current_balance_paisa), 0)', 'total')
      .where('c.current_balance_paisa > 0')
      .andWhere('c.is_active = :a', { a: true })
      .getRawOne()) as { total: string | number };
    const totalReceivable = Number(receivablesRow.total ?? 0);

    const payablesRow = (await this.supplierRepository
      .createQueryBuilder('s')
      .innerJoin(
        (qb) =>
          qb
            .from('supplier_ledger_entries', 'le')
            .select('le.supplier_id', 'supplier_id')
            .addSelect('le.balance_after_paisa', 'balance_after_paisa')
            .where(
              `le.id = (
                SELECT MAX(id) FROM supplier_ledger_entries
                WHERE supplier_id = le.supplier_id
              )`,
            ),
        'latest',
        'latest.supplier_id = s.id',
      )
      .select('COALESCE(SUM(latest.balance_after_paisa), 0)', 'total')
      .where('latest.balance_after_paisa > 0')
      .getRawOne()) as { total: string | number };
    const totalPayable = Number(payablesRow.total ?? 0);

    const inventoryValue = await this.computeInventoryValuePaisa();

    const todayIso = this.toIsoDate(new Date());
    const todaysRow = (await this.saleItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.sale', 'sale')
      .select('COALESCE(SUM(item.line_revenue_paisa), 0)', 'sales')
      .addSelect('COALESCE(SUM(item.line_cost_paisa), 0)', 'cost')
      .addSelect('COUNT(DISTINCT item.sale_id)', 'saleCount')
      .where('sale.sale_date = :d', { d: todayIso })
      .getRawOne()) as {
      sales: string | number;
      cost: string | number;
      saleCount: string | number;
    };
    const todaysSales = Number(todaysRow.sales ?? 0);
    const todaysProfit = todaysSales - Number(todaysRow.cost ?? 0);
    const todaysCount = Number(todaysRow.saleCount ?? 0);

    const rangeSalesRow = (await this.saleItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.sale', 'sale')
      .select('COALESCE(SUM(item.line_revenue_paisa), 0)', 'sales')
      .addSelect('COALESCE(SUM(item.line_cost_paisa), 0)', 'cost')
      .where('sale.sale_date >= :s', { s: window.rangeStart })
      .andWhere('sale.sale_date <= :e', { e: window.rangeEnd })
      .getRawOne()) as { sales: string | number; cost: string | number };
    const rangeSales = Number(rangeSalesRow.sales ?? 0);
    void rangeSales;

    // Range KPIs: show today's subset of the full range so the
    // dashboard can render "Today" alongside the trend.
    const [lifetimeExpenses, periodExpenses] = await Promise.all([
      this.expensesService.getTotalInPeriod('2000-01-01', window.rangeEnd),
      this.expensesService.getTotalInPeriod(window.rangeStart, window.rangeEnd),
    ]);

    return {
      totalSalesPaisa: totalSales,
      totalProfitPaisa: totalProfit,
      totalReceivedPaisa: totalReceived,
      totalReceivablePaisa: totalReceivable,
      totalPayablePaisa: totalPayable,
      inventoryValuePaisa: inventoryValue,
      totalSalesCount: Number(lifetimeRow?.saleCount ?? 0),
      todaysSalesPaisa: todaysSales,
      todaysSalesCount: todaysCount,
      todaysProfitPaisa: todaysProfit,
      rawCoilKg: 0, // populated by inventory snapshot below
      finishedStockKg: 0,
      planeStockKg: 0,
      totalExpensesPaisa: lifetimeExpenses,
      periodExpensesPaisa: periodExpenses,
      netProfitPaisa: totalProfit - lifetimeExpenses,
    };
  }

  /**
   * Builds the chart series. Uses one query per granularity: daily
   * for <= 30d, weekly for 3-6m, monthly for 1y.
   */
  private async computeTimeSeries(window: {
    rangeStart: string;
    rangeEnd: string;
    bucket: 'day' | 'week' | 'month';
  }): Promise<DashboardTimeSeriesPoint[]> {
    const rows = await this.saleItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.sale', 'sale')
      .select('sale.sale_date', 'd')
      .addSelect('COALESCE(SUM(item.line_revenue_paisa), 0)', 'sales')
      .addSelect('COALESCE(SUM(item.line_cost_paisa), 0)', 'cost')
      .addSelect('COUNT(DISTINCT item.sale_id)', 'saleCount')
      .where('sale.sale_date >= :s', { s: window.rangeStart })
      .andWhere('sale.sale_date <= :e', { e: window.rangeEnd })
      .groupBy('sale.sale_date')
      .orderBy('sale.sale_date', 'ASC')
      .getRawMany();

    // Bucket the raw daily rows into the requested granularity.
    const buckets = new Map<
      string,
      { sales: number; cost: number; count: number; label: string; date: Date }
    >();
    for (const row of rows as RawPeriodRow[]) {
      const date = this.parseIsoDate(row.d);
      const key = this.bucketKey(date, window.bucket);
      const prev = buckets.get(key) ?? {
        sales: 0,
        cost: 0,
        count: 0,
        label: this.bucketLabel(date, window.bucket),
        date,
      };
      prev.sales += Number(row.sales);
      prev.cost += Number(row.cost);
      prev.count += Number(row.saleCount);
      buckets.set(key, prev);
    }

    // Always emit a continuous range so the chart doesn't have gaps
    // even on days with zero sales.
    const series: DashboardTimeSeriesPoint[] = [];
    const start = this.parseIsoDate(window.rangeStart);
    const end = this.parseIsoDate(window.rangeEnd);
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const key = this.bucketKey(cursor, window.bucket);
      const bucket = buckets.get(key);
      series.push({
        bucket: key,
        label: this.bucketLabel(cursor, window.bucket),
        salesPaisa: bucket?.sales ?? 0,
        profitPaisa: (bucket?.sales ?? 0) - (bucket?.cost ?? 0),
        salesCount: bucket?.count ?? 0,
      });
      this.advanceCursor(cursor, window.bucket);
    }
    return series;
  }

  private async fetchRecentSales(
    limit: number,
  ): Promise<DashboardRecentSale[]> {
    const rows = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .orderBy('sale.saleDate', 'DESC')
      .addOrderBy('sale.id', 'DESC')
      .limit(limit)
      .getMany();
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      customerId: s.customerId,
      customerName: s.customer ? s.customer.name : null,
      totalAmountPaisa: Number(s.totalAmountPaisa),
      paidAmountPaisa: Number(s.paidAmountPaisa),
      dueAmountPaisa: Number(s.dueAmountPaisa),
      paymentStatus: s.paymentStatus,
      saleDate: this.toIsoDate(s.saleDate),
    }));
  }

  private async computeReceivables(): Promise<DashboardReceivablesSummary> {
    // Use the customer service for the aggregate (single source of
    // truth) then hydrate the per-customer top list straight from
    // the customer table to avoid pulling all sales into memory.
    const totalOutstanding =
      await this.customersService.aggregateOutstandingPaisa();

    const customers = (await this.customerRepository
      .createQueryBuilder('c')
      .leftJoin('c.sales', 'sale')
      .select('c.id', 'id')
      .addSelect('c.code', 'code')
      .addSelect('c.name', 'name')
      .addSelect('c.phone', 'phone')
      .addSelect('c.current_balance_paisa', 'outstanding')
      .addSelect('COALESCE(SUM(sale.total_amount_paisa), 0)', 'totalSales')
      .where('c.current_balance_paisa > 0')
      .andWhere('c.is_active = :a', { a: true })
      .groupBy('c.id')
      .orderBy('c.current_balance_paisa', 'DESC')
      .limit(5)
      .getRawMany()) as unknown as RawReceivableCustomerRow[];
    return {
      totalOutstandingPaisa: totalOutstanding,
      customersWithBalance: customers.length,
      top: customers.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        phone: c.phone,
        outstandingPaisa: Number(c.outstanding),
        totalSalesPaisa: Number(c.totalSales),
      })),
    };
  }

  private async computePayables(): Promise<DashboardPayablesSummary> {
    // The supplier ledger writes a `balanceAfterPaisa` on every entry
    // as the running payable. The current outstanding is therefore
    // the latest `balanceAfterPaisa` per supplier (max id), restricted
    // to suppliers where that running balance is positive.
    const suppliers = (await this.supplierRepository
      .createQueryBuilder('s')
      .innerJoin(
        (qb) =>
          qb
            .from('supplier_ledger_entries', 'le')
            .select('le.supplier_id', 'supplier_id')
            .addSelect('le.balance_after_paisa', 'balance_after_paisa')
            .addSelect('le.amount_paisa', 'amount_paisa')
            .addSelect('le.purchase_id', 'purchase_id')
            .where(
              `le.id = (
                SELECT MAX(id) FROM supplier_ledger_entries
                WHERE supplier_id = le.supplier_id
              )`,
            ),
        'latest',
        'latest.supplier_id = s.id',
      )
      .leftJoin('s.purchases', 'purchase')
      .leftJoin('purchase.coils', 'coil')
      .select('s.id', 'id')
      .addSelect('s.code', 'code')
      .addSelect('s.name', 'name')
      .addSelect('s.phone', 'phone')
      .addSelect('latest.balance_after_paisa', 'outstanding')
      .addSelect(
        'COALESCE(SUM(coil.purchase_amount_paisa), 0)',
        'totalPurchases',
      )
      .where('latest.balance_after_paisa > 0')
      .groupBy('s.id')
      .addGroupBy('latest.balance_after_paisa')
      .orderBy('latest.balance_after_paisa', 'DESC')
      .limit(5)
      .getRawMany()) as unknown as RawPayableSupplierRow[];
    const totalOutstanding = suppliers.reduce(
      (sum, s) => sum + Number(s.outstanding),
      0,
    );
    return {
      totalOutstandingPaisa: totalOutstanding,
      suppliersWithBalance: suppliers.length,
      top: suppliers.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        phone: s.phone,
        outstandingPaisa: Number(s.outstanding),
        totalPurchasePaisa: Number(s.totalPurchases),
      })),
    };
  }

  private async computeInventorySnapshot(): Promise<DashboardInventorySnapshot> {
    const rawRow = (await this.coilRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.current_weight), 0)', 'kg')
      .getRawOne()) as { kg: string | number };
    const rawKg = Number(rawRow.kg ?? 0);

    const finishedRow = (await this.stockRepository
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.remaining_weight_kg), 0)', 'kg')
      .getRawOne()) as { kg: string | number };
    const finishedKg = Number(finishedRow.kg ?? 0);

    const planeRow = (await this.planeRepository
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.weight_kg), 0)', 'kg')
      .where('p.status = :s', { s: 'AVAILABLE' })
      .getRawOne()) as { kg: string | number };
    const planeKg = Number(planeRow.kg ?? 0);

    const cashRow = (await this.customerLedgerRepository
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount_paisa), 0)', 'cash')
      .where('e.entry_type = :t', { t: 'PAYMENT' })
      .getRawOne()) as { cash: string | number };
    const cashReceived = Number(cashRow.cash ?? 0);

    const receivablesRow = (await this.customerRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.current_balance_paisa), 0)', 'total')
      .where('c.current_balance_paisa > 0')
      .andWhere('c.is_active = :a', { a: true })
      .getRawOne()) as { total: string | number };
    const receivable = Number(receivablesRow.total ?? 0);

    const payablesRow = (await this.supplierRepository
      .createQueryBuilder('s')
      .innerJoin(
        (qb) =>
          qb
            .from('supplier_ledger_entries', 'le')
            .select('le.supplier_id', 'supplier_id')
            .addSelect('le.balance_after_paisa', 'balance_after_paisa')
            .where(
              `le.id = (
                SELECT MAX(id) FROM supplier_ledger_entries
                WHERE supplier_id = le.supplier_id
              )`,
            ),
        'latest',
        'latest.supplier_id = s.id',
      )
      .select('COALESCE(SUM(latest.balance_after_paisa), 0)', 'total')
      .where('latest.balance_after_paisa > 0')
      .getRawOne()) as { total: string | number };
    const payable = Number(payablesRow.total ?? 0);

    const totalValue = await this.computeInventoryValuePaisa();

    return {
      rawCoilKg: rawKg,
      finishedStockKg: finishedKg,
      planeStockKg: planeKg,
      totalKg: rawKg + finishedKg + planeKg,
      totalValuePaisa: totalValue,
      cashReceivedPaisa: cashReceived,
      receivablePaisa: receivable,
      payablePaisa: payable,
    };
  }

  /**
   * Inventory value = remaining raw coil × purchase cost + remaining
   * finished stock × finished cost + remaining plane stock × its
   * snapshot cost. All three are derived from SQL so the operator
   * never sees a stale in-memory number.
   */
  private async computeInventoryValuePaisa(): Promise<number> {
    const rawRow = (await this.coilRepository
      .createQueryBuilder('c')
      .select(
        'COALESCE(SUM(c.current_weight * c.purchase_amount_paisa / NULLIF(c.purchase_weight, 0)), 0)',
        'value',
      )
      .where('c.purchase_weight > 0')
      .getRawOne()) as { value: string | number };
    const rawValue = Number(rawRow.value ?? 0);

    const finishedRow = (await this.stockRepository
      .createQueryBuilder('s')
      .select(
        'COALESCE(SUM(s.remaining_weight_kg * s.finished_cost_per_kg_paisa), 0)',
        'value',
      )
      .getRawOne()) as { value: string | number };
    const finishedValue = Number(finishedRow.value ?? 0);

    const planeRow = (await this.planeRepository
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.total_value_paisa), 0)', 'value')
      .where('p.status = :s', { s: 'AVAILABLE' })
      .getRawOne()) as { value: string | number };
    const planeValue = Number(planeRow.value ?? 0);

    return Math.round(rawValue + finishedValue + planeValue);
  }

  private parseIsoDate(s: string): Date {
    const parts = s.split('-').map(Number);
    return new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1);
  }

  private toIsoDate(d: Date | string): string {
    if (typeof d === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      throw new BadRequestException(`Invalid date string: ${d}`);
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private bucketKey(d: Date, bucket: 'day' | 'week' | 'month'): string {
    if (bucket === 'day') return this.toIsoDate(d);
    if (bucket === 'month') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    // ISO week number for the year
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const week =
      1 +
      Math.round(
        ((target.getTime() - firstThursday.getTime()) / 86400000 -
          3 +
          ((firstThursday.getDay() + 6) % 7)) /
          7,
      );
    return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  private bucketLabel(d: Date, bucket: 'day' | 'week' | 'month'): string {
    if (bucket === 'day') {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
      });
    }
    if (bucket === 'month') {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });
    }
    const week = this.bucketKey(d, 'week');
    return `Wk ${week.slice(-2)}`;
  }

  private advanceCursor(d: Date, bucket: 'day' | 'week' | 'month'): void {
    if (bucket === 'day') {
      d.setDate(d.getDate() + 1);
      return;
    }
    if (bucket === 'month') {
      d.setMonth(d.getMonth() + 1);
      return;
    }
    d.setDate(d.getDate() + 7);
  }
}
