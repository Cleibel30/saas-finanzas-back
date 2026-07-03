import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async createCompany(companyData: CreateCompanyDto, userId: string) {
    return this.prisma.company.create({
      data: {
        name: companyData.name,
        userId,
      },
    });
  }

  async getCompaniesByUser(userId: string) {
    return this.prisma.company.findMany({
      where: { userId },
    });
  }

  async getCompanyById(companyId: string, userId: string) {
    return this.prisma.company.findFirst({
      where: { id: companyId, userId },
    });
  }

  async updateCompany(
    companyId: string,
    companyData: CreateCompanyDto,
    userId: string,
  ) {
    return this.prisma.company.updateMany({
      where: { id: companyId, userId },
      data: { name: companyData.name },
    });
  }

  async verifyCompanyOwnership(companyId: string, userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, userId },
    });
    return !!company; // Return true if company exists, false otherwise
  }
}
