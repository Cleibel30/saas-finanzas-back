import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/company.dto';
import { Request } from 'express'; // Importa esto para usar el tipo Request
import { UserDto } from '@/auth/dto/user.dto';
import { AuthGuard } from '@nestjs/passport';
import { ValidateCompanyGuard } from './guards/validate-company/validate-company.guard';
import { Throttle } from '@nestjs/throttler';

@Controller('company')
export class CompanyController {
  constructor(private companyService: CompanyService) {}

  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('create')
  async createCompany(
    @Body() companyData: CreateCompanyDto,
    @Req() req: Request & { user: UserDto },
  ) {
    return this.companyService.createCompany(companyData, req.user.userId);
  }

  @Patch('update/:id')
  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  async updateCompany(
    @Body() companyData: CreateCompanyDto,
    @Param('id') companyId: string,
    @Req() req: Request & { user: UserDto },
  ) {
    return this.companyService.updateCompany(
      companyId,
      companyData,
      req.user.userId,
    );
  }

  @Get('my-companies')
  @UseGuards(AuthGuard('jwt'))
  async getMyCompanies(@Req() req: Request & { user: UserDto }) {
    return this.companyService.getCompaniesByUser(req.user.userId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  async getCompanyById(
    @Param('id') companyId: string,
    @Req() req: Request & { user: UserDto },
  ) {
    return this.companyService.getCompanyById(companyId, req.user.userId);
  }
}
