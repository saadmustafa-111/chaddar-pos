import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from './entities/purchase.entity';
import { Coil } from '../coils/entities/coil.entity';
import { InventoryMovement } from '../inventory-movements/entities/inventory-movement.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, Coil, InventoryMovement, Supplier]),
    SuppliersModule,
    AttachmentsModule,
  ],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
