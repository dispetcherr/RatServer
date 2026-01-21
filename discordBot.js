const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.on('ready', () => {
    console.log(`✅ Discord бот ${client.user.tag} запущен!`);
});

client.on('messageCreate', async message => {
    if (message.content === '/test') {
        message.reply('Бот работает через server.js!');
    }
});

client.login('MTM5Nzk4NTQyODM4NDI1NjAwMA.GHeP85.k2qv2aPdZQTLCnZAMh1JgWtxrpLTnBAZ8sdSRA');
