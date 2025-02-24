import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll() {
    return this.prismaService.user.findMany();
  }

  async createOrGetUser(data: { name: string; photo?: string; ticket?: string; number: string}) {
    console.log(data)
    const searchedUser = await this.prismaService.user.upsert({
      where: { number: data.number },
      update: {}, 
      create: {
        name: data.name,
        number: data.number,
      },
    });

    if(searchedUser){
      return searchedUser
    }
    return this.prismaService.user.create({
      data: {
      name: data.name,
      number: data.number,
      }
    });
  }

  async findOne(id: string) {
    return this.prismaService.user.findUnique({
      where: { id: parseInt(id, 10) },
    });
  }

  async findByUser(user: string){
    return this.prismaService.user.findFirst({
      where: {number: user}
    })
  }
}
