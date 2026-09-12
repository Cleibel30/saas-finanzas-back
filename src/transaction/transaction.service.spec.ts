import { TransactionService } from './transaction.service';
import { Currency } from '@prisma/client';

describe('TransactionService', () => {
  let service: TransactionService;

  beforeEach(async () => {
    service = new TransactionService({} as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateAmounts', () => {
    it('convierte DOLARES a Bs exacto sin artefacto float', () => {
      const { amountUSD, amountBs } = service.calculateAmounts(
        100,
        Currency.DOLARES,
        0.955,
      );
      expect(amountUSD.toNumber()).toBe(100);
      expect(amountBs.toNumber()).toBe(95.5);
    });

    it('convierte BOLIVARES a USD redondeando half-up', () => {
      const { amountUSD, amountBs } = service.calculateAmounts(
        100,
        Currency.BOLIVARES,
        0.955,
      );
      expect(amountBs.toNumber()).toBe(100);
      expect(amountUSD.toNumber()).toBe(104.71);
    });

    it('con tasa 0 en BOLIVARES devuelve amountUSD 0', () => {
      const { amountUSD, amountBs } = service.calculateAmounts(
        50,
        Currency.BOLIVARES,
        0,
      );
      expect(amountUSD.toNumber()).toBe(0);
      expect(amountBs.toNumber()).toBe(50);
    });
  });

  describe('resolveAmounts', () => {
    it('recalcula monto = unitPrice * quantity en DOLARES', () => {
      const { amountUSD, amountBs } = service['resolveAmounts']({
        unitPrice: 4.55,
        quantity: 10,
        currency: Currency.DOLARES,
        dollarRate: 80.5,
        amountUSD: 999,
        amountBs: 999,
      });
      expect(amountUSD.toNumber()).toBe(45.5);
      expect(amountBs.toNumber()).toBe(3662.75);
    });

    it('recalcula monto en BOLIVARES usando la tasa', () => {
      const { amountUSD, amountBs } = service['resolveAmounts']({
        unitPrice: 100,
        quantity: 3,
        currency: Currency.BOLIVARES,
        dollarRate: 0.955,
        amountUSD: 999,
        amountBs: 999,
      });
      expect(amountBs.toNumber()).toBe(300);
      expect(amountUSD.toNumber()).toBe(314.14);
    });

    it('confía en el cliente si falta unitPrice o quantity', () => {
      const { amountUSD, amountBs } = service['resolveAmounts']({
        unitPrice: undefined,
        quantity: 3,
        currency: Currency.DOLARES,
        dollarRate: 80.5,
        amountUSD: 42,
        amountBs: 3381,
      });
      expect(amountUSD.toNumber()).toBe(42);
      expect(amountBs.toNumber()).toBe(3381);
    });

    it('confía en el cliente si quantity es 0', () => {
      const { amountUSD } = service['resolveAmounts']({
        unitPrice: 4.55,
        quantity: 0,
        currency: Currency.DOLARES,
        dollarRate: 80.5,
        amountUSD: 77,
        amountBs: 100,
      });
      expect(amountUSD.toNumber()).toBe(77);
    });
  });
});
