import { Module, Global } from '@nestjs/common';
import { UserService } from './user/user.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  controllers: [],
  providers: [UserService, ConfigService],
  exports: [UserService, ConfigService],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
})
export class DataAccessAuthServerModule {}
