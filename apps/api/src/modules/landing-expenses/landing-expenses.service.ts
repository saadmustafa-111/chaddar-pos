import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  CoilLandingExpense,
  LandingExpenseType,
} from './entities/coil-landing-expense.entity';
import { CreateCoilLandingExpenseDto } from './dto/create-coil-landing-expense.dto';
import { UpdateCoilLandingExpenseDto } from './dto/update-coil-landing-expense.dto';
import { Coil } from '../coils/entities/coil.entity';

@Injectable()
export class LandingExpensesService {
  constructor(
    @InjectRepository(CoilLandingExpense)
    private readonly expenseRepository: Repository<CoilLandingExpense>,
    @InjectRepository(Coil)
    private readonly coilRepository: Repository<Coil>,
    private readonly dataSource: DataSource,
  ) {}

  async findByCoil(coilId: number): Promise<CoilLandingExpense[]> {
    return this.expenseRepository.find({
      where: { coilId },
      order: { expenseDate: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(id: number): Promise<CoilLandingExpense> {
    const expense = await this.expenseRepository.findOne({
      where: { id },
    });

    if (!expense) {
      throw new NotFoundException('Landing expense not found');
    }

    return expense;
  }

  async create(
    coilId: number,
    createDto: CreateCoilLandingExpenseDto,
  ): Promise<CoilLandingExpense> {
    const coil = await this.coilRepository.findOne({
      where: { id: coilId },
    });

    if (!coil) {
      throw new NotFoundException('Coil not found');
    }

    const expense = this.expenseRepository.create({
      coilId,
      type: createDto.type ?? LandingExpenseType.OTHER,
      amountPaisa: createDto.amountPaisa,
      expenseDate: new Date(createDto.expenseDate),
      description: createDto.description.trim(),
      referenceNumber: createDto.referenceNumber?.trim() || null,
    });

    return this.expenseRepository.save(expense);
  }

  async update(
    id: number,
    updateDto: UpdateCoilLandingExpenseDto,
  ): Promise<CoilLandingExpense> {
    const expense = await this.findOne(id);

    if (updateDto.type !== undefined) {
      expense.type = updateDto.type;
    }

    if (updateDto.amountPaisa !== undefined) {
      expense.amountPaisa = updateDto.amountPaisa;
    }

    if (updateDto.expenseDate !== undefined) {
      expense.expenseDate = new Date(updateDto.expenseDate);
    }

    if (updateDto.description !== undefined) {
      expense.description = updateDto.description?.trim() || null;
    }

    if (updateDto.referenceNumber !== undefined) {
      expense.referenceNumber = updateDto.referenceNumber || null;
    }

    return this.expenseRepository.save(expense);
  }

  async remove(id: number): Promise<void> {
    const expense = await this.findOne(id);
    await this.expenseRepository.remove(expense);
  }

  async calculateTotalLandingExpenses(coilId: number): Promise<number> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = (await queryRunner.query(
        `SELECT SUM(amount_paisa) as total FROM coil_landing_expenses WHERE coil_id = ?`,
        [coilId],
      )) as Array<{ total: number | null }>;

      await queryRunner.commitTransaction();
      return result[0]?.total ?? 0;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
