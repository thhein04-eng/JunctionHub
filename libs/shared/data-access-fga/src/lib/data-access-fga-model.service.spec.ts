import { Test, TestingModule } from '@nestjs/testing';
import { DataAccessFgaModelService } from './data-access-fga-model.service';

describe('DataAccessFgaModelService', () => {
  let service: DataAccessFgaModelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataAccessFgaModelService],
    }).compile();

    service = module.get<DataAccessFgaModelService>(DataAccessFgaModelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
