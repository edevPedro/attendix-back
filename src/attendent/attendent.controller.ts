import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AttendentService } from './attendent.service';
import { AdminGuard } from 'src/auth/admin.guard';

@Controller('attendents')
@UseGuards(AdminGuard)
export class AttendentController {
  constructor(private readonly attendentService: AttendentService) {}

  @Get()
  async findAll() {
    return this.attendentService.findAll();
  }

  @Post()
  async createAttendent(@Body() data: { name: string; photo?: string; ticket?: string }) {
    return this.attendentService.createAttendent({ name: data.name, ticket: data.ticket });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.attendentService.findOne(id);
  }
}
