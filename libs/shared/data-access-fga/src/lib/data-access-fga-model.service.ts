import { Injectable, Logger } from '@nestjs/common';
import { DataAccessFgaClientService } from './data-access-fga-client.service';
import { transformer } from '@openfga/syntax-transformer';

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
    classroom: {
      permissions: ['teacher', 'student', 'viewer'],
      inheritFrom: 'parent',
    },
    course: {
      permissions: ['teacher', 'student', 'viewer'],
      inheritFrom: 'parent',
    },
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
    project: {
      permissions: ['admin', 'editor', 'viewer'],
      inheritFrom: 'parent',
    },
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
export class DataAccessFgaModelService {
  private readonly logger = new Logger(DataAccessFgaModelService.name);

  constructor(
    private readonly dataAccessFgaClientService: DataAccessFgaClientService,
  ) {}

  // ─── Generate DSL from template ────────────────────────────────────────────

  generateDsl(
    industryTypeSlug: string,
    resourceTypeDefs: ResourceTypeDslInput[],
    relationships: RelationshipDslInput[],
  ): string {
    const permConfig = INDUSTRY_PERMISSION_CONFIG[industryTypeSlug] ?? {};
    const typeIdToSlug = new Map(
      resourceTypeDefs.map((rt) => [rt.id, rt.slug]),
    );

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
          lines.push(
            `    define ${permission}: [user] or ${permission} from ${config.inheritFrom}`,
          );
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
    const client = this.dataAccessFgaClientService.forStore(storeId);

    // transformDSLToJSONObject returns the full model object
    const model = transformer.transformDSLToJSONObject(dsl);

    const res = await client.writeAuthorizationModel({
      schema_version: model.schema_version,
      type_definitions: model.type_definitions,
    });

    this.logger.log(
      `FGA model written to store ${storeId} → model ${res.authorization_model_id}`,
    );
    return res.authorization_model_id;
  }

  // ─── Generate + write in one call ─────────────────────────────────────────

  async provisionModel(
    storeId: string,
    industryTypeSlug: string,
    resourceTypeDefs: ResourceTypeDslInput[],
    relationships: RelationshipDslInput[],
  ): Promise<string> {
    const dsl = this.generateDsl(
      industryTypeSlug,
      resourceTypeDefs,
      relationships,
    );
    this.logger.debug(`Generated DSL for "${industryTypeSlug}":\n${dsl}`);
    return this.writeModel(storeId, dsl);
  }
}
