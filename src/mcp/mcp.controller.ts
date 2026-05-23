import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpService } from './mcp.service';
// 1. Importamos los tipos explícitos de Express
import { Request, Response } from 'express';

@Controller('mcp')
export class McpController {
    private sseTransport: SSEServerTransport | null = null;

    constructor(private readonly mcpService: McpService) { }

    // 2. Tipamos req como Request y res como Response
    @Get('sse')
    async handleSse(@Req() req: Request, @Res() res: Response) {
        this.sseTransport = new SSEServerTransport('/mcp/messages', res);
        await this.mcpService.mcpServer.connect(this.sseTransport);
        console.log('📡 Canal SSE para MCP establecido.');
    }

    @Post('messages')
    async handleMessages(@Req() req: Request, @Res() res: Response) {
        if (!this.sseTransport) {
            return res.status(400).json({ error: "Conexión SSE no inicializada" });
        }

        // Forzamos a 'any' los argumentos para que el SDK de MCP 
        // acepte los objetos req y res nativos de Express que NestJS inyecta
        await this.sseTransport.handleMessage(req as any, res as any);
    }
}