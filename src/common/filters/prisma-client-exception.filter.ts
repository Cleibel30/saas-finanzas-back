import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

const PRISMA_TO_HTTP: Record<string, HttpStatus> = {
  P2000: HttpStatus.BAD_REQUEST,
  P2002: HttpStatus.CONFLICT,
  P2003: HttpStatus.CONFLICT,
  P2025: HttpStatus.NOT_FOUND,
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status =
      PRISMA_TO_HTTP[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message: this.getMessage(exception),
      error: this.getError(exception),
    });
  }

  private getMessage(exception: Prisma.PrismaClientKnownRequestError): string {
    if (exception.code === 'P2002') {
      const target = (exception.meta?.target as string[])?.join(', ');
      return target
        ? `Ya existe un registro con el mismo ${target}.`
        : 'Conflicto de unicidad.';
    }
    if (exception.code === 'P2025') return 'Registro no encontrado.';
    if (exception.code === 'P2003') return 'El registro relacionado no existe.';
    return 'Error inesperado en la base de datos.';
  }

  private getError(exception: Prisma.PrismaClientKnownRequestError): string {
    if (exception.code === 'P2002') return 'Conflict';
    if (exception.code === 'P2025') return 'Not Found';
    return 'Internal Server Error';
  }
}
