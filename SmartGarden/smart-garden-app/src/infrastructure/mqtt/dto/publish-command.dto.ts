import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PublishCommandDto {
  @ApiProperty()
  @IsString()
  gardenId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  led1State?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  led2State?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  led3State?: string;
}
