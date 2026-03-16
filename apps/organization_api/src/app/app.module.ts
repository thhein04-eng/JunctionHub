import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrganizationModule } from './organization/organization.module';
import { DataAccessPrismaModule } from '@junction-hub/shared/data-access-prisma';
import { OnboardingModule } from './onboarding/onboarding.module';
import { IndustryTypeModule } from './industry-type/industry-type.module';
import { DataAccessFgaModule } from '@junction-hub/shared/data-access-fga';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    OrganizationModule,
    DataAccessPrismaModule,
    DataAccessFgaModule,
    OnboardingModule,
    IndustryTypeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
