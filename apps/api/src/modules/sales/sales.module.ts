import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { Coil } from '../coils/entities/coil.entity';
import { InventoryMovement } from '../inventory-movements/entities/inventory-movement.entity';
import { PriceCategory } from '../price-categories/entities/price-category.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      FinishedChaddarStock,
      Coil,
      InventoryMovement,
      PriceCategory,
    ]),
    CustomersModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
