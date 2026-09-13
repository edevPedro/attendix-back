import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

@WebSocketGateway(3301, {
  cors: {
    origin: '*',
  },
})
@Injectable()
export class ChatGateway extends EventEmitter {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor() {
    super();
  }

  afterInit() {
    this.logger.log('WebSocket gateway em ws://localhost:3301');
  }

  emitToFront(data: unknown) {
    this.server?.emit('messageFromWhatsApp', data);
  }

  @SubscribeMessage('messageFromFront')
  handleMessageFromFront(@MessageBody() data: { to: string; message?: string }) {
    this.emit('fromFront', data);
  }
}
