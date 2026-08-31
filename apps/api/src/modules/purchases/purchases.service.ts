import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { Coil, InventoryStatus } from '../coils/entities/coil.entity';
import {
  InventoryMovement,
  MovementType,
} from '../inventory-movements/entities/inventory-movement.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SupplierLedgerService } from '../suppliers/supplier-ledger.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { AttachmentEntityType } from '../attachments/entities/attachment.entity';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(Coil)
    private readonly coilRepository: Repository<Coil>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepository: Repository<InventoryMovement>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly dataSource: DataSource,
    private readonly supplierLedgerService: SupplierLedgerService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  private async generatePurchaseCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PUR-${year}-`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = (await queryRunner.query(`
        SELECT MAX(CAST(SUBSTR(code, LENGTH('${prefix}') + 1) AS INTEGER)) as max_num
        FROM purchases
        WHERE code LIKE '${prefix}%'
      `)) as Array<{ max_num: number | null }>;
      const maxNum = result[0]?.max_num ?? 0;
      const nextNum = maxNum + 1;
      const code = `${prefix}${String(nextNum).padStart(5, '0')}`;
      await queryRunner.commitTransaction();
      return code;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async generateCoilCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `COIL-${year}-`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = (await queryRunner.query(`
        SELECT MAX(CAST(SUBSTR(code, LENGTH('${prefix}') + 1) AS INTEGER)) as max_num
        FROM coils
        WHERE code LIKE '${prefix}%'
      `)) as Array<{ max_num: number | null }>;
      const maxNum = result[0]?.max_num ?? 0;
      const nextNum = maxNum + 1;
      const code = `${prefix}${String(nextNum).padStart(5, '0')}`;
      await queryRunner.commitTransaction();
      return code;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private calculatePurchaseAmount(weight: number, ratePaisa: number): number {
    const weightDecimal = Number(weight);
    const rateDecimal = Number(ratePaisa);
    if (
      isNaN(weightDecimal) ||
      isNaN(rateDecimal) ||
      weightDecimal <= 0 ||
      rateDecimal < 0
    ) {
      return 0;
    }
    return Math.round(weightDecimal * rateDecimal);
  }

  async create(
    createDto: CreatePurchaseDto,
    createdBy?: string,
  ): Promise<Purchase> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const supplier = await queryRunner.manager.findOne(Supplier, {
        where: { id: createDto.supplierId },
      });

      if (!supplier) {
        throw new BadRequestException('Supplier not found');
      }

      const purchaseCode = await this.generatePurchaseCode();

      const purchase = queryRunner.manager.create(Purchase, {
        code: purchaseCode,
        supplierId: createDto.supplierId,
        supplierInvoiceNumber: createDto.supplierInvoiceNumber ?? null,
        purchaseDate: new Date(createDto.purchaseDate),
        notes: createDto.notes ?? null,
        createdBy: createdBy ?? null,
      });

      const savedPurchase = await queryRunner.manager.save(purchase);

      const coils: Coil[] = [];

      for (const coilDto of createDto.coils) {
        const coilCode = await this.generateCoilCode();

        const purchaseAmount = this.calculatePurchaseAmount(
          coilDto.purchaseWeight,
          coilDto.purchaseRatePaisa,
        );

        const coil = queryRunner.manager.create(Coil, {
          code: coilCode,
          batchNumber: coilDto.batchNumber ?? null,
          purchaseId: savedPurchase.id,
          supplierId: createDto.supplierId,
          materialFamilyId: coilDto.materialFamilyId ?? null,
          priceCategoryId: coilDto.priceCategoryId ?? null,
          brand: coilDto.brand ?? null,
          color: coilDto.color ?? null,
          width: coilDto.width,
          thicknessMm: coilDto.thicknessMm ?? null,
          grossWeight: coilDto.grossWeight ?? coilDto.purchaseWeight,
          purchaseWeight: coilDto.purchaseWeight,
          purchaseRatePaisa: coilDto.purchaseRatePaisa,
          purchaseAmountPaisa: purchaseAmount,
          currentWeight: coilDto.purchaseWeight,
          status: InventoryStatus.RAW,
          location: coilDto.location ?? null,
          notes: coilDto.notes ?? null,
        });

        const savedCoil = await queryRunner.manager.save(coil);
        coils.push(savedCoil);

        const movement = queryRunner.manager.create(InventoryMovement, {
          coilId: savedCoil.id,
          type: MovementType.PURCHASE_RECEIPT,
          weightDelta: coilDto.purchaseWeight,
          weightBalance: coilDto.purchaseWeight,
          referenceType: 'PURCHASE',
          referenceId: savedPurchase.id,
          referenceCode: purchaseCode,
          createdBy: createdBy ?? null,
        });

        await queryRunner.manager.save(movement);

        // Record the payable side of the purchase in the supplier
        // ledger so balances stay consistent with the coil totals.
        await this.supplierLedgerService.recordPurchaseDueInTransaction(
          queryRunner.manager,
          createDto.supplierId,
          savedPurchase.id,
          purchaseAmount,
          savedPurchase.purchaseDate,
          purchaseCode,
          createdBy ?? null,
        );
      }

      await queryRunner.commitTransaction();

      const result = await this.purchaseRepository.findOne({
        where: { id: savedPurchase.id },
        relations: { supplier: true, coils: true },
      });

      return result!;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Purchase[]> {
    return this.purchaseRepository.find({
      relations: { supplier: true, coils: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Purchase> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id },
      relations: { supplier: true, coils: true },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
  }

  async delete(id: number): Promise<void> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id },
      relations: { coils: true, ledgerEntries: true },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    const coilCount = purchase.coils?.length ?? 0;
    const ledgerEntryCount = purchase.ledgerEntries?.length ?? 0;

    if (coilCount > 0) {
      throw new BadRequestException(
        `Cannot delete this purchase because it has ${coilCount} coil(s) associated with it. Purchase history must be preserved.`,
      );
    }

    if (ledgerEntryCount > 0) {
      throw new BadRequestException(
        `Cannot delete this purchase because it has ${ledgerEntryCount} supplier ledger entry/entries associated with it. Purchase history must be preserved.`,
      );
    }

    const attachments = await this.attachmentsService.findByEntity(
      AttachmentEntityType.PURCHASE,
      id,
    );
    if (attachments.length > 0) {
      throw new BadRequestException(
        `Cannot delete this purchase because it has ${attachments.length} attached document(s). Delete the documents first.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.remove(purchase);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
