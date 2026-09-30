import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PortfoliosService } from './portfolios.service.js';
import { PortfoliosController } from './portfolios.controller.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [PortfoliosService],
  controllers: [PortfoliosController],
})
export class PortfoliosModule {}
