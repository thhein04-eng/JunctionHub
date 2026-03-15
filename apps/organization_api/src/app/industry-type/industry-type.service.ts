import { DataAccessPrismaService } from '@junction-hub/shared/data-access-prisma';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateIndustryTypeDto } from './dto';

@Injectable()
export class IndustryTypeService {
  constructor(
    private readonly dataAccessPrismaService: DataAccessPrismaService,
  ) {}

  async create(dto: CreateIndustryTypeDto) {
    const existing = await this.dataAccessPrismaService.industryType.findUnique(
      {
        where: { slug: dto.slug },
      },
    );
    if (existing)
      throw new ConflictException(
        `Industry type "${dto.slug}" already exists.`,
      );

    return this.dataAccessPrismaService.$transaction(async (tx) => {
      const industryType = await tx.industryType.create({
        data: { slug: dto.slug, label: dto.label },
      });

      const createdTypes = await Promise.all(
        dto.resourceTypes.map((rt) =>
          tx.resourceTypeDefinition.create({
            data: {
              industryTypeId: industryType.id,
              slug: rt.slug,
              label: rt.label,
              isEssential: rt.isEssential,
            },
          }),
        ),
      );

      const slugToId = new Map(createdTypes.map((t) => [t.slug, t.id]));

      await Promise.all(
        dto.relationships.map((rel) =>
          tx.resourceTypeRelationship.create({
            data: {
              industryTypeId: industryType.id,
              sourceResourceTypeId: slugToId.get(rel.sourceSlug)!,
              targetResourceTypeId: slugToId.get(rel.targetSlug)!,
              relationLabel: rel.relationLabel,
            },
          }),
        ),
      );

      return tx.industryType.findUnique({
        where: { id: industryType.id },
        include: { resourceTypeDefs: true, relationships: true },
      });
    });
  }

  async findById(id: string) {
    const record = await this.dataAccessPrismaService.industryType.findUnique({
      where: { id },
      include: { resourceTypeDefs: true, relationships: true },
    });
    if (!record)
      throw new NotFoundException(`Industry type "${id}" not found.`);

    return record;
  }

  async findAll() {
    return this.dataAccessPrismaService.industryType.findMany({
      include: { resourceTypeDefs: true, relationships: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
