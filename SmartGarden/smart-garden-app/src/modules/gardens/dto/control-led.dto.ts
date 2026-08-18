import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum LedState {
  On = 'On',
  Off = 'Off',
}

export class ControlLedDto {
  @ApiProperty({ enum: LedState, default: LedState.On })
  @IsEnum(LedState)
  led1State!: LedState;

  @ApiProperty({ enum: LedState, default: LedState.Off })
  @IsEnum(LedState)
  led2State!: LedState;

  @ApiProperty({ enum: LedState, default: LedState.Off })
  @IsEnum(LedState)
  led3State!: LedState;
}
