import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { SupplierLedgerEntry } from './entities/supplier-ledger-entry.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { SuppliersService } from './suppliers.service';
import { SupplierLedgerService } from './supplier-ledger.service';
import {
  SuppliersController,
  SupplierLedgerController,
} from './suppliers.controller';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier, SupplierLedgerEntry, Purchase]),
    AttachmentsModule,
  ],
  controllers: [SuppliersController, SupplierLedgerController],
  providers: [SuppliersService, SupplierLedgerService],
  exports: [SuppliersService, SupplierLedgerService],
})
export class SuppliersModule {}
