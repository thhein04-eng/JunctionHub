import { Test, TestingModule } from '@nestjs/testing';
import { DataAccessFgaTupleService } from './data-access-fga-tuple.service';

describe('DataAccessFgaTupleService', () => {
  let service: DataAccessFgaTupleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataAccessFgaTupleService],
    }).compile();

    service = module.get<DataAccessFgaTupleService>(DataAccessFgaTupleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
