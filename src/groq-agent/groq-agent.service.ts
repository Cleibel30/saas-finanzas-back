import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { McpService } from '../mcp/mcp.service';
import {
  CategoriaResuelta,
  ConsultaEncadenada,
  ItemResuelto,
  detectarConsultaEncadenada,
  elegirMejorCoincidencia,
  extraerNombreEntidad,
  herramientaMargenPorTipo,
} from './finance-query.resolver';

type ToolExecution = { name: string; result: string };

type EjecucionPlaneada = {
  name: string;
  args: Record<string, unknown>;
};

@Injectable()
export class GroqAgentService {
  private readonly logger = new Logger(GroqAgentService.name);
  private groq: Groq;

  constructor(private readonly mcpService: McpService) {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async procesarPreguntaFinanciera(preguntaUsuario: string, companyId: string) {
    const serverHandlers = this.mcpService.herramientasRegistradas;

    if (!serverHandlers.length) {
      this.logger.error(
        'herramientasRegistradas está vacío. ¿Arrancó McpService?',
      );
      return 'Error interno: las herramientas financieras no están disponibles. Reinicia el servidor.';
    }

    const requiereDatos = this.requiereConsultaBaseDeDatos(preguntaUsuario);

    const respuestaConIds = await this.ejecutarConsultaConResolucionDeIds(
      preguntaUsuario,
      companyId,
    );
    if (respuestaConIds) {
      return respuestaConIds;
    }

    const ejecucionDirecta =
      this.planificarEjecucionDirecta(preguntaUsuario) ??
      (requiereDatos
        ? this.inferirHerramientaPorPalabrasClave(preguntaUsuario)
        : null);

    if (ejecucionDirecta) {
      return this.ejecutarYFormatear(
        ejecucionDirecta,
        preguntaUsuario,
        companyId,
      );
    }

    if (requiereDatos) {
      const nombre = extraerNombreEntidad(preguntaUsuario);
      if (nombre) {
        return this.ejecutarYFormatear(
          { name: 'search_item_by_name', args: { name: nombre } },
          preguntaUsuario,
          companyId,
        );
      }

      return (
        'No identifiqué qué dato consultar. Ejemplos:\n' +
        '- "lista las categorías"\n' +
        '- "stock de camisa oversize"\n' +
        '- "listar productos"'
      );
    }

    const tools = serverHandlers.map((tool: any) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.groqParameters ?? { type: 'object', properties: {} },
      },
    }));

    const hoy = new Date().toISOString().split('T')[0];
    const systemMessage = {
      role: 'system' as const,
      content: `Eres un asistente financiero amable. Fecha: ${hoy}. Responde brevemente en español.`,
    };

    try {
      const choice = await this.llamarGroq(
        [
          { role: 'system' as const, content: systemMessage.content },
          { role: 'user' as const, content: preguntaUsuario },
        ],
        tools,
        'auto',
      );

      if (choice.message.tool_calls?.length) {
        const ejecuciones = await this.ejecutarHerramientas(
          choice.message.tool_calls,
          serverHandlers,
          companyId,
        );
        return this.formatearRespuestaDeterministica(
          ejecuciones,
          preguntaUsuario,
        );
      }

      return (
        choice.message.content ??
        'Hola. Puedo ayudarte con stock, precios, márgenes, transacciones y flujo de caja.'
      );
    } catch (error) {
      this.logger.warn(`Groq falló en conversación general: ${error}`);
      return 'Hola. Puedo ayudarte con stock, precios, márgenes, transacciones y flujo de caja. ¿Qué necesitas consultar?';
    }
  }

  private async ejecutarYFormatear(
    plan: EjecucionPlaneada,
    preguntaUsuario: string,
    companyId: string,
  ): Promise<string> {
    return this.ejecutarPlanesYFormatear([plan], preguntaUsuario, companyId);
  }

  private async ejecutarPlanesYFormatear(
    planes: EjecucionPlaneada[],
    preguntaUsuario: string,
    companyId: string,
  ): Promise<string> {
    const ejecuciones: ToolExecution[] = [];

    for (const plan of planes) {
      this.logger.log(`Ejecución directa: ${plan.name}`);
      const resultado = await this.mcpService.ejecutarHerramienta(
        plan.name,
        plan.args,
        companyId,
      );
      ejecuciones.push({ name: plan.name, result: resultado });
    }

    return this.formatearRespuestaDeterministica(ejecuciones, preguntaUsuario);
  }

  /**
   * Resuelve nombre → itemId/categoryId y encadena la herramienta final.
   * Ej: "margen del servicio consultoría este mes" → search_item_by_name → get_service_margin
   */
  private async ejecutarConsultaConResolucionDeIds(
    pregunta: string,
    companyId: string,
  ): Promise<string | null> {
    const consulta = detectarConsultaEncadenada(pregunta);
    if (!consulta) {
      return null;
    }

    switch (consulta.tipo) {
      case 'margen_global':
        return this.ejecutarPlanesYFormatear(
          [
            {
              name: 'get_global_margin',
              args: {
                startDate: consulta.fechas.startDate,
                endDate: consulta.fechas.endDate,
              },
            },
          ],
          pregunta,
          companyId,
        );

      case 'punto_equilibrio':
        return this.ejecutarPlanesYFormatear(
          [
            {
              name: 'get_break_even_point',
              args: {
                startDate: consulta.fechas.startDate,
                endDate: consulta.fechas.endDate,
              },
            },
          ],
          pregunta,
          companyId,
        );

      case 'margen_item':
        return this.ejecutarMargenPorNombreEntidad(
          consulta,
          pregunta,
          companyId,
        );

      case 'transacciones_categoria':
        return this.ejecutarTransaccionesPorNombreCategoria(
          consulta.nombreEntidad,
          pregunta,
          companyId,
        );

      case 'lotes_producto':
        return this.ejecutarLotesPorNombreProducto(
          consulta.nombreEntidad,
          pregunta,
          companyId,
        );

      default:
        return null;
    }
  }

  private async ejecutarMargenPorNombreEntidad(
    consulta: Extract<ConsultaEncadenada, { tipo: 'margen_item' }>,
    pregunta: string,
    companyId: string,
  ): Promise<string> {
    const resolucion = await this.resolverItemPorNombre(
      consulta.nombreEntidad,
      companyId,
      pregunta,
    );

    if (typeof resolucion === 'string') {
      return resolucion;
    }

    let herramientaMargen = herramientaMargenPorTipo(
      resolucion.item.type,
      consulta.forzarServicio,
    );

    let resultadoMargen = await this.mcpService.ejecutarHerramienta(
      herramientaMargen,
      {
        itemId: resolucion.item.id,
        startDate: consulta.fechas.startDate,
        endDate: consulta.fechas.endDate,
      },
      companyId,
    );

    const margenData = this.parsearJson(resultadoMargen);
    if (margenData?.error && resolucion.item.type === 'SERVICE') {
      herramientaMargen = 'get_product_margin';
      resultadoMargen = await this.mcpService.ejecutarHerramienta(
        herramientaMargen,
        {
          itemId: resolucion.item.id,
          startDate: consulta.fechas.startDate,
          endDate: consulta.fechas.endDate,
        },
        companyId,
      );
    }

    return this.formatearRespuestaDeterministica(
      [
        resolucion.busqueda,
        { name: herramientaMargen, result: resultadoMargen },
      ],
      pregunta,
    );
  }

  private async ejecutarTransaccionesPorNombreCategoria(
    nombreCategoria: string,
    pregunta: string,
    companyId: string,
  ): Promise<string> {
    const resolucion = await this.resolverCategoriaPorNombre(
      nombreCategoria,
      companyId,
      pregunta,
    );

    if (typeof resolucion === 'string') {
      return resolucion;
    }

    const resultadoTransacciones = await this.mcpService.ejecutarHerramienta(
      'get_transactions_by_category',
      { categoryId: resolucion.categoria.id },
      companyId,
    );

    return this.formatearRespuestaDeterministica(
      [
        resolucion.busqueda,
        {
          name: 'get_transactions_by_category',
          result: resultadoTransacciones,
        },
      ],
      pregunta,
    );
  }

  private async ejecutarLotesPorNombreProducto(
    nombreProducto: string,
    pregunta: string,
    companyId: string,
  ): Promise<string> {
    const resolucion = await this.resolverItemPorNombre(
      nombreProducto,
      companyId,
      pregunta,
    );

    if (typeof resolucion === 'string') {
      return resolucion;
    }

    const resultadoLotes = await this.mcpService.ejecutarHerramienta(
      'get_batches_by_product',
      { itemId: resolucion.item.id },
      companyId,
    );

    return this.formatearRespuestaDeterministica(
      [
        resolucion.busqueda,
        { name: 'get_batches_by_product', result: resultadoLotes },
      ],
      pregunta,
    );
  }

  private async resolverItemPorNombre(
    nombre: string,
    companyId: string,
    pregunta: string,
  ): Promise<{ item: ItemResuelto; busqueda: ToolExecution } | string> {
    const resultadoBusqueda = await this.mcpService.ejecutarHerramienta(
      'search_item_by_name',
      { name: nombre },
      companyId,
    );

    const data = this.parsearJson(resultadoBusqueda);

    if (
      !data?.success ||
      !Array.isArray(data.items) ||
      data.items.length === 0
    ) {
      return (
        `No encontré ningún producto o servicio con el nombre "${nombre}" en la base de datos. ` +
        'Verifica el nombre o lista los items con "listar productos".'
      );
    }

    if (data.items.length > 1) {
      const lineas = data.items.map(
        (item: ItemResuelto) =>
          `- ${item.name} (${item.type}) | id: ${item.id}`,
      );
      return (
        `Encontré ${data.items.length} coincidencias para "${nombre}". Sé más específico:\n` +
        `${lineas.join('\n')}`
      );
    }

    const item = elegirMejorCoincidencia(data.items, nombre) as ItemResuelto;

    return {
      item,
      busqueda: { name: 'search_item_by_name', result: resultadoBusqueda },
    };
  }

  private async resolverCategoriaPorNombre(
    nombre: string,
    companyId: string,
    pregunta: string,
  ): Promise<
    { categoria: CategoriaResuelta; busqueda: ToolExecution } | string
  > {
    const resultadoBusqueda = await this.mcpService.ejecutarHerramienta(
      'search_category_by_name',
      { name: nombre },
      companyId,
    );

    const data = this.parsearJson(resultadoBusqueda);

    if (
      !data?.success ||
      !Array.isArray(data.categories) ||
      data.categories.length === 0
    ) {
      return (
        `No encontré ninguna categoría con el nombre "${nombre}" en la base de datos. ` +
        'Prueba con "lista las categorías".'
      );
    }

    if (data.categories.length > 1) {
      const lineas = data.categories.map(
        (cat: CategoriaResuelta) => `- ${cat.name} | id: ${cat.id}`,
      );
      return (
        `Encontré ${data.categories.length} categorías para "${nombre}". Sé más específico:\n` +
        `${lineas.join('\n')}`
      );
    }

    const categoria = elegirMejorCoincidencia(
      data.categories,
      nombre,
    ) as CategoriaResuelta;

    return {
      categoria,
      busqueda: { name: 'search_category_by_name', result: resultadoBusqueda },
    };
  }

  private planificarEjecucionDirecta(
    pregunta: string,
  ): EjecucionPlaneada | null {
    const q = pregunta
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

    if (this.preguntaPideListadoCategorias(q)) {
      return { name: 'list_categories', args: {} };
    }

    if (/list(a|ar|ame|ado)?\s+(todos\s+)?(los\s+)?productos/.test(q)) {
      return { name: 'list_products', args: {} };
    }

    if (/list(a|ar|ame|ado)?\s+(todos\s+)?(los\s+)?servicios/.test(q)) {
      return { name: 'list_services', args: {} };
    }

    if (
      /list(a|ar|ame|ado)?\s+(todos\s+)?(los\s+)?(items|productos|servicios)/.test(
        q,
      )
    ) {
      return { name: 'list_items', args: {} };
    }

    if (/list(a|ar|ame|ado)?\s+(las\s+)?transacciones/.test(q)) {
      return { name: 'list_transactions', args: {} };
    }

    if (/list(a|ar|ame|ado)?\s+(los\s+)?lotes/.test(q)) {
      return { name: 'list_production_batches', args: {} };
    }

    if (/flujo de caja|cash flow|resumen de caja/.test(q)) {
      return { name: 'get_total_cash_flow', args: {} };
    }

    const nombre = extraerNombreEntidad(pregunta);
    const esCategoria = /categor[ií]a/.test(q);
    const esStockPrecio =
      /stock|precio|existencia|disponib|inventario|cu[aá]nto|cu[aá]nta/.test(q);

    if (
      nombre &&
      (esStockPrecio ||
        (!esCategoria && !/margen|rentabilidad|transacciones|lotes?/.test(q)))
    ) {
      return { name: 'search_item_by_name', args: { name: nombre } };
    }

    if (nombre && esCategoria && !/margen|transacciones|lotes?/.test(q)) {
      return { name: 'search_category_by_name', args: { name: nombre } };
    }

    return null;
  }

  private preguntaPideListadoCategorias(q: string): boolean {
    return (
      /list(a|ar|ame|ado)?\s+(las\s+)?categor[ií]as/.test(q) ||
      /categor[ií]as\s+(de\s+la\s+)?empresa/.test(q) ||
      /(?:dame|muestra|mostrar|ver)\s+(?:las\s+)?categor[ií]as/.test(q) ||
      /^categor[ií]as$/.test(q.trim())
    );
  }

  private inferirHerramientaPorPalabrasClave(
    pregunta: string,
  ): EjecucionPlaneada | null {
    const q = pregunta
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

    if (/categor[ií]a/.test(q)) {
      return { name: 'list_categories', args: {} };
    }
    if (/transacc/i.test(q)) {
      return { name: 'list_transactions', args: {} };
    }
    if (/lote|batch/.test(q)) {
      return { name: 'list_production_batches', args: {} };
    }
    if (/flujo|caja/.test(q)) {
      return { name: 'get_total_cash_flow', args: {} };
    }
    if (/servicio/.test(q)) {
      return { name: 'list_services', args: {} };
    }
    if (/producto|inventario/.test(q)) {
      return { name: 'list_products', args: {} };
    }

    return null;
  }

  private normalizarNombreHerramienta(nombreCrudo: string): string {
    const limpio = nombreCrudo
      .replace(/\{\}$/g, '')
      .replace(/[^a-z0-9_]/gi, '')
      .toLowerCase();

    const alias: Record<string, string> = {
      lista_categories: 'list_categories',
      list_categories: 'list_categories',
      lista_categorias: 'list_categories',
      listacategorias: 'list_categories',
      listacategories: 'list_categories',
      lista_products: 'list_products',
      lista_productos: 'list_products',
      lista_items: 'list_items',
      lista_services: 'list_services',
      lista_servicios: 'list_services',
      lista_transactions: 'list_transactions',
      lista_transacciones: 'list_transactions',
      search_item_by_name: 'search_item_by_name',
      buscar_item: 'search_item_by_name',
    };

    return alias[limpio] ?? nombreCrudo.replace(/\{\}$/g, '').trim();
  }

  private async llamarGroq(
    messages: any[],
    tools: any[],
    toolChoice: 'auto' | 'none' = 'auto',
  ) {
    const payload: Record<string, unknown> = {
      model: 'llama-3.3-70b-versatile',
      messages,
    };

    if (tools.length > 0 && toolChoice !== 'none') {
      payload.tools = tools;
      payload.tool_choice = toolChoice;
    }

    const response = await this.groq.chat.completions.create(payload as any);
    return response.choices[0];
  }

  private async ejecutarHerramientas(
    toolCalls: any[],
    serverHandlers: any[],
    companyId: string,
  ): Promise<ToolExecution[]> {
    const ejecuciones: ToolExecution[] = [];

    for (const toolCall of toolCalls) {
      const nombreHerramienta = this.normalizarNombreHerramienta(
        toolCall.function.name,
      );
      this.logger.log(
        `Herramienta vía Groq: ${toolCall.function.name} → ${nombreHerramienta}`,
      );

      let argumentos: Record<string, unknown> = {};
      try {
        argumentos = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        ejecuciones.push({
          name: nombreHerramienta,
          result: JSON.stringify({
            success: false,
            dataSource: 'database',
            error: 'Argumentos de herramienta inválidos',
          }),
        });
        continue;
      }
      argumentos.companyId = companyId;

      const targetTool = serverHandlers.find(
        (t: any) => t.name === nombreHerramienta,
      );

      if (!targetTool) {
        ejecuciones.push({
          name: nombreHerramienta,
          result: JSON.stringify({
            success: false,
            dataSource: 'database',
            error: `Herramienta "${toolCall.function.name}" no registrada.`,
          }),
        });
        continue;
      }

      const resultadoMcp = await targetTool.execute(argumentos);
      ejecuciones.push({
        name: nombreHerramienta,
        result:
          typeof resultadoMcp === 'string'
            ? resultadoMcp
            : JSON.stringify(resultadoMcp),
      });
    }

    return ejecuciones;
  }

  private formatearRespuestaDeterministica(
    ejecuciones: ToolExecution[],
    preguntaUsuario: string,
  ): string {
    if (ejecuciones.length === 0) {
      return 'No se obtuvieron datos de la base de datos para tu consulta.';
    }

    const bloques = ejecuciones.map((ej) =>
      this.formatearResultadoHerramienta(ej.name, ej.result),
    );

    return [
      `Consulta: "${preguntaUsuario}"`,
      '',
      ...bloques,
      '',
      '_Datos obtenidos directamente de la base de datos (sin interpretación por IA)._',
    ].join('\n');
  }

  private formatearResultadoHerramienta(
    nombreHerramienta: string,
    jsonCrudo: string,
  ): string {
    const data = this.parsearJson(jsonCrudo);

    if (data?.success === false) {
      return `**${nombreHerramienta}:** ${data.message ?? data.error ?? 'Sin resultados en la base de datos.'}`;
    }

    if (
      nombreHerramienta === 'search_item_by_name' &&
      Array.isArray(data?.items)
    ) {
      if (data.items.length === 0) {
        return `**Búsqueda de producto/servicio:** ${data.message ?? 'No se encontró en la base de datos.'}`;
      }
      const lineas = data.items.map(
        (item: any) =>
          `- ${item.name} (${item.type}) | precio: ${item.basePrice} | stock: ${item.stockCurrent} | id: ${item.id}`,
      );
      return `**Productos/servicios encontrados (${data.count}):**\n${lineas.join('\n')}`;
    }

    if (
      nombreHerramienta === 'search_category_by_name' &&
      Array.isArray(data?.categories)
    ) {
      if (data.categories.length === 0) {
        return `**Búsqueda de categoría:** ${data.message ?? 'No se encontró en la base de datos.'}`;
      }
      const lineas = data.categories.map(
        (cat: any) =>
          `- ${cat.name} (${cat.type}, ${cat.flowDirection}) | id: ${cat.id}`,
      );
      return `**Categorías encontradas (${data.count}):**\n${lineas.join('\n')}`;
    }

    if (
      (nombreHerramienta === 'get_service_margin' ||
        nombreHerramienta === 'get_product_margin' ||
        nombreHerramienta === 'get_global_margin' ||
        nombreHerramienta === 'get_break_even_point') &&
      typeof data === 'object'
    ) {
      const etiqueta =
        data.itemName ?? data.serviceName ?? data.productName ?? '';
      const encabezado = etiqueta
        ? `**${nombreHerramienta}** (${etiqueta})`
        : `**${nombreHerramienta}**`;
      return `${encabezado}:\n${this.resumirJson(data)}`;
    }

    const resumen = this.resumirJson(data);
    return `**${nombreHerramienta}:**\n${resumen}`;
  }

  private resumirJson(data: unknown): string {
    if (data === null || data === undefined) {
      return 'Sin datos.';
    }
    if (Array.isArray(data)) {
      return data.length === 0
        ? 'Sin registros.'
        : `${data.length} registro(s):\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
    }
    if (typeof data === 'object') {
      return `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
    }
    return String(data);
  }

  private parsearJson(jsonCrudo: string): any {
    try {
      return JSON.parse(jsonCrudo);
    } catch {
      return { success: false, error: 'Respuesta inválida de la herramienta.' };
    }
  }

  private requiereConsultaBaseDeDatos(pregunta: string): boolean {
    const q = pregunta
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

    const palabrasDatos = [
      'stock',
      'precio',
      'producto',
      'servicio',
      'categoria',
      'transaccion',
      'margen',
      'venta',
      'costo',
      'flujo',
      'lote',
      'batch',
      'existencia',
      'disponib',
      'cuanto',
      'lista',
      'listar',
      'busca',
      'buscar',
      'inventario',
      'equilibrio',
      'ingreso',
      'egreso',
      'ganancia',
      'perdida',
      'utilidad',
    ];

    return (
      palabrasDatos.some((palabra) => q.includes(palabra)) ||
      extraerNombreEntidad(pregunta) !== null ||
      detectarConsultaEncadenada(pregunta) !== null
    );
  }
}
