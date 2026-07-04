import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GrossProfitService } from '@/gross-profit/gross-profit.service';
import { TransactionStatus, FlowDirection, CategoryType } from '@prisma/client';

@Injectable()
export class NetProfitService {
  constructor(
    private prisma: PrismaService,
    private grossProfitService: GrossProfitService,
  ) {}

  private normalizeDateRange(startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private async getExpensesByType(
    companyId: string,
    categoryType: CategoryType,
    start: Date,
    end: Date,
  ) {
    const agg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: {
          flowDirection: FlowDirection.OUTFLOW,
          type: categoryType,
          isCogs: false,
        },
      },
    });

    return {
      amountUSD: Number(agg._sum.amountUSD) || 0,
      amountBs: Number(agg._sum.amountBs) || 0,
    };
  }

  async getNetProfit(companyId: string, startDate: Date, endDate: Date) {
    const { start, end } = this.normalizeDateRange(startDate, endDate);

    const grossProfit = await this.grossProfitService.getGlobalGrossProfit(companyId, startDate, endDate);
    const operatingExpenses = await this.getExpensesByType(companyId, CategoryType.OPERATING, start, end);
    const investingExpenses = await this.getExpensesByType(companyId, CategoryType.INVESTING, start, end);
    const financingExpenses = await this.getExpensesByType(companyId, CategoryType.FINANCING, start, end);

    const totalExpensesUSD =
      operatingExpenses.amountUSD + investingExpenses.amountUSD + financingExpenses.amountUSD;
    const totalExpensesBs =
      operatingExpenses.amountBs + investingExpenses.amountBs + financingExpenses.amountBs;

    const netProfitUSD = grossProfit.grossProfit - totalExpensesUSD;
    const netProfitBs = grossProfit.grossProfitBs - totalExpensesBs;
    const netMarginRatio = grossProfit.netSales > 0 ? netProfitUSD / grossProfit.netSales : 0;

    return {
      grossProfit: {
        netSales: grossProfit.netSales,
        netSalesBs: grossProfit.netSalesBs,
        cogs: grossProfit.cogs,
        cogsBs: grossProfit.cogsBs,
        grossProfit: grossProfit.grossProfit,
        grossProfitBs: grossProfit.grossProfitBs,
      },
      expenses: {
        operating: {
          amountUSD: operatingExpenses.amountUSD,
          amountBs: operatingExpenses.amountBs,
        },
        investing: {
          amountUSD: investingExpenses.amountUSD,
          amountBs: investingExpenses.amountBs,
        },
        financing: {
          amountUSD: financingExpenses.amountUSD,
          amountBs: financingExpenses.amountBs,
        },
        totalUSD: totalExpensesUSD,
        totalBs: totalExpensesBs,
      },
      netProfitUSD: Number(netProfitUSD.toFixed(2)),
      netProfitBs: Number(netProfitBs.toFixed(2)),
      netMarginRatio: Number(netMarginRatio.toFixed(2)),
    };
  }

  async getStatement(companyId: string, startDate: Date, endDate: Date) {
    const { start, end } = this.normalizeDateRange(startDate, endDate);

    const salesAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.INFLOW },
      },
    });

    const cogsAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: { flowDirection: FlowDirection.OUTFLOW, isCogs: true },
      },
    });

    const operatingAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: {
          flowDirection: FlowDirection.OUTFLOW,
          type: CategoryType.OPERATING,
          isCogs: false,
        },
      },
    });

    const investingAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: {
          flowDirection: FlowDirection.OUTFLOW,
          type: CategoryType.INVESTING,
          isCogs: false,
        },
      },
    });

    const financingAgg = await this.prisma.transaction.aggregate({
      _sum: { amountUSD: true, amountBs: true },
      where: {
        companyId,
        status: TransactionStatus.COMPLETED,
        isRemoved: false,
        paymentDate: { gte: start, lte: end },
        category: {
          flowDirection: FlowDirection.OUTFLOW,
          type: CategoryType.FINANCING,
          isCogs: false,
        },
      },
    });

    const salesUSD = Number(salesAgg._sum.amountUSD) || 0;
    const salesBs = Number(salesAgg._sum.amountBs) || 0;
    const cogsUSD = Number(cogsAgg._sum.amountUSD) || 0;
    const cogsBs = Number(cogsAgg._sum.amountBs) || 0;
    const grossProfitUSD = salesUSD - cogsUSD;
    const grossProfitBs = salesBs - cogsBs;

    const operatingUSD = Number(operatingAgg._sum.amountUSD) || 0;
    const operatingBs = Number(operatingAgg._sum.amountBs) || 0;
    const investingUSD = Number(investingAgg._sum.amountUSD) || 0;
    const investingBs = Number(investingAgg._sum.amountBs) || 0;
    const financingUSD = Number(financingAgg._sum.amountUSD) || 0;
    const financingBs = Number(financingAgg._sum.amountBs) || 0;

    const totalExpensesUSD = operatingUSD + investingUSD + financingUSD;
    const totalExpensesBs = operatingBs + investingBs + financingBs;

    const netProfitUSD = grossProfitUSD - totalExpensesUSD;
    const netProfitBs = grossProfitBs - totalExpensesBs;

    return {
      period: { startDate: start, endDate: end },
      currency: 'USD',
      sections: [
        { label: 'Sales', amountUSD: salesUSD, amountBs: salesBs },
        { label: 'Cost of Goods Sold (COGS)', amountUSD: -cogsUSD, amountBs: -cogsBs },
        {
          label: 'Gross Profit',
          amountUSD: Number(grossProfitUSD.toFixed(2)),
          amountBs: Number(grossProfitBs.toFixed(2)),
          subtotal: true,
        },
        { label: 'Operating Expenses', amountUSD: -operatingUSD, amountBs: -operatingBs },
        { label: 'Investing Expenses', amountUSD: -investingUSD, amountBs: -investingBs },
        { label: 'Financing Expenses', amountUSD: -financingUSD, amountBs: -financingBs },
        {
          label: 'Total Expenses',
          amountUSD: -totalExpensesUSD,
          amountBs: -totalExpensesBs,
          subtotal: true,
        },
        {
          label: 'Net Profit (P&L)',
          amountUSD: Number(netProfitUSD.toFixed(2)),
          amountBs: Number(netProfitBs.toFixed(2)),
          total: true,
        },
      ],
    };
  }
}
