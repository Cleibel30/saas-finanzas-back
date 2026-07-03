import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { CacheService } from '@/common/cache/cache.service';

@Injectable()
export class CashFlowService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async getTotalCashFlow(companyId: string) {
    return this.cache.getOrSet(
      `cashflow:total:${companyId}`,
      async () => {
        const colorMap = {
          INFLOW: '#4CAF50',
          OUTFLOW: '#F44336',
        };

        // 1. Summary aggregates - 4 atomic queries instead of loading all rows
        const [
          completedInflow,
          completedOutflow,
          pendingInflow,
          pendingOutflow,
        ] = await Promise.all([
          this.prisma.transaction.aggregate({
            _sum: { amountUSD: true, amountBs: true },
            where: {
              companyId,
              status: 'COMPLETED',
              isRemoved: false,
              category: { flowDirection: 'INFLOW' },
            },
          }),
          this.prisma.transaction.aggregate({
            _sum: { amountUSD: true, amountBs: true },
            where: {
              companyId,
              status: 'COMPLETED',
              isRemoved: false,
              category: { flowDirection: 'OUTFLOW' },
            },
          }),
          this.prisma.transaction.aggregate({
            _sum: { amountUSD: true, amountBs: true },
            where: {
              companyId,
              status: 'PENDING',
              isRemoved: false,
              category: { flowDirection: 'INFLOW' },
            },
          }),
          this.prisma.transaction.aggregate({
            _sum: { amountUSD: true, amountBs: true },
            where: {
              companyId,
              status: 'PENDING',
              isRemoved: false,
              category: { flowDirection: 'OUTFLOW' },
            },
          }),
        ]);

        const ciUsd = Number(completedInflow._sum.amountUSD) || 0;
        const ciBs = Number(completedInflow._sum.amountBs) || 0;
        const coUsd = Number(completedOutflow._sum.amountUSD) || 0;
        const coBs = Number(completedOutflow._sum.amountBs) || 0;
        const piUsd = Number(pendingInflow._sum.amountUSD) || 0;
        const piBs = Number(pendingInflow._sum.amountBs) || 0;
        const poUsd = Number(pendingOutflow._sum.amountUSD) || 0;
        const poBs = Number(pendingOutflow._sum.amountBs) || 0;

        const summary = {
          usd: {
            current_balance: ciUsd - coUsd,
            pending_inflow: piUsd,
            pending_outflow: -poUsd,
            net_cash_flow: ciUsd - coUsd + piUsd - poUsd,
          },
          bs: {
            current_balance: ciBs - coBs,
            pending_inflow: piBs,
            pending_outflow: -poBs,
            net_cash_flow: ciBs - coBs + piBs - poBs,
          },
        };

        // 2. Statement aggregation by category type + individual category via raw SQL
        const rows = await this.prisma.$queryRaw<
          {
            type: string;
            category_id: string;
            name: string;
            flow_direction: string;
            signed_usd: string;
            signed_bs: string;
          }[]
        >`
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
            GROUP BY c.type, c.id, c.name, c.flow_direction
        `;

        const statementMap: Record<
          string,
          {
            totalUsd: number;
            totalBs: number;
            categories: Map<
              string,
              {
                name: string;
                amountUsd: number;
                amountBs: number;
                color: string;
              }
            >;
          }
        > = {
          OPERATING: { totalUsd: 0, totalBs: 0, categories: new Map() },
          INVESTING: { totalUsd: 0, totalBs: 0, categories: new Map() },
          FINANCING: { totalUsd: 0, totalBs: 0, categories: new Map() },
        };

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
            color: colorMap[row.flow_direction as keyof typeof colorMap],
          });
        }

        const formatStatement = (
          type: keyof typeof statementMap,
          currency: 'Usd' | 'Bs',
        ) => ({
          total: statementMap[type][`total${currency}`],
          categories: Array.from(statementMap[type].categories.values()).map(
            (c) => ({
              name: c.name,
              amount: c[`amount${currency}`],
              color: c.color,
            }),
          ),
        });

        return {
          companyId,
          usd: {
            summary: summary.usd,
            cash_flow_statement: {
              operating: formatStatement('OPERATING', 'Usd'),
              investing: formatStatement('INVESTING', 'Usd'),
              financing: formatStatement('FINANCING', 'Usd'),
            },
          },
          bs: {
            summary: summary.bs,
            cash_flow_statement: {
              operating: formatStatement('OPERATING', 'Bs'),
              investing: formatStatement('INVESTING', 'Bs'),
              financing: formatStatement('FINANCING', 'Bs'),
            },
          },
          period: {
            start_date: null,
            end_date: new Date(),
          },
        };
      },
      120_000,
    );
  }

  async getCashFlow(companyId: string, startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      start.setDate(new Date().getDate() - 30);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    const cacheKey = `cashflow:range:${companyId}:${start.toISOString()}:${end.toISOString()}`;
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const colorMap = {
          INFLOW: '#4CAF50',
          OUTFLOW: '#F44336',
        };

        const [inflowAgg, outflowAgg, statementRows, records] =
          await Promise.all([
            this.prisma.transaction.aggregate({
              _sum: { amountUSD: true, amountBs: true },
              where: {
                companyId,
                isRemoved: false,
                status: 'COMPLETED',
                paymentDate: { gte: start, lte: end },
                category: { flowDirection: 'INFLOW' },
              },
            }),
            this.prisma.transaction.aggregate({
              _sum: { amountUSD: true, amountBs: true },
              where: {
                companyId,
                isRemoved: false,
                status: 'COMPLETED',
                paymentDate: { gte: start, lte: end },
                category: { flowDirection: 'OUTFLOW' },
              },
            }),
            this.prisma.$queryRaw<
              {
                type: string;
                category_id: string;
                name: string;
                flow_direction: string;
                signed_usd: string;
                signed_bs: string;
              }[]
            >`
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
                  AND t.payment_date >= ${start}
                  AND t.payment_date <= ${end}
                GROUP BY c.type, c.id, c.name, c.flow_direction
            `,
            this.prisma.transaction.findMany({
              where: {
                companyId,
                isRemoved: false,
                status: 'COMPLETED',
                paymentDate: { gte: start, lte: end },
              },
              include: { category: true },
              orderBy: { paymentDate: 'desc' },
            }),
          ]);

        const inflowUsd = Number(inflowAgg._sum.amountUSD) || 0;
        const inflowBs = Number(inflowAgg._sum.amountBs) || 0;
        const outflowUsd = Number(outflowAgg._sum.amountUSD) || 0;
        const outflowBs = Number(outflowAgg._sum.amountBs) || 0;

        const totals = { inflowUsd, outflowUsd, inflowBs, outflowBs };

        const cashFlowStatement: Record<
          string,
          {
            totalUsd: number;
            totalBs: number;
            categories: Map<
              string,
              {
                name: string;
                amountUsd: number;
                amountBs: number;
                color: string;
              }
            >;
          }
        > = {
          OPERATING: { totalUsd: 0, totalBs: 0, categories: new Map() },
          INVESTING: { totalUsd: 0, totalBs: 0, categories: new Map() },
          FINANCING: { totalUsd: 0, totalBs: 0, categories: new Map() },
        };

        for (const row of statementRows) {
          const signedUsd = Number(row.signed_usd) || 0;
          const signedBs = Number(row.signed_bs) || 0;
          const section = cashFlowStatement[row.type];
          if (!section) continue;

          section.totalUsd += signedUsd;
          section.totalBs += signedBs;
          section.categories.set(row.category_id, {
            name: row.name,
            amountUsd: signedUsd,
            amountBs: signedBs,
            color: colorMap[row.flow_direction as keyof typeof colorMap],
          });
        }

        const formatSection = (
          type: keyof typeof cashFlowStatement,
          currency: 'Usd' | 'Bs',
        ) => ({
          total: cashFlowStatement[type][`total${currency}`],
          categories: Array.from(
            cashFlowStatement[type].categories.values(),
          ).map((c) => ({
            name: c.name,
            amount: c[`amount${currency}`],
            color: c.color,
          })),
        });

        return {
          period: { startDate, endDate },
          usd: {
            summary: {
              current_balance: totals.inflowUsd - totals.outflowUsd,
              inflow: totals.inflowUsd,
              outflow: totals.outflowUsd,
              net_cash_flow: totals.inflowUsd - totals.outflowUsd,
            },
            cash_flow_statement: {
              operating: formatSection('OPERATING', 'Usd'),
              investing: formatSection('INVESTING', 'Usd'),
              financing: formatSection('FINANCING', 'Usd'),
            },
          },
          bs: {
            summary: {
              current_balance: totals.inflowBs - totals.outflowBs,
              inflow: totals.inflowBs,
              outflow: totals.outflowBs,
              net_cash_flow: totals.inflowBs - totals.outflowBs,
            },
            cash_flow_statement: {
              operating: formatSection('OPERATING', 'Bs'),
              investing: formatSection('INVESTING', 'Bs'),
              financing: formatSection('FINANCING', 'Bs'),
            },
          },
          transactionCount: records.length,
          records,
        };
      },
      120_000,
    );
  }
}
