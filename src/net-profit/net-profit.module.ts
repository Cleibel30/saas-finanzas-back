import { Module } from '@nestjs/common';
import { NetProfitController } from './net-profit.controller';
import { NetProfitService } from './net-profit.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { CompanyModule } from '@/company/company.module';
import { GrossProfitModule } from '@/gross-profit/gross-profit.module';

@Module({
  controllers: [NetProfitController],
  providers: [NetProfitService],
  imports: [PrismaModule, CompanyModule, GrossProfitModule],
  exports: [NetProfitService],
})
export class NetProfitModule {}
