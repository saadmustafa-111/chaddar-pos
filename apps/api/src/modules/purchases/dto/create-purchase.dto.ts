import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsString,
  IsDateString,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCoilDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  materialFamilyId?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  brand?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  batchNumber?: string;

  @IsNumber()
  @Min(0)
  width: number;

  @IsNumber()
  @IsOptional()
  @Min(0.001)
  thicknessMm?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  grossWeight?: number;

  @IsNumber()
  @Min(0.001)
  purchaseWeight: number;

  @IsInt()
  @Min(0)
  purchaseRatePaisa: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  priceCategoryId?: number;
}

export class CreatePurchaseDto {
  @IsInt()
  @Min(1)
  supplierId: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  supplierInvoiceNumber?: string;

  @IsDateString()
  purchaseDate: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCoilDto)
  @IsNotEmpty()
  coils: CreateCoilDto[];
}
