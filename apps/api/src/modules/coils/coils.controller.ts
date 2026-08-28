import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  CoilsService,
  CoilFilters,
  FinishedCostSummary,
} from './coils.service';
import { InventoryStatus } from './entities/coil.entity';
import { UpdateCoilProcessingDto } from './dto/update-coil-processing.dto';
import { UpdateCoilDto } from './dto/update-coil.dto';
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

  @Get(':id/kg-per-foot')
  async getKgPerFoot(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ kgPerFoot: number | null }> {
    const kgPerFoot = await this.coilsService.getKgPerFoot(id);
    return { kgPerFoot };
  }

  @Patch(':id/processing')
  async updateProcessing(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCoilProcessingDto,
  ): Promise<Coil> {
    return this.coilsService.updateProcessing(id, updateDto);
  }

  @Get(':id/finished-cost')
  async getFinishedCost(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FinishedCostSummary> {
    return this.coilsService.getFinishedCost(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCoilDto,
  ): Promise<Coil> {
    return this.coilsService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.coilsService.delete(id);
  }
}
