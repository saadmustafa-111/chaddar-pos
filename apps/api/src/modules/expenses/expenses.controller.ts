import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { Expense, ExpenseCategory } from './entities/expense.entity';
import { ExpenseSummary } from './expenses.service';

@Controller('expenses')
@UseGuards(SessionAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  async findAll(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('category') category?: ExpenseCategory,
    @Query('search') search?: string,
  ): Promise<Expense[]> {
    return this.expensesService.findAll({ dateFrom, dateTo, category, search });
  }

  @Get('summary')
  async getSummary(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<ExpenseSummary> {
    return this.expensesService.getSummary({ dateFrom, dateTo });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Expense> {
    return this.expensesService.findOne(id);
  }

  @Post()
  async create(
    @Body() createDto: CreateExpenseDto,
    @Req() req: { session?: { username?: string } },
  ): Promise<Expense> {
    return this.expensesService.create(createDto, req.session?.username);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateExpenseDto,
  ): Promise<Expense> {
    return this.expensesService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.expensesService.delete(id);
  }
}
