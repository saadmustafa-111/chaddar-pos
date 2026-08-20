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
  ],
})
export class AppModule {}
