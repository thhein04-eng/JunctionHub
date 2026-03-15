import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class DataAccessPrismaService extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({ url: process.env['DATABASE_URL'] });
    super({ adapter });
  }
}
