import { Test, TestingModule } from '@nestjs/testing';
import { GroqAgentService } from './groq-agent.service';

describe('GroqAgentService', () => {
  let service: GroqAgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroqAgentService],
    }).compile();

    service = module.get<GroqAgentService>(GroqAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
