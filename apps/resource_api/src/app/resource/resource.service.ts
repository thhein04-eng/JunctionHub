import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataAccessPrismaService } from '@junction-hub/shared/data-access-prisma';
import {
  CreateResourceDto,
  RenameResourceDto,
  CreateRelationshipDto,
} from './dto';
import { DataAccessFgaTupleService } from '@junction-hub/shared/data-access-fga';

@Injectable()
export class ResourceService {
  constructor(
    private readonly prisma: DataAccessPrismaService,
    private readonly fgaTuple: DataAccessFgaTupleService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(orgId: string, dto: CreateResourceDto) {
    // Resolve resource type definition by slug within this org's industry type
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { industryType: { include: { resourceTypeDefs: true } } },
    });
    if (!org) throw new NotFoundException(`Organization "${orgId}" not found.`);

    const resourceTypeDef = org.industryType.resourceTypeDefs.find(
      (rt) => rt.slug === dto.resourceTypeSlug,
    );
    if (!resourceTypeDef) {
      throw new BadRequestException(
        `Resource type "${dto.resourceTypeSlug}" does not exist in industry type "${org.industryType.slug}".`,
      );
    }

    return this.prisma.resource.create({
      data: {
        orgId,
        resourceTypeDefinitionId: resourceTypeDef.id,
        name: dto.name,
      },
      include: { resourceTypeDef: true },
    });
  }

  // ─── List (flat, optionally filtered by type) ─────────────────────────────

  async findAll(orgId: string, typeSlug?: string) {
    await this.assertOrgExists(orgId);

    return this.prisma.resource.findMany({
      where: {
        orgId,
        ...(typeSlug && {
          resourceTypeDef: { slug: typeSlug },
        }),
      },
      include: { resourceTypeDef: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Get one ───────────────────────────────────────────────────────────────

  async findOne(orgId: string, resourceId: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, orgId },
      include: {
        resourceTypeDef: true,
        sourceRelationships: {
          include: {
            targetResource: { include: { resourceTypeDef: true } },
            relationshipDef: true,
          },
        },
        targetRelationships: {
          include: {
            sourceResource: { include: { resourceTypeDef: true } },
            relationshipDef: true,
          },
        },
      },
    });
    if (!resource)
      throw new NotFoundException(`Resource "${resourceId}" not found.`);
    return resource;
  }

  // ─── Hierarchical tree from a root resource ────────────────────────────────

  async getTree(orgId: string, rootResourceId: string) {
    await this.assertOrgExists(orgId);

    // Load all resources and relationships for this org in two queries
    const [resources, relationships] = await Promise.all([
      this.prisma.resource.findMany({
        where: { orgId },
        include: { resourceTypeDef: true },
      }),
      this.prisma.resourceRelationship.findMany({
        where: { orgId },
        include: { relationshipDef: true },
      }),
    ]);

    const resourceMap = new Map(
      resources.map((r) => [r.id, { ...r, children: [] as any[] }]),
    );

    // Build adjacency
    for (const rel of relationships) {
      const source = resourceMap.get(rel.sourceResourceId);
      if (source) {
        source.children.push({
          relation: rel.relationshipDef.relationLabel,
          resource: resourceMap.get(rel.targetResourceId),
        });
      }
    }

    const root = resourceMap.get(rootResourceId);
    if (!root)
      throw new NotFoundException(`Resource "${rootResourceId}" not found.`);
    return root;
  }

  // ─── Rename ────────────────────────────────────────────────────────────────

  async rename(orgId: string, resourceId: string, dto: RenameResourceDto) {
    await this.assertResourceExists(orgId, resourceId);

    return this.prisma.resource.update({
      where: { id: resourceId },
      data: { name: dto.name },
      include: { resourceTypeDef: true },
    });
  }

  // ─── Link two resources ────────────────────────────────────────────────────

  async createRelationship(
    orgId: string,
    sourceResourceId: string,
    dto: CreateRelationshipDto,
  ) {
    const [source, target] = await Promise.all([
      this.assertResourceExists(orgId, sourceResourceId),
      this.assertResourceExists(orgId, dto.targetResourceId),
    ]);

    // Find the matching relationship definition from the template
    const relationshipDef =
      await this.prisma.resourceTypeRelationship.findFirst({
        where: {
          sourceResourceTypeId: source.resourceTypeDefinitionId,
          targetResourceTypeId: target.resourceTypeDefinitionId,
          relationLabel: dto.relationLabel,
        },
      });
    if (!relationshipDef) {
      throw new BadRequestException(
        `Relationship "${dto.relationLabel}" is not defined between these resource types.`,
      );
    }

    // Check for duplicate
    const existing = await this.prisma.resourceRelationship.findFirst({
      where: {
        orgId,
        relationshipDefId: relationshipDef.id,
        sourceResourceId,
        targetResourceId: dto.targetResourceId,
      },
    });
    if (existing)
      throw new ConflictException('This relationship already exists.');

    const result = await this.prisma.resourceRelationship.create({
      data: {
        orgId,
        relationshipDefId: relationshipDef.id,
        sourceResourceId,
        targetResourceId: dto.targetResourceId,
      },
      include: {
        relationshipDef: true,
        sourceResource: true,
        targetResource: true,
      },
    });

    // FGA tuple write — added after DB write
    try {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
      });
      if (org?.fgaStoreId) {
        await this.fgaTuple.writeStructural(
          org.fgaStoreId,
          source.resourceTypeDef.slug, // ← from assertResourceExists
          sourceResourceId,
          target.resourceTypeDef.slug, // ← from assertResourceExists
          dto.targetResourceId,
        );
        console.log('FGA tuple written for relationship');
      } else {
        console.log('No fgaStoreId on org — skipping FGA tuple write');
      }
    } catch (err) {
      console.error(
        `FGA tuple write failed for relationship ${result.id}:`,
        err,
      );
    }

    return result;
  }

  // ─── Delete resource ───────────────────────────────────────────────────────

  async delete(orgId: string, resourceId: string) {
    await this.assertResourceExists(orgId, resourceId);

    const childCount = await this.prisma.resourceRelationship.count({
      where: { orgId, sourceResourceId: resourceId },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        `Cannot delete resource with ${childCount} linked child resource(s). Remove or reassign them first.`,
      );
    }

    // 🆕 Fetch incoming relationships before deleting — needed for FGA tuple cleanup
    const incomingRels = await this.prisma.resourceRelationship.findMany({
      where: { orgId, targetResourceId: resourceId },
      include: {
        sourceResource: { include: { resourceTypeDef: true } },
        targetResource: { include: { resourceTypeDef: true } },
      },
    });

    // ✅ existing DB deletes — no changes
    await this.prisma.resourceRelationship.deleteMany({
      where: { orgId, targetResourceId: resourceId },
    });

    await this.prisma.resource.delete({ where: { id: resourceId } });

    // 🆕 FGA tuple cleanup — added after DB deletes
    try {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
      });
      if (org?.fgaStoreId) {
        for (const rel of incomingRels) {
          await this.fgaTuple.deleteStructural(
            org.fgaStoreId,
            rel.sourceResource.resourceTypeDef.slug,
            rel.sourceResourceId,
            rel.targetResource.resourceTypeDef.slug,
            resourceId,
          );
        }
      }
    } catch (err) {
      console.error(`FGA tuple delete failed for resource ${resourceId}:`, err);
    }

    // ✅ existing return — no changes
    return { deleted: true, id: resourceId };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async assertOrgExists(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException(`Organization "${orgId}" not found.`);
    return org;
  }

  private async assertResourceExists(orgId: string, resourceId: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, orgId },
      include: { resourceTypeDef: true }, // 🆕
    });
    if (!resource)
      throw new NotFoundException(`Resource "${resourceId}" not found.`);
    return resource;
  }
}
