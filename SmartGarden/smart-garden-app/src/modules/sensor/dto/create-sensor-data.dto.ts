import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSensorDataDto {
  @ApiProperty()
  @IsString()
  gardenId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  packetNo?: number;

  @ApiProperty()
  @IsNumber()
  temperature!: number;

  @ApiProperty()
  @IsNumber()
  humidity!: number;

  @ApiPropertyOptional({ description: 'Payload gốc từ MQTT' })
  @IsOptional()
  payload?: unknown;
}
