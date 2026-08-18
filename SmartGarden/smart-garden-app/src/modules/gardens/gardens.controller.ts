import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/types/auth-request.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlLedDto } from './dto/control-led.dto';
import { CreateGardenDto } from './dto/create-garden.dto';
import { UpdateGardenDto } from './dto/update-garden.dto';
import { GardensService } from './gardens.service';

@ApiTags('Gardens')
@ApiBearerAuth()
@Controller('gardens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GardensController {
  constructor(private readonly gardensService: GardensService) {}

  @Post()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Tạo khu vườn' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGardenDto) {
    return this.gardensService.create(user.sub, user.role, dto);
  }

  @Get()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Lấy danh sách khu vườn' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.gardensService.findAll(user.sub, user.role);
  }

  @Get('revenue/all')
  @Roles('admin')
  @ApiOperation({ summary: 'Tổng doanh thu toàn hệ thống theo ngày/tuần/tháng' })
  allRevenue(@Query('range') range: 'day' | 'week' | 'month' = 'day') {
    return this.gardensService.getAllRevenue(range);
  }

  @Get(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Lấy chi tiết khu vườn' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.gardensService.findOne(id, user.sub, user.role);
  }

  @Get(':id/revenue')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Doanh thu của một khu vườn' })
  revenue(@Param('id') id: string, @Query('range') range: 'day' | 'week' | 'month' = 'day') {
    return this.gardensService.getRevenue(id, range);
  }

  @Patch(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Cập nhật khu vườn' })
  update(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateGardenDto) {
    return this.gardensService.update(id, user.sub, user.role, dto);
  }

  @Delete(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Xóa khu vườn' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.gardensService.remove(id, user.sub, user.role);
  }

  @Post(':id/led')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Điều khiển bật/tắt đèn qua MQTT' })
  setLedState(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: ControlLedDto) {
    return this.gardensService.setLedState(id, user.sub, user.role, dto);
  }
}
