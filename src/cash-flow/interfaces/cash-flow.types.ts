export interface AggregatedTotalsRow {
  flow_direction: string;
  status: string;
  total_usd: string;
  total_bs: string;
}

export interface RawStatementRow {
  type: string;
  category_id: string;
  name: string;
  flow_direction: string;
  signed_usd: string;
  signed_bs: string;
}

export interface StatementCategoryInput {
  name: string;
  amountUsd: number;
  amountBs: number;
  color: string;
}

export interface StatementSectionMap {
  totalUsd: number;
  totalBs: number;
  categories: Map<string, StatementCategoryInput>;
}

export type StatementMap = Record<string, StatementSectionMap>;

export interface CategoryOutput {
  name: string;
  amount: number;
  color: string;
}

export interface StatementSectionOutput {
  total: number;
  categories: CategoryOutput[];
}

export interface CashFlowStatementOutput {
  operating: StatementSectionOutput;
  investing: StatementSectionOutput;
  financing: StatementSectionOutput;
}

export interface TotalCurrencySummary {
  current_balance: number;
  pending_inflow: number;
  pending_outflow: number;
  net_cash_flow: number;
}

export interface RangeCurrencySummary {
  current_balance: number;
  inflow: number;
  outflow: number;
  pending_inflow: number;
  pending_outflow: number;
  net_cash_flow: number;
}

export interface CurrencyBlock<T> {
  summary: T;
  cash_flow_statement: CashFlowStatementOutput;
}

export interface TotalCashFlowResponse {
  companyId: string;
  usd: CurrencyBlock<TotalCurrencySummary>;
  bs: CurrencyBlock<TotalCurrencySummary>;
  period: { start_date: null; end_date: Date };
}

export interface RangeCashFlowResponse {
  period: { startDate: Date; endDate: Date };
  usd: CurrencyBlock<RangeCurrencySummary>;
  bs: CurrencyBlock<RangeCurrencySummary>;
  transactionCount: number;
  records: unknown[];
}

export interface DateRange {
  start: Date;
  end: Date;
}
