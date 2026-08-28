import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Coil } from '../coils/entities/coil.entity';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { PlaneStock } from '../plane-stock/entities/plane-stock.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CustomerLedgerEntry } from '../customers/entities/customer-ledger-entry.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SupplierLedgerEntry } from '../suppliers/entities/supplier-ledger-entry.entity';
import { CustomersModule } from '../customers/customers.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      Coil,
      FinishedChaddarStock,
      PlaneStock,
      Customer,
      CustomerLedgerEntry,
      Supplier,
      SupplierLedgerEntry,
    ]),
    CustomersModule,
    ExpensesModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
