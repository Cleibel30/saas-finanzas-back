import { Test, TestingModule } from '@nestjs/testing';
import { BalancePointController } from './balance-point.controller';

describe('BalancePointController', () => {
  let controller: BalancePointController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalancePointController],
    }).compile();

    controller = module.get<BalancePointController>(BalancePointController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
