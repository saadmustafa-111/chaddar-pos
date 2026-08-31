import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  PriceCategoriesService,
  PriceCategoryWithCost,
} from './price-categories.service';
import { UpdatePriceCategoryDto } from './dto/update-price-category.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';

@Controller('price-categories')
@UseGuards(SessionAuthGuard)
export class PriceCategoriesController {
  constructor(
    private readonly priceCategoriesService: PriceCategoriesService,
  ) {}

  @Get()
  async findAll(): Promise<PriceCategoryWithCost[]> {
    return this.priceCategoriesService.findAll();
  }

  @Get('active')
  async findActive(): Promise<PriceCategoryWithCost[]> {
    return this.priceCategoriesService.findActive();
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdatePriceCategoryDto,
  ): Promise<PriceCategoryWithCost> {
    return this.priceCategoriesService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.priceCategoriesService.delete(id);
  }
}
