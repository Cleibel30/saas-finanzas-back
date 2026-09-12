import { Injectable, Logger } from '@nestjs/common';
import { McpService } from '../mcp/mcp.service';
import { formatearRespuestaBonita } from './response-formatter';
import {
  CategoriaResuelta,
  ConsultaEncadenada,
  ItemResuelto,
  detectarConsultaEncadenada,
  elegirMejorCoincidencia,
  extraerNombreEntidad,
  extraerRangoFechas,
  herramientaMargenPorTipo,
} from './finance-query.resolver';
import { clasificarIntencion } from './intent-classifier';

type ToolExecution = { name: string; result: string };

type EjecucionPlaneada = {
  name: string;
  args: Record<string, unknown>;
};

const MODELO_COHERE = process.env.CO_MODEL || 'command-a-plus-05-2026';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

@Injectable()
export class GroqAgentService {
  private readonly logger = new Logger(GroqAgentService.name);

  constructor(private readonly mcpService: McpService) {}

  async procesarPreguntaFinanciera(preguntaUsuario: string, companyId: string) {
    const serverHandlers = this.mcpService.herramientasRegistradas;

    if (!serverHandlers.length) {
      this.logger.error(
        'herramientasRegistradas está vacío. ¿Arrancó McpService?',
      );
      return 'Error interno: las herramientas financieras no están disponibles. Reinicia el servidor.';
    }

    const intencion = clasificarIntencion(preguntaUsuario);
    this.logger.log(
      `Intención: ${intencion.tipo} — "${preguntaUsuario}" (company ${companyId})`,
    );

    if (intencion.tipo === 'CONOCIMIENTO') {
      return this.ejecutarPreguntaConocimiento(preguntaUsuario);
    }

    if (intencion.tipo === 'GENERAL') {
      return this.ejecutarPreguntaGeneral(preguntaUsuario);
    }

    if (intencion.tipo === 'ABIERTA') {
      return this.ejecutarAsesoriaConDatos(preguntaUsuario, companyId);
    }

    const subQueries = await this.descomponerPreguntas(preguntaUsuario);
    this.logger.log(
      `Sub-queries: ${subQueries.length} — [${subQueries.join(' | ')}]`,
    );

    const ejecucionesFlat: ToolExecution[] = [];
    const results = await Promise.all(
      subQueries.map((sq) => this.ejecutarSubQuery(sq, companyId)),
    );
    for (const result of results) {
      ejecucionesFlat.push(...result);
    }

    if (ejecucionesFlat.length > 0) {
      const datosFormateados =
        this.formatearRespuestaDeterministica(ejecucionesFlat);
      const tieneDatosReales = ejecucionesFlat.some(
        (e) =>
          !e.result.includes('No hay') &&
          !e.result.includes('No se encontraron'),
      );
      if (tieneDatosReales) {
        const analisis = await this.analizarResultados(
          preguntaUsuario,
          ejecucionesFlat,
        );
        return datosFormateados + this.formatearAnalisisIA(analisis);
      }
      return datosFormateados;
    }

    return this.ejecutarFallbackGroq(
      preguntaUsuario,
      companyId,
      serverHandlers,
      intencion.tipo === 'DATOS_SIMPLE',
    );
  }

  private async ejecutarFallbackGroq(
    preguntaUsuario: string,
    companyId: string,
    serverHandlers: any[],
    requiereDatos: boolean,
  ): Promise<string> {
    const tools = serverHandlers.map((tool: any) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.groqParameters ?? { type: 'object', properties: {} },
      },
    }));

    const hoy = new Date().toISOString().split('T')[0];
    const systemPrompt = this.construirSystemPromptConEjemplos(hoy);

    try {
      const choice = await this.llamarCohereConRetry(
        [
          { role: 'system' as const, content: systemPrompt },
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
        const datosFormateados =
          this.formatearRespuestaDeterministica(ejecuciones);
        const analisis = await this.analizarResultados(
          preguntaUsuario,
          ejecuciones,
        );
        return datosFormateados + this.formatearAnalisisIA(analisis);
      }

      return choice.message.content ?? this.mensajeAyuda(requiereDatos);
    } catch (error) {
      this.logger.warn(`Cohere fallback error: ${error}`);
      return this.mensajeAyuda(requiereDatos);
    }
  }

  private construirSystemPromptConEjemplos(hoy: string): string {
    return [
      `Eres "FinAssist", asesor financiero experto de la empresa del usuario. Fecha actual: ${hoy}.`,
      '',
      'Puedes resolver DOS tipos de peticiones:',
      '',
      '1) EDUCACIÓN FINANCIERA (sin tocar la base de datos):',
      '   Explica conceptos como margen de contribución, punto de equilibrio, utilidad bruta vs neta, flujo de caja, costo unitario, COGS, markup vs margen, etc. Sé claro, breve y usa un ejemplo numérico sencillo.',
      '',
      '2) CONSULTAS SOBRE DATOS REALES DE LA EMPRESA:',
      '   IMPORTANTE: cuando el usuario mencione un producto, servicio o categoría por su nombre,',
      '   usa search_item_by_name(name="...") o search_category_by_name(name="...") para buscarlo en la base de datos.',
      '',
      'REGLAS:',
      '- Si preguntan por stock, precio, inventario, existencia → search_item_by_name',
      '- Si preguntan por listados → list_products, list_services, list_categories, list_items',
      '- Si preguntan por margen/rentabilidad de X → search_item_by_name + get_product_margin / get_service_margin',
      '- Si preguntan por movimientos/transacciones con fecha (este mes, mes pasado, últimos 30 días) → get_transactions_by_date_range',
      '- Si preguntan por flujo de caja → get_total_cash_flow / get_cash_flow_by_date_range',
      '- Si preguntan por punto de equilibrio → get_break_even_point',
      '- Si preguntan por utilidad bruta/neta o estado de resultados → get_gross_profit / get_net_profit / get_net_profit_statement',
      '- Si preguntan por lotes de un producto → search_item_by_name + get_batches_by_product',
      '- Si preguntan por costos → get_unit_cost_by_product / get_unit_cost_by_service / get_unit_cost_by_batch',
      '',
      'EN ASESORÍA (ej: "¿cómo incremento las ventas?", "¿cómo mejoro mis márgenes?"):',
      'fundamenta tus recomendaciones en los datos reales obtenidos con las herramientas. Si no hay',
      'datos disponibles, da consejo general pero acláralo y NUNCA inventes cifras.',
      '',
      'Responde SIEMPRE en español, de forma breve, amable y accionable. No inventes datos:',
      'solo menciona cifras que provengan de la base de datos.',
    ].join('\n');
  }

  private mensajeAyuda(requiereDatos: boolean): string {
    if (requiereDatos) {
      return (
        'No identifiqué qué dato consultar. Ejemplos:\n' +
        '- "lista las categorías"\n' +
        '- "stock de camisa oversize"\n' +
        '- "listar productos"'
      );
    }
    return 'Hola. Puedo ayudarte con stock, precios, márgenes, transacciones y flujo de caja. ¿Qué necesitas consultar?';
  }

  private async ejecutarPreguntaConocimiento(
    preguntaUsuario: string,
  ): Promise<string> {
    const hoy = new Date().toISOString().split('T')[0];
    const systemPrompt = this.construirSystemPromptConEjemplos(hoy);

    try {
      const choice = await this.llamarCohereConRetry(
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: preguntaUsuario },
        ],
        [],
        'none',
      );
      return choice.message.content ?? this.mensajeAyuda(false);
    } catch (error) {
      this.logger.warn(`Cohere knowledge error: ${error}`);
      return this.mensajeAyuda(false);
    }
  }

  private async ejecutarPreguntaGeneral(
    preguntaUsuario: string,
  ): Promise<string> {
    const systemPrompt = this.construirSystemPromptGeneral();

    try {
      const choice = await this.llamarCohereConRetry(
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: preguntaUsuario },
        ],
        [],
        'none',
      );
      return (
        choice.message.content ??
        'No pude procesar tu pregunta. Inténtalo de nuevo.'
      );
    } catch (error) {
      this.logger.warn(`Cohere general error: ${error}`);
      return 'Ocurrió un error al procesar tu pregunta. Inténtalo de nuevo.';
    }
  }

  private construirSystemPromptGeneral(): string {
    const hoy = new Date().toISOString().split('T')[0];
    return [
      `Eres un asistente inteligente llamado FinAssist. Fecha actual: ${hoy}.`,
      '',
      'Tienes acceso a herramientas financieras para consultar datos reales de la empresa del usuario.',
      '',
      'Si el usuario pregunta sobre finanzas, contabilidad, precios, inventario, transacciones,',
      'márgenes, utilidades, flujo de caja, o cualquier tema financiero/empresarial,',
      'responde con tu conocimiento financiero. Si necesita datos específicos de la empresa,',
      'menciona que puede preguntar por esos datos.',
      '',
      'Si el usuario pregunta sobre cualquier otro tema (ciencia, historia, tecnología, salud, etc.),',
      'responde con tu conocimiento general de forma clara y útil.',
      '',
      'Responde SIEMPRE en español, de forma breve y clara.',
    ].join('\n');
  }

  /**
   * Preguntas de asesoría ("¿cómo incremento las ventas?"): recopila métricas
   * reales de la empresa (margen, equilibrio, flujo de caja) y redacta una
   * recomendación fundamentada con el LLM. Si no hay datos, da consejo general.
   */
  private async ejecutarAsesoriaConDatos(
    pregunta: string,
    companyId: string,
  ): Promise<string> {
    const fechas = extraerRangoFechas(pregunta);
    const planes: EjecucionPlaneada[] = [
      {
        name: 'get_global_margin',
        args: {
          startDate: fechas.startDate,
          endDate: fechas.endDate,
        },
      },
      {
        name: 'get_break_even_point',
        args: {
          startDate: fechas.startDate,
          endDate: fechas.endDate,
        },
      },
      { name: 'get_total_cash_flow', args: {} },
    ];

    const nombre = extraerNombreEntidad(pregunta);
    if (nombre) {
      planes.unshift({ name: 'search_item_by_name', args: { name: nombre } });
    }

    const ejecuciones = await this.ejecutarPlanes(planes, companyId);
    const utiles = ejecuciones.filter((e) => this.esResultadoUtil(e.result));
    const contexto = utiles.length
      ? this.formatearRespuestaDeterministica(utiles)
      : '';

    return this.sintetizarRespuesta(pregunta, contexto, utiles.length > 0);
  }

  private async sintetizarRespuesta(
    pregunta: string,
    contexto: string,
    tieneDatos: boolean,
  ): Promise<string> {
    const hoy = new Date().toISOString().split('T')[0];
    const systemPrompt = this.construirSystemPromptConEjemplos(hoy);
    const bloqueDatos = contexto.trim()
      ? `Datos reales de tu empresa consultados:\n${contexto.trim()}`
      : 'No se pudieron consultar datos de la base de datos en este momento.';

    try {
      const choice = await this.llamarCohereConRetry(
        [
          { role: 'system' as const, content: systemPrompt },
          {
            role: 'user' as const,
            content: [
              pregunta,
              '',
              '---',
              bloqueDatos,
              '',
              'Redacta una respuesta clara, breve y accionable basada en los datos anteriores (si los hay).',
              'Si no hay datos, da consejo general claramente distinguible y no inventes cifras.',
            ].join('\n'),
          },
        ],
        [],
        'none',
      );
      return (
        choice.message.content ??
        (contexto.trim() ? contexto.trim() : this.mensajeAyuda(tieneDatos))
      );
    } catch (error) {
      this.logger.warn(`Cohere synthesis error: ${error}`);
      return contexto.trim() ? contexto.trim() : this.mensajeAyuda(tieneDatos);
    }
  }

  private esResultadoUtil(resultado: string): boolean {
    try {
      const data = JSON.parse(resultado);
      if (!data || typeof data !== 'object') {
        return false;
      }
      if (data.success === false) {
        return false;
      }
      if (Array.isArray(data)) {
        return data.length > 0;
      }
      if (data.error) {
        return false;
      }
      const claves = Object.keys(data).filter(
        (k) => !['success', 'dataSource', 'searchTerm'].includes(k),
      );
      if (claves.length === 0) {
        return false;
      }
      if (
        claves.every(
          (k) => Array.isArray(data[k]) && (data[k] as unknown[]).length === 0,
        )
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
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
    const ejecuciones = await this.ejecutarPlanes(planes, companyId);
    return this.formatearRespuestaDeterministica(ejecuciones);
  }

  private async ejecutarPlanes(
    planes: EjecucionPlaneada[],
    companyId: string,
  ): Promise<ToolExecution[]> {
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

    return ejecuciones;
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

    return this.formatearRespuestaDeterministica([
      resolucion.busqueda,
      { name: herramientaMargen, result: resultadoMargen },
    ]);
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

    return this.formatearRespuestaDeterministica([
      resolucion.busqueda,
      {
        name: 'get_transactions_by_category',
        result: resultadoTransacciones,
      },
    ]);
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

    return this.formatearRespuestaDeterministica([
      resolucion.busqueda,
      { name: 'get_batches_by_product', result: resultadoLotes },
    ]);
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
        (item: ItemResuelto) => `- ${item.name} (${item.type})`,
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
        (cat: CategoriaResuelta) => `- ${cat.name}`,
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

    if (
      /movimientos?|moves|transacciones?|ventas?|ingresos?|egresos?|gastos?/.test(
        q,
      )
    ) {
      const fechas = extraerRangoFechas(pregunta);
      return {
        name: 'get_transactions_by_date_range',
        args: { startDate: fechas.startDate, endDate: fechas.endDate },
      };
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
    if (/transacc|movimient|moves/.test(q)) {
      const esTemporal =
        /mes\s+pasado|ultimos?\s+(?:30\s+)?d[ií]as|esta\s+semana|hoy\b|este\s+mes|del\s+mes|2\d{3}-\d{2}-\d{2}/.test(
          q,
        );
      if (esTemporal || /movimient/.test(q)) {
        const fechas = extraerRangoFechas(pregunta);
        return {
          name: 'get_transactions_by_date_range',
          args: { startDate: fechas.startDate, endDate: fechas.endDate },
        };
      }
      return { name: 'list_transactions', args: {} };
    }
    if (/lote|batch/.test(q)) {
      return { name: 'list_production_batches', args: {} };
    }
    if (/flujo|caja|saldo|balance/.test(q)) {
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

  private async llamarCohere(
    messages: any[],
    tools: any[],
    toolChoice: 'auto' | 'none' = 'auto',
  ) {
    const systemMessage = messages.find((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, any> = {
      model: MODELO_COHERE,
      messages: [
        ...(systemMessage
          ? [{ role: 'system', content: systemMessage.content }]
          : []),
        ...userMessages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };

    if (tools.length > 0 && toolChoice !== 'none') {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        },
      }));
    }

    const response = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CO_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        message: error.message || 'Cohere API error',
      };
    }

    const data = await response.json();

    const text =
      data.message?.content
        ?.filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('') ?? null;

    const toolCalls =
      data.message?.tool_calls?.map((tc: any) => ({
        function: {
          name: tc.function?.name ?? '',
          arguments: tc.function?.arguments ?? '{}',
        },
      })) ?? [];

    return {
      message: {
        content: text,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      },
    };
  }

  private esErrorTransitorio(error: unknown): boolean {
    const codigo =
      error instanceof Object && 'status' in error
        ? (error as { status: number }).status
        : undefined;
    return codigo === 503 || codigo === 429 || codigo === 500;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async llamarCohereConRetry(
    messages: any[],
    tools: any[],
    toolChoice: 'auto' | 'none' = 'auto',
  ) {
    let ultimoError: unknown;

    for (let intento = 0; intento < MAX_RETRIES; intento++) {
      try {
        this.logger.log(
          `Cohere → modelo=${MODELO_COHERE}, intento=${intento + 1}/${MAX_RETRIES}`,
        );
        return await this.llamarCohere(messages, tools, toolChoice);
      } catch (error) {
        ultimoError = error;
        if (!this.esErrorTransitorio(error)) {
          throw error;
        }
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, intento);
        this.logger.warn(
          `Cohere intento ${intento + 1} falló: ${error}. Retry en ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }

    throw ultimoError;
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
        `Herramienta vía Cohere: ${toolCall.function.name} → ${nombreHerramienta}`,
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
  ): string {
    return formatearRespuestaBonita(ejecuciones);
  }

  private parsearJson(jsonCrudo: string): any {
    try {
      return JSON.parse(jsonCrudo);
    } catch {
      return { success: false, error: 'Respuesta inválida de la herramienta.' };
    }
  }

  private async descomponerPreguntas(pregunta: string): Promise<string[]> {
    try {
      const choice = await this.llamarCohereConRetry(
        [
          {
            role: 'system',
            content:
              'Eres un asistente que descompone preguntas complejas en sub-preguntas independientes.\n' +
              'Si la pregunta contiene múltiples solicitudes separadas por "y", "también", "además", "así como", "concatenado con", etc., descompón en sub-preguntas.\n' +
              'Si es una sola pregunta, retorna SOLO esa pregunta sin modificaciones.\n' +
              'Responde ÚNICAMENTE con un array JSON de strings, sin texto adicional.\n' +
              'Ejemplo: "dame el margen de tortas y el stock de camisas" → ["dame el margen de tortas", "el stock de camisas"]\n' +
              'Ejemplo: "lista las categorías" → ["lista las categorías"]',
          },
          { role: 'user', content: pregunta },
        ],
        [],
        'none',
      );

      const texto = choice.message.content?.trim() ?? '[]';
      const match = texto.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(
            (s): s is string => typeof s === 'string' && s.length > 0,
          );
        }
      }
    } catch (error) {
      this.logger.warn(`descomponerPreguntas fallback: ${error}`);
    }
    return [pregunta];
  }

  private async ejecutarSubQuery(
    subQuery: string,
    companyId: string,
  ): Promise<ToolExecution[]> {
    const consulta = detectarConsultaEncadenada(subQuery);
    if (consulta) {
      const resultado = await this.ejecutarConsultaConResolucionDeIds(
        subQuery,
        companyId,
      );
      if (resultado) {
        return [{ name: 'consulta_encadenada', result: resultado }];
      }
    }

    const plan =
      this.planificarEjecucionDirecta(subQuery) ??
      this.inferirHerramientaPorPalabrasClave(subQuery);

    if (plan) {
      const resultado = await this.mcpService.ejecutarHerramienta(
        plan.name,
        plan.args,
        companyId,
      );
      return [{ name: plan.name, result: resultado }];
    }

    const nombre = extraerNombreEntidad(subQuery);
    if (nombre) {
      const resultado = await this.mcpService.ejecutarHerramienta(
        'search_item_by_name',
        { name: nombre },
        companyId,
      );
      return [{ name: 'search_item_by_name', result: resultado }];
    }

    const serverHandlers = this.mcpService.herramientasRegistradas;
    const tools = serverHandlers.map((tool: any) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.groqParameters ?? { type: 'object', properties: {} },
      },
    }));

    const hoy = new Date().toISOString().split('T')[0];
    const systemPrompt = this.construirSystemPromptConEjemplos(hoy);

    try {
      const choice = await this.llamarCohereConRetry(
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: subQuery },
        ],
        tools,
        'auto',
      );

      if (choice.message.tool_calls?.length) {
        return await this.ejecutarHerramientas(
          choice.message.tool_calls,
          serverHandlers,
          companyId,
        );
      }
    } catch (error) {
      this.logger.warn(`ejecutarSubQuery LLM fallback error: ${error}`);
    }

    return [];
  }

  private async analizarResultados(
    pregunta: string,
    resultados: ToolExecution[],
  ): Promise<string> {
    if (resultados.length === 0) return '';

    const datosFormateados = formatearRespuestaBonita(resultados);
    const hoy = new Date().toISOString().split('T')[0];

    try {
      const choice = await this.llamarCohereConRetry(
        [
          {
            role: 'system',
            content:
              `Eres "FinAssist", asesor financiero experto. Fecha actual: ${hoy}.\n` +
              'Recibirás datos financieros reales de la empresa del usuario junto con su pregunta.\n' +
              'Tu tarea:\n' +
              '1. Analiza los datos mostrados\n' +
              '2. Identifica tendencias, fortalezas y debilidades\n' +
              '3. Da 1-3 recomendaciones accionables y breves\n' +
              '4. Si hay datos negativos o preocupantes, menciónalos\n\n' +
              'Responde en español, sé conciso (máximo 4-5 líneas). No repitas los datos numéricos, solo coméntalos.',
          },
          {
            role: 'user',
            content: `Pregunta del usuario: ${pregunta}\n\nDatos obtenidos:\n${datosFormateados}`,
          },
        ],
        [],
        'none',
      );

      return choice.message.content ?? '';
    } catch (error) {
      this.logger.warn(`analizarResultados error: ${error}`);
      return '';
    }
  }

  private formatearAnalisisIA(analisis: string): string {
    if (!analisis.trim()) return '';
    return `\n---\n\n### Análisis\n${analisis.trim()}`;
  }
}
