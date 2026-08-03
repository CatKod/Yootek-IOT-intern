import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('hello')
  @ApiOperation({ summary: 'Kiểm tra API hoạt động' })
  @ApiResponse({ status: 200, description: 'API đang hoạt động' })
  getHello(): { message: string } {
    return this.appService.getHello();
  }
}
