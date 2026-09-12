import { Test, TestingModule } from '@nestjs/testing';
import { GroqAgentService } from './groq-agent.service';
import { McpService } from '@/mcp/mcp.service';

type FetchPayload = {
  model?: string;
  messages?: Array<{ role: string; content: string }>;
  tools?: unknown[];
};

describe('GroqAgentService', () => {
  let service: GroqAgentService;
  let fetchMock: jest.Mock;
  let ejecutarHerramientaMock: jest.Mock;

  const mcpServiceMock = {
    herramientasRegistradas: [
      { name: 'get_global_margin', description: 'global margin' },
    ],
    ejecutarHerramienta: jest.fn(),
  };

  const respuestaLLM = (content: string) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          message: {
            content: [{ type: 'text', text: content }],
            tool_calls: undefined,
          },
        }),
    });

  const respuestaLLMMultiple = (contents: string[]) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          message: {
            content: contents.map((text) => ({ type: 'text', text })),
            tool_calls: undefined,
          },
        }),
    });

  const ultimoPayload = (): FetchPayload => {
    const call = fetchMock.mock.calls.at(-1);
    return call ? JSON.parse(call[1].body) : {};
  };

  const payloads = (): FetchPayload[] => {
    return fetchMock.mock.calls.map((call: any[]) => JSON.parse(call[1].body));
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    process.env.CO_API_KEY = 'test-key';

    fetchMock = jest
      .fn()
      .mockResolvedValue(respuestaLLM('Respuesta del asistente'));
    global.fetch = fetchMock;

    ejecutarHerramientaMock = mcpServiceMock.ejecutarHerramienta;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroqAgentService,
        { provide: McpService, useValue: mcpServiceMock },
      ],
    }).compile();

    service = module.get<GroqAgentService>(GroqAgentService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debería definirse', () => {
    expect(service).toBeDefined();
  });

  it('usa command-a-plus-05-2026 como modelo principal', async () => {
    await service.procesarPreguntaFinanciera(
      '¿qué es el margen de contribución?',
      'c1',
    );

    expect(ultimoPayload().model).toBe('command-a-plus-05-2026');
  });

  it('responde definiciones (CONOCIMIENTO) sin ejecutar herramientas ni enviar tools al LLM', async () => {
    const respuesta = await service.procesarPreguntaFinanciera(
      '¿qué es el margen de contribución?',
      'c1',
    );

    expect(respuesta).toBe('Respuesta del asistente');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ultimoPayload().tools).toBeUndefined();
    expect(ejecutarHerramientaMock).not.toHaveBeenCalled();
  });

  it('asesoría (ABIERTA) consulta métricas reales y sintetiza con el LLM', async () => {
    ejecutarHerramientaMock.mockImplementation((name: string) => {
      if (name === 'get_global_margin') {
        return JSON.stringify({
          success: true,
          totalSales: 1000,
          totalVariableCosts: 400,
          totalMargin: 600,
          globalMarginRatio: 0.6,
        });
      }
      return JSON.stringify({
        success: false,
        dataSource: 'database',
        error: 'sin datos',
      });
    });

    const respuesta = await service.procesarPreguntaFinanciera(
      '¿cómo puedo incrementar las ventas?',
      'c1',
    );

    expect(respuesta).toBe('Respuesta del asistente');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const nombres = ejecutarHerramientaMock.mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(nombres).toEqual(
      expect.arrayContaining([
        'get_global_margin',
        'get_break_even_point',
        'get_total_cash_flow',
      ]),
    );
    const userMsg = ultimoPayload().messages?.find(
      (m) => m.role === 'user',
    )?.content;
    expect(userMsg).toContain('Margen de contribución global');
  });

  it('asesoría sin datos disponibles aún responde con consejo general (síntesis)', async () => {
    ejecutarHerramientaMock.mockResolvedValue(
      JSON.stringify({
        success: false,
        dataSource: 'database',
        error: 'sin datos',
      }),
    );

    const respuesta = await service.procesarPreguntaFinanciera(
      '¿cómo incrementar las ventas?',
      'c1',
    );

    expect(respuesta).toBe('Respuesta del asistente');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const userMsg = ultimoPayload().messages?.find(
      (m) => m.role === 'user',
    )?.content;
    expect(userMsg).toContain('No se pudieron consultar datos');
  });

  it('"movimientos de este mes" descompone, ejecuta y analiza', async () => {
    ejecutarHerramientaMock.mockResolvedValue(
      JSON.stringify([
        {
          paymentDate: '2026-08-05T00:00:00.000Z',
          category: { name: 'Ventas' },
          item: { name: 'Camisa' },
          amountUSD: 100,
          amountBs: 0,
          status: 'COMPLETED',
        },
      ]),
    );

    const respuesta = await service.procesarPreguntaFinanciera(
      '¿cuáles son los movimientos de este mes?',
      'c1',
    );

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const iso = (d: Date) => d.toISOString().split('T')[0];

    expect(ejecutarHerramientaMock).toHaveBeenCalledWith(
      'get_transactions_by_date_range',
      { startDate: iso(inicioMes), endDate: iso(hoy) },
      'c1',
    );
    expect(respuesta).toContain('Transacciones');
    expect(respuesta).toContain('Camisa');
  });

  it('"stock de camisa oversize" descompone, resuelve y analiza', async () => {
    ejecutarHerramientaMock.mockResolvedValue(
      JSON.stringify({
        success: true,
        items: [
          {
            id: 'i1',
            name: 'Camisa Oversize',
            type: 'PRODUCT',
            basePrice: 15,
            stockCurrent: 8,
          },
        ],
      }),
    );

    const respuesta = await service.procesarPreguntaFinanciera(
      'stock de camisa oversize',
      'c1',
    );

    expect(ejecutarHerramientaMock).toHaveBeenCalledWith(
      'search_item_by_name',
      { name: 'camisa oversize' },
      'c1',
    );
    expect(respuesta).toContain('Camisa Oversize');
  });

  it('pregunta múltiple descompone y ejecuta en paralelo', async () => {
    ejecutarHerramientaMock.mockImplementation((name: string) => {
      if (name === 'search_item_by_name') {
        return JSON.stringify({
          success: true,
          items: [
            { id: 'i1', name: 'Tortas', type: 'PRODUCT', stockCurrent: 20 },
          ],
        });
      }
      if (name === 'get_product_margin') {
        return JSON.stringify({ success: true, margin: 0.65 });
      }
      return JSON.stringify({ success: false, error: 'sin datos' });
    });

    fetchMock
      .mockResolvedValueOnce(
        respuestaLLM('["stock de tortas", "margen de tortas"]'),
      )
      .mockResolvedValueOnce(respuestaLLM('Análisis: Todo bien'));

    const respuesta = await service.procesarPreguntaFinanciera(
      'dame el stock de tortas y el margen de tortas',
      'c1',
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(respuesta).toContain('Tortas');
    expect(respuesta).toContain('Análisis');
  });

  it('reintenta tras error 503 y recupera en el segundo intento', async () => {
    fetchMock
      .mockRejectedValueOnce({ status: 503, message: 'UNAVAILABLE' })
      .mockResolvedValueOnce(respuestaLLM('Respuesta recuperada'));

    const promise = service.procesarPreguntaFinanciera(
      '¿qué es el margen de contribución?',
      'c1',
    );
    await jest.advanceTimersByTimeAsync(1000);
    const respuesta = await promise;

    expect(respuesta).toBe('Respuesta recuperada');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ultimoPayload().model).toBe('command-a-plus-05-2026');
  });

  it('reintenta tras error 429 y recupera', async () => {
    fetchMock
      .mockRejectedValueOnce({ status: 429, message: 'RATE_LIMIT' })
      .mockResolvedValueOnce(respuestaLLM('OK'));

    const promise = service.procesarPreguntaFinanciera(
      '¿qué es el margen de contribución?',
      'c1',
    );
    await jest.advanceTimersByTimeAsync(1000);
    const respuesta = await promise;

    expect(respuesta).toBe('OK');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falla inmediatamente en error 401 (no transitorio)', async () => {
    fetchMock.mockRejectedValue({
      status: 401,
      message: 'Unauthorized',
    });

    const respuesta = await service.procesarPreguntaFinanciera(
      '¿qué es el margen de contribución?',
      'c1',
    );

    expect(respuesta).toContain('Puedo ayudarte con stock');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retorna mensaje de ayuda si agota reintentos', async () => {
    fetchMock.mockRejectedValue({
      status: 503,
      message: 'UNAVAILABLE',
    });

    const promise = service.procesarPreguntaFinanciera(
      '¿qué es el margen de contribución?',
      'c1',
    );
    await jest.advanceTimersByTimeAsync(7000);
    const respuesta = await promise;

    expect(respuesta).toContain('Puedo ayudarte con stock');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
