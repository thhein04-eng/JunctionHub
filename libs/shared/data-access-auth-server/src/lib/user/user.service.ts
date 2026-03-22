import { Injectable } from '@nestjs/common';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from '@junction-hub/util-auth';

@Injectable()
export class UserService {
  private adminClient: KcAdminClient;
  private tokenExpiresAt = 0;
  constructor(private readonly configService: ConfigService) {
    this.adminClient = new KcAdminClient({
      baseUrl: this.configService.get('KEYCLOAK_URL'),
      realmName: this.configService.get('KEYCLOAK_REALM'),
    });
  }

  async createUser(dto: CreateUserDto) {
    await this.authenticate();
    const id = await this.adminClient.users.create({
      username: dto.username,
      email: dto.email,
      enabled: true,
    });
    console.log('User ID: ', id);
  }

  private async authenticate(): Promise<void> {
    console.log(
      'SECRET_KEY: ',
      this.configService.get('KEYCLOAK_CLIENT_SECRET'),
    );
    const clientId = this.configService.get('KEYCLOAK_CLIENT_ID');
    if (!clientId) return;
    const now = Date.now();
    if (now < this.tokenExpiresAt) return;

    await this.adminClient.auth({
      grantType: 'client_credentials',
      clientId: clientId,
      clientSecret: this.configService.get('KEYCLOAK_CLIENT_SECRET'),
    });

    this.tokenExpiresAt = now + 55 * 1000;
  }
}
