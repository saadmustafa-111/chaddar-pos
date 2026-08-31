import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentMarketRate } from './entities/current-market-rate.entity';
import { MarketRateHistory } from './entities/market-rate-history.entity';
import { CurrentMarketRatesService } from './current-market-rates.service';
import { CurrentMarketRatesController } from './current-market-rates.controller';
import { Coil } from '../coils/entities/coil.entity';
import { CoilLandingExpense } from '../landing-expenses/entities/coil-landing-expense.entity';
import { MaterialFamiliesModule } from '../material-families/material-families.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CurrentMarketRate,
      MarketRateHistory,
      Coil,
      CoilLandingExpense,
    ]),
    MaterialFamiliesModule,
  ],
  controllers: [CurrentMarketRatesController],
  providers: [CurrentMarketRatesService],
  exports: [CurrentMarketRatesService],
})
export class CurrentMarketRatesModule {}
