import { Module } from '@nestjs/common';
import { GroqAgentModule } from '@/groq-agent/groq-agent.module';
import { McpModule } from '@/mcp/mcp.module';
import { FinanceChatController } from './finance-chat.controller';
import { CompanyModule } from '@/company/company.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  controllers: [FinanceChatController],
  imports: [McpModule, GroqAgentModule, CompanyModule, PrismaModule],
})
export class FinanceChatModule {}
