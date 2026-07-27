import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { CacheService } from '@/common/cache/cache.service';
import { Prisma } from '@prisma/client';
import {
  AggregatedTotalsRow,
  RawStatementRow,
  StatementMap,
  DateRange,
  TotalCashFlowResponse,
  RangeCashFlowResponse,
} from './interfaces/cash-flow.types';
import {
  CASH_FLOW_COLORS,
  CACHE_TTL,
  CACHE_PREFIXES,
  STATEMENT_TYPES,
} from './constants/cash-flow.constants';

@Injectable()
export class CashFlowService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async getTotalCashFlow(companyId: string): Promise<TotalCashFlowResponse> {
    return this.cache.getOrSet(
      `${CACHE_PREFIXES.TOTAL}:${companyId}`,
      async () => {
        const [totals, statementRows] = await Promise.all([
          this.getAggregatedTotals(companyId),
          this.getStatementRaw(companyId),
        ]);

        const ciUsd = this.pickTotal(
          totals,
          'INFLOW',
          'COMPLETED',
          'total_usd',
        );
        const ciBs = this.pickTotal(totals, 'INFLOW', 'COMPLETED', 'total_bs');
        const coUsd = this.pickTotal(
          totals,
          'OUTFLOW',
          'COMPLETED',
          'total_usd',
        );
        const coBs = this.pickTotal(totals, 'OUTFLOW', 'COMPLETED', 'total_bs');
        const piUsd = this.pickTotal(totals, 'INFLOW', 'PENDING', 'total_usd');
        const piBs = this.pickTotal(totals, 'INFLOW', 'PENDING', 'total_bs');
        const poUsd = this.pickTotal(totals, 'OUTFLOW', 'PENDING', 'total_usd');
        const poBs = this.pickTotal(totals, 'OUTFLOW', 'PENDING', 'total_bs');

        const statementMap = this.buildStatementMap(statementRows);

        return {
          companyId,
          usd: {
            summary: {
              current_balance: ciUsd - coUsd,
              pending_inflow: piUsd,
              pending_outflow: -poUsd,
              net_cash_flow: ciUsd - coUsd + piUsd - poUsd,
            },
            cash_flow_statement: {
              operating: this.sectionOutput(statementMap, 'OPERATING', 'Usd'),
              investing: this.sectionOutput(statementMap, 'INVESTING', 'Usd'),
              financing: this.sectionOutput(statementMap, 'FINANCING', 'Usd'),
            },
          },
          bs: {
            summary: {
              current_balance: ciBs - coBs,
              pending_inflow: piBs,
              pending_outflow: -poBs,
              net_cash_flow: ciBs - coBs + piBs - poBs,
            },
            cash_flow_statement: {
              operating: this.sectionOutput(statementMap, 'OPERATING', 'Bs'),
              investing: this.sectionOutput(statementMap, 'INVESTING', 'Bs'),
              financing: this.sectionOutput(statementMap, 'FINANCING', 'Bs'),
            },
          },
          period: {
            start_date: null,
            end_date: new Date(),
          },
        };
      },
      CACHE_TTL,
    );
  }

  async getCashFlow(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<RangeCashFlowResponse> {
    const { start, end } = this.validateDateRange(startDate, endDate);

    const cacheKey = `${CACHE_PREFIXES.RANGE}:${companyId}:${start.toISOString()}:${end.toISOString()}`;
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const [completed, pending, statementRows, records] = await Promise.all([
          this.getAggregatedTotals(companyId, 'COMPLETED', { start, end }),
          this.getAggregatedTotals(companyId, 'PENDING', { start, end }),
          this.getStatementRaw(companyId, { start, end }),
          this.prisma.transaction.findMany({
            where: {
              companyId,
              isRemoved: false,
              status: 'COMPLETED',
              paymentDate: { gte: start, lte: end },
            },
            include: { category: true },
            orderBy: { paymentDate: 'desc' },
            take: 200,
          }),
        ]);

        const inflowUsd = this.pickTotal(
          completed,
          'INFLOW',
          'COMPLETED',
          'total_usd',
        );
        const inflowBs = this.pickTotal(
          completed,
          'INFLOW',
          'COMPLETED',
          'total_bs',
        );
        const outflowUsd = this.pickTotal(
          completed,
          'OUTFLOW',
          'COMPLETED',
          'total_usd',
        );
        const outflowBs = this.pickTotal(
          completed,
          'OUTFLOW',
          'COMPLETED',
          'total_bs',
        );
        const piUsd = this.pickTotal(pending, 'INFLOW', 'PENDING', 'total_usd');
        const piBs = this.pickTotal(pending, 'INFLOW', 'PENDING', 'total_bs');
        const poUsd = this.pickTotal(
          pending,
          'OUTFLOW',
          'PENDING',
          'total_usd',
        );
        const poBs = this.pickTotal(pending, 'OUTFLOW', 'PENDING', 'total_bs');

        const statementMap = this.buildStatementMap(statementRows);

        return {
          period: { startDate: start, endDate: end },
          usd: {
            summary: {
              current_balance: inflowUsd - outflowUsd,
              inflow: inflowUsd,
              outflow: outflowUsd,
              pending_inflow: piUsd,
              pending_outflow: -poUsd,
              net_cash_flow: inflowUsd - outflowUsd + piUsd - poUsd,
            },
            cash_flow_statement: {
              operating: this.sectionOutput(statementMap, 'OPERATING', 'Usd'),
              investing: this.sectionOutput(statementMap, 'INVESTING', 'Usd'),
              financing: this.sectionOutput(statementMap, 'FINANCING', 'Usd'),
            },
          },
          bs: {
            summary: {
              current_balance: inflowBs - outflowBs,
              inflow: inflowBs,
              outflow: outflowBs,
              pending_inflow: piBs,
              pending_outflow: -poBs,
              net_cash_flow: inflowBs - outflowBs + piBs - poBs,
            },
            cash_flow_statement: {
              operating: this.sectionOutput(statementMap, 'OPERATING', 'Bs'),
              investing: this.sectionOutput(statementMap, 'INVESTING', 'Bs'),
              financing: this.sectionOutput(statementMap, 'FINANCING', 'Bs'),
            },
          },
          transactionCount: records.length,
          records,
        };
      },
      CACHE_TTL,
    );
  }

  // ─── Private helpers ──────────────────────────────────────

  // TEMPORARY: debug endpoint to inspect pending transactions in date range
  async debugPendingTransactions(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const { start, end } = this.validateDateRange(startDate, endDate);

    const [aggregated, transactions] = await Promise.all([
      this.getAggregatedTotals(companyId, 'PENDING', { start, end }),
      this.prisma.transaction.findMany({
        where: {
          companyId,
          isRemoved: false,
          status: 'PENDING',
          paymentDate: { gte: start, lte: end },
        },
        include: { category: true },
        orderBy: { paymentDate: 'desc' },
      }),
    ]);

    return {
      dateRange: { start, end },
      aggregated,
      transactionCount: transactions.length,
      transactions,
    };
  }

  private async getAggregatedTotals(
    companyId: string,
    status?: string,
    dateRange?: DateRange,
  ) {
    const statusFilter = status
      ? Prisma.sql`AND t.status = ${status}`
      : Prisma.empty;

    const dateFilter = dateRange
      ? Prisma.sql`AND t.payment_date >= ${dateRange.start} AND t.payment_date <= ${dateRange.end}`
      : Prisma.empty;

    return this.prisma.$queryRaw<AggregatedTotalsRow[]>`
      SELECT
        c.flow_direction,
        t.status,
        SUM(t.amount_usd) AS total_usd,
        SUM(t.amount_bs) AS total_bs
      FROM transactions t
      INNER JOIN categories c ON c.id = t.category_id
      WHERE t.company_id = ${companyId}::uuid
        AND t.is_removed = false
        ${statusFilter}
        ${dateFilter}
      GROUP BY c.flow_direction, t.status
    `;
  }

  private async getStatementRaw(companyId: string, dateRange?: DateRange) {
    const dateFilter = dateRange
      ? Prisma.sql`AND t.payment_date >= ${dateRange.start} AND t.payment_date <= ${dateRange.end}`
      : Prisma.empty;

    return this.prisma.$queryRaw<RawStatementRow[]>`
      SELECT
        c.type,
        c.id AS category_id,
        c.name,
        c.flow_direction,
        SUM(
          CASE WHEN c.flow_direction = 'INFLOW' THEN t.amount_usd ELSE -t.amount_usd END
        ) AS signed_usd,
        SUM(
          CASE WHEN c.flow_direction = 'INFLOW' THEN t.amount_bs ELSE -t.amount_bs END
        ) AS signed_bs
      FROM transactions t
      INNER JOIN categories c ON c.id = t.category_id
      WHERE t.company_id = ${companyId}::uuid
        AND t.is_removed = false
        AND t.status = 'COMPLETED'
        ${dateFilter}
      GROUP BY c.type, c.id, c.name, c.flow_direction
    `;
  }

  private buildStatementMap(rows: RawStatementRow[]): StatementMap {
    const statementMap: StatementMap = {};
    for (const type of STATEMENT_TYPES) {
      statementMap[type] = { totalUsd: 0, totalBs: 0, categories: new Map() };
    }

    for (const row of rows) {
      const signedUsd = Number(row.signed_usd) || 0;
      const signedBs = Number(row.signed_bs) || 0;
      const section = statementMap[row.type];
      if (!section) continue;

      section.totalUsd += signedUsd;
      section.totalBs += signedBs;
      section.categories.set(row.category_id, {
        name: row.name,
        amountUsd: signedUsd,
        amountBs: signedBs,
        color:
          CASH_FLOW_COLORS[row.flow_direction as keyof typeof CASH_FLOW_COLORS],
      });
    }

    return statementMap;
  }

  private sectionOutput(
    statementMap: StatementMap,
    type: string,
    currency: 'Usd' | 'Bs',
  ) {
    const section = statementMap[type];
    if (!section) return { total: 0, categories: [] };

    return {
      total: section[`total${currency}`],
      categories: Array.from(section.categories.values()).map((c) => ({
        name: c.name,
        amount: c[`amount${currency}`],
        color: c.color,
      })),
    };
  }

  private validateDateRange(startDate: Date, endDate: Date): DateRange {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date range');
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private pickTotal(
    rows: AggregatedTotalsRow[],
    flowDirection: string,
    status: string,
    field: 'total_usd' | 'total_bs',
  ): number {
    const row = rows.find(
      (r) => r.flow_direction === flowDirection && r.status === status,
    );
    return row ? Number(row[field]) || 0 : 0;
  }
}
