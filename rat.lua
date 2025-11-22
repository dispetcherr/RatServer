-- Тестовый скрипт для загрузки видео
local function testDownload()
    print("🔄 Начинаю загрузку видео...")
    
    local success, result = pcall(function()
        -- Скачиваем видео
        writefile("test_video.mp4", game:HttpGet("https://github.com/HappyCow91/RobloxScripts/raw/main/Videos/videoplayback.mp4"))
        print("✅ Видео скачано!")
        
        -- Проверяем размер файла
        if readfile then
            local content = readfile("test_video.mp4")
            print("📊 Размер файла: " .. #content .. " байт")
        end
        
        -- Пытаемся получить путь через getcustomasset
        if getcustomasset then
            local path = getcustomasset("test_video.mp4")
            print("📁 Путь к файлу: " .. tostring(path))
        end
        
        return true
    end)
    
    if success then
        print("🎉 Тест пройден! Видео должно быть в папке эксплойта")
    else
        print("❌ Ошибка: " .. tostring(result))
    end
end

-- Запускаем тест
testDownload()
