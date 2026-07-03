import { Test, TestingModule } from '@nestjs/testing';
import { ContributionMarginController } from './contribution-margin.controller';

describe('ContributionMarginController', () => {
  let controller: ContributionMarginController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContributionMarginController],
    }).compile();

    controller = module.get<ContributionMarginController>(
      ContributionMarginController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
