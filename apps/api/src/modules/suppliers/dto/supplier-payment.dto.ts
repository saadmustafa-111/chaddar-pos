import {
  IsInt,
  IsOptional,
  Min,
  IsDateString,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RecordSupplierPaymentDto {
  /**
   * Amount in paisa (Rs × 100). Positive integer. Must not exceed the
   * supplier's outstanding balance at write time.
   */
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: unknown }) => Math.round(Number(value)))
  amountPaisa: number;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : String(value).trim(),
  )
  note?: string;

  /**
   * Optional reference back to the purchase this payment settles.
   * Stored in the ledger so future audits can link payments to their
   * originating purchase.
   */
  @IsInt()
  @IsOptional()
  @Min(1)
  purchaseId?: number;
}
