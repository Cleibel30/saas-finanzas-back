import { Test, TestingModule } from '@nestjs/testing';
import { FinanceChatService } from './finance-chat.service';

describe('FinanceChatService', () => {
  let service: FinanceChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinanceChatService],
    }).compile();

    service = module.get<FinanceChatService>(FinanceChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
