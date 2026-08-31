import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { SupplierLedgerEntry } from './entities/supplier-ledger-entry.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import {
  SupplierLedgerService,
  SupplierTotals,
} from './supplier-ledger.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { AttachmentEntityType } from '../attachments/entities/attachment.entity';

export interface SupplierWithTotals {
  supplier: Supplier;
  totals: SupplierTotals;
}

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(SupplierLedgerEntry)
    private readonly ledgerRepository: Repository<SupplierLedgerEntry>,
    private readonly dataSource: DataSource,
    private readonly ledgerService: SupplierLedgerService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  private async generateCode(): Promise<string> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = (await queryRunner.query(`
        SELECT MAX(CAST(SUBSTR(code, 5) AS INTEGER)) as max_num
        FROM suppliers
        WHERE code LIKE 'SUP-%'
      `)) as Array<{ max_num: number | null }>;
      const maxNum = result[0]?.max_num ?? 0;
      const nextNum = maxNum + 1;
      const code = `SUP-${String(nextNum).padStart(5, '0')}`;
      await queryRunner.commitTransaction();
      return code;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async create(createDto: CreateSupplierDto): Promise<Supplier> {
    const code = await this.generateCode();

    const supplier = this.supplierRepository.create({
      ...createDto,
      code,
      isActive: createDto.isActive ?? true,
    });

    return this.supplierRepository.save(supplier);
  }

  async findAll(): Promise<Supplier[]> {
    return this.supplierRepository.find({
      order: { code: 'ASC' },
    });
  }

  /**
   * Find all suppliers with their financial totals attached. Used by
   * the suppliers list page so the operator can see outstanding
   * balances at a glance.
   */
  async findAllWithTotals(): Promise<SupplierWithTotals[]> {
    const suppliers = await this.findAll();
    return Promise.all(
      suppliers.map(async (supplier) => ({
        supplier,
        totals: await this.ledgerService.getTotals(supplier.id),
      })),
    );
  }

  async findActive(): Promise<Supplier[]> {
    return this.supplierRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(id: number, updateDto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(id);

    Object.assign(supplier, updateDto);

    return this.supplierRepository.save(supplier);
  }

  /**
   * Convenience wrapper to expose the latest N ledger entries for the
   * supplier detail page header.
   */
  async getRecentLedger(
    supplierId: number,
    limit = 10,
  ): Promise<SupplierLedgerEntry[]> {
    await this.findOne(supplierId);
    return this.ledgerRepository.find({
      where: { supplierId },
      order: { entryDate: 'DESC', createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });
  }

  async delete(id: number): Promise<void> {
    const supplier = await this.findOne(id);

    const purchaseCount = await this.purchaseRepository.count({
      where: { supplierId: id },
    });
    if (purchaseCount > 0) {
      throw new BadRequestException(
        `Cannot delete supplier '${supplier.name}' because it has ${purchaseCount} purchase(s) on record. Archive it instead to keep history intact.`,
      );
    }

    const ledgerCount = await this.ledgerRepository.count({
      where: { supplierId: id },
    });
    if (ledgerCount > 0) {
      throw new BadRequestException(
        `Cannot delete supplier '${supplier.name}' because it has ${ledgerCount} ledger entry/entries on record. Archive it instead to keep history intact.`,
      );
    }

    const attachments = await this.attachmentsService.findByEntity(
      AttachmentEntityType.SUPPLIER,
      id,
    );
    if (attachments.length > 0) {
      throw new BadRequestException(
        `Cannot delete supplier '${supplier.name}' because it has ${attachments.length} attached document(s). Delete the documents first.`,
      );
    }

    await this.supplierRepository.remove(supplier);
  }
}
