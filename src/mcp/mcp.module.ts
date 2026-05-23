import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { GroqAgentModule } from '@/groq-agent/groq-agent.module';
import { ContributionMarginModule } from '@/contribution-margin/contribution-margin.module';
import { BalancePointModule } from '@/balance-point/balance-point.module';

@Module({
  controllers: [McpController],
  providers: [McpService],
  imports: [GroqAgentModule, ContributionMarginModule, BalancePointModule], // Importamos el módulo del agente para que pueda inyectar el servicio MCP
  exports: [McpService] // Exportamos el servicio MCP para que el agente pueda usarlo
})
export class McpModule {}
