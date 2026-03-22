import { Body, Controller, Post } from '@nestjs/common';
import { UserService } from '@junction-hub/data-access-auth-server';
import { CreateUserDto } from '@junction-hub/util-auth';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    this.userService.createUser(dto);
  }
}
