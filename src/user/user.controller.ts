import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { AdminGuard } from 'src/auth/admin.guard';

@Controller('users')
@UseGuards(AdminGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @Post()
  async createUser(
    @Body() data: { name: string; photo?: string; ticket?: string; number: string },
  ) {
    return this.userService.createOrGetUser(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }
}
