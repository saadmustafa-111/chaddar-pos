import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsDateString,
  Min,
  MaxLength,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateSaleItemDto {
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: number }) => Math.round(Number(value)))
  finishedStockId: number;

  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: number }) => Math.round(Number(value)))
  piecesSold: number;

  /**
   * Sold weight in KG. Optional — the service will derive it from
   * `piecesSold × stock.weightPerPieceKg` when omitted, so the operator
   * only has to enter the number of pieces.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return isNaN(parsed) ? (value as number) : Math.round(parsed * 1000) / 1000;
  })
  weightSoldKg?: number;

  /**
   * Optional manual selling rate override in paisa. If omitted, the
   * service uses the stock's price category default selling rate (or 0
   * for unassigned stock).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return Math.round(Number(value));
  })
  sellingRatePaisa?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}

export class CreateSaleDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return isNaN(parsed) ? value : parsed;
  })
  customerId?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return Math.round(Number(value));
  })
  paidAmountPaisa?: number;

  @IsDateString()
  saleDate: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;

  /**
   * Optional client-generated UUID used by the POS to dedupe a double
   * click on "Complete Sale". When provided, two POSTs that share the
   * same key within a short window return the existing sale instead
   * of creating a duplicate financial / inventory record.
   */
  @IsString()
  @IsOptional()
  @MaxLength(64)
  idempotencyKey?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];
}
