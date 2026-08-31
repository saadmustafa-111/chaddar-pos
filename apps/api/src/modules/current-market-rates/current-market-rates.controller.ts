import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  CurrentMarketRatesService,
  MarketRateWithFamily,
  MarketRateHistoryEntry,
  MarketRateDisplayRow,
} from './current-market-rates.service';
import { UpdateMarketRateDto } from './dto/update-market-rate.dto';
import { CurrentMarketRate } from './entities/current-market-rate.entity';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { MaterialFamiliesService } from '../material-families/material-families.service';

@Controller('market-rates')
@UseGuards(SessionAuthGuard)
export class CurrentMarketRatesController {
  constructor(
    private readonly marketRatesService: CurrentMarketRatesService,
    private readonly materialFamiliesService: MaterialFamiliesService,
  ) {}

  @Get()
  async findAll(): Promise<MarketRateWithFamily[]> {
    return this.marketRatesService.findAll();
  }

  @Get('display')
  async findAllForDisplay(): Promise<MarketRateDisplayRow[]> {
    return this.marketRatesService.findAllForDisplay();
  }

  @Put(':familyId')
  async upsertRate(
    @Param('familyId', ParseIntPipe) familyId: number,
    @Body() dto: UpdateMarketRateDto,
  ): Promise<CurrentMarketRate> {
    await this.materialFamiliesService.findOne(familyId);
    return this.marketRatesService.upsertRate(familyId, dto);
  }

  @Get(':familyId/history')
  async getHistory(
    @Param('familyId', ParseIntPipe) familyId: number,
  ): Promise<MarketRateHistoryEntry[]> {
    await this.materialFamiliesService.findOne(familyId);
    return this.marketRatesService.getHistory(familyId);
  }
}
