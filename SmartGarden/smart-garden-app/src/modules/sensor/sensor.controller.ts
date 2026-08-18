import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/types/auth-request.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto';
import { SensorService } from './sensor.service';

@ApiTags('Sensor Data')
@ApiBearerAuth()
@Controller('sensor-data')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SensorController {
  constructor(private readonly sensorService: SensorService) {}

  @Post()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Thêm dữ liệu cảm biến thủ công hoặc từ MQTT' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSensorDataDto) {
    return this.sensorService.create(dto, user.sub, user.role);
  }

  @Get(':gardenId')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Lấy lịch sử dữ liệu cảm biến của khu vườn' })
  @ApiQuery({ name: 'limit', required: false, description: 'Số bản ghi tối đa (mặc định 100)' })
  @ApiQuery({ name: 'from', required: false, description: 'Thời gian bắt đầu (ISO)' })
  @ApiQuery({ name: 'to', required: false, description: 'Thời gian kết thúc (ISO)' })
  findByGarden(
    @Param('gardenId') gardenId: string,
    @CurrentUser() user: AuthUser,
    @Query('limit') limit = 100,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.sensorService.findByGarden(gardenId, user.sub, user.role, limit, from, to);
  }

  @Get(':gardenId/latest')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Lấy dữ liệu cảm biến mới nhất của khu vườn' })
  latest(@Param('gardenId') gardenId: string, @CurrentUser() user: AuthUser) {
    return this.sensorService.findLatest(gardenId, user.sub, user.role);
  }

  @Get(':gardenId/avg-24h')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Nhiệt độ/độ ẩm trung bình trong 24 giờ' })
  average24h(@Param('gardenId') gardenId: string, @CurrentUser() user: AuthUser) {
    return this.sensorService.getAverage24h(gardenId, user.sub, user.role);
  }
}
