import { Test, TestingModule } from '@nestjs/testing';
import { FinanceChatController } from './finance-chat.controller';

describe('FinanceChatController', () => {
  let controller: FinanceChatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceChatController],
    }).compile();

    controller = module.get<FinanceChatController>(FinanceChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
