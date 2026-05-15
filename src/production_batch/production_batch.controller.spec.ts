import { Test, TestingModule } from '@nestjs/testing';
import { ProductionBatchController } from './production_batch.controller';

describe('ProductionBatchController', () => {
  let controller: ProductionBatchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductionBatchController],
    }).compile();

    controller = module.get<ProductionBatchController>(ProductionBatchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
