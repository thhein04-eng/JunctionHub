import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrganizationModule } from './organization/organization.module';
import { DataAccessPrismaModule } from '@junction-hub/shared/data-access-prisma';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [OrganizationModule, DataAccessPrismaModule, OnboardingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
