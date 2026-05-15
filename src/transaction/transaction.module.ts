import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { CompanyModule } from '@/company/company.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  controllers: [TransactionController],
  providers: [TransactionService],
  imports: [CompanyModule, PrismaModule],
})
export class TransactionModule {}
