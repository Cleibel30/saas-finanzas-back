import { Test, TestingModule } from '@nestjs/testing';
import { BalancePointService } from './balance-point.service';

describe('BalancePointService', () => {
  let service: BalancePointService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BalancePointService],
    }).compile();

    service = module.get<BalancePointService>(BalancePointService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
