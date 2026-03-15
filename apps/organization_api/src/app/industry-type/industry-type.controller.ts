import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IndustryTypeService } from './industry-type.service';
import { CreateIndustryTypeDto } from './dto';

@Controller('industry-type')
export class IndustryTypeController {
  constructor(private readonly industryTypeService: IndustryTypeService) {}

  @Post()
  create(@Body() dto: CreateIndustryTypeDto) {
    return this.industryTypeService.create(dto);
  }

  @Get()
  findAll() {
    return this.industryTypeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.industryTypeService.findById(id);
  }
}
