import { Module } from '@nestjs/common';
import { UserController } from './user/user.controller';

@Module({
  imports: [],
  controllers: [UserController],
})
export class AppModule {}
