import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { SalesService, SaleWithItems } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';

@Controller('sales')
@UseGuards(SessionAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  async findAll(
    @Query('customerId') customerId?: string,
  ): Promise<SaleWithItems[]> {
    if (customerId) {
      return this.salesService.findByCustomer(parseInt(customerId, 10));
    }
    return this.salesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<SaleWithItems> {
    return this.salesService.findOne(id);
  }

  @Post()
  async create(
    @Body() createDto: CreateSaleDto,
    @Req() req: { session?: { username?: string } },
  ): Promise<SaleWithItems> {
    return this.salesService.create(createDto, req.session?.username);
  }
}
