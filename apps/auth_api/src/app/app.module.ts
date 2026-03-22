import { Module } from '@nestjs/common';
import { UserController } from './user/user.controller';
import { DataAccessAuthServerModule } from '@junction-hub/data-access-auth-server';

@Module({
  imports: [DataAccessAuthServerModule],
  controllers: [UserController],
  providers: [],
})
export class AppModule {}
