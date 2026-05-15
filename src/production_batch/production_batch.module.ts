import { Module } from '@nestjs/common';
import { ProductionBatchService } from './production_batch.service';
import { ProductionBatchController } from './production_batch.controller';
import { CompanyModule } from '@/company/company.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  providers: [ProductionBatchService],
  controllers: [ProductionBatchController],
  imports: [CompanyModule, PrismaModule],
})
export class ProductionBatchModule {}
