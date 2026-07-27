export const CASH_FLOW_COLORS = {
  INFLOW: '#4CAF50',
  OUTFLOW: '#F44336',
} as const;

export const CACHE_TTL = 120_000;

export const CACHE_PREFIXES = {
  TOTAL: 'cashflow:total',
  RANGE: 'cashflow:range',
} as const;

export const STATEMENT_TYPES = ['OPERATING', 'INVESTING', 'FINANCING'] as const;
