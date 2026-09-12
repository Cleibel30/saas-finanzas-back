import { Test, TestingModule } from '@nestjs/testing';
import { BalancePointService } from './balance-point.service';
import { ContributionMarginService } from '@/contribution-margin/contribution-margin.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('BalancePointService', () => {
  let service: BalancePointService;
  let marginService: {
    getGlobalContributionMargin: jest.Mock;
  };
  let prisma: {
    transaction: {
      aggregate: jest.Mock;
    };
  };

  const companyId = 'f7c05710-b970-4070-b253-776d61196cda';
  const startDate = new Date('2026-06-16T04:00:00.000Z');
  const endDate = new Date('2026-08-15T03:59:59.999Z');

  beforeEach(async () => {
    marginService = {
      getGlobalContributionMargin: jest.fn(),
    };
    prisma = {
      transaction: {
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalancePointService,
        { provide: ContributionMarginService, useValue: marginService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BalancePointService>(BalancePointService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('con margen de contribución negativo', () => {
    beforeEach(() => {
      marginService.getGlobalContributionMargin.mockResolvedValue({
        totalSales: 844.5,
        totalSalesBs: 638840.89,
        totalVariableCosts: 1071.8,
        totalVariableCostsBs: 801333.88,
        totalMargin: 844.5 - 1071.8,
        totalMarginBs: 638840.89 - 801333.88,
        globalMarginRatio: (844.5 - 1071.8) / 844.5,
        globalMarginRatioBs: (638840.89 - 801333.88) / 638840.89,
      });
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amountUSD: 200, amountBs: 154214 },
      });
    });

    it('devuelve null en equilibrio, isSafe false y marginStatus negative', async () => {
      const result = await service.getCompanyBreakEven(
        companyId,
        startDate,
        endDate,
      );

      expect(result.breakEven.salesVolumeRequired).toBeNull();
      expect(result.breakEven.salesVolumeRequiredBs).toBeNull();
      expect(result.breakEven.isSafe).toBe(false);
      expect(result.breakEven.isSafeUsd).toBe(false);
      expect(result.breakEven.isSafeBs).toBe(false);
      expect(result.breakEven.distanceToBreakEven).toBeNull();
      expect(result.breakEven.distanceToBreakEvenBs).toBeNull();
      expect(result.breakEven.marginStatus).toBe('negative');
      expect(result.breakEven.marginStatusUsd).toBe('negative');
      expect(result.breakEven.marginStatusBs).toBe('negative');
      expect(result.financialsActual.dollars.globalMarginRatio).toBeLessThan(0);
    });
  });

  describe('USD seguro pero Bs por debajo del equilibrio (tasas inconsistentes)', () => {
    beforeEach(() => {
      marginService.getGlobalContributionMargin.mockResolvedValue({
        totalSales: 762,
        totalSalesBs: 576102.19,
        totalVariableCosts: 559.4,
        totalVariableCostsBs: 423244.17,
        totalMargin: 762 - 559.4,
        totalMarginBs: 576102.19 - 423244.17,
        globalMarginRatio: (762 - 559.4) / 762,
        globalMarginRatioBs: (576102.19 - 423244.17) / 576102.19,
      });
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amountUSD: 200, amountBs: 154214 },
      });
    });

    it('isSafe global false, statuses por moneda divergentes', async () => {
      const result = await service.getCompanyBreakEven(
        companyId,
        startDate,
        endDate,
      );

      expect(result.breakEven.isSafeUsd).toBe(true);
      expect(result.breakEven.isSafeBs).toBe(false);
      expect(result.breakEven.isSafe).toBe(false);
      expect(result.breakEven.marginStatusUsd).toBe('safe');
      expect(result.breakEven.marginStatusBs).toBe('at_risk');
      expect(result.breakEven.marginStatus).toBe('at_risk');
      expect(result.breakEven.distanceToBreakEven).toBeGreaterThan(0);
      expect(result.breakEven.distanceToBreakEvenBs).toBeLessThan(0);
    });
  });

  describe('con margen de contribución positivo', () => {
    beforeEach(() => {
      marginService.getGlobalContributionMargin.mockResolvedValue({
        totalSales: 844.5,
        totalSalesBs: 638840.89,
        totalVariableCosts: 500,
        totalVariableCostsBs: 380000,
        totalMargin: 344.5,
        totalMarginBs: 258840.89,
        globalMarginRatio: 344.5 / 844.5,
        globalMarginRatioBs: 258840.89 / 638840.89,
      });
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amountUSD: 200, amountBs: 154214 },
      });
    });

    it('calcula equilibrio con ratio positivo y distanceToBreakEven > 0', async () => {
      const result = await service.getCompanyBreakEven(
        companyId,
        startDate,
        endDate,
      );

      const expected = 200 / (344.5 / 844.5);
      expect(result.breakEven.salesVolumeRequired).toBeCloseTo(expected, 2);
      expect(result.breakEven.isSafe).toBe(true);
      expect(result.breakEven.isSafeUsd).toBe(true);
      expect(result.breakEven.isSafeBs).toBe(true);
      expect(result.breakEven.distanceToBreakEven).toBeGreaterThan(0);
      expect(result.breakEven.marginStatus).toBe('safe');
      expect(result.breakEven.marginStatusUsd).toBe('safe');
      expect(result.breakEven.marginStatusBs).toBe('safe');
    });
  });
});
