import { Module } from '@nestjs/common';
import { GrossProfitController } from './gross-profit.controller';
import { GrossProfitService } from './gross-profit.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { CompanyModule } from '@/company/company.module';

@Module({
  controllers: [GrossProfitController],
  providers: [GrossProfitService],
  imports: [PrismaModule, CompanyModule],
  exports: [GrossProfitService],
})
export class GrossProfitModule {}
