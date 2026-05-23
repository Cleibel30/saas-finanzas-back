import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import { McpService } from '../mcp/mcp.service';

@Injectable()
export class GroqAgentService {
    private groq: Groq;

    constructor(private readonly mcpService: McpService) {
        this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    async procesarPreguntaFinanciera(preguntaUsuario: string, companyId: string) {
        // 1. ✅ LEEMOS LAS HERRAMIENTAS DESDE NUESTRO ARRAY SEGURO Y PÚBLICO
        const serverHandlers = this.mcpService.herramientasRegistradas;

        const tools = serverHandlers.map((tool: any) => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
            },
        }));

        const hoy = new Date().toISOString().split('T')[0];

        // 2. Primera llamada a Groq
        const response = await this.groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `Eres el analista financiero de la empresa con ID "${companyId}". 
                    La fecha de hoy es exactamente: ${hoy}.
                    
                    REGLAS DE TIEMPO CRÍTICAS:
                    - Si el usuario te pide datos del "mes pasado" o "último mes", calcula las fechas basándote en que hoy es ${hoy}.
                    - Si pide "este mes" o "el mes actual", calcula desde el primero de este mes hasta el día de hoy.
                    
                    Debes extraer o calcular estas fechas de forma interna y pasárselas en formato YYYY-MM-DD a las herramientas correspondientes.
                    ⚠️ REGLA DE ORO COMPORTAMIENTO:
                    - SIEMPRE que el usuario te pida datos, métricas, o te pida "analizar", "revisar" o "comentar" resultados financieros, debes usar PRIMERO la herramienta correspondiente para obtener los datos reales.
                    - Está TERMINANTEMENTE PROHIBIDO responder que no tienes acceso a los datos financieros. Tus datos provienen de las herramientas que tienes conectadas. Si te piden analizar, primero llama a la herramienta y luego redacta tu análisis con los datos que recibas.
                    `

                },
                { role: "user", content: preguntaUsuario }
            ],
            tools: tools.length > 0 ? (tools as any) : undefined,
        });

        const choice = response.choices[0];

        // 3. ¿Llama 3 necesita herramientas?
        if (choice.message.tool_calls) {
            const toolCall = choice.message.tool_calls[0];
            console.log(`🤖 Groq pide ejecutar la herramienta: ${toolCall.function.name}`);

            const argumentos = JSON.parse(toolCall.function.arguments);

            // 4. ✅ BUSCAMOS Y EJECUTAMOS DESDE NUESTRO PROPIO MANEJADOR
            const targetTool = serverHandlers.find((t: any) => t.name === toolCall.function.name);

            if (!targetTool) {
                throw new Error(`La herramienta ${toolCall.function.name} no se encuentra registrada.`);
            }

            // Ejecutamos la función local de Prisma directamente
            const resultadoMcp = await targetTool.execute(argumentos);

            // 5. Segunda llamada a Groq
            const respuestaFinal = await this.groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "user", content: preguntaUsuario },
                    choice.message,
                    {
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(resultadoMcp),
                    }
                ],
            });

            return respuestaFinal.choices[0].message.content;
        }

        return choice.message.content;
    }
}