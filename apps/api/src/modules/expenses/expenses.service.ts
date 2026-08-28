import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, ExpenseCategory } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

export interface ExpenseSummary {
  totalExpensesPaisa: number;
  byCategory: { category: string; total: number }[];
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async create(dto: CreateExpenseDto, createdBy?: string): Promise<Expense> {
    if (dto.category === ExpenseCategory.OTHER && !dto.customCategory?.trim()) {
      throw new BadRequestException(
        'Custom category name is required when selecting "Other / Custom"',
      );
    }

    const expense = this.expenseRepository.create({
      expenseDate: new Date(dto.expenseDate),
      category: dto.category,
      customCategory: dto.customCategory?.trim() || null,
      amountPaisa: dto.amountPaisa,
      note: dto.note?.trim() || null,
      createdBy: createdBy || null,
    });

    return this.expenseRepository.save(expense);
  }

  async findAll(filters?: {
    dateFrom?: string;
    dateTo?: string;
    category?: ExpenseCategory;
    search?: string;
  }): Promise<Expense[]> {
    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .orderBy('expense.expense_date', 'DESC')
      .addOrderBy('expense.created_at', 'DESC');

    if (filters?.dateFrom) {
      qb.andWhere('expense.expense_date >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }

    if (filters?.dateTo) {
      qb.andWhere('expense.expense_date <= :dateTo', {
        dateTo: filters.dateTo,
      });
    }

    if (filters?.category) {
      qb.andWhere('expense.category = :category', {
        category: filters.category,
      });
    }

    if (filters?.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      qb.andWhere(
        '(LOWER(expense.note) LIKE LOWER(:search) OR LOWER(expense.custom_category) LIKE LOWER(:search))',
        { search: term },
      );
    }

    return qb.getMany();
  }

  async findOne(id: number): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({ where: { id } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  async update(id: number, dto: UpdateExpenseDto): Promise<Expense> {
    const expense = await this.findOne(id);

    if (
      dto.category === ExpenseCategory.OTHER &&
      !dto.customCategory?.trim() &&
      !expense.customCategory
    ) {
      throw new BadRequestException(
        'Custom category name is required when selecting "Other / Custom"',
      );
    }

    if (dto.expenseDate !== undefined) {
      expense.expenseDate = new Date(dto.expenseDate);
    }

    if (dto.category !== undefined) {
      expense.category = dto.category;
    }

    if (dto.customCategory !== undefined) {
      expense.customCategory = dto.customCategory?.trim() || null;
    }

    if (dto.amountPaisa !== undefined) {
      expense.amountPaisa = dto.amountPaisa;
    }

    if (dto.note !== undefined) {
      expense.note = dto.note?.trim() || null;
    }

    return this.expenseRepository.save(expense);
  }

  async delete(id: number): Promise<void> {
    const expense = await this.findOne(id);
    await this.expenseRepository.remove(expense);
  }

  async getSummary(filters?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ExpenseSummary> {
    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .select('expense.category', 'category')
      .addSelect('COALESCE(SUM(expense.amount_paisa), 0)', 'total')
      .groupBy('expense.category')
      .orderBy('total', 'DESC');

    if (filters?.dateFrom) {
      qb.andWhere('expense.expense_date >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }

    if (filters?.dateTo) {
      qb.andWhere('expense.expense_date <= :dateTo', {
        dateTo: filters.dateTo,
      });
    }

    const rows = await qb.getRawMany<{
      category: string;
      total: string | number;
    }>();

    const byCategory = rows.map((r) => ({
      category: r.category,
      total: Number(r.total),
    }));

    const totalExpensesPaisa = byCategory.reduce((sum, c) => sum + c.total, 0);

    return { totalExpensesPaisa, byCategory };
  }

  async getTotalInPeriod(dateFrom: string, dateTo: string): Promise<number> {
    const result = (await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount_paisa), 0)', 'total')
      .where('expense.expense_date >= :dateFrom', { dateFrom })
      .andWhere('expense.expense_date <= :dateTo', { dateTo })
      .getRawOne()) as { total: string | number } | null;
    return Number(result?.total ?? 0);
  }
}
