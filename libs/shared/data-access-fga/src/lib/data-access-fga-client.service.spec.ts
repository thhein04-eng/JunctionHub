import { Test } from '@nestjs/testing';
import { DataAccessFgaClientService } from './data-access-fga-client.service';

describe('DataAccessFgaClientService', () => {
  let service: DataAccessFgaClientService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DataAccessFgaClientService],
    }).compile();

    service = module.get(DataAccessFgaClientService);
  });

  it('should be defined', () => {
    expect(service).toBeTruthy();
  });
});
