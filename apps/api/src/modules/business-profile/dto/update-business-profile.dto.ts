import { IsString, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateBusinessProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  shopName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  taxNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  footerMessage?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(({ value }: { value: string | null | undefined }) =>
    value === null || value === undefined ? undefined : String(value).trim(),
  )
  logoUrl?: string;
}
