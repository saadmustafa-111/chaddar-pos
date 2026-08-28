import { IsOptional, IsString } from 'class-validator';

export class UpdateCoilDto {
  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
