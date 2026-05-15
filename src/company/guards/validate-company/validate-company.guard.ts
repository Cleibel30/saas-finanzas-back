import { CompanyService } from '@/company/company.service';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ValidateCompanyGuard implements CanActivate {
  constructor(private companyService: CompanyService) { }
  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Ya viene del AuthGuard("jwt")

    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    // Obtenemos el companyId de los parámetros (ej: /companies/:companyId/items)
    const companyId = request.params.companyId;

    if (!companyId) {
      throw new ForbiddenException('Company ID is required for this action');
    }

    const verification = await this.companyService.verifyCompanyOwnership(companyId, user.userId);

    if (!verification) {
      throw new UnauthorizedException('You do not have access to this company');
    }

    return true;
  }
}
