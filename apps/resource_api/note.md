# Resource API — Full Source

---

## apps/resource-api/src/app.module.ts

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@your-org/database';
import { ResourceModule } from './resource/resource.module';

@Module({
  imports: [DatabaseModule, ResourceModule],
})
export class AppModule {}
```

---

## apps/resource-api/src/resource/dto/index.ts

```typescript
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  resourceTypeSlug: string;
}

export class RenameResourceDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateRelationshipDto {
  @IsUUID()
  @IsNotEmpty()
  targetResourceId: string;

  @IsString()
  @IsNotEmpty()
  relationLabel: string;
}

export class ListResourcesDto {
  @IsString()
  @IsOptional()
  typeSlug?: string;
}
```

---

## apps/resource-api/src/resource/resource.service.ts

```typescript
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@your-org/database';
import { CreateResourceDto, RenameResourceDto, CreateRelationshipDto } from './dto';

@Injectable()
export class ResourceService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(orgId: string, dto: CreateResourceDto) {
    // Resolve resource type definition by slug within this org's industry type
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { industryType: { include: { resourceTypeDefs: true } } },
    });
    if (!org) throw new NotFoundException(`Organization "${orgId}" not found.`);

    const resourceTypeDef = org.industryType.resourceTypeDefs.find((rt) => rt.slug === dto.resourceTypeSlug);
    if (!resourceTypeDef) {
      throw new BadRequestException(`Resource type "${dto.resourceTypeSlug}" does not exist in industry type "${org.industryType.slug}".`);
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
    if (!resource) throw new NotFoundException(`Resource "${resourceId}" not found.`);
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

    const resourceMap = new Map(resources.map((r) => [r.id, { ...r, children: [] as any[] }]));

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
    if (!root) throw new NotFoundException(`Resource "${rootResourceId}" not found.`);
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

  async createRelationship(orgId: string, sourceResourceId: string, dto: CreateRelationshipDto) {
    const [source, target] = await Promise.all([this.assertResourceExists(orgId, sourceResourceId), this.assertResourceExists(orgId, dto.targetResourceId)]);

    // Find the matching relationship definition from the template
    const relationshipDef = await this.prisma.resourceTypeRelationship.findFirst({
      where: {
        sourceResourceTypeId: source.resourceTypeDefinitionId,
        targetResourceTypeId: target.resourceTypeDefinitionId,
        relationLabel: dto.relationLabel,
      },
    });
    if (!relationshipDef) {
      throw new BadRequestException(`Relationship "${dto.relationLabel}" is not defined between these resource types.`);
    }

    // Check for duplicate
    const existing = await this.prisma.resourceRelationship.findFirst({
      where: { orgId, relationshipDefId: relationshipDef.id, sourceResourceId, targetResourceId: dto.targetResourceId },
    });
    if (existing) throw new ConflictException('This relationship already exists.');

    return this.prisma.resourceRelationship.create({
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
  }

  // ─── Delete resource ───────────────────────────────────────────────────────

  async delete(orgId: string, resourceId: string) {
    await this.assertResourceExists(orgId, resourceId);

    // Block deletion if this resource has children (is a source in any relationship)
    const childCount = await this.prisma.resourceRelationship.count({
      where: { orgId, sourceResourceId: resourceId },
    });
    if (childCount > 0) {
      throw new BadRequestException(`Cannot delete resource with ${childCount} linked child resource(s). Remove or reassign them first.`);
    }

    // Delete incoming relationships (where this resource is a target)
    await this.prisma.resourceRelationship.deleteMany({
      where: { orgId, targetResourceId: resourceId },
    });

    await this.prisma.resource.delete({ where: { id: resourceId } });

    return { deleted: true, id: resourceId };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async assertOrgExists(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException(`Organization "${orgId}" not found.`);
    return org;
  }

  private async assertResourceExists(orgId: string, resourceId: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, orgId },
    });
    if (!resource) throw new NotFoundException(`Resource "${resourceId}" not found.`);
    return resource;
  }
}
```

---

## apps/resource-api/src/resource/resource.controller.ts

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { CreateResourceDto, RenameResourceDto, CreateRelationshipDto, ListResourcesDto } from './dto';

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
  getTree(@Param('orgId') orgId: string, @Param('rootResourceId') rootResourceId: string) {
    return this.service.getTree(orgId, rootResourceId);
  }

  @Get(':id')
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.findOne(orgId, id);
  }

  @Patch(':id/rename')
  rename(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: RenameResourceDto) {
    return this.service.rename(orgId, id, dto);
  }

  @Post(':id/relationships')
  createRelationship(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: CreateRelationshipDto) {
    return this.service.createRelationship(orgId, id, dto);
  }

  @Delete(':id')
  delete(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.delete(orgId, id);
  }
}
```

---

## apps/resource-api/src/resource/resource.module.ts

```typescript
import { Module } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { ResourceController } from './resource.controller';

@Module({
  controllers: [ResourceController],
  providers: [ResourceService],
})
export class ResourceModule {}
```

# Verification

Base URL: `http://localhost:3000/api`
Org ID: `de28e405-f680-4891-b729-26ebc90b3ea6`
School Resource ID: `c1638d3a-7d3e-4603-8a18-2f224454cd5e`

---

## 1. List all resources (see what was seeded)

```bash
curl http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources \
  | jq .
```

---

## 2. Filter by type — only classrooms

```bash
curl "http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources?typeSlug=classroom" \
  | jq .
```

---

## 3. Get the hierarchy tree from the root school resource

```bash
curl http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources/tree/c1638d3a-7d3e-4603-8a18-2f224454cd5e \
  | jq .
```

---

## 4. Rename "Default School" to "Springfield Elementary"

```bash
curl -X PATCH http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources/c1638d3a-7d3e-4603-8a18-2f224454cd5e/rename \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Springfield Elementary"
  }' | jq .
```

---

## 5. Create a new department

```bash
curl -X POST http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Math Department",
    "resourceTypeSlug": "department"
  }' | jq .
```

> Copy the `id` from the response — replace `NEW_DEPARTMENT_ID` in the steps below.

---

## 6. Link the new department to the school

```bash
curl -X POST http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources/c1638d3a-7d3e-4603-8a18-2f224454cd5e/relationships \
  -H "Content-Type: application/json" \
  -d '{
    "targetResourceId": "46d9a3cd-993c-4f9a-9571-93c335235ebc",
    "relationLabel": "has_department"
  }' | jq .
```

---

## 7. Create a classroom

```bash
curl -X POST http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Room 101",
    "resourceTypeSlug": "classroom"
  }' | jq .
```

> Copy the `id` from the response — replace `ROOM_101_ID` in the steps below.

---

## 8. Link the classroom to the department

```bash
curl -X POST http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources/46d9a3cd-993c-4f9a-9571-93c335235ebc/relationships \
  -H "Content-Type: application/json" \
  -d '{
    "targetResourceId": "d7bd40bc-497b-4705-b7ff-6926e4f72f86",
    "relationLabel": "has_classroom"
  }' | jq .
```

---

## 9. Get Room 101 with all its relationships

```bash
curl http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources/d7bd40bc-497b-4705-b7ff-6926e4f72f86 | jq .
```

---

## 10. Try deleting the school (should fail — has children)

```bash
curl -X DELETE http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources/c1638d3a-7d3e-4603-8a18-2f224454cd5e | jq .
```

Expected:

```json
{
  "statusCode": 400,
  "message": "Cannot delete resource with X linked child resource(s). Remove or reassign them first."
}
```

---

## 11. Delete Room 101 (no children — should succeed)

```bash
curl -X DELETE http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources/d7bd40bc-497b-4705-b7ff-6926e4f72f86 | jq .
```

Expected:

```json
{ "deleted": true, "id": "ROOM_101_ID" }
```

---

## 12. Try an invalid relationship (should fail)

```bash
curl -X POST http://localhost:3000/api/organizations/de28e405-f680-4891-b729-26ebc90b3ea6/resources/c1638d3a-7d3e-4603-8a18-2f224454cd5e/relationships \
  -H "Content-Type: application/json" \
  -d '{
    "targetResourceId": "46d9a3cd-993c-4f9a-9571-93c335235ebc",
    "relationLabel": "invalid_label"
  }' | jq .
```

Expected:

```json
{
  "statusCode": 400,
  "message": "Relationship \"invalid_label\" is not defined between these resource types."
}
```
