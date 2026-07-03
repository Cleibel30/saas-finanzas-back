import { CompanyService } from '@/company/company.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class ValidateCompanyGuard implements CanActivate {
  constructor(
    private companyService: CompanyService,
    private prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Ya viene del AuthGuard("jwt")

    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    // Obtenemos el companyId de los parámetros (ej: /companies/:companyId/items)
    const companyId = request.params.companyId ?? request.params.id;

    if (!companyId) {
      throw new ForbiddenException('Company ID is required for this action');
    }

    // 1. Verificar ownership
    const verification = await this.companyService.verifyCompanyOwnership(
      companyId,
      user.userId,
    );

    if (!verification) {
      throw new UnauthorizedException('You do not have access to this company');
    }

    // 2. Verificar que la compañía no esté suspendida
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { isSuspended: true },
    });

    if (company?.isSuspended) {
      throw new UnauthorizedException(
        'Esta compañía se encuentra suspendida. Contacta al administrador.',
      );
    }

    return true;
  }
}
