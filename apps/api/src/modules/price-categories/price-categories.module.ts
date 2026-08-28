import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceCategoriesController } from './price-categories.controller';
import { PriceCategoriesService } from './price-categories.service';
import { PriceCategory } from './entities/price-category.entity';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { Coil } from '../coils/entities/coil.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PriceCategory, FinishedChaddarStock, Coil]),
  ],
  controllers: [PriceCategoriesController],
  providers: [PriceCategoriesService],
  exports: [PriceCategoriesService],
})
export class PriceCategoriesModule {}
