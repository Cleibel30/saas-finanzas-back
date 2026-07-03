import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpService } from './mcp.service';
import { Request, Response } from 'express';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import { UserDto } from '@/auth/dto/user.dto';
import { mcpTenantContext } from './mcp-tenant.context';
import { ConfigService } from '@nestjs/config';

type McpSession = {
  transport: SSEServerTransport;
  companyId: string;
  userId: string;
};

@Controller('mcp')
export class McpController {
  private readonly sessions = new Map<string, McpSession>();

  constructor(
    private readonly mcpService: McpService,
    private readonly configService: ConfigService,
  ) {}

  private assertMcpHttpEnabled(): void {
    const enabled =
      this.configService
        .get<string>('MCP_HTTP_ENABLED', 'false')
        .toLowerCase() === 'true';
    if (!enabled) {
      throw new ForbiddenException('El endpoint MCP HTTP está deshabilitado');
    }
  }

  @Get('sse/:companyId')
  @UseGuards(ValidateCompanyGuard)
  async handleSse(
    @Param('companyId') companyId: string,
    @Req() req: Request & { user: UserDto },
    @Res() res: Response,
  ) {
    this.assertMcpHttpEnabled();

    const transport = new SSEServerTransport('/mcp/messages', res);
    const sessionId = transport.sessionId;

    this.sessions.set(sessionId, {
      transport,
      companyId,
      userId: req.user.userId,
    });

    transport.onclose = () => {
      this.sessions.delete(sessionId);
    };

    await mcpTenantContext.run(
      { companyId, userId: req.user.userId },
      async () => this.mcpService.mcpServer.connect(transport),
    );
  }

  @Post('messages')
  async handleMessages(
    @Req() req: Request & { user?: UserDto },
    @Res() res: Response,
  ) {
    this.assertMcpHttpEnabled();

    const user = req.user;
    if (!user?.userId) {
      throw new UnauthorizedException('Autenticación requerida');
    }

    const sessionId = req.query.sessionId;
    if (typeof sessionId !== 'string' || !sessionId) {
      return res.status(400).json({ error: 'sessionId es obligatorio' });
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return res
        .status(404)
        .json({ error: 'Sesión MCP no encontrada o expirada' });
    }

    if (session.userId !== user.userId) {
      throw new ForbiddenException('La sesión MCP no pertenece a este usuario');
    }

    await mcpTenantContext.run(
      { companyId: session.companyId, userId: user.userId },
      () => session.transport.handlePostMessage(req, res),
    );
  }
}
