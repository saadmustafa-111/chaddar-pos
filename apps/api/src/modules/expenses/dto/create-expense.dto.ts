import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { ExpenseCategory } from '../entities/expense.entity';

export class CreateExpenseDto {
  @IsDateString()
  expenseDate: string;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customCategory?: string;

  @IsInt()
  @Min(1)
  amountPaisa: number;

  @IsOptional()
  @IsString()
  note?: string;
}
