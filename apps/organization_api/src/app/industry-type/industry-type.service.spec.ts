import { Test, TestingModule } from '@nestjs/testing';
import { IndustryTypeService } from './industry-type.service';

describe('IndustryTypeService', () => {
  let service: IndustryTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IndustryTypeService],
    }).compile();

    service = module.get<IndustryTypeService>(IndustryTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
