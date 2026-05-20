import { Test, TestingModule } from '@nestjs/testing';
import { CashFlowController } from './cash-flow.controller';

describe('CashFlowController', () => {
  let controller: CashFlowController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashFlowController],
    }).compile();

    controller = module.get<CashFlowController>(CashFlowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
