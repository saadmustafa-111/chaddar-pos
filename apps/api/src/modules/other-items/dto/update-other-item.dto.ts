import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpdateOtherItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePaisa?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
