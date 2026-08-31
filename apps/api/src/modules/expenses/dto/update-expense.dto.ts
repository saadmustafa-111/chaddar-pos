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

export class UpdateExpenseDto {
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customCategory?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountPaisa?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
