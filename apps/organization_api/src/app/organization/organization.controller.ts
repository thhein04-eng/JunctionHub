import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Organization as OrganizationModel } from '@junction-hub/shared/data-access-prisma';
import { FindAllOrganizationDto } from './dto/find-all-organization.dto';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  async create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationService.create(createOrganizationDto);
  }

  @Get()
  async findAll(
    @Query()
    params: FindAllOrganizationDto,
  ): Promise<OrganizationModel[]> {
    return this.organizationService.findAllByParams(params);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<OrganizationModel | null> {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<OrganizationModel> {
    return this.organizationService.update(id, updateOrganizationDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<OrganizationModel> {
    return this.organizationService.remove(id);
  }
}
