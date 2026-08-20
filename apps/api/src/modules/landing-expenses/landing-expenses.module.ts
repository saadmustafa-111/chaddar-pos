import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoilLandingExpense } from './entities/coil-landing-expense.entity';
import { Coil } from '../coils/entities/coil.entity';
import { LandingExpensesService } from './landing-expenses.service';
import { LandingExpensesController } from './landing-expenses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CoilLandingExpense, Coil])],
  controllers: [LandingExpensesController],
  providers: [LandingExpensesService],
  exports: [LandingExpensesService],
})
export class LandingExpensesModule {}
