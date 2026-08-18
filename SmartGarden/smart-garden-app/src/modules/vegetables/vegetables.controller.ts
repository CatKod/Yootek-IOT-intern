import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/types/auth-request.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePriceDto } from './dto/create-price.dto';
import { CreateVegetableDto } from './dto/create-vegetable.dto';
import { SellVegetableDto } from './dto/sell-vegetable.dto';
import { UpdateVegetableDto } from './dto/update-vegetable.dto';
import { VegetablesService } from './vegetables.service';

@ApiTags('Vegetables')
@ApiBearerAuth()
@Controller('vegetables')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VegetablesController {
  constructor(private readonly vegetablesService: VegetablesService) {}

  @Post()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Thêm loại rau vào khu vườn' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVegetableDto) {
    return this.vegetablesService.create(user.sub, user.role, dto);
  }

  @Get()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Lấy danh sách rau' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.vegetablesService.findAll(user.sub, user.role);
  }

  @Put(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Cập nhật số lượng nhập/bán của rau' })
  update(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateVegetableDto) {
    return this.vegetablesService.update(id, user.sub, user.role, dto);
  }

  @Post(':id/sell')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Bán rau, tạo giao dịch Sale' })
  sell(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: SellVegetableDto) {
    return this.vegetablesService.sell(id, user.sub, user.role, dto.quantity);
  }

  @Post(':id/price')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Nhập giá cho rau' })
  createPrice(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: CreatePriceDto) {
    return this.vegetablesService.createPrice(id, user.sub, user.role, dto);
  }

  @Put(':id/price')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Sửa giá của rau' })
  updatePrice(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: CreatePriceDto) {
    return this.vegetablesService.updatePrice(id, user.sub, user.role, dto);
  }

  @Delete(':id/price')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Xóa giá của rau' })
  deletePrice(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.vegetablesService.deletePrice(id, user.sub, user.role);
  }

  @Get(':id/price')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Lấy giá của rau' })
  getPrice(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.vegetablesService.getPrice(id, user.sub, user.role);
  }
}
