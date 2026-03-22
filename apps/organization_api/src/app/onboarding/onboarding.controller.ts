import { Body, Controller, Post } from '@nestjs/common';
import { OrganizationService } from '../organization/organization.service';
import { StartOnboardingDto } from './dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  start(@Body() dto: StartOnboardingDto) {
    // TODO Create a new lib, named 'feature-organization-server'
    // TODO Create a new service, named 'onboarding'
    // TODO Create a new method, named 'onboard'
    // TODO Create an org
    // TODO Create a new user in Keycloak
    // (call @junction-hub/data-access-auth-server#UserService#createUser)
    // TODO Store the user in DB
    // TODO Add the user to the org as an admin
    // TODO Assign the user as admin in FGA
    // TODO From this method, call that method
    return this.organizationService.createWithSeed({
      name: dto.name,
      industryTypeSlug: dto.industryTypeSlug,
    });
  }
}
