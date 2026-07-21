import { Injectable } from '@nestjs/common';
import { TransactionService } from '@/transaction/transaction.service';
import { NetProfitService } from '@/net-profit/net-profit.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(
    private transactionService: TransactionService,
    private netProfitService: NetProfitService,
  ) {}

  async getDashboard(
    companyId: string,
    month?: string,
  ): Promise<DashboardResponseDto> {
    const now = new Date();
    let year: number;
    let monthNum: number;

    if (month) {
      const parts = month.split('-');
      year = parseInt(parts[0], 10);
      monthNum = parseInt(parts[1], 10);
    } else {
      year = now.getFullYear();
      monthNum = now.getMonth() + 1;
    }

    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
    const prevStartDate = new Date(year, monthNum - 2, 1);
    const prevEndDate = new Date(year, monthNum - 1, 0, 23, 59, 59, 999);
    const chartStartDate = new Date(year, monthNum - 9, 1);

    const [balance, monthlyTransactions, chartData, netProfit, recentResult] =
      await Promise.all([
        this.transactionService.getCompanyBalance(companyId),
        this.transactionService.getTransactionsByDateRange(
          companyId,
          prevStartDate,
          endDate,
        ),
        this.transactionService.getMonthlyChartData(
          companyId,
          chartStartDate,
          endDate,
        ),
        this.netProfitService.getNetProfit(companyId, startDate, endDate),
        this.transactionService.getTransactionsByCompany(companyId, 1, 5),
      ]);

    const currentMonthTx = monthlyTransactions.filter((t) => {
      const d = t.paymentDate ?? t.createdAt;
      return d >= startDate && d <= endDate;
    });

    const prevMonthTx = monthlyTransactions.filter((t) => {
      const d = t.paymentDate ?? t.createdAt;
      return d >= prevStartDate && d <= prevEndDate;
    });

    const aggregate = (
      txns: typeof monthlyTransactions,
    ) => {
      let inflowUsd = 0;
      let inflowBs = 0;
      let outflowUsd = 0;
      let outflowBs = 0;

      for (const t of txns) {
        if (t.category.flowDirection === 'INFLOW') {
          inflowUsd += Number(t.amountUSD);
          inflowBs += Number(t.amountBs);
        } else {
          outflowUsd += Number(t.amountUSD);
          outflowBs += Number(t.amountBs);
        }
      }
      return { inflowUsd, inflowBs, outflowUsd, outflowBs };
    };

    const current = aggregate(currentMonthTx);
    const prev = aggregate(prevMonthTx);

    const calcVariation = (curr: number, prevVal: number) =>
      prevVal !== 0
        ? Math.round(((curr - prevVal) / Math.abs(prevVal)) * 100 * 10) / 10
        : 0;

    return {
      currentBalance: balance,
      monthlyRevenue: {
        usd: current.inflowUsd,
        bs: current.inflowBs,
        variation: calcVariation(current.inflowUsd, prev.inflowUsd),
      },
      monthlyExpenses: {
        usd: current.outflowUsd,
        bs: current.outflowBs,
        variation: calcVariation(current.outflowUsd, prev.outflowUsd),
      },
      netProfit: {
        usd: netProfit.netProfitUSD,
        bs: netProfit.netProfitBs,
        margin: netProfit.netMarginRatio,
      },
      chartData,
      recentTransactions: recentResult.data.slice(0, 5).map((t) => ({
        id: t.id,
        description: t.description,
        amountUSD: Number(t.amountUSD),
        amountBs: Number(t.amountBs),
        status: t.status,
        date: t.createdAt.toISOString(),
        category: t.category.name,
      })),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }
}
