import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CoilsService, CoilFilters } from './coils.service';
import { InventoryStatus } from './entities/coil.entity';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { Coil } from './entities/coil.entity';
import { InventoryMovement } from '../inventory-movements/entities/inventory-movement.entity';

@Controller('coils')
@UseGuards(SessionAuthGuard)
export class CoilsController {
  constructor(private readonly coilsService: CoilsService) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: InventoryStatus,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<Coil[]> {
    const filters: CoilFilters = {
      search,
      supplierId: supplierId ? parseInt(supplierId, 10) : undefined,
      status,
      dateFrom,
      dateTo,
    };
    return this.coilsService.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Coil> {
    return this.coilsService.findOne(id);
  }

  @Get(':id/movements')
  async getMovements(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<InventoryMovement[]> {
    return this.coilsService.getMovements(id);
  }
}
