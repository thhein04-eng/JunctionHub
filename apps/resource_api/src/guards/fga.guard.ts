import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataAccessFgaTupleService } from '@junction-hub/shared/data-access-fga';
import { DataAccessPrismaService } from '@junction-hub/shared/data-access-prisma';

export interface FgaCheckOptions {
  relation: string;
  objectType: string;
  // how to get the objectId from the request
  objectIdParam: string; // e.g. 'id' or 'orgId'
}

export const FGA = (options: FgaCheckOptions) =>
  SetMetadata('fga_check', options);

@Injectable()
export class FgaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly fgaTuple: DataAccessFgaTupleService,
    private readonly prisma: DataAccessPrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<FgaCheckOptions>(
      'fga_check',
      context.getHandler(),
    );
    if (!options) return true; // no FGA decorator — allow through

    const request = context.switchToHttp().getRequest();

    // Get userId from JWT (assumes auth middleware already ran)
    const userId = request.user?.sub ?? request.user?.id;
    if (!userId) throw new ForbiddenException('No user identity found.');

    // Get orgId from route params to find the FGA store
    const orgId = request.params.orgId;
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org?.fgaStoreId)
      throw new ForbiddenException('Organization not found.');

    // Get objectId from route params
    const objectId = request.params[options.objectIdParam];
    if (!objectId)
      throw new ForbiddenException('Object ID not found in request.');

    const allowed = await this.fgaTuple.check(
      org.fgaStoreId,
      userId,
      options.relation,
      options.objectType,
      objectId,
    );

    if (!allowed)
      throw new ForbiddenException(
        `User does not have "${options.relation}" access to ${options.objectType}:${objectId}`,
      );

    return true;
  }
}
