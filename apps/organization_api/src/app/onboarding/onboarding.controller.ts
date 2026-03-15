import { Body, Controller, Post } from '@nestjs/common';
import { OrganizationService } from '../organization/organization.service';
import { StartOnboardingDto } from './dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  start(@Body() dto: StartOnboardingDto) {
    return this.organizationService.createWithSeed({
      name: dto.name,
      industryTypeSlug: dto.industryTypeSlug,
    });
  }
}
