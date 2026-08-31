import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Sale, SalePaymentStatus, SaleStatus } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import {
  FinishedChaddarStock,
  FinishedChaddarStatus,
} from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { Coil } from '../coils/entities/coil.entity';
import {
  InventoryMovement,
  MovementType,
} from '../inventory-movements/entities/inventory-movement.entity';
import { PriceCategory } from '../price-categories/entities/price-category.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CustomersService } from '../customers/customers.service';

export interface SaleWithItems {
  sale: Sale;
  items: SaleItem[];
}

const ROUND_KG = (n: number) => Math.round(n * 1000) / 1000;

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
    private readonly dataSource: DataSource,
    private readonly customersService: CustomersService,
  ) {}

  private async generateSaleCode(queryRunner: {
    query: (sql: string, params?: unknown[]) => Promise<unknown>;
  }): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SALE-${year}-`;

    const result = (await queryRunner.query(
      `SELECT MAX(CAST(SUBSTR(code, LENGTH('${prefix}') + 1) AS INTEGER)) as max_num
       FROM sales
       WHERE code LIKE '${prefix}%'`,
    )) as Array<{ max_num: number | null }>;
    const maxNum = result[0]?.max_num ?? 0;
    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(5, '0')}`;
  }

  /**
   * Resolve the default selling rate for a stock from its persisted price
   * category snapshot. Returns 0 when the stock has no category so the
   * operator is forced to enter a rate explicitly.
   */
  private async resolveDefaultSellingRatePaisa(
    manager: {
      findOne: (
        entity: typeof PriceCategory,
        opts: { where: { id: number } },
      ) => Promise<PriceCategory | null>;
    },
    stock: FinishedChaddarStock,
  ): Promise<number> {
    if (!stock.priceCategoryId) return 0;
    const cat = await manager.findOne(PriceCategory, {
      where: { id: stock.priceCategoryId },
    });
    return cat ? Number(cat.sellingRatePaisa) : 0;
  }

  /**
   * Resolve the weight-per-piece for a stock, preferring the persisted
   * snapshot and falling back to a fresh derivation from total/remaining.
   * Returns 0 if the stock has no production data, forcing the operator
   * to explicitly enter a weight.
   */
  private resolveWeightPerPieceKg(stock: FinishedChaddarStock): number {
    const wpp =
      stock.weightPerPieceKg != null ? Number(stock.weightPerPieceKg) : null;
    if (wpp != null && wpp > 0) return wpp;
    const produced = Number(stock.piecesProduced);
    if (produced > 0) {
      return Number(stock.totalWeightKg) / produced;
    }
    return 0;
  }

  async create(dto: CreateSaleDto, createdBy?: string): Promise<SaleWithItems> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one sale item is required');
    }

    const customerId = dto.customerId ?? null;
    const paidAmountPaisa = dto.paidAmountPaisa ?? 0;

    if (paidAmountPaisa < 0) {
      throw new BadRequestException('Paid amount cannot be negative');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Idempotency guard: when the client provides an idempotencyKey
      // (a fresh UUID it generates per submit attempt) and a sale with
      // the same key already exists, return that sale instead of
      // creating a duplicate that would re-deduct finished stock and
      // re-create a customer ledger due. The unique index on
      // `sales.idempotency_key` is the database-level guarantee.
      if (dto.idempotencyKey && dto.idempotencyKey.trim().length > 0) {
        const existing = await queryRunner.manager.findOne(Sale, {
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          await queryRunner.rollbackTransaction();
          const existingItems = await this.saleItemRepository.find({
            where: { saleId: existing.id },
          });
          return { sale: existing, items: existingItems };
        }
      }

      const saleCode = await this.generateSaleCode(queryRunner);

      const sale = queryRunner.manager.create(Sale, {
        code: saleCode,
        customerId,
        saleDate: new Date(dto.saleDate),
        totalAmountPaisa: 0,
        totalCostPaisa: 0,
        grossProfitPaisa: 0,
        paidAmountPaisa: 0,
        dueAmountPaisa: 0,
        paymentStatus: SalePaymentStatus.UNPAID,
        status: SaleStatus.COMPLETED,
        note: dto.note ?? null,
        createdBy: createdBy ?? null,
        idempotencyKey: dto.idempotencyKey ?? null,
      });

      const savedSale = await queryRunner.manager.save(sale);

      const savedItems: SaleItem[] = [];
      let totalAmount = 0;
      let totalCost = 0;
      let totalProfit = 0;

      for (const itemDto of dto.items) {
        const stock = await queryRunner.manager.findOne(FinishedChaddarStock, {
          where: { id: itemDto.finishedStockId },
          relations: { priceCategory: true },
        });

        if (!stock) {
          throw new NotFoundException(
            `Finished stock ${itemDto.finishedStockId} not found`,
          );
        }

        if (stock.status === FinishedChaddarStatus.SOLD_OUT) {
          throw new BadRequestException(
            `Finished stock ${stock.code} is already sold out`,
          );
        }

        const availablePieces = stock.remainingPieces;
        const availableWeight = Number(stock.remainingWeightKg);

        if (itemDto.piecesSold <= 0) {
          throw new BadRequestException(
            `Pieces sold must be greater than zero for stock ${stock.code}`,
          );
        }

        const wpp = this.resolveWeightPerPieceKg(stock);
        let weightSoldKg: number;
        if (
          itemDto.weightSoldKg !== undefined &&
          itemDto.weightSoldKg !== null
        ) {
          weightSoldKg = itemDto.weightSoldKg;
        } else if (wpp > 0) {
          weightSoldKg = ROUND_KG(itemDto.piecesSold * wpp);
        } else {
          throw new BadRequestException(
            `Cannot derive sold weight for ${stock.code}. Enter weight manually or record a cutting batch with weight-per-piece first.`,
          );
        }

        if (weightSoldKg <= 0) {
          throw new BadRequestException(
            `Weight sold must be greater than zero for stock ${stock.code}`,
          );
        }

        if (itemDto.piecesSold > availablePieces) {
          throw new BadRequestException(
            `Cannot sell ${itemDto.piecesSold} pieces of ${stock.code}; only ${availablePieces} remaining`,
          );
        }
        if (weightSoldKg > availableWeight + 0.0005) {
          throw new BadRequestException(
            `Cannot sell ${weightSoldKg.toFixed(3)} KG of ${stock.code}; only ${availableWeight.toFixed(3)} KG remaining`,
          );
        }

        let sellingRatePaisa: number;
        if (
          itemDto.sellingRatePaisa !== undefined &&
          itemDto.sellingRatePaisa !== null
        ) {
          sellingRatePaisa = itemDto.sellingRatePaisa;
        } else {
          sellingRatePaisa = await this.resolveDefaultSellingRatePaisa(
            queryRunner.manager,
            stock,
          );
        }

        const lineRevenuePaisa = Math.round(weightSoldKg * sellingRatePaisa);
        const lineCostPaisa = Math.round(
          weightSoldKg * Number(stock.finishedCostPerKgPaisa),
        );
        const lineProfitPaisa = lineRevenuePaisa - lineCostPaisa;

        const saleItem = queryRunner.manager.create(SaleItem, {
          saleId: savedSale.id,
          finishedStockId: stock.id,
          cuttingBatchId: stock.cuttingBatchId,
          sourceCoilId: stock.sourceCoilId,
          sizeLabel: stock.sizeLabel,
          piecesSold: itemDto.piecesSold,
          weightSoldKg: ROUND_KG(weightSoldKg),
          sellingRatePaisa,
          finishedCostPerKgPaisa: Number(stock.finishedCostPerKgPaisa),
          lineRevenuePaisa,
          lineCostPaisa,
          lineGrossProfitPaisa: lineProfitPaisa,
          note: itemDto.note ?? null,
        });

        const savedItem = await queryRunner.manager.save(saleItem);
        savedItems.push(savedItem);

        totalAmount += lineRevenuePaisa;
        totalCost += lineCostPaisa;
        totalProfit += lineProfitPaisa;

        const newRemainingPieces = availablePieces - itemDto.piecesSold;
        const newRemainingWeight = ROUND_KG(availableWeight - weightSoldKg);

        stock.remainingPieces = newRemainingPieces;
        stock.remainingWeightKg = newRemainingWeight;
        if (
          stock.weightPerPieceKg != null &&
          newRemainingPieces > 0 &&
          newRemainingWeight > 0
        ) {
          stock.weightPerPieceKg = ROUND_KG(
            newRemainingWeight / newRemainingPieces,
          );
        }
        stock.status =
          newRemainingPieces <= 0 || newRemainingWeight <= 0
            ? FinishedChaddarStatus.SOLD_OUT
            : FinishedChaddarStatus.PARTIALLY_SOLD;
        await queryRunner.manager.save(stock);

        const coil = await queryRunner.manager.findOne(Coil, {
          where: { id: stock.sourceCoilId },
        });
        if (coil) {
          const movement = queryRunner.manager.create(InventoryMovement, {
            coilId: coil.id,
            type: MovementType.SALE,
            weightDelta: 0,
            weightBalance: Number(coil.currentWeight),
            referenceType: 'SALE',
            referenceId: savedSale.id,
            referenceCode: savedSale.code,
            notes: `Sold ${itemDto.piecesSold} × ${stock.sizeLabel} (${weightSoldKg.toFixed(3)} KG) from stock ${stock.code}`,
            createdBy: createdBy ?? null,
          });
          await queryRunner.manager.save(movement);
        }
      }

      if (customerId === null) {
        if (paidAmountPaisa !== totalAmount) {
          throw new BadRequestException(
            'Cash sales must be fully paid. Leave customer empty and pay the exact total.',
          );
        }
      } else {
        if (paidAmountPaisa > totalAmount) {
          throw new BadRequestException(
            `Paid amount (${(paidAmountPaisa / 100).toFixed(2)}) cannot exceed sale total (${(totalAmount / 100).toFixed(2)})`,
          );
        }
      }

      const dueAmountPaisa = totalAmount - paidAmountPaisa;
      if (dueAmountPaisa > 0 && customerId === null) {
        throw new BadRequestException(
          'Credit sales require a customer. Leave the customer empty only when paying the full amount.',
        );
      }

      const paymentStatus =
        dueAmountPaisa <= 0
          ? SalePaymentStatus.PAID
          : paidAmountPaisa > 0
            ? SalePaymentStatus.PARTIAL
            : SalePaymentStatus.UNPAID;

      savedSale.totalAmountPaisa = totalAmount;
      savedSale.totalCostPaisa = totalCost;
      savedSale.grossProfitPaisa = totalProfit;
      savedSale.paidAmountPaisa = paidAmountPaisa;
      savedSale.dueAmountPaisa = dueAmountPaisa;
      savedSale.paymentStatus = paymentStatus;

      await queryRunner.manager.save(savedSale);

      if (customerId !== null) {
        await this.customersService.applySaleTransaction(
          queryRunner,
          customerId,
          savedSale.id,
          savedSale.saleDate,
          totalAmount,
          paidAmountPaisa,
          savedSale.note,
          createdBy ?? null,
        );
      }

      await queryRunner.commitTransaction();

      return { sale: savedSale, items: savedItems };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<SaleWithItems[]> {
    const sales = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .orderBy('sale.saleDate', 'DESC')
      .addOrderBy('sale.createdAt', 'DESC')
      .getMany();

    if (sales.length === 0) return [];

    const saleIds = sales.map((s) => s.id);
    const items = await this.saleItemRepository
      .createQueryBuilder('item')
      .where('item.saleId IN (:...saleIds)', { saleIds })
      .getMany();

    const itemsBySaleId = new Map<number, SaleItem[]>();
    for (const item of items) {
      const list = itemsBySaleId.get(item.saleId) ?? [];
      list.push(item);
      itemsBySaleId.set(item.saleId, list);
    }

    return sales.map((sale) => ({
      sale,
      items: itemsBySaleId.get(sale.id) ?? [],
    }));
  }

  async findOne(id: number): Promise<SaleWithItems> {
    const sale = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .where('sale.id = :id', { id })
      .getOne();
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    const items = await this.saleItemRepository.find({
      where: { saleId: sale.id },
    });
    return { sale, items };
  }

  async findByCustomer(customerId: number): Promise<SaleWithItems[]> {
    const sales = await this.saleRepository.find({
      where: { customerId },
      order: { saleDate: 'DESC', createdAt: 'DESC' },
    });

    if (sales.length === 0) return [];

    const saleIds = sales.map((s) => s.id);
    const items = await this.saleItemRepository
      .createQueryBuilder('item')
      .where('item.saleId IN (:...saleIds)', { saleIds })
      .getMany();

    const itemsBySaleId = new Map<number, SaleItem[]>();
    for (const item of items) {
      const list = itemsBySaleId.get(item.saleId) ?? [];
      list.push(item);
      itemsBySaleId.set(item.saleId, list);
    }

    return sales.map((sale) => ({
      sale,
      items: itemsBySaleId.get(sale.id) ?? [],
    }));
  }
}
