import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ResourceService } from './resource.service';
import {
  CreateResourceDto,
  RenameResourceDto,
  CreateRelationshipDto,
  ListResourcesDto,
} from './dto';

@Controller('organizations/:orgId/resources')
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  @Post()
  create(@Param('orgId') orgId: string, @Body() dto: CreateResourceDto) {
    return this.service.create(orgId, dto);
  }

  @Get()
  findAll(@Param('orgId') orgId: string, @Query() query: ListResourcesDto) {
    return this.service.findAll(orgId, query.typeSlug);
  }

  @Get('tree/:rootResourceId')
  getTree(
    @Param('orgId') orgId: string,
    @Param('rootResourceId') rootResourceId: string,
  ) {
    return this.service.getTree(orgId, rootResourceId);
  }

  @Get(':id')
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.findOne(orgId, id);
  }

  @Patch(':id/rename')
  rename(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: RenameResourceDto,
  ) {
    return this.service.rename(orgId, id, dto);
  }

  @Post(':id/relationships')
  createRelationship(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: CreateRelationshipDto,
  ) {
    return this.service.createRelationship(orgId, id, dto);
  }

  @Delete(':id')
  delete(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.delete(orgId, id);
  }
}
