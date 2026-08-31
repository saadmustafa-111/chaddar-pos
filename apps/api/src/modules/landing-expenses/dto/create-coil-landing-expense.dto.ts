import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCoilLandingExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @IsOptional()
  type?: string;

  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: number }) => Math.round(value))
  amountPaisa: number;

  @IsDateString()
  @IsNotEmpty()
  expenseDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  referenceNumber?: string;
}
