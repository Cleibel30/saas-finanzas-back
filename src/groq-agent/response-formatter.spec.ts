import {
  formatearResultado,
  formatearRespuestaBonita,
} from './response-formatter';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const buscarId = (texto: string): boolean => UUID.test(texto);

describe('response-formatter', () => {
  describe('búsqueda de productos', () => {
    const payload = JSON.stringify({
      success: true,
      dataSource: 'database',
      searchTerm: 'torta',
      source: 'fuzzy',
      count: 2,
      items: [
        {
          id: 'aaaaaaaa-0000-0000-0000-000000000000',
          name: 'Torta de chocolate',
          type: 'PRODUCT',
          basePrice: 25.5,
          stockCurrent: 12,
        },
        {
          id: 'bbbbbbbb-0000-0000-0000-000000000000',
          name: 'Torta de zanahoria',
          type: 'PRODUCT',
          basePrice: 20,
          stockCurrent: 4,
        },
      ],
    });

    it('usa etiquetas en español y no muestra ids ni claves en inglés', () => {
      const salida = formatearResultado('search_item_by_name', payload);
      expect(salida).toContain('Nombre');
      expect(salida).toContain('Tipo');
      expect(salida).toContain('Precio');
      expect(salida).toContain('Producto');
      expect(salida).toContain('Torta de chocolate');
      expect(buscarId(salida)).toBe(false);
      expect(salida).not.toContain('basePrice');
      expect(salida).not.toContain('amountUSD');
      expect(salida).not.toContain('json');
    });
  });

  describe('búsqueda de categorías', () => {
    const payload = JSON.stringify({
      success: true,
      categories: [
        {
          id: 'cccccccc-0000-0000-0000-000000000000',
          name: 'Repostería',
          type: 'OPERATING',
          flowDirection: 'OUTFLOW',
          isCogs: false,
          isDirectCost: false,
          isDefault: false,
        },
      ],
      count: 1,
    });

    it('traduce tipo y flujo y no muestra el id', () => {
      const salida = formatearResultado('search_category_by_name', payload);
      expect(salida).toContain('Repostería');
      expect(salida).toContain('Operativa');
      expect(salida).toContain('Egreso');
      expect(buscarId(salida)).toBe(false);
      expect(salida).not.toContain('OPERATING');
      expect(salida).not.toContain('flowDirection');
    });
  });

  describe('listar productos (data/meta)', () => {
    const payload = JSON.stringify({
      data: [
        {
          id: 'cccccccc-0000-0000-0000-000000000000',
          name: 'Masa madre',
          type: 'PRODUCT',
          basePrice: 8,
          stockCurrent: 30,
          companyId: 'dddddddd-0000-0000-0000-000000000000',
        },
      ],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    it('usa plantilla de lista de productos', () => {
      const salida = formatearResultado('list_products', payload);
      expect(salida).toContain('Productos (1)');
      expect(salida).toContain('Masa madre');
      expect(buscarId(salida)).toBe(false);
      expect(salida).not.toContain('companyId');
    });
  });

  describe('listar transacciones', () => {
    const payload = JSON.stringify({
      data: [
        {
          id: 'eeeeeeee-0000-0000-0000-000000000000',
          paymentDate: '2026-08-01T12:00:00.000Z',
          amountUSD: 100,
          amountBs: 3600,
          status: 'COMPLETED',
          category: {
            id: 'ffffffff-0000-0000-0000-000000000000',
            name: 'Ventas',
          },
          item: {
            id: '11111111-0000-0000-0000-000000000000',
            name: 'Torta de chocolate',
          },
        },
      ],
      meta: {},
    });

    it('achata categoría e item y traduce el estado', () => {
      const salida = formatearResultado('list_transactions', payload);
      expect(salida).toContain('Categoría');
      expect(salida).toContain('Ventas');
      expect(salida).toContain('Torta de chocolate');
      expect(salida).toContain('Completada');
      expect(buscarId(salida)).toBe(false);
      expect(salida).not.toContain('COMPLETED');
    });
  });

  describe('margen global', () => {
    const payload = JSON.stringify({
      totalSales: 5000,
      totalSalesBs: 180000,
      totalVariableCosts: 3000,
      totalVariableCostsBs: 108000,
      totalMargin: 2000,
      totalMarginBs: 72000,
      globalMarginRatio: 0.4,
      globalMarginRatioBs: 0.4,
    });

    it('muestra concepto en español e %', () => {
      const salida = formatearResultado('get_global_margin', payload);
      expect(salida).toContain('Ventas');
      expect(salida).toContain('Costos variables');
      expect(salida).toContain('Margen de contribución');
      expect(salida).toContain('%');
      expect(buscarId(salida)).toBe(false);
      expect(salida).not.toContain('totalSales');
      expect(salida).not.toContain('json');
    });
  });

  describe('margen de un producto', () => {
    const payload = JSON.stringify({
      itemId: '22222222-0000-0000-0000-000000000000',
      itemName: 'Torta de fresa',
      itemType: 'PRODUCT',
      totalUnitsSold: 10,
      period: {
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-31T23:59:59.999Z',
      },
      financials: {
        totalInflow: 1000,
        totalInflowBs: 36000,
        totalVariableCost: 400,
        totalVariableCostBs: 14400,
        contributionMargin: 600,
        contributionMarginBs: 21600,
        contributionMarginRatio: 0.6,
      },
      unitAnalysis: {
        unitInflow: 100,
        unitInflowBs: 3600,
        unitVariableCost: 40,
        unitVariableCostBs: 1440,
        unitContributionMargin: 60,
        unitContributionMarginBs: 2160,
      },
    });

    it('traduce encabezado y análisis por unidad', () => {
      const salida = formatearResultado('get_product_margin', payload);
      expect(salida).toContain('Torta de fresa');
      expect(salida).toContain('Ingresos');
      expect(salida).toContain('Análisis por unidad');
      expect(salida).toContain('Margen de contribución');
      expect(buscarId(salida)).toBe(false);
      expect(salida).not.toContain('totalInflow');
      expect(salida).not.toContain('unitVariableCost');
    });
  });

  describe('punto de equilibrio', () => {
    const payload = JSON.stringify({
      companyId: 'aaaaaaaa-0000-0000-0000-000000000000',
      period: {
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-07T00:00:00.000Z',
      },
      financialsActual: {
        dollars: {
          totalSales: 5000,
          totalVariableCosts: 3000,
          totalFixedCosts: 1200,
          globalMarginRatio: 40,
        },
        bs: {
          totalSalesBs: 180000,
          totalVariableCostsBs: 108000,
          totalFixedCostsBs: 43200,
          globalMarginRatioBs: 40,
        },
      },
      breakEven: {
        salesVolumeRequired: 3000,
        salesVolumeRequiredBs: 108000,
        isSafe: true,
        isSafeUsd: true,
        isSafeBs: true,
        distanceToBreakEven: 2000,
        distanceToBreakEvenBs: 72000,
        marginStatus: 'safe',
        marginStatusUsd: 'safe',
        marginStatusBs: 'safe',
      },
    });

    it('muestra conceptos del equilibrio sin ids', () => {
      const salida = formatearResultado('get_break_even_point', payload);
      expect(salida).toContain('Punto de equilibrio');
      expect(salida).toContain('Ventas mínimas requeridas');
      expect(salida).toContain('¿Situación segura?');
      expect(salida).toContain('Sí');
      expect(buscarId(salida)).toBe(false);
      expect(salida).not.toContain('salesVolumeRequired');
    });
  });

  describe('estado de resultados (P&L)', () => {
    const payload = JSON.stringify({
      period: {
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-31T00:00:00.000Z',
      },
      currency: 'USD',
      sections: [
        { label: 'Sales', amountUSD: 5000, amountBs: 180000 },
        {
          label: 'Cost of Goods Sold (COGS)',
          amountUSD: -2000,
          amountBs: -72000,
        },
        {
          label: 'Gross Profit',
          amountUSD: 3000,
          amountBs: 108000,
          subtotal: true,
        },
        {
          label: 'Net Profit (P&L)',
          amountUSD: 1000,
          amountBs: 36000,
          total: true,
        },
      ],
    });

    it('traduce los conceptos del estado de resultados', () => {
      const salida = formatearResultado('get_net_profit_statement', payload);
      expect(salida).toContain('Ventas');
      expect(salida).toContain('Costo de venta (COGS)');
      expect(salida).toContain('Utilidad bruta');
      expect(salida).toContain('Utilidad neta');
      expect(salida).not.toContain('Sales');
      expect(salida).not.toContain('Gross Profit');
      expect(buscarId(salida)).toBe(false);
    });
  });

  describe('flujo de caja total', () => {
    const payload = JSON.stringify({
      companyId: '22222222-0000-0000-0000-000000000000',
      usd: {
        summary: {
          current_balance: 8000,
          pending_inflow: 500,
          pending_outflow: -300,
          net_cash_flow: 8200,
        },
        cash_flow_statement: {
          operating: {
            total: 7000,
            categories: [
              { name: 'Ventas', amount: 7200, color: '#000000' },
              { name: 'Servicios', amount: -200, color: '#ffffff' },
            ],
          },
          investing: { total: 500, categories: [] },
          financing: { total: 500, categories: [] },
        },
      },
      bs: {
        summary: {
          current_balance: 288000,
          pending_inflow: 0,
          pending_outflow: 0,
          net_cash_flow: 288000,
        },
      },
      period: { start_date: null, end_date: '2026-08-07T00:00:00.000Z' },
    });

    it('muestra resumen por moneda sin ids ni colores', () => {
      const salida = formatearResultado('get_total_cash_flow', payload);
      expect(salida).toContain('Flujo de caja');
      expect(salida).toContain('Saldo actual');
      expect(salida).toContain('Por secciones');
      expect(salida).toContain('Operativas');
      expect(salida).toContain('Ventas:');
      expect(buscarId(salida)).toBe(false);
      expect(salida).not.toContain('#');
      expect(salida).not.toContain('current_balance');
    });
  });

  describe('costo unitario', () => {
    const payload = JSON.stringify({
      itemId: '33333333-0000-0000-0000-000000000000',
      itemName: 'Torta de chocolate',
      totalBatches: 3,
      totalQuantity: 60,
      totalCostUSD: 900,
      totalCostBs: 32400,
      weightedAvgUnitCostUSD: 15,
      weightedAvgUnitCostBs: 540,
    });

    it('traduce etiquetas del costo unitario', () => {
      const salida = formatearResultado('get_unit_cost_by_product', payload);
      expect(salida).toContain('Torta de chocolate');
      expect(salida).toContain('Costo unitario promedio (USD)');
      expect(salida).toContain('Lotes cerrados');
      expect(buscarId(salida)).toBe(false);
      expect(salida).not.toContain('weightedAvgUnitCostUSD');
    });
  });

  describe('precio sugerido', () => {
    const payload = JSON.stringify({
      itemId: 'bbb33333-0000-0000-0000-000000000000',
      itemName: 'Torta de chocolate',
      itemType: 'PRODUCT',
      unitCostUSD: 15,
      unitCostBs: 540,
      targetMarginPercent: 30,
      marginMethod: {
        priceUSD: 21.43,
        priceBs: 771.43,
        grossMarginUSD: 6.43,
        grossMarginBs: 231.43,
        description: 'Precio de venta para lograr 30% de margen',
      },
      markupMethod: {
        priceUSD: 19.5,
        priceBs: 702,
        description: 'Precio de venta con 30% de markup',
      },
    });

    it('muestra precio recomendado en español', () => {
      const salida = formatearResultado('calculate_price_with_margin', payload);
      expect(salida).toContain('Precio recomendado');
      expect(salida).toContain('Precio (USD)');
      expect(salida).toContain('Margen objetivo');
      expect(buscarId(salida)).toBe(false);
      expect(salida).not.toContain('priceUSD');
    });
  });

  describe('error de herramienta', () => {
    it('muestra el mensaje del backend y nada más', () => {
      const payload = JSON.stringify({
        success: false,
        dataSource: 'database',
        error: 'Item no encontrado',
      });
      const salida = formatearResultado('search_item_by_name', payload);
      expect(salida).toContain('Item no encontrado');
      expect(salida).not.toContain('json');
    });
  });

  describe('formatearRespuestaBonita', () => {
    it('une varios bloques y no incluye ids', () => {
      const items = JSON.stringify({
        success: true,
        items: [
          {
            id: 'aaa22233-0000-0000-0000-000000000000',
            name: 'Torta',
            type: 'PRODUCT',
            basePrice: 10,
            stockCurrent: 5,
          },
        ],
      });
      const salida = formatearRespuestaBonita([
        { name: 'search_item_by_name', result: items },
        {
          name: 'get_global_margin',
          result: '{"totalSales":10,"globalMarginRatio":0.5}',
        },
      ]);
      expect(salida).toContain('Torta');
      expect(salida).toContain('Margen de contribución global');
      expect(buscarId(salida)).toBe(false);
    });
  });
});
