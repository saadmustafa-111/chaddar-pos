import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { LandingExpensesService } from './landing-expenses.service';
import { CreateCoilLandingExpenseDto } from './dto/create-coil-landing-expense.dto';
import { UpdateCoilLandingExpenseDto } from './dto/update-coil-landing-expense.dto';
import { CoilLandingExpense } from './entities/coil-landing-expense.entity';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';

@Controller('coils/:coilId/landing-expenses')
@UseGuards(SessionAuthGuard)
export class LandingExpensesController {
  constructor(
    private readonly landingExpensesService: LandingExpensesService,
  ) {}

  @Get()
  async findAll(
    @Param('coilId', ParseIntPipe) coilId: number,
  ): Promise<CoilLandingExpense[]> {
    return this.landingExpensesService.findByCoil(coilId);
  }

  @Post()
  async create(
    @Param('coilId', ParseIntPipe) coilId: number,
    @Body() createDto: CreateCoilLandingExpenseDto,
  ): Promise<CoilLandingExpense> {
    return this.landingExpensesService.create(coilId, createDto);
  }

  @Patch(':id')
  async update(
    @Param('coilId', ParseIntPipe) coilId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCoilLandingExpenseDto,
  ): Promise<CoilLandingExpense> {
    return this.landingExpensesService.update(id, updateDto);
  }

  @Delete(':id')
  async remove(
    @Param('coilId', ParseIntPipe) coilId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean }> {
    await this.landingExpensesService.remove(id);
    return { success: true };
  }
}
