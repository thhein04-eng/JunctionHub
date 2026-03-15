import { Module, Global } from '@nestjs/common';
import { DataAccessPrismaService } from './data-access-prisma.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  controllers: [],
  providers: [DataAccessPrismaService],
  exports: [DataAccessPrismaService],
  imports: [ConfigModule.forRoot()],
})
export class DataAccessPrismaModule {}
