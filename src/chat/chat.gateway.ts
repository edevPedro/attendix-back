import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { sendMessageToWhatsApp, WhatsApp } from 'src/whatsapp-socket/conn';
import { ChatService } from './chat.service';
import { Injectable } from '@nestjs/common';
import { UserService } from 'src/user/user.service';

@WebSocketGateway(3301, {
  cors: {
    origin: '*',
  },
})
@Injectable()
export class ChatGateway {
  @WebSocketServer()
  server: Server;
  constructor(
    private readonly chatService: ChatService,
    private readonly userService: UserService
  ) {}

  afterInit() {

    WhatsApp(this);
    const httpServer = this.server.httpServer;
    const addressInfo = httpServer?.address();
    const port = typeof addressInfo === 'string' ? addressInfo : addressInfo?.port ?? 'desconhecido';
    const protocol = httpServer instanceof (require('https').Server) ? 'wss' : 'ws';
    
    const websocketUrl = `${protocol}://localhost:${port}`;
    console.log(`WebSocket gateway iniciado na URL ${websocketUrl}`);
  }

  
  async handleWhatsAppMessage(data: any) {
    console.log('Recebido do WhatsApp:', data);
    this.server.emit('messageFromWhatsApp', data);
    
    try {
      const user = await this.userService.createOrGetUser({
        number: data.from,
        name: data.name,
      });
      
      await this.chatService.addMessageToChat(user.id, data.message, 'attendent');
    } catch (error) {
      console.log('Erro ao salvar mensagem no banco de dados:', error);
    }
  }
  

  @SubscribeMessage('messageFromFront')
  handleMessageFromFront(@MessageBody() data: any) {
    console.log('Recebido do Front-end:', data);
    sendMessageToWhatsApp(data);
  }
}