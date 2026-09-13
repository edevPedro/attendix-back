import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

/** Realtime opcional. Envio/recebimento autenticado passa pelo REST /admin. */
@WebSocketGateway(3301, {
  cors: { origin: false },
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
    this.logger.log('WebSocket interno em ws://localhost:3301 (sem ingestão)');
  }

  emitToFront(_data: unknown) {
    /* Não espalhar mensagens do WhatsApp numa porta aberta. Use GET /admin/inbox. */
  }
}
