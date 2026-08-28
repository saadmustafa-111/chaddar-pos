import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import {
  CuttingBatchesService,
  CuttingBatchWithStock,
  WeightPerPieceSuggestion,
} from './cutting-batches.service';
import { CreateCuttingBatchDto } from './dto/create-cutting-batch.dto';
import { CuttingBatch } from './entities/cutting-batch.entity';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';

class AdjustStockWeightDto {
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Transform(({ value }: { value: number }) => {
    const parsed = Number(value);
    return isNaN(parsed) ? value : Math.round(parsed * 1000) / 1000;
  })
  remainingWeightKg: number;
}

@Controller('coils/:coilId/cutting-batches')
@UseGuards(SessionAuthGuard)
export class CuttingBatchesController {
  constructor(private readonly cuttingBatchesService: CuttingBatchesService) {}

  @Get()
  async findByCoil(
    @Param('coilId', ParseIntPipe) coilId: number,
  ): Promise<CuttingBatchWithStock[]> {
    return this.cuttingBatchesService.findByCoil(coilId);
  }

  @Post()
  async create(
    @Param('coilId', ParseIntPipe) coilId: number,
    @Body() createDto: CreateCuttingBatchDto,
    @Req() req: { session?: { username?: string } },
  ): Promise<CuttingBatchWithStock> {
    return this.cuttingBatchesService.create(
      coilId,
      createDto,
      req.session?.username,
    );
  }
}

@Controller('cutting-batches')
@UseGuards(SessionAuthGuard)
export class CuttingBatchesRootController {
  constructor(private readonly cuttingBatchesService: CuttingBatchesService) {}

  @Get('suggest-weight')
  async suggestWeight(
    @Query('coilId', ParseIntPipe) coilId: number,
    @Query('sizeLabel') sizeLabel: string,
  ): Promise<WeightPerPieceSuggestion> {
    return this.cuttingBatchesService.suggestWeightPerPiece(coilId, sizeLabel);
  }

  @Get(':id')
  async findOneBatch(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CuttingBatch> {
    return this.cuttingBatchesService.findOneBatch(id);
  }
}

@Controller('finished-chaddar-stock')
@UseGuards(SessionAuthGuard)
export class FinishedChaddarStockController {
  constructor(private readonly cuttingBatchesService: CuttingBatchesService) {}

  @Get()
  async findAll(): Promise<FinishedChaddarStock[]> {
    return this.cuttingBatchesService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FinishedChaddarStock> {
    return this.cuttingBatchesService.findOneStock(id);
  }

  @Patch(':id/adjust-weight')
  async adjustWeight(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdjustStockWeightDto,
    @Req() req: { session?: { username?: string } },
  ): Promise<FinishedChaddarStock> {
    return this.cuttingBatchesService.adjustStockWeight(
      id,
      dto.remainingWeightKg,
      req.session?.username,
    );
  }
}
