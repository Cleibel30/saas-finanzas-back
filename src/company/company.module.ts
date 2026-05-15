import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { ValidateCompanyGuard } from './guards/validate-company/validate-company.guard';

@Module({
  controllers: [CompanyController],
  providers: [CompanyService, ValidateCompanyGuard],
  imports: [PrismaModule],
  exports: [CompanyService, ValidateCompanyGuard],
})
export class CompanyModule {}
