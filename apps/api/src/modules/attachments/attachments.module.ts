import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Attachment } from './entities/attachment.entity';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_SERVICE } from './storage.interface';
import { AttachmentEntityValidator } from './attachment-entity-validator';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Coil } from '../coils/entities/coil.entity';
import { CoilLandingExpense } from '../landing-expenses/entities/coil-landing-expense.entity';
import { SupplierLedgerEntry } from '../suppliers/entities/supplier-ledger-entry.entity';
import { CustomerLedgerEntry } from '../customers/entities/customer-ledger-entry.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Attachment,
      Supplier,
      Customer,
      Purchase,
      Sale,
      Coil,
      CoilLandingExpense,
      SupplierLedgerEntry,
      CustomerLedgerEntry,
    ]),
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    LocalStorageService,
    AttachmentEntityValidator,
    { provide: STORAGE_SERVICE, useClass: LocalStorageService },
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
