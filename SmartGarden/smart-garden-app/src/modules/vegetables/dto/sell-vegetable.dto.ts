import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SellVegetableDto {
  @ApiProperty({ description: 'Số lượng bán ra' })
  @IsInt()
  @Min(1)
  quantity!: number;
}
