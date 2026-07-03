import { Module } from '@nestjs/common';
import { GroqAgentController } from './groq-agent.controller';
import { GroqAgentService } from './groq-agent.service';
import { McpModule } from '@/mcp/mcp.module';

@Module({
  controllers: [GroqAgentController],
  providers: [GroqAgentService],
  exports: [GroqAgentService],
  imports: [McpModule],
})
export class GroqAgentModule {}
