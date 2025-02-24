import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { ChatGateway } from 'src/chat/chat.gateway';
import QRCode from 'qrcode';

let sock: ReturnType<typeof makeWASocket>;
let chatGateway: ChatGateway;

export async function WhatsApp(gatewayInstance: ChatGateway) {
    console.log('Iniciando WhatsApp...');
    chatGateway = gatewayInstance;
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    setInterval(() => {
        if (sock) {
            sock.sendPresenceUpdate('available'); 
            console.log("Status de presença enviado para manter a conexão ativa.");
        }
    }, 10000);

    sock.ev.on('connection.update', update => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                WhatsApp(chatGateway);
            }
        } else if (connection === 'open') {
            console.log('WhatsApp conectado! JID:', sock.user);
        } else if (connection === 'connecting') {
            console.log('Connecting...');
        } else if (qr) {

        }
        console.log(`STATUS: ${connection}`);
    });

    sock.ev.on('messages.upsert', async (event: { messages: any }) => {
        for (const m of event.messages) {
            sock.waitForMessage(m.key.remoteJid!);
            if (m.message) {
                console.log(`${m.key.remoteJid} sent a message:`, m.message.conversation);
                chatGateway.handleWhatsAppMessage({
                    from: m.key.remoteJid,
                    message: m.message.conversation,
                    time: m.messageTimestamp,
                    name: m.pushName
                });
                continue;
            }
            console.log(JSON.stringify(m, undefined, 2));
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

export function sendMessageToWhatsApp(data: { to: string; message: string }) {
    if (!sock) {
        console.error('WhatsApp Socket não inicializado.');
        return;
    }

    sock.sendMessage(data.to, { text: data.message })
        .then(() => console.log(`Mensagem enviada para ${data.to}: ${data.message}`))
        .catch(err => console.error('Erro ao enviar mensagem:', err));
}

export { sock };
