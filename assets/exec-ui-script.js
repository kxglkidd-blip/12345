window.ANDRUX_EXEC_UI = `local AndruxExecutor = {}

local C = {
    bg = Color3.fromRGB(243, 240, 234),
    bg2 = Color3.fromRGB(255, 250, 241),
    ink = Color3.fromRGB(23, 19, 13),
    muted = Color3.fromRGB(116, 109, 97),
    rule = Color3.fromRGB(222, 212, 195),
    accent = Color3.fromRGB(111, 77, 45),
    accent2 = Color3.fromRGB(32, 58, 51),
    ok = Color3.fromRGB(45, 111, 82),
    bad = Color3.fromRGB(138, 45, 45),
    warn = Color3.fromRGB(154, 107, 29),
    dark = Color3.fromRGB(23, 19, 13),
    darkPanel = Color3.fromRGB(23, 19, 13),
    white = Color3.fromRGB(255, 255, 255),
    transparent = Color3.fromRGB(0, 0, 0),
}

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")

-- TARGET_PLAYER is injected by the website when pushing to a specific player
-- When nil, falls back to LocalPlayer (client-side executor use)
local player = Players.LocalPlayer
if not player and TARGET_PLAYER then
    player = Players:FindFirstChild(TARGET_PLAYER)
end
if not player then return end

local playerGui = player:WaitForChild("PlayerGui")
local isServer = not Players.LocalPlayer

-- RemoteEvent only needed for client-side execution
local remote
local serverConnected = false

local gui = Instance.new("ScreenGui")
gui.Name = "AndruxExecutor"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = playerGui

local W = 520
local H = 420
local minimized = false
local currentMode = "lua"
local dragging = false
local dragStart = nil
local startPos = nil

local mainFrame = Instance.new("Frame")
mainFrame.Name = "MainFrame"
mainFrame.Size = UDim2.new(0, W, 0, H)
mainFrame.Position = UDim2.new(0.5, -W/2, 0.5, -H/2)
mainFrame.BackgroundColor3 = C.bg
mainFrame.BorderSizePixel = 0
mainFrame.Parent = gui

local mainCorner = Instance.new("UICorner")
mainCorner.CornerRadius = UDim.new(0, 14)
mainCorner.Parent = mainFrame

local mainStroke = Instance.new("UIStroke")
mainStroke.Color = C.rule
mainStroke.Thickness = 1
mainStroke.Parent = mainFrame

local mainShadow = Instance.new("Frame")
mainShadow.Name = "Shadow"
mainShadow.Size = UDim2.new(1, 12, 1, 12)
mainShadow.Position = UDim2.new(0, -6, 0, -6)
mainShadow.BackgroundColor3 = C.transparent
mainShadow.BackgroundTransparency = 1
mainShadow.ZIndex = 0
mainShadow.Parent = mainFrame

local shadowCorner = Instance.new("UICorner")
shadowCorner.CornerRadius = UDim.new(0, 18)
shadowCorner.Parent = mainShadow

local shadowGrad = Instance.new("UIGradient")
shadowGrad.Transparency = NumberSequence.new({
    NumberSequenceKeypoint.new(0, 0.85),
    NumberSequenceKeypoint.new(0.5, 0.88),
    NumberSequenceKeypoint.new(1, 1),
})
shadowGrad.Parent = mainShadow

local titleBar = Instance.new("Frame")
titleBar.Name = "TitleBar"
titleBar.Size = UDim2.new(1, 0, 0, 40)
titleBar.Position = UDim2.new(0, 0, 0, 0)
titleBar.BackgroundColor3 = C.bg2
titleBar.BorderSizePixel = 0
titleBar.Parent = mainFrame

local titleCorner = Instance.new("UICorner")
titleCorner.CornerRadius = UDim.new(0, 14)
titleCorner.Parent = titleBar

local titleBottomFix = Instance.new("Frame")
titleBottomFix.Size = UDim2.new(1, 0, 0, 14)
titleBottomFix.Position = UDim2.new(0, 0, 0, 26)
titleBottomFix.BackgroundColor3 = C.bg2
titleBottomFix.BorderSizePixel = 0
titleBottomFix.Parent = titleBar

local titleBarStroke = Instance.new("Frame")
titleBarStroke.Size = UDim2.new(1, 0, 0, 1)
titleBarStroke.Position = UDim2.new(0, 0, 1, -1)
titleBarStroke.BackgroundColor3 = C.rule
titleBarStroke.BorderSizePixel = 0
titleBarStroke.Parent = titleBar

local logoMark = Instance.new("Frame")
logoMark.Size = UDim2.new(0, 26, 0, 26)
logoMark.Position = UDim2.new(0, 14, 0.5, -13)
logoMark.BackgroundColor3 = C.dark
logoMark.BorderSizePixel = 0
logoMark.Parent = titleBar

local logoCorner = Instance.new("UICorner")
logoCorner.CornerRadius = UDim.new(0, 8)
logoCorner.Parent = logoMark

local logoText = Instance.new("TextLabel")
logoText.Size = UDim2.new(1, 0, 1, 0)
logoText.BackgroundTransparency = 1
logoText.Text = "AX"
logoText.TextColor3 = C.bg2
logoText.Font = Enum.Font.GothamBold
logoText.TextSize = 12
logoText.Parent = logoMark

local titleText = Instance.new("TextLabel")
titleText.Size = UDim2.new(0, 200, 1, 0)
titleText.Position = UDim2.new(0, 50, 0, 0)
titleText.BackgroundTransparency = 1
titleText.Text = "Andrux Executor"
titleText.TextColor3 = C.ink
titleText.Font = Enum.Font.GothamBold
titleText.TextSize = 15
titleText.TextXAlignment = Enum.TextXAlignment.Left
titleText.Parent = titleBar

local btnSize = 30
local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, btnSize, 0, btnSize)
closeBtn.Position = UDim2.new(1, -36, 0.5, -15)
closeBtn.BackgroundColor3 = C.bad
closeBtn.BorderSizePixel = 0
closeBtn.Text = "X"
closeBtn.TextColor3 = C.bg2
closeBtn.Font = Enum.Font.GothamBold
closeBtn.TextSize = 12
closeBtn.Parent = titleBar

local closeCorner = Instance.new("UICorner")
closeCorner.CornerRadius = UDim.new(0, 7)
closeCorner.Parent = closeBtn

local minBtn = Instance.new("TextButton")
minBtn.Size = UDim2.new(0, btnSize, 0, btnSize)
minBtn.Position = UDim2.new(1, -72, 0.5, -15)
minBtn.BackgroundColor3 = C.muted
minBtn.BorderSizePixel = 0
minBtn.Text = "-"
minBtn.TextColor3 = C.bg2
minBtn.Font = Enum.Font.GothamBold
minBtn.TextSize = 14
minBtn.Parent = titleBar

local minCorner = Instance.new("UICorner")
minCorner.CornerRadius = UDim.new(0, 7)
minCorner.Parent = minBtn

local tabHolder = Instance.new("Frame")
tabHolder.Name = "TabHolder"
tabHolder.Size = UDim2.new(1, -28, 0, 38)
tabHolder.Position = UDim2.new(0, 14, 0, 50)
tabHolder.BackgroundTransparency = 1
tabHolder.Parent = mainFrame

local tabLayout = Instance.new("UIListLayout")
tabLayout.FillDirection = Enum.FillDirection.Horizontal
tabLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left
tabLayout.Padding = UDim.new(0, 6)
tabLayout.Parent = tabHolder

local luaTab = Instance.new("TextButton")
luaTab.Size = UDim2.new(0, 90, 0, 34)
luaTab.BackgroundColor3 = C.accent2
luaTab.BorderSizePixel = 0
luaTab.Text = "Lua"
luaTab.TextColor3 = C.bg2
luaTab.Font = Enum.Font.GothamBold
luaTab.TextSize = 13
luaTab.Parent = tabHolder

local luaTabCorner = Instance.new("UICorner")
luaTabCorner.CornerRadius = UDim.new(0, 10)
luaTabCorner.Parent = luaTab

local requireTab = Instance.new("TextButton")
requireTab.Size = UDim2.new(0, 90, 0, 34)
requireTab.BackgroundColor3 = C.bg2
requireTab.BorderSizePixel = 0
requireTab.Text = "Require"
requireTab.TextColor3 = C.muted
requireTab.Font = Enum.Font.GothamBold
requireTab.TextSize = 13
requireTab.Parent = tabHolder

local requireTabCorner = Instance.new("UICorner")
requireTabCorner.CornerRadius = UDim.new(0, 10)
requireTabCorner.Parent = requireTab

local requireTabStroke = Instance.new("UIStroke")
requireTabStroke.Color = C.rule
requireTabStroke.Thickness = 1
requireTabStroke.Parent = requireTab

local luaPanel = Instance.new("Frame")
luaPanel.Name = "LuaPanel"
luaPanel.Size = UDim2.new(1, -28, 1, -110)
luaPanel.Position = UDim2.new(0, 14, 0, 96)
luaPanel.BackgroundTransparency = 1
luaPanel.Parent = mainFrame

local luaEditor = Instance.new("TextBox")
luaEditor.Name = "Editor"
luaEditor.Size = UDim2.new(1, 0, 1, -52)
luaEditor.Position = UDim2.new(0, 0, 0, 0)
luaEditor.BackgroundColor3 = C.darkPanel
luaEditor.BorderSizePixel = 0
luaEditor.Text = ""
luaEditor.TextColor3 = Color3.fromRGB(214, 228, 213)
luaEditor.Font = Enum.Font.Code
luaEditor.TextSize = 13
luaEditor.TextWrapped = true
luaEditor.TextXAlignment = Enum.TextXAlignment.Left
luaEditor.TextYAlignment = Enum.TextYAlignment.Top
luaEditor.PlaceholderText = "在此输入 Lua 脚本..."
luaEditor.PlaceholderColor3 = Color3.fromRGB(120, 116, 108)
luaEditor.ClearTextOnFocus = false
luaEditor.MultiLine = true
luaEditor.Parent = luaPanel

local editorCorner = Instance.new("UICorner")
editorCorner.CornerRadius = UDim.new(0, 12)
editorCorner.Parent = luaEditor

local editorStroke = Instance.new("UIStroke")
editorStroke.Color = C.rule
editorStroke.Thickness = 1
editorStroke.Parent = luaEditor

local editorPadding = Instance.new("UIPadding")
editorPadding.PaddingLeft = UDim.new(0, 12)
editorPadding.PaddingRight = UDim.new(0, 12)
editorPadding.PaddingTop = UDim.new(0, 10)
editorPadding.PaddingBottom = UDim.new(0, 10)
editorPadding.Parent = luaEditor

local luaActions = Instance.new("Frame")
luaActions.Size = UDim2.new(1, 0, 0, 40)
luaActions.Position = UDim2.new(0, 0, 1, -40)
luaActions.BackgroundTransparency = 1
luaActions.Parent = luaPanel

local luaActionLayout = Instance.new("UIListLayout")
luaActionLayout.FillDirection = Enum.FillDirection.Horizontal
luaActionLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left
luaActionLayout.Padding = UDim.new(0, 8)
luaActionLayout.Parent = luaActions

local execLuaBtn = Instance.new("TextButton")
execLuaBtn.Size = UDim2.new(1, -88, 0, 40)
execLuaBtn.BackgroundColor3 = C.accent2
execLuaBtn.BorderSizePixel = 0
execLuaBtn.Text = "执行"
execLuaBtn.TextColor3 = C.bg2
execLuaBtn.Font = Enum.Font.GothamBold
execLuaBtn.TextSize = 14
execLuaBtn.Parent = luaActions

local execLuaCorner = Instance.new("UICorner")
execLuaCorner.CornerRadius = UDim.new(0, 12)
execLuaCorner.Parent = execLuaBtn

local clearLuaBtn = Instance.new("TextButton")
clearLuaBtn.Size = UDim2.new(0, 80, 0, 40)
clearLuaBtn.BackgroundColor3 = C.bg2
clearLuaBtn.BorderSizePixel = 0
clearLuaBtn.Text = "清空"
clearLuaBtn.TextColor3 = C.muted
clearLuaBtn.Font = Enum.Font.GothamBold
clearLuaBtn.TextSize = 14
clearLuaBtn.Parent = luaActions

local clearLuaCorner = Instance.new("UICorner")
clearLuaCorner.CornerRadius = UDim.new(0, 12)
clearLuaCorner.Parent = clearLuaBtn

local clearLuaStroke = Instance.new("UIStroke")
clearLuaStroke.Color = C.rule
clearLuaStroke.Thickness = 1
clearLuaStroke.Parent = clearLuaBtn

local requirePanel = Instance.new("Frame")
requirePanel.Name = "RequirePanel"
requirePanel.Size = UDim2.new(1, -28, 1, -110)
requirePanel.Position = UDim2.new(0, 14, 0, 96)
requirePanel.BackgroundTransparency = 1
requirePanel.Visible = false
requirePanel.Parent = mainFrame

local requireLayout = Instance.new("UIListLayout")
requireLayout.FillDirection = Enum.FillDirection.Vertical
requireLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
requireLayout.Padding = UDim.new(0, 12)
requireLayout.Parent = requirePanel

local assetIdLabel = Instance.new("TextLabel")
assetIdLabel.Size = UDim2.new(1, 0, 0, 20)
assetIdLabel.BackgroundTransparency = 1
assetIdLabel.Text = "资产 ID"
assetIdLabel.TextColor3 = C.muted
assetIdLabel.Font = Enum.Font.GothamBold
assetIdLabel.TextSize = 13
assetIdLabel.TextXAlignment = Enum.TextXAlignment.Left
assetIdLabel.Parent = requirePanel

local assetIdInput = Instance.new("TextBox")
assetIdInput.Size = UDim2.new(1, 0, 0, 42)
assetIdInput.BackgroundColor3 = C.bg2
assetIdInput.BorderSizePixel = 0
assetIdInput.Text = ""
assetIdInput.TextColor3 = C.ink
assetIdInput.Font = Enum.Font.GothamMedium
assetIdInput.TextSize = 14
assetIdInput.PlaceholderText = "12345 或 12345:method 或 12345.func"
assetIdInput.PlaceholderColor3 = C.muted
assetIdInput.ClearTextOnFocus = false
assetIdInput.Parent = requirePanel

local assetCorner = Instance.new("UICorner")
assetCorner.CornerRadius = UDim.new(0, 12)
assetCorner.Parent = assetIdInput

local assetStroke = Instance.new("UIStroke")
assetStroke.Color = C.rule
assetStroke.Thickness = 1
assetStroke.Parent = assetIdInput

local assetPadding = Instance.new("UIPadding")
assetPadding.PaddingLeft = UDim.new(0, 14)
assetPadding.PaddingRight = UDim.new(0, 14)
assetPadding.Parent = assetIdInput

local usernameLabel = Instance.new("TextLabel")
usernameLabel.Size = UDim2.new(1, 0, 0, 20)
usernameLabel.BackgroundTransparency = 1
usernameLabel.Text = "玩家用户名 (可选)"
usernameLabel.TextColor3 = C.muted
usernameLabel.Font = Enum.Font.GothamBold
usernameLabel.TextSize = 13
usernameLabel.TextXAlignment = Enum.TextXAlignment.Left
usernameLabel.Parent = requirePanel

local usernameInput = Instance.new("TextBox")
usernameInput.Size = UDim2.new(1, 0, 0, 42)
usernameInput.BackgroundColor3 = C.bg2
usernameInput.BorderSizePixel = 0
usernameInput.Text = ""
usernameInput.TextColor3 = C.ink
usernameInput.Font = Enum.Font.GothamMedium
usernameInput.TextSize = 14
usernameInput.PlaceholderText = "玩家 Roblox 用户名"
usernameInput.PlaceholderColor3 = C.muted
usernameInput.ClearTextOnFocus = false
usernameInput.Parent = requirePanel

local userCorner = Instance.new("UICorner")
userCorner.CornerRadius = UDim.new(0, 12)
userCorner.Parent = usernameInput

local userStroke = Instance.new("UIStroke")
userStroke.Color = C.rule
userStroke.Thickness = 1
userStroke.Parent = usernameInput

local userPadding = Instance.new("UIPadding")
userPadding.PaddingLeft = UDim.new(0, 14)
userPadding.PaddingRight = UDim.new(0, 14)
userPadding.Parent = usernameInput

local spacer = Instance.new("Frame")
spacer.Size = UDim2.new(0, 0, 0, 4)
spacer.BackgroundTransparency = 1
spacer.Parent = requirePanel

local requireActions = Instance.new("Frame")
requireActions.Size = UDim2.new(1, 0, 0, 42)
requireActions.BackgroundTransparency = 1
requireActions.Parent = requirePanel

local reqActionLayout = Instance.new("UIListLayout")
reqActionLayout.FillDirection = Enum.FillDirection.Horizontal
reqActionLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left
reqActionLayout.Padding = UDim.new(0, 8)
reqActionLayout.Parent = requireActions

local execRequireBtn = Instance.new("TextButton")
execRequireBtn.Size = UDim2.new(1, -88, 0, 42)
execRequireBtn.BackgroundColor3 = C.accent2
execRequireBtn.BorderSizePixel = 0
execRequireBtn.Text = "执行"
execRequireBtn.TextColor3 = C.bg2
execRequireBtn.Font = Enum.Font.GothamBold
execRequireBtn.TextSize = 14
execRequireBtn.Parent = requireActions

local execReqCorner = Instance.new("UICorner")
execReqCorner.CornerRadius = UDim.new(0, 12)
execReqCorner.Parent = execRequireBtn

local clearRequireBtn = Instance.new("TextButton")
clearRequireBtn.Size = UDim2.new(0, 80, 0, 42)
clearRequireBtn.BackgroundColor3 = C.bg2
clearRequireBtn.BorderSizePixel = 0
clearRequireBtn.Text = "清空"
clearRequireBtn.TextColor3 = C.muted
clearRequireBtn.Font = Enum.Font.GothamBold
clearRequireBtn.TextSize = 14
clearRequireBtn.Parent = requireActions

local clearReqCorner = Instance.new("UICorner")
clearReqCorner.CornerRadius = UDim.new(0, 12)
clearReqCorner.Parent = clearRequireBtn

local clearReqStroke = Instance.new("UIStroke")
clearReqStroke.Color = C.rule
clearReqStroke.Thickness = 1
clearReqStroke.Parent = clearRequireBtn

local statusBar = Instance.new("TextLabel")
statusBar.Name = "Status"
statusBar.Size = UDim2.new(1, -28, 0, 26)
statusBar.Position = UDim2.new(0, 14, 1, -34)
statusBar.BackgroundColor3 = C.bg2
statusBar.BorderSizePixel = 0
statusBar.Text = "就绪"
statusBar.TextColor3 = C.muted
statusBar.Font = Enum.Font.GothamMedium
statusBar.TextSize = 12
statusBar.TextXAlignment = Enum.TextXAlignment.Left
statusBar.Parent = mainFrame

local statusCorner = Instance.new("UICorner")
statusCorner.CornerRadius = UDim.new(0, 8)
statusCorner.Parent = statusBar

local statusStroke = Instance.new("UIStroke")
statusStroke.Color = C.rule
statusStroke.Thickness = 1
statusStroke.Parent = statusBar

local statusPadding = Instance.new("UIPadding")
statusPadding.PaddingLeft = UDim.new(0, 12)
statusPadding.Parent = statusBar

local function setStatus(text, color)
    statusBar.Text = text
    statusBar.TextColor3 = color or C.muted
end

local function truncate(msg, max)
    msg = tostring(msg or "未知")
    if #msg > max then msg = msg:sub(1, max - 3) .. "..." end
    return msg
end

-- Capture TextBox text via FocusLost (server-side TextBox.Text doesn't sync from client in real-time)
local luaCode = ""
local assetIdStr = ""
local usernameStr = ""
luaEditor.FocusLost:Connect(function() luaCode = luaEditor.Text end)
assetIdInput.FocusLost:Connect(function() assetIdStr = assetIdInput.Text end)
usernameInput.FocusLost:Connect(function() usernameStr = usernameInput.Text end)

local function parseAsset(input)
    input = (input or ""):gsub("^%s+", ""):gsub("%s+$", "")
    local assetId, suffix

    local colon = input:find(":")
    if colon then
        assetId = input:sub(1, colon - 1)
        suffix = input:sub(colon)
    else
        local dot = input:find("%.")
        if dot then
            assetId = input:sub(1, dot - 1)
            suffix = input:sub(dot)
        else
            assetId = input
            suffix = ""
        end
    end

    assetId = tonumber(assetId)
    if not assetId then return nil end

    local methodName = nil
    local useColon = false
    if suffix ~= "" then
        if suffix:sub(1, 1) == ":" then
            useColon = true
            methodName = suffix:sub(2)
        elseif suffix:sub(1, 1) == "." then
            methodName = suffix:sub(2)
        end
    end

    return {
        id = assetId,
        methodName = methodName,
        useColon = useColon,
        suffix = suffix,
    }
end

local function executeLua()
    local code = luaEditor.Text
    if code == "" or code == luaEditor.PlaceholderText then code = luaCode end
    if code == "" or code == luaEditor.PlaceholderText then
        setStatus("请输入脚本", C.warn)
        return
    end

    if isServer then
        if type(loadstring) ~= "function" then
            setStatus("loadstring 不可用 — 请开启 LoadStringEnabled", C.bad)
            return
        end
        local fn, err = loadstring(code)
        if type(fn) ~= "function" then
            setStatus("编译失败: " .. truncate(err, 70), C.bad)
            return
        end
        local ok, rerr = pcall(fn)
        if ok then
            setStatus("执行成功", C.ok)
        else
            setStatus("运行错误: " .. truncate(rerr, 70), C.bad)
        end
    else
        if not remote or not serverConnected then
            setStatus("未连接服务器 — 请安装 andrux_exec_server 脚本", C.bad)
            return
        end
        setStatus("发送到服务器执行...", C.accent)
        remote:FireServer("lua", code)
    end
end

local function executeRequire()
    local input = assetIdInput.Text
    if input == "" then input = assetIdStr end
    if input == "" then
        setStatus("请输入资产 ID", C.warn)
        return
    end

    local parsed = parseAsset(input)
    if not parsed then
        setStatus("资产 ID 格式错误", C.bad)
        return
    end

    local username = usernameInput.Text
    if username == "" or username == usernameInput.PlaceholderText then username = usernameStr end
    if username == usernameInput.PlaceholderText then
        username = ""
    end

    if isServer then
        setStatus("正在 require(" .. parsed.id .. ")...", C.accent)
        task.spawn(function()
            local ok, result = pcall(function()
                return require(parsed.id)
            end)
            if not ok then
                setStatus("require 失败: " .. truncate(result, 70), C.bad)
                return
            end
            if not parsed.methodName or parsed.methodName == "" then
                setStatus("require 成功", C.ok)
                return
            end
            local method = result[parsed.methodName]
            if method == nil then
                local avail = ""
                if type(result) == "table" then
                    local keys = {}
                    for k, v in pairs(result) do
                        if type(k) == "string" then
                            table.insert(keys, k)
                        end
                    end
                    if #keys > 0 then
                        avail = " (可用: " .. table.concat(keys, ", ") .. ")"
                    end
                end
                setStatus(parsed.methodName .. " 不存在" .. truncate(avail, 50), C.bad)
                return
            end
            if type(method) ~= "function" then
                setStatus(parsed.methodName .. " 类型: " .. type(method), C.bad)
                return
            end
            local cok, cresult
            if parsed.useColon then
                cok, cresult = pcall(method, result, username)
            else
                cok, cresult = pcall(method, username)
            end
            if cok then
                setStatus("执行成功: " .. parsed.suffix, C.ok)
            else
                setStatus("调用失败: " .. truncate(cresult, 70), C.bad)
            end
        end)
    else
        if not remote or not serverConnected then
            setStatus("未连接服务器 — 请安装 andrux_exec_server 脚本", C.bad)
            return
        end
        setStatus("发送到服务器执行...", C.accent)
        remote:FireServer("require", parsed.id, parsed.methodName or "", parsed.useColon, username)
    end
end

local function switchMode(mode)
    currentMode = mode
    if mode == "lua" then
        luaTab.BackgroundColor3 = C.accent2
        luaTab.TextColor3 = C.bg2
        requireTab.BackgroundColor3 = C.bg2
        requireTab.TextColor3 = C.muted
        luaPanel.Visible = true
        requirePanel.Visible = false
    else
        luaTab.BackgroundColor3 = C.bg2
        luaTab.TextColor3 = C.muted
        requireTab.BackgroundColor3 = C.accent2
        requireTab.TextColor3 = C.bg2
        luaPanel.Visible = false
        requirePanel.Visible = true
    end
end

luaTab.MouseButton1Click:Connect(function()
    switchMode("lua")
end)

requireTab.MouseButton1Click:Connect(function()
    switchMode("require")
end)

execLuaBtn.MouseButton1Click:Connect(executeLua)
clearLuaBtn.MouseButton1Click:Connect(function()
    luaEditor.Text = ""
    setStatus("已清空", C.muted)
end)

execRequireBtn.MouseButton1Click:Connect(executeRequire)
clearRequireBtn.MouseButton1Click:Connect(function()
    assetIdInput.Text = ""
    usernameInput.Text = ""
    setStatus("已清空", C.muted)
end)

closeBtn.MouseButton1Click:Connect(function()
    gui.Enabled = false
    gui.Visible = false
end)

minBtn.MouseButton1Click:Connect(function()
    minimized = not minimized
    if minimized then
        TweenService:Create(mainFrame, TweenInfo.new(0.15), {
            Size = UDim2.new(0, W, 0, 40)
        }):Play()
        luaPanel.Visible = false
        requirePanel.Visible = false
        tabHolder.Visible = false
        statusBar.Visible = false
    else
        tabHolder.Visible = true
        statusBar.Visible = true
        if currentMode == "lua" then
            luaPanel.Visible = true
        else
            requirePanel.Visible = true
        end
        TweenService:Create(mainFrame, TweenInfo.new(0.15), {
            Size = UDim2.new(0, W, 0, H)
        }):Play()
    end
end)

-- Smooth drag: works on both server and client
local dragTarget = nil

titleBar.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1
        or input.UserInputType == Enum.UserInputType.Touch then
        dragging = true
        dragStart = input.Position
        startPos = mainFrame.Position
        dragTarget = startPos
    end
end)

local function onDragMove(input)
    if not dragging then return end
    if input.UserInputType == Enum.UserInputType.MouseMovement
        or input.UserInputType == Enum.UserInputType.Touch then
        local delta = input.Position - dragStart
        dragTarget = UDim2.new(
            startPos.X.Scale,
            startPos.X.Offset + delta.X,
            startPos.Y.Scale,
            startPos.Y.Offset + delta.Y
        )
    end
end

local function onDragEnd(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1
        or input.UserInputType == Enum.UserInputType.Touch then
        dragging = false
    end
end

if isServer then
    titleBar.InputChanged:Connect(onDragMove)
    titleBar.InputEnded:Connect(onDragEnd)
else
    UserInputService.InputChanged:Connect(onDragMove)
    UserInputService.InputEnded:Connect(onDragEnd)
end

-- Smooth interpolation: frame follows mouse with easing
local renderStep = isServer and RunService.Heartbeat or RunService.RenderStepped
renderStep:Connect(function()
    if dragging and dragTarget then
        local cur = mainFrame.Position
        mainFrame.Position = UDim2.new(
            cur.X.Scale,
            cur.X.Offset + (dragTarget.X.Offset - cur.X.Offset) * 0.35,
            cur.Y.Scale,
            cur.Y.Offset + (dragTarget.Y.Offset - cur.Y.Offset) * 0.35
        )
    end
end)

UserInputService.InputBegan:Connect(function(input, gpe)
    if gpe then return end
    if input.KeyCode == Enum.KeyCode.RightShift then
        gui.Enabled = not gui.Enabled
        gui.Visible = gui.Enabled
    end
end)

local btns = {closeBtn, minBtn, luaTab, requireTab, execLuaBtn, clearLuaBtn, execRequireBtn, clearRequireBtn}
for _, btn in ipairs(btns) do
    btn.MouseEnter:Connect(function()
        if btn == closeBtn then
            btn.BackgroundColor3 = C.bad
        elseif btn == minBtn then
            btn.BackgroundColor3 = C.muted
        else
            local orig = btn.BackgroundColor3
            btn.BackgroundColor3 = Color3.fromRGB(
                math.min(orig.R * 255 + 10, 255),
                math.min(orig.G * 255 + 10, 255),
                math.min(orig.B * 255 + 10, 255)
            )
        end
    end)
    btn.MouseLeave:Connect(function()
        if btn == closeBtn then
            btn.BackgroundColor3 = C.bad
        elseif btn == minBtn then
            btn.BackgroundColor3 = C.muted
        elseif btn == luaTab then
            if currentMode == "lua" then
                btn.BackgroundColor3 = C.accent2
            else
                btn.BackgroundColor3 = C.bg2
            end
        elseif btn == requireTab then
            if currentMode == "require" then
                btn.BackgroundColor3 = C.accent2
            else
                btn.BackgroundColor3 = C.bg2
            end
        elseif btn == execLuaBtn or btn == execRequireBtn then
            btn.BackgroundColor3 = C.accent2
        elseif btn == clearLuaBtn or btn == clearRequireBtn then
            btn.BackgroundColor3 = C.bg2
        end
    end)
end

switchMode("lua")

if isServer then
    -- Server-side: loadstring/require available directly, no RemoteEvent needed
    setStatus("就绪 — 服务端执行模式", C.ok)
else
    -- Client-side: async wait for RemoteEvent
    setStatus("等待服务器连接...", C.warn)
    task.spawn(function()
        local r = playerGui:WaitForChild("AndruxExec", 30)
        if r and r:IsA("RemoteEvent") then
            remote = r
            serverConnected = true

            r.OnClientEvent:Connect(function(result)
                if type(result) ~= "table" then return end
                if result.status == "ok" then
                    setStatus(result.msg or "成功", C.ok)
                elseif result.status == "error" then
                    setStatus(result.msg or "错误", C.bad)
                end
            end)

            setStatus("已连接服务器 — 右 Shift 开关窗口", C.ok)
        else
            setStatus("未连接服务器 — 需安装 andrux_exec_server", C.bad)
        end
    end)
end

return AndruxExecutor
`;