import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Coil } from '../coils/entities/coil.entity';
import { CoilLandingExpense } from '../landing-expenses/entities/coil-landing-expense.entity';
import { SupplierLedgerEntry } from '../suppliers/entities/supplier-ledger-entry.entity';
import { CustomerLedgerEntry } from '../customers/entities/customer-ledger-entry.entity';
import { AttachmentEntityType } from './entities/attachment.entity';

@Injectable()
export class AttachmentEntityValidator {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Coil)
    private readonly coilRepo: Repository<Coil>,
    @InjectRepository(CoilLandingExpense)
    private readonly expenseRepo: Repository<CoilLandingExpense>,
    @InjectRepository(SupplierLedgerEntry)
    private readonly supplierLedgerRepo: Repository<SupplierLedgerEntry>,
    @InjectRepository(CustomerLedgerEntry)
    private readonly customerLedgerRepo: Repository<CustomerLedgerEntry>,
  ) {}

  async validateEntityExists(
    entityType: AttachmentEntityType,
    entityId: number,
  ): Promise<void> {
    let exists = false;

    switch (entityType) {
      case AttachmentEntityType.SUPPLIER:
        exists =
          (await this.supplierRepo.count({ where: { id: entityId } })) > 0;
        break;
      case AttachmentEntityType.CUSTOMER:
        exists =
          (await this.customerRepo.count({ where: { id: entityId } })) > 0;
        break;
      case AttachmentEntityType.PURCHASE:
        exists =
          (await this.purchaseRepo.count({ where: { id: entityId } })) > 0;
        break;
      case AttachmentEntityType.SALE:
        exists = (await this.saleRepo.count({ where: { id: entityId } })) > 0;
        break;
      case AttachmentEntityType.COIL:
        exists = (await this.coilRepo.count({ where: { id: entityId } })) > 0;
        break;
      case AttachmentEntityType.EXPENSE:
      case AttachmentEntityType.COIL_LANDING_EXPENSE:
        exists =
          (await this.expenseRepo.count({ where: { id: entityId } })) > 0;
        break;
      case AttachmentEntityType.PURCHASE_PAYMENT:
        exists =
          (await this.supplierLedgerRepo.count({ where: { id: entityId } })) >
          0;
        break;
      case AttachmentEntityType.CUSTOMER_PAYMENT:
        exists =
          (await this.customerLedgerRepo.count({ where: { id: entityId } })) >
          0;
        break;
      case AttachmentEntityType.OTHER:
        exists = true;
        break;
    }

    if (!exists) {
      throw new BadRequestException(
        `${entityType} with ID ${entityId} does not exist`,
      );
    }
  }
}
