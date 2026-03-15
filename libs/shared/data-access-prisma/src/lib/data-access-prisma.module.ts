import { Module, Global } from '@nestjs/common';
import { DataAccessPrismaService } from './data-access-prisma.service';

@Global()
@Module({
  controllers: [],
  providers: [DataAccessPrismaService],
  exports: [DataAccessPrismaService],
})
export class DataAccessPrismaModule {}
