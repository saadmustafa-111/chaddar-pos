import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class MoveToPlaneDto {
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return isNaN(parsed) || !Number.isFinite(parsed)
      ? (value as number)
      : Math.round(parsed * 1000) / 1000;
  })
  weightKg: number;

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
