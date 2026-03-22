import { Body, Controller, Post } from '@nestjs/common';

interface CreateUserDto {
  id?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerified?: boolean;
  attributes?: [][];
  userProfileMetadata?: object;
  enabled?: boolean;
  self?: string;
  origin?: string;
  createdTimestamp?: number;
}

@Controller('user')
export class UserController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    throw new Error('not implemented');
  }
}
