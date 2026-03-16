# libs/shared/data-access-fga — Full Source

---

## libs/shared/data-access-fga/src/lib/fga-client.service.ts

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { OpenFgaClient, CredentialsMethod } from '@openfga/sdk';

@Injectable()
export class FgaClientService implements OnModuleInit {
  private readonly logger = new Logger(FgaClientService.name);
  private _client!: OpenFgaClient;

  async onModuleInit() {
    this._client = new OpenFgaClient({
      apiUrl: process.env['FGA_API_URL'] ?? 'http://localhost:8080',
      credentials: {
        method: CredentialsMethod.None,
        // For production with Auth0 FGA:
        // method: CredentialsMethod.ClientCredentials,
        // config: {
        //   clientId: process.env['FGA_CLIENT_ID'],
        //   clientSecret: process.env['FGA_CLIENT_SECRET'],
        //   apiTokenIssuer: process.env['FGA_API_TOKEN_ISSUER'],
        //   apiAudience: process.env['FGA_API_AUDIENCE'],
        // }
      },
    });
    this.logger.log(`FGA client initialized → ${process.env['FGA_API_URL'] ?? 'http://localhost:8080'}`);
  }

  get client(): OpenFgaClient {
    return this._client;
  }

  // Returns a client scoped to a specific store
  forStore(storeId: string): OpenFgaClient {
    this._client.storeId = storeId;
    return this._client;
  }

  async createStore(name: string): Promise<string> {
    const res = await this._client.createStore({ name });
    this.logger.log(`FGA store created: ${res.id} (${name})`);
    return res.id;
  }

  async deleteStore(storeId: string): Promise<void> {
    this.forStore(storeId);
    await this._client.deleteStore();
    this.logger.log(`FGA store deleted: ${storeId}`);
  }
}
```

---

## libs/shared/data-access-fga/src/lib/fga-model.service.ts

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { FgaClientService } from './fga-client.service';
import { transformDSLToJSON } from '@openfga/syntax-transformer';

// ─── Permission config per industry type ─────────────────────────────────────
// Defines permission relations per resource type slug.
// Structural relations come from ResourceTypeRelationship table.
// Permission relations are defined here.

export interface PermissionConfig {
  [resourceTypeSlug: string]: {
    permissions: string[];
    inheritFrom?: string; // usually 'parent'
  };
}

export const INDUSTRY_PERMISSION_CONFIG: Record<string, PermissionConfig> = {
  school: {
    school: { permissions: ['admin', 'member'] },
    department: { permissions: ['admin', 'member'], inheritFrom: 'parent' },
    classroom: { permissions: ['teacher', 'student', 'viewer'], inheritFrom: 'parent' },
    course: { permissions: ['teacher', 'student', 'viewer'], inheritFrom: 'parent' },
    student: { permissions: ['viewer'], inheritFrom: 'parent' },
    teacher: { permissions: ['viewer'], inheritFrom: 'parent' },
  },
  hospital: {
    hospital: { permissions: ['admin', 'member'] },
    department: { permissions: ['admin', 'member'], inheritFrom: 'parent' },
    ward: { permissions: ['doctor', 'nurse', 'viewer'], inheritFrom: 'parent' },
    doctor: { permissions: ['viewer'], inheritFrom: 'parent' },
    nurse: { permissions: ['viewer'], inheritFrom: 'parent' },
    patient: { permissions: ['viewer'], inheritFrom: 'parent' },
  },
  corporate: {
    company: { permissions: ['admin', 'member'] },
    department: { permissions: ['admin', 'member'], inheritFrom: 'parent' },
    team: { permissions: ['admin', 'member'], inheritFrom: 'parent' },
    employee: { permissions: ['viewer'], inheritFrom: 'parent' },
    project: { permissions: ['admin', 'editor', 'viewer'], inheritFrom: 'parent' },
  },
};

const DEFAULT_PERMISSION_CONFIG: PermissionConfig[string] = {
  permissions: ['admin', 'editor', 'viewer'],
  inheritFrom: 'parent',
};

// ─── DSL input types ──────────────────────────────────────────────────────────

export interface ResourceTypeDslInput {
  id: string;
  slug: string;
}

export interface RelationshipDslInput {
  sourceResourceTypeId: string;
  targetResourceTypeId: string;
  relationLabel: string;
}

@Injectable()
export class FgaModelService {
  private readonly logger = new Logger(FgaModelService.name);

  constructor(private readonly fgaClient: FgaClientService) {}

  // ─── Generate DSL from template ────────────────────────────────────────────

  generateDsl(industryTypeSlug: string, resourceTypeDefs: ResourceTypeDslInput[], relationships: RelationshipDslInput[]): string {
    const permConfig = INDUSTRY_PERMISSION_CONFIG[industryTypeSlug] ?? {};
    const typeIdToSlug = new Map(resourceTypeDefs.map((rt) => [rt.id, rt.slug]));

    // incoming: typeSlug → source types that point to it
    const incoming = new Map<string, string[]>();
    // outgoing: typeSlug → { targetSlug, label }[]
    const outgoing = new Map<string, { targetSlug: string; label: string }[]>();

    for (const rt of resourceTypeDefs) {
      incoming.set(rt.slug, []);
      outgoing.set(rt.slug, []);
    }

    for (const rel of relationships) {
      const sourceSlug = typeIdToSlug.get(rel.sourceResourceTypeId);
      const targetSlug = typeIdToSlug.get(rel.targetResourceTypeId);
      if (!sourceSlug || !targetSlug) continue;

      incoming.get(targetSlug)?.push(sourceSlug);
      outgoing.get(sourceSlug)?.push({ targetSlug, label: rel.relationLabel });
    }

    const lines: string[] = ['model', '  schema 1.1', ''];

    for (const rt of resourceTypeDefs) {
      const config = permConfig[rt.slug] ?? DEFAULT_PERMISSION_CONFIG;
      const incomingSlugs = incoming.get(rt.slug) ?? [];
      const outgoingRels = outgoing.get(rt.slug) ?? [];

      lines.push(`type ${rt.slug}`);
      lines.push('  relations');

      // 1. Structural parent relation
      if (incomingSlugs.length > 0) {
        lines.push(`    define parent: [${incomingSlugs.join(', ')}]`);
      }

      // 2. Structural outgoing relations
      for (const out of outgoingRels) {
        lines.push(`    define ${out.label}: [${out.targetSlug}]`);
      }

      // 3. Permission relations
      for (const permission of config.permissions) {
        if (config.inheritFrom && incomingSlugs.length > 0) {
          lines.push(`    define ${permission}: [user] or ${permission} from ${config.inheritFrom}`);
        } else {
          lines.push(`    define ${permission}: [user]`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // ─── Write model to FGA store ─────────────────────────────────────────────

  async writeModel(storeId: string, dsl: string): Promise<string> {
    const client = this.fgaClient.forStore(storeId);

    const { type_definitions, schema_version } = transformDSLToJSON(dsl);

    const res = await client.writeAuthorizationModel({
      schema_version,
      type_definitions,
    });

    this.logger.log(`FGA model written to store ${storeId} → model ${res.authorization_model_id}`);
    return res.authorization_model_id;
  }

  // ─── Generate + write in one call ─────────────────────────────────────────

  async provisionModel(storeId: string, industryTypeSlug: string, resourceTypeDefs: ResourceTypeDslInput[], relationships: RelationshipDslInput[]): Promise<string> {
    const dsl = this.generateDsl(industryTypeSlug, resourceTypeDefs, relationships);
    this.logger.debug(`Generated DSL for "${industryTypeSlug}":\n${dsl}`);
    return this.writeModel(storeId, dsl);
  }
}
```

---

## libs/shared/data-access-fga/src/lib/fga-tuple.service.ts

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ClientTuple } from '@openfga/sdk';
import { FgaClientService } from './fga-client.service';

const BATCH_SIZE = 10; // FGA write API max per call

export interface TupleInput {
  userType: string; // e.g. 'user' or a resource type slug
  userId: string; // user id or resource id
  relation: string; // e.g. 'parent', 'viewer', 'admin'
  objectType: string; // resource type slug
  objectId: string; // resource id
}

@Injectable()
export class FgaTupleService {
  private readonly logger = new Logger(FgaTupleService.name);

  constructor(private readonly fgaClient: FgaClientService) {}

  // ─── Write tuples ─────────────────────────────────────────────────────────

  async write(storeId: string, tuples: TupleInput[]): Promise<void> {
    if (tuples.length === 0) return;
    const client = this.fgaClient.forStore(storeId);
    const mapped = this.mapTuples(tuples);

    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      await client.write({ writes: mapped.slice(i, i + BATCH_SIZE) });
    }
    this.logger.debug(`Wrote ${tuples.length} tuple(s) to store ${storeId}`);
  }

  // ─── Delete tuples ────────────────────────────────────────────────────────

  async delete(storeId: string, tuples: TupleInput[]): Promise<void> {
    if (tuples.length === 0) return;
    const client = this.fgaClient.forStore(storeId);
    const mapped = this.mapTuples(tuples);

    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      await client.write({ deletes: mapped.slice(i, i + BATCH_SIZE) });
    }
    this.logger.debug(`Deleted ${tuples.length} tuple(s) from store ${storeId}`);
  }

  // ─── Check a single permission ────────────────────────────────────────────

  async check(storeId: string, userId: string, relation: string, objectType: string, objectId: string): Promise<boolean> {
    const client = this.fgaClient.forStore(storeId);
    const res = await client.check({
      user: `user:${userId}`,
      relation,
      object: `${objectType}:${objectId}`,
    });
    return res.allowed ?? false;
  }

  // ─── Batch check multiple permissions ────────────────────────────────────

  async batchCheck(storeId: string, checks: { userId: string; relation: string; objectType: string; objectId: string }[]): Promise<boolean[]> {
    const results = await Promise.all(checks.map((c) => this.check(storeId, c.userId, c.relation, c.objectType, c.objectId)));
    return results;
  }

  // ─── List all objects a user has access to ────────────────────────────────

  async listObjects(storeId: string, userId: string, relation: string, objectType: string): Promise<string[]> {
    const client = this.fgaClient.forStore(storeId);
    const res = await client.listObjects({
      user: `user:${userId}`,
      relation,
      type: objectType,
    });
    return res.objects ?? [];
  }

  // ─── Structural tuple helpers ─────────────────────────────────────────────

  // Write a parent→child structural relationship
  async writeStructural(storeId: string, sourceTypeSlug: string, sourceId: string, targetTypeSlug: string, targetId: string): Promise<void> {
    await this.write(storeId, [
      {
        userType: sourceTypeSlug,
        userId: sourceId,
        relation: 'parent',
        objectType: targetTypeSlug,
        objectId: targetId,
      },
    ]);
  }

  async deleteStructural(storeId: string, sourceTypeSlug: string, sourceId: string, targetTypeSlug: string, targetId: string): Promise<void> {
    await this.delete(storeId, [
      {
        userType: sourceTypeSlug,
        userId: sourceId,
        relation: 'parent',
        objectType: targetTypeSlug,
        objectId: targetId,
      },
    ]);
  }

  // ─── User role helpers ────────────────────────────────────────────────────

  async assignRole(storeId: string, userId: string, role: string, objectType: string, objectId: string): Promise<void> {
    await this.write(storeId, [
      {
        userType: 'user',
        userId,
        relation: role,
        objectType,
        objectId,
      },
    ]);
  }

  async removeRole(storeId: string, userId: string, role: string, objectType: string, objectId: string): Promise<void> {
    await this.delete(storeId, [
      {
        userType: 'user',
        userId,
        relation: role,
        objectType,
        objectId,
      },
    ]);
  }

  // ─── Bulk write all org tuples (used during onboarding) ──────────────────

  async writeAllStructural(
    storeId: string,
    relationships: {
      sourceTypeSlug: string;
      sourceId: string;
      targetTypeSlug: string;
      targetId: string;
    }[],
  ): Promise<void> {
    const tuples: TupleInput[] = relationships.map((rel) => ({
      userType: rel.sourceTypeSlug,
      userId: rel.sourceId,
      relation: 'parent',
      objectType: rel.targetTypeSlug,
      objectId: rel.targetId,
    }));
    await this.write(storeId, tuples);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private mapTuples(tuples: TupleInput[]): ClientTuple[] {
    return tuples.map((t) => ({
      user: `${t.userType}:${t.userId}`,
      relation: t.relation,
      object: `${t.objectType}:${t.objectId}`,
    }));
  }
}
```

---

## libs/shared/data-access-fga/src/lib/data-access-fga.module.ts

```typescript
import { Global, Module } from '@nestjs/common';
import { FgaClientService } from './fga-client.service';
import { FgaModelService } from './fga-model.service';
import { FgaTupleService } from './fga-tuple.service';

@Global()
@Module({
  providers: [FgaClientService, FgaModelService, FgaTupleService],
  exports: [FgaClientService, FgaModelService, FgaTupleService],
})
export class FgaModule {}
```

---

## libs/shared/data-access-fga/src/index.ts

```typescript
export { FgaModule } from './lib/data-access-fga.module';
export { FgaClientService } from './lib/fga-client.service';
export { FgaModelService } from './lib/fga-model.service';
export { FgaTupleService } from './lib/fga-tuple.service';
export type { TupleInput, PermissionConfig, ResourceTypeDslInput, RelationshipDslInput } from './lib/fga-model.service';
```

---

## tsconfig.base.json

```json
{
  "compilerOptions": {
    "paths": {
      "@your-org/shared/data-access-prisma": ["libs/shared/data-access-prisma/src/index.ts"],
      "@your-org/shared/data-access-fga": ["libs/shared/data-access-fga/src/index.ts"]
    }
  }
}
```

---

## Usage in organization-api

```typescript
// apps/organization-api/src/app.module.ts
import { FgaModule } from '@your-org/shared/data-access-fga';

@Module({
  imports: [DatabaseModule, FgaModule, ...],
})
export class AppModule {}
```

```typescript
// apps/organization-api/src/organization/organization.service.ts
import { FgaClientService, FgaModelService, FgaTupleService } from '@your-org/shared/data-access-fga';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fgaClient: FgaClientService,
    private readonly fgaModel: FgaModelService,
    private readonly fgaTuple: FgaTupleService,
  ) {}

  async createWithSeed(input: CreateWithSeedInput) {
    // ... existing transaction ...

    // 1. Create FGA store
    const storeId = await this.fgaClient.createStore(input.name);

    // 2. Generate + write authorization model
    const modelId = await this.fgaModel.provisionModel(storeId, org.industryType.slug, org.industryType.resourceTypeDefs, org.industryType.relationships);

    // 3. Persist storeId + modelId
    await this.prisma.organization.update({
      where: { id: org.id },
      data: { fgaStoreId: storeId, fgaModelId: modelId },
    });

    // 4. Write structural tuples from seeded relationships
    await this.fgaTuple.writeAllStructural(
      storeId,
      seedResult.relationships.map((rel) => ({
        sourceTypeSlug: rel.sourceTypeSlug,
        sourceId: rel.sourceResourceId,
        targetTypeSlug: rel.targetTypeSlug,
        targetId: rel.targetResourceId,
      })),
    );

    return { org, seed: seedResult };
  }
}
```

```typescript
// apps/resource-api/src/resource/resource.service.ts
import { FgaTupleService } from '@your-org/shared/data-access-fga';

@Injectable()
export class ResourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fgaTuple: FgaTupleService,
  ) {}

  async createRelationship(orgId: string, sourceResourceId: string, dto: CreateRelationshipDto) {
    // ... existing DB write ...

    // Sync to FGA
    if (org.fgaStoreId) {
      await this.fgaTuple.writeStructural(org.fgaStoreId, source.resourceTypeDef.slug, sourceResourceId, target.resourceTypeDef.slug, dto.targetResourceId);
    }
  }

  async delete(orgId: string, resourceId: string) {
    // ... existing validation ...

    if (org.fgaStoreId) {
      await this.fgaTuple.deleteStructural(org.fgaStoreId, source.resourceTypeDef.slug, rel.sourceResourceId, target.resourceTypeDef.slug, resourceId);
    }
  }
}
```

---

## Install required packages

```bash
npm install @openfga/sdk @openfga/syntax-transformer
```
