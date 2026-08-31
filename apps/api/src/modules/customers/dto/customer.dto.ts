import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsIn,
  Min,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateCustomerDto {
  @IsString()
  @IsOptional()
  @MaxLength(20)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  code?: string;

  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => String(value).trim())
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : String(value).trim(),
  )
  phone?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : String(value).trim(),
  )
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : String(value).trim(),
  )
  note?: string;
}

export class UpdateCustomerDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  phone?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  note?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: number }) => Math.round(Number(value)))
  amountPaisa: number;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  note?: string;
}

export class CustomerFiltersDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: 'true' | 'false';
}
