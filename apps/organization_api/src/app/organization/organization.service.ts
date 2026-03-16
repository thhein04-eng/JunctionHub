import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  DataAccessPrismaService,
  Organization,
  Prisma,
  ResourceTypeDefinition,
  ResourceTypeRelationship,
} from '@junction-hub/shared/data-access-prisma';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { FindAllOrganizationDto } from './dto/find-all-organization.dto';
import {
  DataAccessFgaClientService,
  DataAccessFgaModelService,
  DataAccessFgaTupleService,
} from '@junction-hub/shared/data-access-fga';

interface CreateWithSeedInput {
  name: string;
  industryTypeSlug: string;
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly dataAccessPrismaService: DataAccessPrismaService,
    private readonly dataAccessFgaClientService: DataAccessFgaClientService,
    private readonly dataAccessFgaModelService: DataAccessFgaModelService,
    private readonly dataAccessFgaTupleService: DataAccessFgaTupleService,
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    await this.createWithSeed({
      ...createOrganizationDto,
      industryTypeSlug: 'school',
    });
  }

  async createWithSeed(input: CreateWithSeedInput) {
    const industryType =
      await this.dataAccessPrismaService.industryType.findUnique({
        where: { slug: input.industryTypeSlug },
        include: { resourceTypeDefs: true, relationships: true },
      });
    if (!industryType) {
      throw new NotFoundException(
        `Industry type "${input.industryTypeSlug}" not found.`,
      );
    }

    // 1. Run existing DB transaction
    const result = await this.dataAccessPrismaService.$transaction(
      async (tx) => {
        const org = await tx.organization.create({
          data: { name: input.name, industryTypeId: industryType.id },
        });

        const essentialTypes = industryType.resourceTypeDefs.filter(
          (rt) => rt.isEssential,
        );
        if (essentialTypes.length === 0) {
          return {
            org,
            seed: {
              resourcesCreated: 0,
              relationshipsCreated: 0,
              resourceMap: {},
            },
            relationships: [],
          };
        }

        const ordered = this.topologicalSort(
          essentialTypes,
          industryType.relationships,
        );

        const typeIdToInstanceId: Record<string, string> = {};
        for (const rt of ordered) {
          const resource = await tx.resource.create({
            data: {
              orgId: org.id,
              resourceTypeDefinitionId: rt.id,
              name: `Default ${rt.label}`,
            },
          });
          typeIdToInstanceId[rt.id] = resource.id;
        }

        const seededIds = new Set(Object.keys(typeIdToInstanceId));
        let relationshipsCreated = 0;
        const seededRelationships: {
          sourceTypeSlug: string;
          sourceId: string;
          targetTypeSlug: string;
          targetId: string;
        }[] = [];

        for (const rel of industryType.relationships) {
          if (
            seededIds.has(rel.sourceResourceTypeId) &&
            seededIds.has(rel.targetResourceTypeId)
          ) {
            await tx.resourceRelationship.create({
              data: {
                orgId: org.id,
                relationshipDefId: rel.id,
                sourceResourceId: typeIdToInstanceId[rel.sourceResourceTypeId],
                targetResourceId: typeIdToInstanceId[rel.targetResourceTypeId],
              },
            });
            relationshipsCreated++;

            // Collect for FGA tuple writing after transaction
            const sourceSlug = industryType.resourceTypeDefs.find(
              (rt) => rt.id === rel.sourceResourceTypeId,
            )?.slug;
            const targetSlug = industryType.resourceTypeDefs.find(
              (rt) => rt.id === rel.targetResourceTypeId,
            )?.slug;
            if (sourceSlug && targetSlug) {
              seededRelationships.push({
                sourceTypeSlug: sourceSlug,
                sourceId: typeIdToInstanceId[rel.sourceResourceTypeId],
                targetTypeSlug: targetSlug,
                targetId: typeIdToInstanceId[rel.targetResourceTypeId],
              });
            }
          }
        }

        const typeMap = new Map(
          industryType.resourceTypeDefs.map((rt) => [rt.id, rt.slug]),
        );
        const resourceMap: Record<string, string> = {};
        for (const [typeId, instanceId] of Object.entries(typeIdToInstanceId)) {
          const slug = typeMap.get(typeId);
          if (slug) resourceMap[slug] = instanceId;
        }

        return {
          org,
          seed: {
            resourcesCreated: ordered.length,
            relationshipsCreated,
            resourceMap,
          },
          relationships: seededRelationships,
        };
      },
    );

    // 2. Provision FGA store + model + tuples (outside transaction — FGA is external)
    try {
      const storeId = await this.dataAccessFgaClientService.createStore(
        input.name,
      );

      // const modelId = await this.dataAccessFgaModelService.provisionModel(
      //   storeId,
      //   industryType.slug,
      //   industryType.resourceTypeDefs,
      //   industryType.relationships,
      // );

      const modelId =
        await this.dataAccessFgaModelService.provisionModelFromFile(
          storeId,
          industryType.slug,
        );

      await this.dataAccessPrismaService.organization.update({
        where: { id: result.org.id },
        data: { fgaStoreId: storeId, fgaModelId: modelId },
      });

      console.log(
        'Seeded relationships for FGA:',
        JSON.stringify(result.relationships, null, 2),
      );

      if (result.relationships.length > 0) {
        await this.dataAccessFgaTupleService.writeAllStructural(
          storeId,
          result.relationships,
        );
      }
    } catch (err) {
      // FGA failure should not fail onboarding — log and continue
      console.error(`FGA provisioning failed for org ${result.org.id}:`, err);
    }

    return { org: result.org, seed: result.seed };
  }

  async findOne(id: string) {
    const org = await this.dataAccessPrismaService.organization.findUnique({
      where: { id },
      include: {
        resources: { include: { resourceTypeDef: true } },
      },
    });
    if (!org) throw new NotFoundException(`Organization "${id}" not found.`);
    return org;
  }

  async findAll() {
    return this.dataAccessPrismaService.organization.findMany({
      include: { industryType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllByParams(params: FindAllOrganizationDto) {
    return this.dataAccessPrismaService.organization.findMany(params);
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

  private topologicalSort(
    essentialTypes: ResourceTypeDefinition[],
    relationships: ResourceTypeRelationship[],
  ): ResourceTypeDefinition[] {
    const essentialIds = new Set(essentialTypes.map((t) => t.id));
    const typeMap = new Map(essentialTypes.map((t) => [t.id, t]));
    const relevantRels = relationships.filter(
      (r) =>
        essentialIds.has(r.sourceResourceTypeId) &&
        essentialIds.has(r.targetResourceTypeId),
    );

    const inDegree = new Map<string, number>();
    const targets = new Map<string, string[]>();
    for (const id of essentialIds) {
      inDegree.set(id, 0);
      targets.set(id, []);
    }
    for (const rel of relevantRels) {
      inDegree.set(
        rel.targetResourceTypeId,
        (inDegree.get(rel.targetResourceTypeId) ?? 0) + 1,
      );
      targets.get(rel.sourceResourceTypeId)?.push(rel.targetResourceTypeId);
    }

    const queue = [...essentialIds].filter((id) => inDegree.get(id) === 0);
    const sorted: ResourceTypeDefinition[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = typeMap.get(current);
      if (node) sorted.push(node);
      for (const targetId of targets.get(current) ?? []) {
        const newDeg = (inDegree.get(targetId) ?? 1) - 1;
        inDegree.set(targetId, newDeg);
        if (newDeg === 0) queue.push(targetId);
      }
    }

    if (sorted.length !== essentialTypes.length) {
      throw new Error('Cycle detected in essential resource types.');
    }
    return sorted;
  }
}
