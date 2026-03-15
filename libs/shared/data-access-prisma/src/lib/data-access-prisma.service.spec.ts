import { Test } from '@nestjs/testing';
import { DataAccessPrismaService } from './data-access-prisma.service';

describe('DataAccessPrismaService', () => {
  let service: DataAccessPrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DataAccessPrismaService],
    }).compile();

    service = module.get(DataAccessPrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeTruthy();
  });
});
