import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/types/auth-request.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PriceService, type RevenueRange } from './price.service';

@ApiTags('Price & Revenue')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Get('price')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Lấy danh sách giá của rau theo ngày, tuần, tháng' })
  @ApiQuery({ name: 'range', enum: ['day', 'week', 'month'], required: false, description: 'Khoảng thời gian' })
  getPriceList(@Query('range') range: RevenueRange = 'day', @CurrentUser() user: AuthUser) {
    return this.priceService.getPriceList(range, user.sub, user.role);
  }

  @Get('all/price')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Tổng doanh thu theo ngày, tuần, tháng' })
  @ApiQuery({ name: 'range', enum: ['day', 'week', 'month'], required: false, description: 'Khoảng thời gian' })
  getAllRevenue(@Query('range') range: RevenueRange = 'day', @CurrentUser() user: AuthUser) {
    return this.priceService.getAllRevenue(range, user.sub, user.role);
  }
}
