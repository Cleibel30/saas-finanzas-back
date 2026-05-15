import { Test, TestingModule } from '@nestjs/testing';
import { ProductionBatchService } from './production_batch.service';

describe('ProductionBatchService', () => {
  let service: ProductionBatchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductionBatchService],
    }).compile();

    service = module.get<ProductionBatchService>(ProductionBatchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
