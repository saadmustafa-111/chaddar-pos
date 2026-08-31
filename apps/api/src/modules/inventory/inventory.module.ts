import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coil } from '../coils/entities/coil.entity';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { CuttingBatch } from '../cutting-batches/entities/cutting-batch.entity';
import { PriceCategory } from '../price-categories/entities/price-category.entity';
import { InventoryMovement } from '../inventory-movements/entities/inventory-movement.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Coil,
      FinishedChaddarStock,
      CuttingBatch,
      PriceCategory,
      InventoryMovement,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
