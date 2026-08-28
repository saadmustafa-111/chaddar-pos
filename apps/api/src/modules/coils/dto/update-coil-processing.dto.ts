import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ProcessingStatus } from '../entities/coil.entity';

export class UpdateCoilProcessingDto {
  @IsString()
  @IsOptional()
  @IsIn(Object.values(ProcessingStatus))
  processingStatus?: ProcessingStatus;

  @IsDateString()
  @IsOptional()
  processingDate?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : String(value),
  )
  processingNote?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }: { value: number | string | undefined }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return isNaN(parsed) ? undefined : Math.round(parsed * 1000) / 1000;
  })
  wastageWeight?: number;
}
