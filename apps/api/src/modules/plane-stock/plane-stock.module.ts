import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaneStock } from './entities/plane-stock.entity';
import { Coil } from '../coils/entities/coil.entity';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { CuttingBatch } from '../cutting-batches/entities/cutting-batch.entity';
import { InventoryMovement } from '../inventory-movements/entities/inventory-movement.entity';
import { PlaneStockService } from './plane-stock.service';
import {
  PlaneStockController,
  CoilPlaneStockController,
} from './plane-stock.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlaneStock,
      Coil,
      FinishedChaddarStock,
      CuttingBatch,
      InventoryMovement,
    ]),
  ],
  controllers: [PlaneStockController, CoilPlaneStockController],
  providers: [PlaneStockService],
  exports: [PlaneStockService],
})
export class PlaneStockModule {}
