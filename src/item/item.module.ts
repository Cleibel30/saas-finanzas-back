import { Module } from '@nestjs/common';
import { ItemController } from './item.controller';
import { ItemService } from './item.service';
import { CompanyModule } from '@/company/company.module';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  controllers: [ItemController],
  providers: [ItemService],
  imports: [CompanyModule, PrismaModule],
  exports: [ItemService],
})
export class ItemModule {}
