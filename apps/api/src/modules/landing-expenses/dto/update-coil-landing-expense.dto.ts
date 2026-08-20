import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { LandingExpenseType } from '../entities/coil-landing-expense.entity';

export class UpdateCoilLandingExpenseDto {
  @IsEnum(LandingExpenseType)
  @IsOptional()
  type?: LandingExpenseType;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }: { value: number | undefined }) =>
    value !== undefined ? Math.round(value) : undefined,
  )
  amountPaisa?: number;

  @IsDateString()
  @IsOptional()
  expenseDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  referenceNumber?: string;
}
