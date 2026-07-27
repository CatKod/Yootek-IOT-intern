import { IsOptional, IsString } from 'class-validator';

export class UpsertProfileDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
