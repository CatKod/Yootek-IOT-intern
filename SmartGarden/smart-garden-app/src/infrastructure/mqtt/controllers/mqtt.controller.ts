import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { MqttBrokerService } from '../services/mqtt-broker.service';
import { PublishCommandDto } from '../dto/publish-command.dto';

@ApiTags('MQTT')
@ApiBearerAuth()
@Controller('mqtt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MqttController {
  constructor(private readonly mqttBrokerService: MqttBrokerService) {}

  @Get('status')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Trạng thái kết nối MQTT broker' })
  status() {
    return this.mqttBrokerService.getStatus();
  }

  @Post('command')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Publish command tới MQTT broker' })
  publishCommand(@Body() dto: PublishCommandDto) {
    return this.mqttBrokerService.publishToCommandTopic(dto);
  }
}
