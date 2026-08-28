import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { PriceCategoriesModule } from './modules/price-categories/price-categories.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { CoilsModule } from './modules/coils/coils.module';
import { InventoryMovementsModule } from './modules/inventory-movements/inventory-movements.module';
import { MaterialFamiliesModule } from './modules/material-families/material-families.module';
import { CuttingBatchesModule } from './modules/cutting-batches/cutting-batches.module';
import { PlaneStockModule } from './modules/plane-stock/plane-stock.module';
import { SalesModule } from './modules/sales/sales.module';
import { CustomersModule } from './modules/customers/customers.module';
import { BusinessProfileModule } from './modules/business-profile/business-profile.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { OtherItemsModule } from './modules/other-items/other-items.module';
import { ExpensesModule } from './modules/expenses/expenses.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    PriceCategoriesModule,
    SuppliersModule,
    PurchasesModule,
    CoilsModule,
    InventoryMovementsModule,
    MaterialFamiliesModule,
    CuttingBatchesModule,
    PlaneStockModule,
    SalesModule,
    CustomersModule,
    BusinessProfileModule,
    InventoryModule,
    DashboardModule,
    AttachmentsModule,
    OtherItemsModule,
    ExpensesModule,
  ],
})
export class AppModule {}
