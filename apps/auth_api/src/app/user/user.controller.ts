import { Body, Controller, Post } from '@nestjs/common';
import { UserService } from '@junction-hub/data-access-auth-server';

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

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    this.userService.createUser(dto);
  }
}
