import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { CompanyModule } from './company/company.module';
import { PrismaModule } from './prisma/prisma.module';
import { TransactionModule } from './transaction/transaction.module';
import { CategoryModule } from './category/category.module';
import { ItemModule } from './item/item.module';
import { ProductionBatchModule } from './production_batch/production_batch.module';


@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CompanyModule,
    PrismaModule,
    TransactionModule,
    CategoryModule,
    ItemModule,
    ProductionBatchModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
