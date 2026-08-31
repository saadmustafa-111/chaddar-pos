import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  MaxLength,
  IsDateString,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateCuttingRowDto {
  /**
   * Length of one piece in feet. Any positive value is allowed - the
   * formula is fully generic (no hardcoded 8/10/12).
   */
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
  lengthFt: number;

  /**
   * Width of the coil in inches. Used for heat number generation.
   * When not provided, the system attempts to derive from coil width.
   */
  @IsOptional()
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
  widthInches?: number;

  /**
   * Number of pieces of `lengthFt` to cut. Integer, must be > 0.
   */
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: unknown }) => Math.round(Number(value)))
  quantity: number;
}

/**
 * Payload for `POST /coils/:coilId/cutting-batches`.
 *
 * The shop-floor workflow is now:
 *   - The operator types N rows of (lengthFt, quantity). e.g.
 *       [{lengthFt: 8, quantity: 110}, {lengthFt: 10, quantity: 70}].
 *   - The service computes:
 *       tenFtEquivalentQty  = SUM(lengthFt * qty) / 10
 *       avg10ftPieceWeight  = usableCoilWeight / tenFtEquivalentQty
 *       pieceWeight         = avg10ftPieceWeight * (lengthFt / 10)
 *       totalSizeWeight     = pieceWeight * quantity
 *   - One CuttingBatch record is created with the totals; one
 *     FinishedChaddarStock row is created per input row.
 */
export class CreateCuttingBatchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => (value ?? '').trim())
  sizeLabel: string;

  /**
   * Optional: list of size rows to cut in this batch. When omitted or
   * empty the request is rejected; the new flow has no single-row mode.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateCuttingRowDto)
  rows: CreateCuttingRowDto[];

  /**
   * Optional explicit usable-coil-weight override (KG). When omitted the
   * service uses the coil's current remaining usable weight from the
   * finished-cost computation.
   */
  @IsOptional()
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
  usableCoilWeightKg?: number;

  @IsDateString()
  @IsNotEmpty()
  productionDate: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  note?: string;
}
