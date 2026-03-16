import { Injectable, Logger } from '@nestjs/common';
import { DataAccessFgaClientService } from './data-access-fga-client.service';

const BATCH_SIZE = 10; // FGA write API max per call

interface FgaTupleKey {
  user: string;
  relation: string;
  object: string;
}

export interface TupleInput {
  userType: string; // e.g. 'user' or a resource type slug
  userId: string; // user id or resource id
  relation: string; // e.g. 'parent', 'viewer', 'admin'
  objectType: string; // resource type slug
  objectId: string; // resource id
}

@Injectable()
export class DataAccessFgaTupleService {
  private readonly logger = new Logger(DataAccessFgaTupleService.name);

  constructor(
    private readonly dataAccessFgaClientService: DataAccessFgaClientService,
  ) {}

  // ─── Write tuples ─────────────────────────────────────────────────────────

  async write(storeId: string, tuples: TupleInput[]): Promise<void> {
    if (tuples.length === 0) return;
    const client = this.dataAccessFgaClientService.forStore(storeId);
    const mapped = this.mapTuples(tuples);

    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      await client.write({ writes: mapped.slice(i, i + BATCH_SIZE) });
    }
    this.logger.debug(`Wrote ${tuples.length} tuple(s) to store ${storeId}`);
  }

  // ─── Delete tuples ────────────────────────────────────────────────────────

  async delete(storeId: string, tuples: TupleInput[]): Promise<void> {
    if (tuples.length === 0) return;
    const client = this.dataAccessFgaClientService.forStore(storeId);
    const mapped = this.mapTuples(tuples);

    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      await client.write({ deletes: mapped.slice(i, i + BATCH_SIZE) });
    }
    this.logger.debug(
      `Deleted ${tuples.length} tuple(s) from store ${storeId}`,
    );
  }

  // ─── Check a single permission ────────────────────────────────────────────

  async check(
    storeId: string,
    userId: string,
    relation: string,
    objectType: string,
    objectId: string,
  ): Promise<boolean> {
    const client = this.dataAccessFgaClientService.forStore(storeId);
    const res = await client.check({
      user: `user:${userId}`,
      relation,
      object: `${objectType}:${objectId}`,
    });
    return res.allowed ?? false;
  }

  // ─── Batch check multiple permissions ────────────────────────────────────

  async batchCheck(
    storeId: string,
    checks: {
      userId: string;
      relation: string;
      objectType: string;
      objectId: string;
    }[],
  ): Promise<boolean[]> {
    const results = await Promise.all(
      checks.map((c) =>
        this.check(storeId, c.userId, c.relation, c.objectType, c.objectId),
      ),
    );
    return results;
  }

  // ─── List all objects a user has access to ────────────────────────────────

  async listObjects(
    storeId: string,
    userId: string,
    relation: string,
    objectType: string,
  ): Promise<string[]> {
    const client = this.dataAccessFgaClientService.forStore(storeId);
    const res = await client.listObjects({
      user: `user:${userId}`,
      relation,
      type: objectType,
    });
    return res.objects ?? [];
  }

  // ─── Structural tuple helpers ─────────────────────────────────────────────

  // Write a parent→child structural relationship
  async writeStructural(
    storeId: string,
    sourceTypeSlug: string,
    sourceId: string,
    targetTypeSlug: string,
    targetId: string,
  ): Promise<void> {
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

  async deleteStructural(
    storeId: string,
    sourceTypeSlug: string,
    sourceId: string,
    targetTypeSlug: string,
    targetId: string,
  ): Promise<void> {
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

  async assignRole(
    storeId: string,
    userId: string,
    role: string,
    objectType: string,
    objectId: string,
  ): Promise<void> {
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

  async removeRole(
    storeId: string,
    userId: string,
    role: string,
    objectType: string,
    objectId: string,
  ): Promise<void> {
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

  private mapTuples(tuples: TupleInput[]): FgaTupleKey[] {
    return tuples.map((t) => ({
      user: `${t.userType}:${t.userId}`,
      relation: t.relation,
      object: `${t.objectType}:${t.objectId}`,
    }));
  }

  private async writeTuples(
    storeId: string,
    tuples: FgaTupleKey[],
  ): Promise<void> {
    const client = this.dataAccessFgaClientService.forStore(storeId);

    for (let i = 0; i < tuples.length; i += BATCH_SIZE) {
      await client.write({ writes: tuples.slice(i, i + BATCH_SIZE) });
    }
    this.logger.debug(`Wrote ${tuples.length} tuple(s) to store ${storeId}`);
  }
}
