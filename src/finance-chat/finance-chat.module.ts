import { Module } from '@nestjs/common';
import { GroqAgentModule } from '@/groq-agent/groq-agent.module';
import { FinanceChatController } from './finance-chat.controller';
import { CompanyModule } from '@/company/company.module';

@Module({
  providers: [FinanceChatController],
  controllers: [FinanceChatController],
  imports: [GroqAgentModule, CompanyModule]
})
export class FinanceChatModule {}
