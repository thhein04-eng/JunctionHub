import { Module } from '@nestjs/common';
import { IndustryTypeService } from './industry-type.service';
import { IndustryTypeController } from './industry-type.controller';

@Module({
  controllers: [IndustryTypeController],
  providers: [IndustryTypeService],
})
export class IndustryTypeModule {}
