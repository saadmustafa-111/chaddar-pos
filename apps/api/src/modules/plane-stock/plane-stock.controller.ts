import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  PlaneStockService,
  PlaneStockRow,
  PlaneStockSummary,
} from './plane-stock.service';
import { MoveToPlaneDto } from './dto/move-to-plane.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';

@Controller('plane-stock')
@UseGuards(SessionAuthGuard)
export class PlaneStockController {
  constructor(private readonly planeStockService: PlaneStockService) {}

  @Get('summary')
  async getSummary(): Promise<PlaneStockSummary> {
    return this.planeStockService.getSummary();
  }

  @Get()
  async findAll(): Promise<PlaneStockRow[]> {
    return this.planeStockService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<PlaneStockRow> {
    return this.planeStockService.findOne(id);
  }
}

@Controller('coils/:coilId/plane-stock')
@UseGuards(SessionAuthGuard)
export class CoilPlaneStockController {
  constructor(private readonly planeStockService: PlaneStockService) {}

  @Get()
  async findByCoil(
    @Param('coilId', ParseIntPipe) coilId: number,
  ): Promise<PlaneStockRow[]> {
    return this.planeStockService.findByCoil(coilId);
  }

  @Post()
  async moveFromCoil(
    @Param('coilId', ParseIntPipe) coilId: number,
    @Body() dto: MoveToPlaneDto,
    @Req() req: { session?: { username?: string } },
  ): Promise<PlaneStockRow> {
    const created = await this.planeStockService.moveFromCoil(
      coilId,
      dto,
      req.session?.username,
    );
    // Re-read through the rich mapping so the response includes
    // supplier / purchase / material-family names too.
    return this.planeStockService.findOne(created.id);
  }
}
