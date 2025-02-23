import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AttendentService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll() {
    return this.prismaService.attendent.findMany();
  }

  async createAttendent(data: { name: string; photo?: string; ticket?: string }) {
    return this.prismaService.attendent.create({ data });
  }

  async findOne(id: string) {
    return this.prismaService.attendent.findUnique({
      where: { id: parseInt(id, 10) }, 
    });
  }
}
