import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CredentialsMethod, OpenFgaClient } from '@openfga/sdk';

@Injectable()
export class DataAccessFgaClientService implements OnModuleInit {
  private _client!: OpenFgaClient;
  private readonly logger = new Logger(DataAccessFgaClientService.name);

  async onModuleInit() {
    this._client = new OpenFgaClient({
      apiUrl: process.env['FGA_API_URL'],
      credentials: {
        method: CredentialsMethod.None,
      },
    });

    this.logger.log(`FGA client initialized → ${process.env['FGA_API_URL']}`);
  }

  get client() {
    return this._client;
  }

  /*
   * Returns a client scoped to a specifig store
   */
  forStore(storeId: string) {
    this._client.storeId = storeId;
    return this._client;
  }

  async createStore(name: string) {
    const res = await this._client.createStore({ name });
    this.logger.log(`FGA store created: ${res.id} (${name})`);

    return res.id;
  }

  async deleteStore(storeId: string) {
    this.forStore(storeId);
    await this._client.deleteStore();
    this.logger.log(`FGA store deleted: ${storeId}`);
  }
}
