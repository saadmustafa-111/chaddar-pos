import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coil } from './entities/coil.entity';
import { InventoryMovement } from '../inventory-movements/entities/inventory-movement.entity';
import { CoilLandingExpense } from '../landing-expenses/entities/coil-landing-expense.entity';
import { PriceCategory } from '../price-categories/entities/price-category.entity';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { CoilsService } from './coils.service';
import { CoilsController } from './coils.controller';
import { LandingExpensesModule } from '../landing-expenses/landing-expenses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Coil,
      InventoryMovement,
      CoilLandingExpense,
      PriceCategory,
      FinishedChaddarStock,
    ]),
    LandingExpensesModule,
  ],
  controllers: [CoilsController],
  providers: [CoilsService],
  exports: [CoilsService],
})
export class CoilsModule {}
