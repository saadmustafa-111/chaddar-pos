import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCoilLandingExpenseDto {
  @IsString()
  @IsOptional()
  @MaxLength(20)
  type?: string;

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
  @MaxLength(255)
  referenceNumber?: string;
}
