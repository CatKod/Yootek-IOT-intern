import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { GardenModule } from './modules/gardens/garden.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { loadConfiguration } from './config/configuration';
import { MqttModule } from './infrastructure/mqtt/mqtt.module';
import { PriceModule } from './modules/price/price.module';
import { PrismaModule } from './prisma/prisma.module';
import { SensorModule } from './modules/sensor/sensor.module';
import { VegetablesModule } from './modules/vegetables/vegetables.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: '.env',
      load: [loadConfiguration],
    }),
    PrismaModule,
    AuthModule,
    GardenModule,
    VegetablesModule,
    SensorModule,
    PriceModule,
    MqttModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
