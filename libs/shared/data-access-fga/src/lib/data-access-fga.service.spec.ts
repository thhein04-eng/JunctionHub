import { Test } from '@nestjs/testing';
import { DataAccessFgaService } from './data-access-fga.service';

describe('DataAccessFgaService', () => {
  let service: DataAccessFgaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DataAccessFgaService],
    }).compile();

    service = module.get(DataAccessFgaService);
  });

  it('should be defined', () => {
    expect(service).toBeTruthy();
  });
});
