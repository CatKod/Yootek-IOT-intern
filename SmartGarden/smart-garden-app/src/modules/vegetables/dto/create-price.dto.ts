import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class CreatePriceDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;
}
