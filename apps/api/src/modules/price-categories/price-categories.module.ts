import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceCategoriesController } from './price-categories.controller';
import { PriceCategoriesService } from './price-categories.service';
import { PriceCategory } from './entities/price-category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PriceCategory])],
  controllers: [PriceCategoriesController],
  providers: [PriceCategoriesService],
  exports: [PriceCategoriesService],
})
export class PriceCategoriesModule {}
