import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { LandingExpenseType } from '../entities/coil-landing-expense.entity';

export class CreateCoilLandingExpenseDto {
  @IsEnum(LandingExpenseType)
  @IsNotEmpty()
  type: LandingExpenseType;

  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: number }) => Math.round(value))
  amountPaisa: number;

  @IsDateString()
  @IsNotEmpty()
  expenseDate: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  referenceNumber?: string;
}
