import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { Purchase } from './entities/purchase.entity';

@Controller('purchases')
@UseGuards(SessionAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  async create(@Body() createDto: CreatePurchaseDto): Promise<Purchase> {
    return this.purchasesService.create(createDto);
  }

  @Get()
  async findAll(): Promise<Purchase[]> {
    return this.purchasesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Purchase> {
    return this.purchasesService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.purchasesService.delete(id);
  }
}
