import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class MqttPublishDto {
  @ApiPropertyOptional({
    example: 'yootek/iot/esp32/command',
    description: 'MQTT topic để publish. Nếu bỏ trống sẽ dùng topic mặc định trong cấu hình.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  topic?: string;

  @ApiProperty({
    example: {
      action: 'calibrate',
      value: 42,
    },
    description: 'Payload sẽ được serialize sang JSON trước khi gửi lên broker.',
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  retain?: boolean;

  @ApiPropertyOptional({
    example: 0,
    enum: [0, 1, 2],
    default: 0,
    description: 'QoS của MQTT message.',
  })
  @IsOptional()
  @IsIn([0, 1, 2])
  qos?: 0 | 1 | 2;
}
