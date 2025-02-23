import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AttendentService } from './attendent.service';

@Controller('attendents')
export class AttendentController {
  constructor(private readonly attendentService: AttendentService) {}

  @Get()
  async findAll() {
    return this.attendentService.findAll();
  }

  @Post()
  async createAttendent(@Body() data: { name: string; photo?: string; ticket?: string }) {
    return this.attendentService.createAttendent(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.attendentService.findOne(id);
  }
}
