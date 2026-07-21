export class DashboardResponseDto {
  currentBalance!: {
    usd: number;
    bs: number;
  };

  monthlyRevenue!: {
    usd: number;
    bs: number;
    variation: number;
  };

  monthlyExpenses!: {
    usd: number;
    bs: number;
    variation: number;
  };

  netProfit!: {
    usd: number;
    bs: number;
    margin: number;
  };

  chartData!: Array<{
    month: string;
    revenue: number;
    expenses: number;
  }>;

  recentTransactions!: Array<{
    id: string;
    description: string | null;
    amountUSD: number;
    amountBs: number;
    status: string;
    date: string;
    category: string;
  }>;

  period!: {
    start: string;
    end: string;
  };
}
