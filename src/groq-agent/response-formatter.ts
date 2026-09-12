type Fila = Record<string, unknown>;

type Columna = {
  clave: string;
  etiqueta: string;
};

type ComandoTabla = {
  titulo: string;
  columnas: Columna[];
  filas: Fila[];
};

const CLAVES_OMITIDAS = new Set([
  'id',
  'companyId',
  'itemId',
  'categoryId',
  'batchId',
  'transactionId',
  'costItemId',
  'isRemoved',
  'isDefault',
  'dataSource',
  'source',
  'color',
  'createdAt',
  'updatedAt',
  'searchTerm',
]);

const ETIQUETAS_ES: Record<string, string> = {
  name: 'Nombre',
  itemName: 'Producto/Servicio',
  productName: 'Producto',
  serviceName: 'Servicio',
  categoryName: 'Categoría',
  type: 'Tipo',
  itemType: 'Tipo',
  amount: 'Monto',
  amountUSD: 'Monto USD',
  amountBs: 'Monto Bs',
  unitPrice: 'Precio unitario',
  basePrice: 'Precio',
  price: 'Precio',
  stockCurrent: 'Stock actual',
  quantity: 'Cantidad',
  batchQuantity: 'Cantidad',
  totalBatches: 'Lotes cerrados',
  status: 'Estado',
  batchStatus: 'Estado del lote',
  flowDirection: 'Flujo',
  currency: 'Moneda',
  dollarRate: 'Tasa del día',
  paymentDate: 'Fecha de pago',
  paymentReference: 'Referencia',
  description: 'Descripción',
  stockEffect: 'Efecto de stock',
  batchDate: 'Fecha del lote',
  totalUnitsSold: 'Unidades vendidas',
  totalServicesSold: 'Servicios vendidos',
  totalSales: 'Ventas',
  totalSalesBs: 'Ventas (Bs)',
  netSales: 'Ventas netas',
  netSalesBs: 'Ventas netas (Bs)',
  totalVariableCosts: 'Costos variables',
  totalVariableCostsBs: 'Costos variables (Bs)',
  totalVariableCost: 'Costos variables',
  totalVariableCostBs: 'Costos variables (Bs)',
  totalFixedCosts: 'Costos fijos',
  totalFixedCostsBs: 'Costos fijos (Bs)',
  totalMargin: 'Margen de contribución',
  totalMarginBs: 'Margen de contribución (Bs)',
  contributionMargin: 'Margen de contribución',
  contributionMarginBs: 'Margen de contribución (Bs)',
  contributionMarginRatio: 'Margen de contribución (%)',
  globalMarginRatio: 'Margen de contribución (%)',
  globalMarginRatioBs: 'Margen de contribución (%) (Bs)',
  totalInflow: 'Ingresos',
  totalInflowBs: 'Ingresos (Bs)',
  grossProfit: 'Utilidad bruta',
  grossProfitBs: 'Utilidad bruta (Bs)',
  netProfitUSD: 'Utilidad neta (USD)',
  netProfitBs: 'Utilidad neta (Bs)',
  netMarginRatio: 'Margen neto (%)',
  grossMarginRatio: 'Margen bruto (%)',
  cogs: 'Costo de venta (COGS)',
  cogsBs: 'Costo de venta (COGS) (Bs)',
  salesVolumeRequired: 'Ventas mínimas requeridas',
  salesVolumeRequiredBs: 'Ventas mínimas requeridas (Bs)',
  distanceToBreakEven: 'Distancia al equilibrio',
  distanceToBreakEvenBs: 'Distancia al equilibrio (Bs)',
  isSafe: 'Situación segura',
  totalCostUSD: 'Costo total (USD)',
  totalCostBs: 'Costo total (Bs)',
  unitCostUSD: 'Costo unitario (USD)',
  unitCostBs: 'Costo unitario (Bs)',
  weightedAvgUnitCostUSD: 'Costo unitario promedio (USD)',
  weightedAvgUnitCostBs: 'Costo unitario promedio (Bs)',
  avgUnitCostUSD: 'Costo unitario promedio (USD)',
  avgUnitCostBs: 'Costo unitario promedio (Bs)',
  unitInflow: 'Ingreso unitario (USD)',
  unitInflowBs: 'Ingreso unitario (Bs)',
  unitVariableCost: 'Costo variable unitario (USD)',
  unitVariableCostBs: 'Costo variable unitario (Bs)',
  unitContributionMargin: 'Margen unitario (USD)',
  unitContributionMarginBs: 'Margen unitario (Bs)',
  avgUnitPrice: 'Precio promedio',
  avgUnitCogs: 'Costo promedio',
  unitGrossProfit: 'Utilidad bruta unitaria',
  totalQuantity: 'Cantidad total',
  targetMarginPercent: 'Margen objetivo (%)',
  priceUSD: 'Precio (USD)',
  priceBs: 'Precio (Bs)',
  current_balance: 'Saldo actual',
  pending_inflow: 'Ingresos pendientes',
  pending_outflow: 'Egresos pendientes',
  net_cash_flow: 'Flujo de caja neto',
  inflow: 'Ingresos',
  outflow: 'Egresos',
  operating: 'Operativas',
  investing: 'Inversión',
  financing: 'Financiamiento',
  transactionCount: 'Transacciones en el periodo',
  period: 'Periodo',
};

const TRADUCCION_TIPO_ITEM = new Map<string, string>([
  ['PRODUCT', 'Producto'],
  ['SERVICE', 'Servicio'],
]);

const TRADUCCION_TIPO_CATEGORIA = new Map<string, string>([
  ['OPERATING', 'Operativa'],
  ['INVESTING', 'Inversión'],
  ['FINANCING', 'Financiamiento'],
]);

const TRADUCCION_FLUJO = new Map<string, string>([
  ['INFLOW', 'Ingreso'],
  ['OUTFLOW', 'Egreso'],
]);

const TRADUCCION_ESTADO = new Map<string, string>([
  ['COMPLETED', 'Completada'],
  ['PENDING', 'Pendiente'],
]);

const TRADUCCION_ESTADO_LOTE = new Map<string, string>([
  ['OPEN', 'Abierto'],
  ['CLOSED', 'Cerrado'],
]);

const TRADUCCION_MONEDA = new Map<string, string>([
  ['BOLIVARES', 'Bolívares'],
  ['DOLARES', 'Dólares'],
]);

const CLAVES_PORCENTAJE = new Set([
  'contributionMarginRatio',
  'globalMarginRatio',
  'globalMarginRatioBs',
  'grossMarginRatio',
  'netMarginRatio',
]);

const CLAVES_FECHA = new Set([
  'paymentDate',
  'batchDate',
  'startDate',
  'endDate',
]);

const LABELES_ESTADO_RESULTADOS = new Map<string, string>([
  ['Sales', 'Ventas'],
  ['Cost of Goods Sold (COGS)', 'Costo de venta (COGS)'],
  ['Gross Profit', 'Utilidad bruta'],
  ['Operating Expenses', 'Gastos operativos'],
  ['Investing Expenses', 'Gastos de inversión'],
  ['Financing Expenses', 'Gastos de financiamiento'],
  ['Total Expenses', 'Total de gastos'],
  ['Net Profit (P&L)', 'Utilidad neta'],
]);

const formateadorNumeros = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function asStringBasico(valor: unknown): string {
  if (typeof valor === 'string') {
    return valor;
  }
  if (
    typeof valor === 'number' ||
    typeof valor === 'boolean' ||
    typeof valor === 'bigint'
  ) {
    return String(valor);
  }
  return '';
}

function textoDe(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function mensajeError(data: Fila): string {
  const msg = data.message;
  const err = data.error;
  if (typeof msg === 'string' && msg.trim()) {
    return msg;
  }
  if (typeof err === 'string' && err.trim()) {
    return err;
  }
  return 'Sin resultados en la base de datos.';
}

function traduccion(valor: unknown, mapa: Map<string, string>): unknown {
  return mapa.get(asStringBasico(valor)) ?? valor;
}

function celdaTexto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '';
  }
  if (typeof valor === 'object') {
    try {
      return JSON.stringify(valor);
    } catch {
      return '[objeto]';
    }
  }
  return asStringBasico(valor).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function celdaNumero(valor: unknown): string {
  if (typeof valor === 'number') {
    return formateadorNumeros.format(valor);
  }
  return celdaTexto(valor);
}

function celdaFecha(valor: unknown): string {
  if (!valor) {
    return '';
  }
  const fecha = new Date(valor as string | number);
  if (Number.isNaN(fecha.getTime())) {
    return asStringBasico(valor);
  }
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${fecha.getFullYear()}`;
}

function celdaPorcentaje(valor: unknown): string {
  let n = Number(valor);
  if (Number.isNaN(n)) {
    return asStringBasico(valor);
  }
  if (Math.abs(n) <= 1) {
    n = n * 100;
  }
  return `${formateadorNumeros.format(n)}%`;
}

/** Formateo de un valor de celda según la clave de la columna. */
function celdaDeClave(clave: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') {
    return '';
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sí' : 'No';
  }
  if (CLAVES_PORCENTAJE.has(clave)) {
    return celdaPorcentaje(valor);
  }
  if (CLAVES_FECHA.has(clave)) {
    return celdaFecha(valor);
  }
  if (clave === 'type' || clave === 'itemType') {
    return celdaTexto(traduccion(valor, TRADUCCION_TIPO_ITEM));
  }
  if (clave === 'flowDirection') {
    return celdaTexto(traduccion(valor, TRADUCCION_FLUJO));
  }
  if (clave === 'status') {
    return celdaTexto(traduccion(valor, TRADUCCION_ESTADO));
  }
  if (clave === 'batchStatus') {
    return celdaTexto(traduccion(valor, TRADUCCION_ESTADO_LOTE));
  }
  if (clave === 'currency') {
    return celdaTexto(traduccion(valor, TRADUCCION_MONEDA));
  }
  return celdaNumero(valor);
}

function valorDe(fila: Fila, clave: string): unknown {
  if (!clave.includes('.')) {
    return fila[clave];
  }
  let actual: unknown = fila;
  for (const parte of clave.split('.')) {
    if (actual === null || actual === undefined || typeof actual !== 'object') {
      return undefined;
    }
    actual = (actual as Record<string, unknown>)[parte];
  }
  return actual;
}

function hoja(clave: string): string {
  const partes = clave.split('.');
  return partes[partes.length - 1];
}

function marcaTabla(comando: ComandoTabla): string {
  const { titulo, columnas, filas } = comando;
  if (filas.length === 0) {
    return `**${titulo}**\n\nSin registros.`;
  }
  const lineas = [`**${titulo}**`, ''];
  lineas.push(`| ${columnas.map((c) => c.etiqueta).join(' | ')} |`);
  lineas.push(`|${columnas.map(() => '---').join('|')}|`);
  for (const fila of filas) {
    const celdas = columnas.map((c) =>
      celdaDeClave(hoja(c.clave), valorDe(fila, c.clave)),
    );
    lineas.push(`| ${celdas.join(' | ')} |`);
  }
  return lineas.join('\n');
}

function tablaConceptos(conceptos: Array<[string, unknown, unknown]>): string {
  const lineas = ['| Concepto | USD | Bs |', '| --- | --- | --- |'];
  for (const [concepto, usd, bs] of conceptos) {
    const celdaUsd = typeof usd === 'string' ? usd : celdaNumero(usd);
    const celdaBs = typeof bs === 'string' ? bs : celdaNumero(bs);
    lineas.push(`| ${celdaTexto(concepto)} | ${celdaUsd} | ${celdaBs} |`);
  }
  return lineas.join('\n');
}

function renderObjeto(objeto: Fila, orden: string[] | null = null): string {
  const claves = orden ?? Object.keys(objeto);
  const lineas: string[] = [];
  for (const clave of claves) {
    if (CLAVES_OMITIDAS.has(clave)) {
      continue;
    }
    const valor = objeto[clave];
    if (valor === null || valor === undefined) {
      continue;
    }
    const etiqueta = ETIQUETAS_ES[clave] ?? clave;
    if (clave === 'period' && typeof valor === 'object') {
      const p = valor as Fila;
      lineas.push(
        `- **Periodo:** ${celdaFecha(p.startDate)} al ${celdaFecha(p.endDate)}`,
      );
      continue;
    }
    if (Array.isArray(valor)) {
      lineas.push(`**${etiqueta}:**`);
      lineas.push(...renderArreglo(valor));
      continue;
    }
    if (typeof valor === 'object') {
      lineas.push(`**${etiqueta}:**`);
      lineas.push(...renderObjeto(valor as Fila).split('\n'));
      continue;
    }
    lineas.push(`- **${etiqueta}:** ${celdaDeClave(clave, valor)}`);
  }
  return lineas.length ? lineas.join('\n') : 'Sin datos.';
}

function renderArreglo(arreglo: unknown[]): string[] {
  if (arreglo.length === 0) {
    return ['Sin registros.'];
  }
  const filas = arreglo.filter(
    (x): x is Fila => typeof x === 'object' && x !== null && !Array.isArray(x),
  );
  if (filas.length > 0) {
    const primero = filas[0];
    const claves = Object.keys(primero).filter((k) => !CLAVES_OMITIDAS.has(k));
    const soloEscalares = claves.every(
      (k) =>
        primero[k] === null ||
        primero[k] === undefined ||
        typeof primero[k] !== 'object',
    );
    if (soloEscalares) {
      const columnas = claves.map((k) => ({
        clave: k,
        etiqueta: ETIQUETAS_ES[k] ?? k,
      }));
      return marcaTabla({ titulo: 'Registros', columnas, filas }).split('\n');
    }
  }
  return arreglo
    .map((x) =>
      typeof x === 'object' && x !== null
        ? renderObjeto(x as Fila)
        : `- ${celdaTexto(x)}`,
    )
    .filter((l) => l)
    .join('\n')
    .split('\n');
}

function marcaTablaItems(filas: Fila[], titulo: string): string {
  const columnas: Columna[] = [
    { clave: 'name', etiqueta: 'Nombre' },
    { clave: 'type', etiqueta: 'Tipo' },
    { clave: 'basePrice', etiqueta: 'Precio' },
    { clave: 'stockCurrent', etiqueta: 'Stock' },
  ];
  const vista = filas.map((fila) => ({
    ...fila,
    type: traduccion(fila.type, TRADUCCION_TIPO_ITEM),
  }));
  return marcaTabla({ titulo, columnas, filas: vista });
}

function marcaTablaCategorias(filas: Fila[], titulo: string): string {
  const columnas: Columna[] = [
    { clave: 'name', etiqueta: 'Nombre' },
    { clave: 'type', etiqueta: 'Tipo' },
    { clave: 'flowDirection', etiqueta: 'Flujo' },
  ];
  const vista = filas.map((fila) => ({
    ...fila,
    type: traduccion(fila.type, TRADUCCION_TIPO_CATEGORIA),
    flowDirection: traduccion(fila.flowDirection, TRADUCCION_FLUJO),
  }));
  return marcaTabla({ titulo, columnas, filas: vista });
}

function marcaTablaTransacciones(filas: Fila[], titulo: string): string {
  const columnas: Columna[] = [
    { clave: 'paymentDate', etiqueta: 'Fecha' },
    { clave: 'category.name', etiqueta: 'Categoría' },
    { clave: 'item.name', etiqueta: 'Producto/Servicio' },
    { clave: 'amountUSD', etiqueta: 'USD' },
    { clave: 'amountBs', etiqueta: 'Bs' },
    { clave: 'status', etiqueta: 'Estado' },
  ];
  const vista = filas.map((fila) => ({
    ...fila,
    status: traduccion(fila.status, TRADUCCION_ESTADO),
  }));
  return marcaTabla({ titulo, columnas, filas: vista });
}

function marcaTablaLotes(filas: Fila[], titulo: string): string {
  const columnas: Columna[] = [
    { clave: 'item.name', etiqueta: 'Producto' },
    { clave: 'quantity', etiqueta: 'Cantidad' },
    { clave: 'status', etiqueta: 'Estado' },
    { clave: 'batchDate', etiqueta: 'Fecha del lote' },
  ];
  const vista = filas.map((fila) => ({
    ...fila,
    status: traduccion(fila.status, TRADUCCION_ESTADO_LOTE),
  }));
  return marcaTabla({ titulo, columnas, filas: vista });
}

function renderMargen(data: Fila): string {
  const nombreItem = textoDe(data.itemName);
  const titulo = nombreItem ? ` — ${nombreItem}` : '';
  const financial = (data.financials as Fila) ?? {};
  const lineas = [`**Margen de contribución${titulo}**`];
  const conceptos: Array<[string, unknown, unknown]> = [
    ['Ingresos', financial.totalInflow, financial.totalInflowBs],
    [
      'Costos variables',
      financial.totalVariableCost ?? financial.totalVariableCosts,
      financial.totalVariableCostBs ?? financial.totalVariableCostsBs,
    ],
    [
      'Margen de contribución',
      financial.contributionMargin,
      financial.contributionMarginBs,
    ],
  ];
  lineas.push('', tablaConceptos(conceptos));

  if (financial.contributionMarginRatio !== undefined) {
    lineas.push(
      `- **% de contribución:** ${celdaPorcentaje(financial.contributionMarginRatio)}`,
    );
  }
  if (data.totalUnitsSold !== undefined) {
    lineas.push(`- **Unidades vendidas:** ${celdaNumero(data.totalUnitsSold)}`);
  }
  if (data.totalServicesSold !== undefined) {
    lineas.push(
      `- **Servicios vendidos:** ${celdaNumero(data.totalServicesSold)}`,
    );
  }
  if (data.batchQuantity !== undefined) {
    lineas.push(`- **Cantidad del lote:** ${celdaNumero(data.batchQuantity)}`);
  }
  if (data.batchStatus !== undefined) {
    lineas.push(
      `- **Estado del lote:** ${celdaTexto(traduccion(data.batchStatus, TRADUCCION_ESTADO_LOTE))}`,
    );
  }

  const unit = data.unitAnalysis as Fila | undefined;
  if (unit) {
    lineas.push('', '**Análisis por unidad:**', renderObjeto(unit));
  }
  return lineas.join('\n');
}

function renderMargenGlobal(data: Fila): string {
  const conceptos: Array<[string, unknown, unknown]> = [
    ['Ventas', data.totalSales, data.totalSalesBs],
    ['Costos variables', data.totalVariableCosts, data.totalVariableCostsBs],
    ['Margen de contribución', data.totalMargin, data.totalMarginBs],
    [
      '% Margen',
      celdaPorcentaje(data.globalMarginRatio),
      celdaPorcentaje(data.globalMarginRatioBs),
    ],
  ];
  return `**Margen de contribución global**\n\n${tablaConceptos(conceptos)}`.trim();
}

function celdaEstadoEquilibrio(valor: unknown): string {
  switch (valor) {
    case 'negative':
      return 'Pérdida estructural (margen negativo)';
    case 'safe':
      return 'Seguro: ventas por encima del equilibrio';
    case 'at_risk':
      return 'En riesgo: por debajo del equilibrio';
    default:
      return '';
  }
}

function renderPuntoEquilibrio(data: Fila): string {
  const finAct = data.financialsActual as Fila | undefined;
  const dolares = finAct?.dollars as Fila | undefined;
  const bs = finAct?.bs as Fila | undefined;
  const eq = data.breakEven as Fila | undefined;
  const leer = (obj: Fila | undefined, clave: string): unknown => obj?.[clave];
  const lineas = [
    '**Punto de equilibrio**',
    '',
    '| Concepto | USD | Bs |',
    '| --- | --- | --- |',
    `| Ventas actuales | ${celdaNumero(leer(dolares, 'totalSales'))} | ${celdaNumero(leer(bs, 'totalSalesBs'))} |`,
    `| Costos variables | ${celdaNumero(leer(dolares, 'totalVariableCosts'))} | ${celdaNumero(leer(bs, 'totalVariableCostsBs'))} |`,
    `| Costos fijos | ${celdaNumero(leer(dolares, 'totalFixedCosts'))} | ${celdaNumero(leer(bs, 'totalFixedCostsBs'))} |`,
    `| % Margen | ${celdaPorcentaje(leer(dolares, 'globalMarginRatio'))} | ${celdaPorcentaje(leer(bs, 'globalMarginRatioBs'))} |`,
    `| Ventas mínimas requeridas | ${celdaNumero(leer(eq, 'salesVolumeRequired'))} | ${celdaNumero(leer(eq, 'salesVolumeRequiredBs'))} |`,
    `| Distancia al equilibrio | ${celdaNumero(leer(eq, 'distanceToBreakEven'))} | ${celdaNumero(leer(eq, 'distanceToBreakEvenBs'))} |`,
    `| ¿Situación segura? (USD) | ${eq?.isSafeUsd ? 'Sí' : 'No'} | |`,
    `| ¿Situación segura? (Bs) | ${eq?.isSafeBs ? 'Sí' : 'No'} | |`,
    `| Estado | ${celdaEstadoEquilibrio(eq?.marginStatus)} | |`,
  ];
  return lineas.join('\n');
}

function renderUtilidadBruta(data: Fila): string {
  const nombreItem = textoDe(data.itemName);
  const titulo = nombreItem ? ` — ${nombreItem}` : '';
  const lineas = [
    `**Utilidad bruta${titulo}**`,
    `- **Ventas netas:** ${celdaNumero(data.netSales)} | ${celdaNumero(data.netSalesBs)}`,
    `- **Costo de venta (COGS):** ${celdaNumero(data.cogs)} | ${celdaNumero(data.cogsBs)}`,
    `- **Utilidad bruta:** ${celdaNumero(data.grossProfit)} | ${celdaNumero(data.grossProfitBs)}`,
    `- **Margen bruto:** ${celdaPorcentaje(data.grossMarginRatio)}`,
  ];
  if (data.totalUnitsSold !== undefined) {
    lineas.push(`- **Unidades vendidas:** ${celdaNumero(data.totalUnitsSold)}`);
  }
  if (data.totalServicesSold !== undefined) {
    lineas.push(
      `- **Servicios vendidos:** ${celdaNumero(data.totalServicesSold)}`,
    );
  }
  const unit = data.unitAnalysis as Fila | undefined;
  if (unit && Object.keys(unit).length > 0) {
    lineas.push('', '**Análisis por unidad:**', renderObjeto(unit));
  }
  return lineas.join('\n');
}

function renderUtilidadNeta(data: Fila): string {
  const gp = (data.grossProfit as Fila) ?? {};
  const gastos = (data.expenses as Fila) ?? {};
  const gastoLinea = (g: Fila | undefined, nombre: string): string => {
    if (!g) {
      return '';
    }
    return `- **${nombre}:** ${celdaNumero(g.amountUSD)} | ${celdaNumero(g.amountBs)}`;
  };
  return [
    '**Utilidad neta**',
    '',
    `- **Ventas netas:** ${celdaNumero(gp.netSales)} | ${celdaNumero(gp.netSalesBs)}`,
    `- **Costo de venta (COGS):** ${celdaNumero(gp.cogs)} | ${celdaNumero(gp.cogsBs)}`,
    `- **Utilidad bruta:** ${celdaNumero(gp.grossProfit)} | ${celdaNumero(gp.grossProfitBs)}`,
    '',
    '**Gastos:**',
    gastoLinea(gastos.operating as Fila, 'Operativos'),
    gastoLinea(gastos.investing as Fila, 'Inversión'),
    gastoLinea(gastos.financing as Fila, 'Financiamiento'),
    `- **Total de gastos:** ${celdaNumero(gastos.totalUSD)} | ${celdaNumero(gastos.totalBs)}`,
    '',
    `- **Utilidad neta (USD):** ${celdaNumero(data.netProfitUSD)}`,
    `- **Utilidad neta (Bs):** ${celdaNumero(data.netProfitBs)}`,
    `- **Margen neto:** ${celdaPorcentaje(data.netMarginRatio)}`,
  ]
    .filter((l) => l.trim())
    .join('\n');
}

function renderEstadoResultados(data: Fila): string {
  const secciones = Array.isArray(data.sections) ? data.sections : [];
  if (secciones.length === 0) {
    return 'Sin registros.';
  }
  const lineas = [
    '**Estado de resultados**',
    '',
    '| Concepto | USD | Bs |',
    '| --- | --- | --- |',
  ];
  for (const seccion of secciones) {
    const s = seccion as Fila;
    const labelOriginal = typeof s.label === 'string' ? s.label : '';
    const etiqueta =
      LABELES_ESTADO_RESULTADOS.get(labelOriginal) ?? labelOriginal;
    const importante = Boolean(s.subtotal || s.total);
    const resalt = (x: string) => (importante ? `**${x}**` : x);
    lineas.push(
      `| ${resalt(celdaTexto(etiqueta))} | ${resalt(celdaNumero(s.amountUSD))} | ${resalt(celdaNumero(s.amountBs))} |`,
    );
  }
  return lineas.join('\n');
}

function renderCostoUnitario(data: Fila): string {
  const nombreItem = textoDe(data.itemName);
  const titulo = nombreItem ? ` — ${nombreItem}` : '';
  const claves = [
    'batchQuantity',
    'batchStatus',
    'quantity',
    'totalQuantity',
    'totalServicesSold',
    'totalBatches',
    'totalCostUSD',
    'totalCostBs',
    'unitCostUSD',
    'unitCostBs',
    'weightedAvgUnitCostUSD',
    'weightedAvgUnitCostBs',
    'avgUnitCostUSD',
    'avgUnitCostBs',
  ].filter((k) => data[k] !== undefined);
  return `**Costo unitario${titulo}**\n${renderObjeto(data, claves)}`.trim();
}

function renderPrecioSugerido(data: Fila): string {
  const margen = (data.marginMethod as Fila) ?? {};
  const markup = (data.markupMethod as Fila) ?? {};
  return [
    `**Precio recomendado — ${textoDe(data.itemName) || 'Producto/Servicio'}**`,
    '',
    `- **Costo unitario:** ${celdaNumero(data.unitCostUSD)} | ${celdaNumero(data.unitCostBs)}`,
    `- **Margen objetivo:** ${celdaNumero(data.targetMarginPercent)}%`,
    '',
    '**Método margen sobre precio de venta:**',
    renderObjeto(margen, ['priceUSD', 'priceBs', 'description']),
    '',
    '**Método margen sobre costo (markup):**',
    renderObjeto(markup, ['priceUSD', 'priceBs', 'description']),
  ].join('\n');
}

function renderFlujoCaja(data: Fila): string {
  const lineas = ['**Flujo de caja**'];
  const bloques: Array<[string, string]> = [
    ['USD', 'usd'],
    ['Bs', 'bs'],
  ];
  for (const [moneda, clave] of bloques) {
    const bloque = data[clave] as Fila | undefined;
    if (!bloque) {
      continue;
    }
    const resumen = (bloque.summary as Fila) ?? {};
    lineas.push(`**${moneda}:**`);
    lineas.push(`- **Saldo actual:** ${celdaNumero(resumen.current_balance)}`);
    if (resumen.inflow !== undefined) {
      lineas.push(`- **Ingresos:** ${celdaNumero(resumen.inflow)}`);
      lineas.push(`- **Egresos:** ${celdaNumero(resumen.outflow)}`);
    }
    lineas.push(
      `- **Ingresos pendientes:** ${celdaNumero(resumen.pending_inflow)}`,
    );
    lineas.push(
      `- **Egresos pendientes:** ${celdaNumero(resumen.pending_outflow)}`,
    );
    lineas.push(
      `- **Flujo de caja neto:** ${celdaNumero(resumen.net_cash_flow)}`,
    );
    lineas.push('');
  }

  const bloqueUsd = data.usd as Fila | undefined;
  const statement = (bloqueUsd?.cash_flow_statement as Fila) ?? {};
  if (Object.keys(statement).length > 0) {
    lineas.push('**Por secciones (USD):**');
    for (const seccion of ['operating', 'investing', 'financing']) {
      const bloque = statement[seccion] as Fila | undefined;
      if (!bloque) {
        continue;
      }
      const etiqueta = ETIQUETAS_ES[seccion] ?? seccion;
      const categorias = (
        (bloque.categories as Array<{ name: string; amount: number }>) ?? []
      ).map((c) => `${c.name}: ${celdaNumero(c.amount)}`);
      const detalle = categorias.length ? ` (${categorias.join(', ')})` : '';
      lineas.push(`- **${etiqueta}:** ${celdaNumero(bloque.total)}${detalle}`);
    }
  }
  return lineas.filter((l) => l.trim()).join('\n');
}

function renderLoteDetalle(data: Fila): string {
  const item = data.item as Fila | undefined;
  const lineas = [
    `**Lote de producción — ${textoDe(item?.name) || 'Sin producto'}**`,
    `- **Cantidad:** ${celdaNumero(data.quantity)}`,
    `- **Estado:** ${celdaTexto(traduccion(data.status, TRADUCCION_ESTADO_LOTE))}`,
    `- **Fecha del lote:** ${celdaFecha(data.batchDate)}`,
  ];
  if (Array.isArray(data.transactions) && data.transactions.length > 0) {
    lineas.push(
      '',
      marcaTablaTransacciones(
        data.transactions as Fila[],
        'Transacciones del lote',
      ),
    );
  }
  return lineas.join('\n');
}

function renderGenerico(data: unknown): string {
  if (data === null || data === undefined) {
    return 'Sin datos.';
  }
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return 'Sin registros.';
    }
    const filas: Fila[] = data.map((x) => {
      if (typeof x === 'object' && x !== null && !Array.isArray(x)) {
        return x as Fila;
      }
      return { value: x };
    });
    const primero = filas[0];
    const claves = Object.keys(primero).filter((k) => !CLAVES_OMITIDAS.has(k));
    const columnas = claves.map((k) => ({
      clave: k,
      etiqueta: ETIQUETAS_ES[k] ?? k,
    }));
    return marcaTabla({ titulo: 'Registros', columnas, filas });
  }
  if (typeof data === 'object') {
    return renderObjeto(data as Fila);
  }
  return celdaTexto(data);
}

function formatearConjunto(nombreHerramienta: string, data: Fila): string {
  if (data?.success === false) {
    return mensajeError(data);
  }

  switch (nombreHerramienta) {
    case 'search_item_by_name': {
      const items = Array.isArray(data.items) ? (data.items as Fila[]) : [];
      if (items.length === 0) {
        return mensajeError(data);
      }
      return marcaTablaItems(
        items,
        `Productos y servicios encontrados (${items.length})`,
      );
    }
    case 'search_category_by_name': {
      const cats = Array.isArray(data.categories)
        ? (data.categories as Fila[])
        : [];
      if (cats.length === 0) {
        return mensajeError(data);
      }
      return marcaTablaCategorias(
        cats,
        `Categorías encontradas (${cats.length})`,
      );
    }
    case 'list_items':
    case 'list_products':
    case 'list_services': {
      const items = Array.isArray(data.data) ? (data.data as Fila[]) : [];
      if (items.length === 0) {
        return 'No hay registros en la base de datos.';
      }
      const titulo =
        nombreHerramienta === 'list_products'
          ? 'Productos'
          : nombreHerramienta === 'list_services'
            ? 'Servicios'
            : 'Productos y servicios';
      return marcaTablaItems(items, `${titulo} (${items.length})`);
    }
    case 'list_categories': {
      const cats = Array.isArray(data.data) ? (data.data as Fila[]) : [];
      if (cats.length === 0) {
        return 'No hay registros en la base de datos.';
      }
      return marcaTablaCategorias(cats, `Categorías (${cats.length})`);
    }
    case 'list_transactions': {
      const tx = Array.isArray(data.data) ? (data.data as Fila[]) : [];
      if (tx.length === 0) {
        return 'No hay transacciones registradas.';
      }
      return marcaTablaTransacciones(tx, `Transacciones (${tx.length})`);
    }
    case 'get_transactions_by_category':
    case 'get_transactions_by_date_range': {
      const tx = Array.isArray(data) ? (data as Fila[]) : [];
      if (tx.length === 0) {
        return 'No se encontraron transacciones para el criterio indicado.';
      }
      return marcaTablaTransacciones(tx, `Transacciones (${tx.length})`);
    }
    case 'get_transaction_by_id':
      return marcaTablaTransacciones([data], 'Transacción');
    case 'list_production_batches':
    case 'get_batches_by_product': {
      const lotes = Array.isArray(data.data) ? (data.data as Fila[]) : [];
      if (lotes.length === 0) {
        return 'No se encontraron lotes para el producto indicado.';
      }
      return marcaTablaLotes(lotes, `Lotes (${lotes.length})`);
    }
    case 'get_batch_by_id':
      return renderLoteDetalle(data);
    case 'get_global_margin':
      return renderMargenGlobal(data);
    case 'get_product_margin':
    case 'get_service_margin':
    case 'get_product_margin_by_batch':
      return renderMargen(data);
    case 'get_break_even_point':
      return renderPuntoEquilibrio(data);
    case 'get_gross_profit':
    case 'get_product_gross_profit':
    case 'get_service_gross_profit':
      return renderUtilidadBruta(data);
    case 'get_net_profit':
      return renderUtilidadNeta(data);
    case 'get_net_profit_statement':
      return renderEstadoResultados(data);
    case 'get_unit_cost_by_product':
    case 'get_unit_cost_by_service':
    case 'get_unit_cost_by_batch':
      return renderCostoUnitario(data);
    case 'calculate_price_with_margin':
      return renderPrecioSugerido(data);
    case 'get_total_cash_flow':
    case 'get_cash_flow_by_date_range':
      return renderFlujoCaja(data);
    default:
      return renderGenerico(data);
  }
}

export function formatearResultado(
  nombreHerramienta: string,
  jsonCrudo: string,
): string {
  let data: unknown;
  try {
    data = JSON.parse(jsonCrudo);
  } catch {
    if (nombreHerramienta === 'consulta_encadenada') {
      return jsonCrudo;
    }
    return 'Hubo un error al interpretar los datos de la base de datos.';
  }
  return formatearConjunto(nombreHerramienta, data as Fila);
}

export function formatearRespuestaBonita(
  ejecuciones: Array<{ name: string; result: string }>,
): string {
  const bloques = ejecuciones.map((ej) =>
    formatearResultado(ej.name, ej.result),
  );
  return bloques.filter((b) => b && b.trim()).join('\n\n');
}
