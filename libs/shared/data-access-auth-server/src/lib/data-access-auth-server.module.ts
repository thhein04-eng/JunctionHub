import { Module, Global } from '@nestjs/common';
import { UserService } from './user/user.service';

@Global()
@Module({
  controllers: [],
  providers: [UserService],
  exports: [],
})
export class DataAccessAuthServerModule {}
