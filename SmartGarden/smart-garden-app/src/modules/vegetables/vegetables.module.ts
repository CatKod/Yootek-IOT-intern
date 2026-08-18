import { Module } from '@nestjs/common';
import { VegetablesController } from './vegetables.controller';
import { VegetablesService } from './vegetables.service';

@Module({
  controllers: [VegetablesController],
  providers: [VegetablesService],
  exports: [VegetablesService],
})
export class VegetablesModule {}
