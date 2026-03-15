import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrganizationModule } from './organization/organization.module';
import { DataAccessPrismaModule } from '@junction-hub/shared/data-access-prisma';

@Module({
  imports: [OrganizationModule, DataAccessPrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
