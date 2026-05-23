import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GroqAgentService } from '@/groq-agent/groq-agent.service';
import { ChatBodyDto } from './dto/msg-chat.dto';
import { AuthGuard } from '@nestjs/passport';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';

@Controller('finance-chat')
export class FinanceChatController {
  constructor(private readonly groqAgentService: GroqAgentService) {}

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Post('ask/:companyId')
  async preguntarIA(@Body() body: ChatBodyDto, @Param('companyId') companyId: string) {
    // Tomamos las variables que vienen del Body de Postman y se las pasamos al Agente de Groq
    const respuestaAnalitica = await this.groqAgentService.procesarPreguntaFinanciera(
      body.preguntaUsuario,
      companyId
    );

    // Le devolvemos el texto limpio redactado por Llama 3 a Postman
    return { response: respuestaAnalitica };
  }
}