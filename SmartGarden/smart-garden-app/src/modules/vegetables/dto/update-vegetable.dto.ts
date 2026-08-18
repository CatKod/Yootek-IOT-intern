import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateVegetableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Số lượng nhập vào' })
  @IsOptional()
  @IsInt()
  @Min(0)
  importedQuantity?: number;

  @ApiPropertyOptional({ description: 'Số lượng bán ra' })
  @IsOptional()
  @IsInt()
  @Min(0)
  soldQuantity?: number;
}
