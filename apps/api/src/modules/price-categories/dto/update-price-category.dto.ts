import { IsInt, Min, IsOptional, IsBoolean } from 'class-validator';

export class UpdatePriceCategoryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  purchaseRatePaisa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sellingRatePaisa?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
