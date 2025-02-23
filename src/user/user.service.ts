import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll() {
    return this.prismaService.user.findMany();
  }

  async createUser(data: { name: string; photo?: string; ticket?: string; number: string}) {
    return this.prismaService.user.create({
      data,
    });
  }

  async findOne(id: string) {
    return this.prismaService.user.findUnique({
      where: { id: parseInt(id, 10) },
    });
  }
}
