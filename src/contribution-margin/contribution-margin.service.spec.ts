import { Test, TestingModule } from '@nestjs/testing';
import { ContributionMarginService } from './contribution-margin.service';

describe('ContributionMarginService', () => {
  let service: ContributionMarginService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContributionMarginService],
    }).compile();

    service = module.get<ContributionMarginService>(ContributionMarginService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
