import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuttingBatch } from './entities/cutting-batch.entity';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { Coil } from '../coils/entities/coil.entity';
import { InventoryMovement } from '../inventory-movements/entities/inventory-movement.entity';
import { PriceCategory } from '../price-categories/entities/price-category.entity';
import { CuttingBatchesService } from './cutting-batches.service';
import {
  CuttingBatchesController,
  CuttingBatchesRootController,
  FinishedChaddarStockController,
} from './cutting-batches.controller';
import { CoilsModule } from '../coils/coils.module';
import { PriceCategoriesModule } from '../price-categories/price-categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CuttingBatch,
      FinishedChaddarStock,
      Coil,
      InventoryMovement,
      PriceCategory,
    ]),
    CoilsModule,
    PriceCategoriesModule,
  ],
  controllers: [
    CuttingBatchesController,
    CuttingBatchesRootController,
    FinishedChaddarStockController,
  ],
  providers: [CuttingBatchesService],
  exports: [CuttingBatchesService],
})
export class CuttingBatchesModule {}
