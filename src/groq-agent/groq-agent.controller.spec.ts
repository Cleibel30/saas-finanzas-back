import { Test, TestingModule } from '@nestjs/testing';
import { GroqAgentController } from './groq-agent.controller';

describe('GroqAgentController', () => {
  let controller: GroqAgentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroqAgentController],
    }).compile();

    controller = module.get<GroqAgentController>(GroqAgentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
