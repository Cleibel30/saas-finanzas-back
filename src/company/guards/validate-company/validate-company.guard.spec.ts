import { ValidateCompanyGuard } from './validate-company.guard';
import { CompanyService } from '@/company/company.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('ValidateCompanyGuard', () => {
  it('should be defined', () => {
    const companyService = {} as CompanyService;
    const prismaService = {} as PrismaService;
    expect(
      new ValidateCompanyGuard(companyService, prismaService),
    ).toBeDefined();
  });
});
