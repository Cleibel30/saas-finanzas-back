import { dec, div, roundCents, toNum } from './money';

describe('money utils', () => {
  describe('dec', () => {
    it('construye Decimal desde número y string', () => {
      expect(dec(0.1).toString()).toBe('0.1');
      expect(dec('95.50').toString()).toBe('95.5');
    });
  });

  describe('roundCents', () => {
    it('usa ROUND_HALF_UP', () => {
      expect(toNum(roundCents(1.005))).toBe(1.01);
      expect(toNum(roundCents(1.004))).toBe(1.0);
      expect(toNum(roundCents(2.5))).toBe(2.5);
    });

    it('evita el artefacto binario de 0.1 + 0.2', () => {
      expect(toNum(roundCents(dec(0.1).add(0.2)))).toBe(0.3);
    });
  });

  describe('operaciones decimal', () => {
    it('multiplica sin error de punto flotante', () => {
      expect(toNum(roundCents(div(100, 0.955)))).toBe(104.71);
    });

    it('redondea el resultado de la multiplicación a centavos', () => {
      expect(toNum(roundCents(dec(100).mul(0.955)))).toBe(95.5);
    });
  });
});
