import { Injectable } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  DataAccessPrismaService,
  Organization,
  Prisma,
} from '@junction-hub/shared/data-access-prisma';

@Injectable()
export class OrganizationService {
  constructor(private dataAccessPrismaService: DataAccessPrismaService) {}

  async create(
    createOrganizationDto: CreateOrganizationDto,
  ): Promise<Organization> {
    const data: Prisma.OrganizationCreateInput = {
      ...createOrganizationDto,
    };

    return this.dataAccessPrismaService.organization.create({
      data,
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.OrganizationWhereUniqueInput;
    where?: Prisma.OrganizationWhereInput;
    orderBy?: Prisma.OrganizationOrderByWithRelationInput;
  }): Promise<Organization[]> {
    const { skip, take, cursor, where, orderBy } = params;

    return this.dataAccessPrismaService.organization.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }

  async findOne(id: string): Promise<Organization | null> {
    const where: Prisma.OrganizationWhereUniqueInput = { id };

    return this.dataAccessPrismaService.organization.findUnique({
      where,
    });
  }

  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<Organization> {
    const data: Prisma.OrganizationUpdateInput = { ...updateOrganizationDto };
    const where: Prisma.OrganizationWhereUniqueInput = { id };

    return this.dataAccessPrismaService.organization.update({
      data,
      where,
    });
  }

  async remove(id: string): Promise<Organization> {
    const where: Prisma.OrganizationWhereUniqueInput = { id };

    return this.dataAccessPrismaService.organization.delete({
      where,
    });
  }
}
