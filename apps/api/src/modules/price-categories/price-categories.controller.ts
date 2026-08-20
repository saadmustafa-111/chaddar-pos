import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PriceCategoriesService } from './price-categories.service';
import { UpdatePriceCategoryDto } from './dto/update-price-category.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { PriceCategory } from './entities/price-category.entity';

@Controller('price-categories')
@UseGuards(SessionAuthGuard)
export class PriceCategoriesController {
  constructor(
    private readonly priceCategoriesService: PriceCategoriesService,
  ) {}

  @Get()
  async findAll(): Promise<PriceCategory[]> {
    return this.priceCategoriesService.findAll();
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdatePriceCategoryDto,
  ): Promise<PriceCategory> {
    return this.priceCategoriesService.update(id, updateDto);
  }
}
