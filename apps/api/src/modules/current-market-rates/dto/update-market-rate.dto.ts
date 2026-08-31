import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateMarketRateDto {
  @IsInt()
  @IsOptional()
  materialFamilyId?: number;

  @IsInt()
  @IsOptional()
  rawMaterialRatePaisa?: number;

  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  notes?: string;
}
