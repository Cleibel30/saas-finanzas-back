import { Injectable, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ContributionMarginService } from '../contribution-margin/contribution-margin.service';
import { z } from 'zod';
import { BalancePointService } from '@/balance-point/balance-point.service';

@Injectable()
export class McpService implements OnModuleInit {
    public mcpServer: McpServer;

    // 📦 GUARDAMOS LAS HERRAMIENTAS AQUÍ EN UN ARRAY PÚBLICO SEGURO
    public herramientasRegistradas: any[] = [];

    constructor(
        private readonly marginService: ContributionMarginService,
        private readonly balancePoint: BalancePointService
    ) {
        this.mcpServer = new McpServer({
            name: "snoop-financial-mcp",
            version: "1.0.0",
        });
    }

    async onModuleInit() {
        this.registerTools();
        console.log('🔨 Herramientas MCP registradas en NestJS.');
    }

    private registerTools() {
        // 1. Esquema puro de Zod para el validador oficial del MCP
        const marginSchema = {
            companyId: z.string().uuid().describe("El ID de la empresa en formato UUID"),
            startDate: z.string().describe("Fecha de inicio en formato YYYY-MM-DD"),
            endDate: z.string().describe("Fecha de fin en formato YYYY-MM-DD"),
        };

        const breakEvenSchema = {
            companyId: z.string().uuid().describe("El ID de la empresa en formato UUID"),
            startDate: z.string().describe("Fecha de inicio en formato YYYY-MM-DD"),
            endDate: z.string().describe("Fecha de fin en formato YYYY-MM-DD"),
        };

        // 2. Registramos formalmente en el servidor MCP usando la firma exacta que espera
        this.mcpServer.tool(
            "get_global_margin",
            "Calcula las ventas totales, costos variables y el ratio de margen global de una empresa en un rango de fechas bimonetario (USD y Bs).",
            marginSchema, // 👈 Pasamos el objeto Zod crudo aquí
            async ({ companyId, startDate, endDate }) => {
                const data = await this.marginService.getGlobalContributionMargin(
                    companyId,
                    new Date(startDate),
                    new Date(endDate)
                );

                return {
                    content: [{
                        type: "text" as const, // 👈 Agregamos 'as const' para decirle a TS que es el literal "text" y no un string cualquiera
                        text: JSON.stringify(data)
                    }]
                };
            }
        );

        this.mcpServer.tool(
            "get_break_even_point",
            "Calcula el punto de equilibrio...",
            breakEvenSchema,
            async ({ companyId, startDate, endDate }) => {
                // 👈 3. LLAMAS A TU NUEVO SERVICIO INYECTADO
                const data = await this.balancePoint.getCompanyBreakEven(
                    companyId,
                    new Date(startDate),
                    new Date(endDate)
                );
                return {
                    content: [{ type: "text" as const, text: JSON.stringify(data) }]
                };
            }
        );

        // 3. Guardamos en tu array de Groq con el formato JSON Schema que la IA necesita
        this.herramientasRegistradas.push({
            name: "get_global_margin",
            description: "Calcula las ventas totales, costos variables y el ratio de margen global de una empresa en un rango de fechas bimonetario (USD y Bs).",
            inputSchema: {
                type: "object",
                properties: {
                    companyId: { type: "string", description: "El ID de la empresa en formato UUID" },
                    startDate: { type: "string", description: "Fecha de inicio en formato YYYY-MM-DD" },
                    endDate: { type: "string", description: "Fecha de fin en formato YYYY-MM-DD" },
                },
                required: ["companyId", "startDate", "endDate"],
            },
            // Hacemos un puente directo a la ejecución del servicio
            execute: async ({ companyId, startDate, endDate }: any) => {
                const data = await this.marginService.getGlobalContributionMargin(
                    companyId,
                    new Date(startDate),
                    new Date(endDate)
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(data) }]
                };
            }
        });

        // 2. NUEVA HERRAMIENTA: Punto de Equilibrio (¡Añádela así debajo!)
        this.herramientasRegistradas.push({
            name: "get_break_even_point", // Nombre único e identificable para Groq
            description: "Calcula los costos fijos totales y el punto de equilibrio (ventas mínimas requeridas para no perder dinero) de la empresa en un rango de fechas bimonetario (USD y Bs).",
            inputSchema: {
                type: "object",
                properties: {
                    companyId: { type: "string", description: "El ID de la empresa en formato UUID" },
                    startDate: { type: "string", description: "Fecha de inicio en formato YYYY-MM-DD" },
                    endDate: { type: "string", description: "Fecha de fin en formato YYYY-MM-DD" },
                },
                required: ["companyId", "startDate", "endDate"],
            },
            execute: async ({ companyId, startDate, endDate }: any) => {
                // 🧠 Aquí haces el puente directo hacia el otro servicio que inyectaste
                const data = await this.balancePoint.getCompanyBreakEven(
                    companyId,
                    new Date(startDate),
                    new Date(endDate)
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(data) }]
                };
            }
        });
    }
}