--[[
    ABYSS HUB // DOORS  -  v2

    Cible     : Roblox DOORS (Hotel+, Mines, Backdoor)
    Exécuteur : Delta Android (UNC standard), compatible PC
    UI        : 100 % intégrée, aucun loadstring externe
    Config    : sauvegardée automatiquement (writefile) si l'exécuteur le permet
]]

if not game:IsLoaded() then
    game.Loaded:Wait()
end

local genv = (typeof(getgenv) == "function" and getgenv()) or _G

-- Ré-exécution : on décharge l'instance précédente au lieu de dupliquer UI + connexions
if genv.AbyssHub and type(genv.AbyssHub.Unload) == "function" then
    pcall(genv.AbyssHub.Unload)
end

-- Notification native Roblox : visible même si notre UI ne peut pas se créer
local function sysNotify(title, text, duration)
    pcall(function()
        game:GetService("StarterGui"):SetCore("SendNotification", {
            Title = title,
            Text = text,
            Duration = duration or 5,
        })
    end)
end

sysNotify("ABYSS HUB", "Chargement...", 3)

local function Main()
    --==================================================================--
    -- SERVICES
    --==================================================================--
    local Players           = game:GetService("Players")
    local RunService        = game:GetService("RunService")
    local UserInputService  = game:GetService("UserInputService")
    local TweenService      = game:GetService("TweenService")
    local Lighting          = game:GetService("Lighting")
    local ReplicatedStorage = game:GetService("ReplicatedStorage")
    local HttpService       = game:GetService("HttpService")
    local CoreGui           = game:GetService("CoreGui")

    local LocalPlayer = Players.LocalPlayer
    while not LocalPlayer do
        task.wait()
        LocalPlayer = Players.LocalPlayer
    end

    local fireprompt = (typeof(fireproximityprompt) == "function") and fireproximityprompt or nil

    --==================================================================--
    -- CYCLE DE VIE (défini en premier : une erreur en plein chargement nettoie quand même tout)
    --==================================================================--
    local Hub = { Alive = true, Connections = {}, Cleanups = {} }
    genv.AbyssHub = Hub

    function Hub.Unload()
        if not Hub.Alive then return end
        Hub.Alive = false
        for i = #Hub.Cleanups, 1, -1 do
            pcall(Hub.Cleanups[i])
        end
        for _, c in ipairs(Hub.Connections) do
            pcall(function() c:Disconnect() end)
        end
        table.clear(Hub.Connections)
        table.clear(Hub.Cleanups)
        if genv.AbyssHub == Hub then
            genv.AbyssHub = nil
        end
    end

    local function onUnload(fn)
        Hub.Cleanups[#Hub.Cleanups + 1] = fn
    end

    local function connect(signal, fn)
        local c = signal:Connect(fn)
        Hub.Connections[#Hub.Connections + 1] = c
        return c
    end

    local function safeCall(fn, ...)
        local ok, err = pcall(fn, ...)
        if not ok then
            warn("[Abyss] " .. tostring(err))
        end
        return ok
    end

    local function randomName()
        local t = {}
        for i = 1, 12 do
            t[i] = string.char(math.random(97, 122))
        end
        return table.concat(t)
    end

    local function getHumanoid()
        local char = LocalPlayer.Character
        return char and char:FindFirstChildOfClass("Humanoid")
    end

    local function getRoot()
        local char = LocalPlayer.Character
        return char and char:FindFirstChild("HumanoidRootPart")
    end

    --==================================================================--
    -- PALETTES & THÈMES
    --==================================================================--
    local Palette = {
        Color3.fromRGB(255, 60, 60),   -- 1 Rouge
        Color3.fromRGB(255, 150, 40),  -- 2 Orange
        Color3.fromRGB(255, 225, 60),  -- 3 Jaune
        Color3.fromRGB(90, 255, 120),  -- 4 Vert
        Color3.fromRGB(70, 210, 255),  -- 5 Cyan
        Color3.fromRGB(70, 120, 255),  -- 6 Bleu
        Color3.fromRGB(170, 90, 255),  -- 7 Violet
        Color3.fromRGB(255, 100, 200), -- 8 Rose
        Color3.fromRGB(255, 255, 255), -- 9 Blanc
    }

    local ThemePresets = {
        { Color3.fromRGB(150, 90, 255), Color3.fromRGB(70, 200, 255) },  -- Abyss
        { Color3.fromRGB(255, 70, 90),  Color3.fromRGB(255, 160, 60) },  -- Sang
        { Color3.fromRGB(60, 220, 130), Color3.fromRGB(60, 200, 255) },  -- Toxique
        { Color3.fromRGB(70, 120, 255), Color3.fromRGB(160, 90, 255) },  -- Océan
        { Color3.fromRGB(255, 90, 190), Color3.fromRGB(160, 90, 255) },  -- Néon
        { Color3.fromRGB(255, 190, 50), Color3.fromRGB(255, 110, 50) },  -- Or
    }

    local Theme = {
        Background = Color3.fromRGB(14, 12, 22),
        Sidebar    = Color3.fromRGB(20, 17, 32),
        Element    = Color3.fromRGB(28, 24, 44),
        ElementHi  = Color3.fromRGB(40, 35, 62),
        Accent     = ThemePresets[1][1],
        Accent2    = ThemePresets[1][2],
        Text       = Color3.fromRGB(235, 232, 245),
        SubText    = Color3.fromRGB(150, 145, 175),
        Off        = Color3.fromRGB(55, 50, 75),
        Danger     = Color3.fromRGB(255, 70, 80),
    }

    --==================================================================--
    -- CONFIGURATION (valeurs par défaut + persistance)
    --==================================================================--
    local Defaults = {
        -- ESP catégories
        EspDoors = false, EspKeys = false, EspObjectives = false, EspItems = false, EspGold = false,
        EspHiding = false, EspContainers = false, EspEntities = false, EspPlayers = false,
        -- ESP réglages
        EspOutline = true, EspNames = true, EspDistance = true, EspFill = 70, EspMaxDist = 1000, EspRainbow = false,
        -- Monde
        Fullbright = false, NoFog = false, AntiBlur = false,
        -- Joueur
        SpeedEnabled = false, Speed = 20, JumpEnabled = false, FovEnabled = false, Fov = 90,
        -- Entités
        NotifyEntities = true, AntiScreech = false,
        -- Auto
        InstantPrompt = false, PromptReach = false, AutoGold = false, AutoItems = false,
        -- Interface
        ThemeIndex = 1, UiScale = 100,
        -- Couleurs ESP (index dans Palette)
        Color_EspDoors = 5, Color_EspKeys = 3, Color_EspObjectives = 4, Color_EspItems = 7, Color_EspGold = 2,
        Color_EspHiding = 6, Color_EspContainers = 8, Color_EspEntities = 1, Color_EspPlayers = 9,
    }

    local Config = {}
    for k, v in pairs(Defaults) do
        Config[k] = v
    end

    local SAVE_FILE = "AbyssHub_Doors.json"
    local canSave = typeof(writefile) == "function" and typeof(readfile) == "function" and typeof(isfile) == "function"
    local loadingSave = false
    local saveQueued = false

    local function readSave()
        if not canSave then return nil end
        local ok, data = pcall(function()
            if not isfile(SAVE_FILE) then return nil end
            return HttpService:JSONDecode(readfile(SAVE_FILE))
        end)
        if ok and type(data) == "table" then
            return data
        end
        return nil
    end

    -- Sauvegarde différée : un slider glissé génère des dizaines de changements, une écriture suffit
    local function scheduleSave()
        if loadingSave or not canSave or saveQueued then return end
        saveQueued = true
        task.delay(1, function()
            saveQueued = false
            if not Hub.Alive then return end
            pcall(function()
                writefile(SAVE_FILE, HttpService:JSONEncode(Config))
            end)
        end)
    end

    local Saved = readSave()
    -- Le thème doit être connu avant de construire l'UI
    if Saved and type(Saved.ThemeIndex) == "number" and ThemePresets[Saved.ThemeIndex] then
        Config.ThemeIndex = Saved.ThemeIndex
        Theme.Accent = ThemePresets[Saved.ThemeIndex][1]
        Theme.Accent2 = ThemePresets[Saved.ThemeIndex][2]
    end

    --==================================================================--
    -- CONTENEUR UI
    --==================================================================--
    local function canParentTo(container)
        if typeof(container) ~= "Instance" or not container:IsDescendantOf(game) then
            return false
        end
        return (pcall(function()
            local probe = Instance.new("ScreenGui")
            probe.Parent = container
            probe:Destroy()
        end))
    end

    local function resolveGuiParent()
        -- Certains gethui() mobiles renvoient une instance hors DataModel : l'UI n'y est jamais rendue
        if typeof(gethui) == "function" then
            local ok, h = pcall(gethui)
            if ok and canParentTo(h) then
                return h
            end
        end
        if canParentTo(CoreGui) then
            return CoreGui
        end
        return LocalPlayer:WaitForChild("PlayerGui")
    end

    local function new(class, props, parent)
        local inst = Instance.new(class)
        if props then
            for k, v in pairs(props) do
                inst[k] = v
            end
        end
        if parent then
            inst.Parent = parent
        end
        return inst
    end

    local function corner(parent, radius)
        return new("UICorner", { CornerRadius = UDim.new(0, radius or 8) }, parent)
    end

    local function tween(inst, time, props)
        if time <= 0 then
            for k, v in pairs(props) do
                inst[k] = v
            end
            return nil
        end
        local t = TweenService:Create(inst, TweenInfo.new(time, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), props)
        t:Play()
        return t
    end

    -- Tout élément coloré par l'accent s'enregistre ici pour suivre les changements de thème en direct
    local ThemeHooks = {}
    local function onTheme(fn)
        ThemeHooks[#ThemeHooks + 1] = fn
        safeCall(fn)
    end
    local function applyTheme(index)
        local preset = ThemePresets[index]
        if not preset then return end
        Theme.Accent = preset[1]
        Theme.Accent2 = preset[2]
        for _, fn in ipairs(ThemeHooks) do
            safeCall(fn)
        end
    end

    local function accentStroke(parent, thickness, transparency)
        local s = new("UIStroke", {
            Thickness = thickness or 1,
            Transparency = transparency or 0.5,
            ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
        }, parent)
        onTheme(function() s.Color = Theme.Accent end)
        return s
    end

    local function accentGradient(parent, rotation)
        local g = new("UIGradient", { Rotation = rotation or 0 }, parent)
        onTheme(function() g.Color = ColorSequence.new(Theme.Accent, Theme.Accent2) end)
        return g
    end

    local GuiParent = resolveGuiParent()

    local ScreenGui = new("ScreenGui", {
        Name = randomName(),
        ResetOnSpawn = false,
        IgnoreGuiInset = true,
        ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
        DisplayOrder = 9999,
    }, GuiParent)
    if typeof(protectgui) == "function" then
        pcall(protectgui, ScreenGui)
    end
    if not ScreenGui:IsDescendantOf(game) then
        ScreenGui.Parent = LocalPlayer:WaitForChild("PlayerGui")
    end
    onUnload(function() ScreenGui:Destroy() end)

    -- Billboards à côté du ScreenGui (un BillboardGui imbriqué dans un ScreenGui ne s'affiche pas),
    -- Highlights dans la caméra (client uniquement, toujours rendue, invisible pour les scripts serveur)
    local BillboardFolder = new("Folder", { Name = randomName() }, ScreenGui.Parent)
    local HighlightFolder = new("Folder", { Name = randomName() }, workspace.CurrentCamera or workspace)
    onUnload(function()
        BillboardFolder:Destroy()
        HighlightFolder:Destroy()
    end)

    --==================================================================--
    -- NOTIFICATIONS
    --==================================================================--
    local NotifHolder = new("Frame", {
        AnchorPoint = Vector2.new(1, 1),
        Position = UDim2.new(1, -12, 1, -12),
        Size = UDim2.fromOffset(240, 400),
        BackgroundTransparency = 1,
    }, ScreenGui)
    new("UIListLayout", {
        VerticalAlignment = Enum.VerticalAlignment.Bottom,
        HorizontalAlignment = Enum.HorizontalAlignment.Right,
        Padding = UDim.new(0, 6),
        SortOrder = Enum.SortOrder.LayoutOrder,
    }, NotifHolder)

    local notifOrder = 0
    local function notify(title, text, color, duration)
        if not Hub.Alive then return end
        color = color or Theme.Accent
        notifOrder = notifOrder + 1
        local card = new("Frame", {
            Size = UDim2.fromOffset(230, 56),
            BackgroundColor3 = Theme.Background,
            BackgroundTransparency = 1,
            LayoutOrder = notifOrder,
        }, NotifHolder)
        corner(card, 8)
        local s = new("UIStroke", { Color = color, Thickness = 1.5, Transparency = 1 }, card)
        local bar = new("Frame", {
            Size = UDim2.new(0, 3, 1, -12),
            Position = UDim2.fromOffset(6, 6),
            BackgroundColor3 = color,
            BackgroundTransparency = 1,
            BorderSizePixel = 0,
        }, card)
        corner(bar, 2)
        local t1 = new("TextLabel", {
            Position = UDim2.fromOffset(16, 6),
            Size = UDim2.new(1, -22, 0, 18),
            BackgroundTransparency = 1,
            Font = Enum.Font.GothamBold,
            Text = title,
            TextSize = 14,
            TextColor3 = color,
            TextXAlignment = Enum.TextXAlignment.Left,
            TextTransparency = 1,
        }, card)
        local t2 = new("TextLabel", {
            Position = UDim2.fromOffset(16, 25),
            Size = UDim2.new(1, -22, 0, 26),
            BackgroundTransparency = 1,
            Font = Enum.Font.Gotham,
            Text = text,
            TextSize = 12,
            TextWrapped = true,
            TextColor3 = Theme.Text,
            TextXAlignment = Enum.TextXAlignment.Left,
            TextYAlignment = Enum.TextYAlignment.Top,
            TextTransparency = 1,
        }, card)

        tween(card, 0.25, { BackgroundTransparency = 0.05 })
        tween(s, 0.25, { Transparency = 0.2 })
        tween(bar, 0.25, { BackgroundTransparency = 0 })
        tween(t1, 0.25, { TextTransparency = 0 })
        tween(t2, 0.25, { TextTransparency = 0 })

        task.delay(duration or 3.5, function()
            if not card.Parent then return end
            tween(card, 0.3, { BackgroundTransparency = 1 })
            tween(s, 0.3, { Transparency = 1 })
            tween(bar, 0.3, { BackgroundTransparency = 1 })
            tween(t1, 0.3, { TextTransparency = 1 })
            tween(t2, 0.3, { TextTransparency = 1 })
            task.wait(0.32)
            card:Destroy()
        end)
    end

    --==================================================================--
    -- DRAG (souris + tactile). Retourne "a-t-on glissé ?" pour distinguer tap et déplacement
    --==================================================================--
    local function makeDraggable(handle, target)
        local dragging, dragInput, startInputPos, startPos = false, nil, nil, nil
        local moved = 0

        connect(handle.InputBegan, function(input)
            local t = input.UserInputType
            if t == Enum.UserInputType.MouseButton1 or t == Enum.UserInputType.Touch then
                dragging = true
                moved = 0
                dragInput = input
                startInputPos = input.Position
                startPos = target.Position
            end
        end)

        connect(UserInputService.InputChanged, function(input)
            if not dragging then return end
            -- En tactile, InputChanged renvoie le même objet input que InputBegan
            if input == dragInput or input.UserInputType == Enum.UserInputType.MouseMovement then
                local delta = input.Position - startInputPos
                moved = math.max(moved, delta.Magnitude)
                target.Position = UDim2.new(
                    startPos.X.Scale, startPos.X.Offset + delta.X,
                    startPos.Y.Scale, startPos.Y.Offset + delta.Y
                )
            end
        end)

        connect(UserInputService.InputEnded, function(input)
            if input == dragInput or input.UserInputType == Enum.UserInputType.MouseButton1 then
                dragging = false
            end
        end)

        return function()
            return moved > 8
        end
    end

    --==================================================================--
    -- FENÊTRE PRINCIPALE
    --==================================================================--
    local Main = new("Frame", {
        AnchorPoint = Vector2.new(0.5, 0.5),
        Position = UDim2.fromScale(0.5, 0.5),
        Size = UDim2.fromOffset(480, 320),
        BackgroundColor3 = Theme.Background,
        BorderSizePixel = 0,
        ClipsDescendants = true,
    }, ScreenGui)
    corner(Main, 12)
    accentStroke(Main, 1.5, 0.35)

    local MainScale = new("UIScale", { Scale = 1 }, Main)
    local function updateScale()
        local cam = workspace.CurrentCamera
        if not cam then return end
        local vp = cam.ViewportSize
        local auto = math.clamp(math.min(vp.X / 640, vp.Y / 420), 0.6, 1.15)
        MainScale.Scale = auto * (Config.UiScale / 100)
    end

    local viewportConn
    local function hookViewport()
        if viewportConn then viewportConn:Disconnect() end
        local cam = workspace.CurrentCamera
        if cam then
            viewportConn = cam:GetPropertyChangedSignal("ViewportSize"):Connect(updateScale)
        end
        updateScale()
    end
    hookViewport()
    connect(workspace:GetPropertyChangedSignal("CurrentCamera"), hookViewport)
    onUnload(function()
        if viewportConn then viewportConn:Disconnect() end
    end)

    local TopBar = new("Frame", {
        Size = UDim2.new(1, 0, 0, 40),
        BackgroundColor3 = Theme.Sidebar,
        BorderSizePixel = 0,
    }, Main)

    local Title = new("TextLabel", {
        Position = UDim2.fromOffset(14, 0),
        Size = UDim2.new(0, 80, 1, 0),
        BackgroundTransparency = 1,
        Font = Enum.Font.GothamBlack,
        Text = "ABYSS",
        TextSize = 21,
        TextColor3 = Color3.new(1, 1, 1),
        TextXAlignment = Enum.TextXAlignment.Left,
    }, TopBar)
    accentGradient(Title)

    new("TextLabel", {
        Position = UDim2.fromOffset(90, 0),
        Size = UDim2.new(0, 200, 1, 0),
        BackgroundTransparency = 1,
        Font = Enum.Font.GothamMedium,
        Text = "// DOORS  v2",
        TextSize = 13,
        TextColor3 = Theme.SubText,
        TextXAlignment = Enum.TextXAlignment.Left,
    }, TopBar)

    local TopLine = new("Frame", {
        AnchorPoint = Vector2.new(0, 1),
        Position = UDim2.fromScale(0, 1),
        Size = UDim2.new(1, 0, 0, 2),
        BackgroundColor3 = Color3.new(1, 1, 1),
        BorderSizePixel = 0,
    }, TopBar)
    accentGradient(TopLine)

    local CloseBtn = new("TextButton", {
        AnchorPoint = Vector2.new(1, 0.5),
        Position = UDim2.new(1, -8, 0.5, 0),
        Size = UDim2.fromOffset(28, 28),
        BackgroundColor3 = Theme.Element,
        Font = Enum.Font.GothamBold,
        Text = "–",
        TextSize = 18,
        TextColor3 = Theme.Text,
        AutoButtonColor = false,
    }, TopBar)
    corner(CloseBtn, 6)

    makeDraggable(TopBar, Main)

    local Sidebar = new("ScrollingFrame", {
        Position = UDim2.fromOffset(0, 40),
        Size = UDim2.new(0, 118, 1, -40),
        BackgroundColor3 = Theme.Sidebar,
        BorderSizePixel = 0,
        ScrollBarThickness = 0,
        CanvasSize = UDim2.new(),
        AutomaticCanvasSize = Enum.AutomaticSize.Y,
        ScrollingDirection = Enum.ScrollingDirection.Y,
    }, Main)
    new("UIListLayout", {
        Padding = UDim.new(0, 4),
        SortOrder = Enum.SortOrder.LayoutOrder,
        HorizontalAlignment = Enum.HorizontalAlignment.Center,
    }, Sidebar)
    new("UIPadding", { PaddingTop = UDim.new(0, 8), PaddingBottom = UDim.new(0, 8) }, Sidebar)

    local PageHolder = new("Frame", {
        Position = UDim2.fromOffset(118, 40),
        Size = UDim2.new(1, -118, 1, -40),
        BackgroundTransparency = 1,
    }, Main)

    --==================================================================--
    -- BOUTON FLOTTANT
    --==================================================================--
    local FloatBtn = new("TextButton", {
        AnchorPoint = Vector2.new(0.5, 0.5),
        Position = UDim2.new(0, 50, 0.35, 0),
        Size = UDim2.fromOffset(50, 50),
        BackgroundColor3 = Color3.new(1, 1, 1),
        Font = Enum.Font.GothamBlack,
        Text = "A",
        TextSize = 24,
        TextColor3 = Color3.new(1, 1, 1),
        AutoButtonColor = false,
    }, ScreenGui)
    corner(FloatBtn, 25)
    accentGradient(FloatBtn, 45)
    new("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 2, Transparency = 0.6 }, FloatBtn)
    local floatDragged = makeDraggable(FloatBtn, FloatBtn)

    local function toggleMain()
        Main.Visible = not Main.Visible
    end
    connect(FloatBtn.Activated, function()
        if floatDragged() then return end
        toggleMain()
    end)
    connect(CloseBtn.Activated, function()
        Main.Visible = false
    end)
    connect(UserInputService.InputBegan, function(input, processed)
        if not processed and input.KeyCode == Enum.KeyCode.RightShift then
            toggleMain()
        end
    end)

    --==================================================================--
    -- MINI LIBRAIRIE D'ÉLÉMENTS
    --==================================================================--
    local UI = { Tabs = {}, Pages = {}, Setters = {}, Current = 1 }

    local function renderTabs()
        for i, b in ipairs(UI.Tabs) do
            local active = (i == UI.Current)
            UI.Pages[i].Visible = active
            b.BackgroundTransparency = active and 0 or 1
            b.TextColor3 = active and Theme.Accent2 or Theme.SubText
        end
    end
    onTheme(renderTabs)

    function UI.Tab(name, icon)
        local index = #UI.Tabs + 1

        local btn = new("TextButton", {
            Size = UDim2.new(1, -14, 0, 34),
            BackgroundColor3 = Theme.ElementHi,
            BackgroundTransparency = 1,
            Font = Enum.Font.GothamBold,
            Text = " " .. icon .. "  " .. name,
            TextSize = 13,
            TextColor3 = Theme.SubText,
            TextXAlignment = Enum.TextXAlignment.Left,
            AutoButtonColor = false,
            LayoutOrder = index,
        }, Sidebar)
        corner(btn, 7)

        local page = new("ScrollingFrame", {
            Size = UDim2.fromScale(1, 1),
            BackgroundTransparency = 1,
            BorderSizePixel = 0,
            ScrollBarThickness = 3,
            CanvasSize = UDim2.new(),
            AutomaticCanvasSize = Enum.AutomaticSize.Y,
            ScrollingDirection = Enum.ScrollingDirection.Y,
            Visible = false,
        }, PageHolder)
        onTheme(function() page.ScrollBarImageColor3 = Theme.Accent end)
        new("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }, page)
        new("UIPadding", {
            PaddingTop = UDim.new(0, 8),
            PaddingBottom = UDim.new(0, 10),
            PaddingLeft = UDim.new(0, 8),
            PaddingRight = UDim.new(0, 10),
        }, page)
        page:SetAttribute("Order", 0)

        UI.Tabs[index] = btn
        UI.Pages[index] = page

        connect(btn.Activated, function()
            UI.Current = index
            renderTabs()
        end)
        renderTabs()
        return page
    end

    local function nextOrder(page)
        local o = (page:GetAttribute("Order") or 0) + 1
        page:SetAttribute("Order", o)
        return o
    end

    function UI.Section(page, text)
        local lbl = new("TextLabel", {
            Size = UDim2.new(1, 0, 0, 22),
            BackgroundTransparency = 1,
            Font = Enum.Font.GothamBlack,
            Text = string.upper(text),
            TextSize = 11,
            TextXAlignment = Enum.TextXAlignment.Left,
            TextYAlignment = Enum.TextYAlignment.Bottom,
            LayoutOrder = nextOrder(page),
        }, page)
        onTheme(function() lbl.TextColor3 = Theme.Accent end)
        return lbl
    end

    function UI.Label(page, text)
        return new("TextLabel", {
            Size = UDim2.new(1, 0, 0, 0),
            AutomaticSize = Enum.AutomaticSize.Y,
            BackgroundTransparency = 1,
            Font = Enum.Font.Gotham,
            Text = text,
            TextSize = 12,
            TextWrapped = true,
            TextColor3 = Theme.SubText,
            TextXAlignment = Enum.TextXAlignment.Left,
            LayoutOrder = nextOrder(page),
        }, page)
    end

    function UI.Toggle(page, text, key, callback)
        local holder = new("TextButton", {
            Size = UDim2.new(1, 0, 0, 38),
            BackgroundColor3 = Theme.Element,
            Text = "",
            AutoButtonColor = false,
            LayoutOrder = nextOrder(page),
        }, page)
        corner(holder, 8)

        new("TextLabel", {
            Position = UDim2.fromOffset(12, 0),
            Size = UDim2.new(1, -66, 1, 0),
            BackgroundTransparency = 1,
            Font = Enum.Font.GothamMedium,
            Text = text,
            TextSize = 13,
            TextColor3 = Theme.Text,
            TextXAlignment = Enum.TextXAlignment.Left,
            TextTruncate = Enum.TextTruncate.AtEnd,
        }, holder)

        local track = new("Frame", {
            AnchorPoint = Vector2.new(1, 0.5),
            Position = UDim2.new(1, -10, 0.5, 0),
            Size = UDim2.fromOffset(40, 21),
            BackgroundColor3 = Theme.Off,
            BorderSizePixel = 0,
        }, holder)
        corner(track, 11)
        local knob = new("Frame", {
            AnchorPoint = Vector2.new(0, 0.5),
            Position = UDim2.new(0, 3, 0.5, 0),
            Size = UDim2.fromOffset(15, 15),
            BackgroundColor3 = Color3.new(1, 1, 1),
            BorderSizePixel = 0,
        }, track)
        corner(knob, 8)

        local function render(instant)
            local state = Config[key] == true
            local time = instant and 0 or 0.18
            tween(track, time, { BackgroundColor3 = state and Theme.Accent or Theme.Off })
            tween(knob, time, { Position = state and UDim2.new(1, -18, 0.5, 0) or UDim2.new(0, 3, 0.5, 0) })
        end

        local function set(state)
            state = state == true
            Config[key] = state
            render(false)
            scheduleSave()
            if callback then
                safeCall(callback, state)
            end
        end

        connect(holder.Activated, function()
            set(not Config[key])
        end)
        onTheme(function() render(true) end)

        UI.Setters[key] = set
        return set
    end

    function UI.Slider(page, text, key, min, max, step, callback, suffix)
        suffix = suffix or ""
        local holder = new("Frame", {
            Size = UDim2.new(1, 0, 0, 54),
            BackgroundColor3 = Theme.Element,
            LayoutOrder = nextOrder(page),
        }, page)
        corner(holder, 8)

        new("TextLabel", {
            Position = UDim2.fromOffset(12, 6),
            Size = UDim2.new(1, -90, 0, 18),
            BackgroundTransparency = 1,
            Font = Enum.Font.GothamMedium,
            Text = text,
            TextSize = 13,
            TextColor3 = Theme.Text,
            TextXAlignment = Enum.TextXAlignment.Left,
        }, holder)

        local valueLabel = new("TextLabel", {
            AnchorPoint = Vector2.new(1, 0),
            Position = UDim2.new(1, -12, 0, 6),
            Size = UDim2.fromOffset(70, 18),
            BackgroundTransparency = 1,
            Font = Enum.Font.GothamBold,
            TextSize = 13,
            TextXAlignment = Enum.TextXAlignment.Right,
        }, holder)
        onTheme(function() valueLabel.TextColor3 = Theme.Accent2 end)

        local bar = new("Frame", {
            Position = UDim2.new(0, 12, 0, 36),
            Size = UDim2.new(1, -24, 0, 6),
            BackgroundColor3 = Theme.Off,
            BorderSizePixel = 0,
        }, holder)
        corner(bar, 3)
        local fill = new("Frame", {
            Size = UDim2.fromScale(0, 1),
            BackgroundColor3 = Color3.new(1, 1, 1),
            BorderSizePixel = 0,
        }, bar)
        corner(fill, 3)
        accentGradient(fill)
        local dot = new("Frame", {
            AnchorPoint = Vector2.new(0.5, 0.5),
            Position = UDim2.fromScale(0, 0.5),
            Size = UDim2.fromOffset(14, 14),
            BackgroundColor3 = Color3.new(1, 1, 1),
            BorderSizePixel = 0,
            ZIndex = 2,
        }, bar)
        corner(dot, 7)

        -- Zone de touche élargie : une barre de 6px est inutilisable au doigt
        local hitbox = new("TextButton", {
            AnchorPoint = Vector2.new(0, 0.5),
            Position = UDim2.new(0, -6, 0.5, 0),
            Size = UDim2.new(1, 12, 0, 32),
            BackgroundTransparency = 1,
            Text = "",
            ZIndex = 3,
        }, bar)

        local function render()
            local value = Config[key]
            local rel = (value - min) / (max - min)
            fill.Size = UDim2.fromScale(rel, 1)
            dot.Position = UDim2.fromScale(rel, 0.5)
            valueLabel.Text = tostring(value) .. suffix
        end

        local function set(value)
            if type(value) ~= "number" or value ~= value then return end
            value = math.clamp(math.floor(value / step + 0.5) * step, min, max)
            if Config[key] == value then return end
            Config[key] = value
            render()
            scheduleSave()
            if callback then
                safeCall(callback, value)
            end
        end

        local function fromX(x)
            local size = bar.AbsoluteSize.X
            if size <= 0 then return end
            local rel = math.clamp((x - bar.AbsolutePosition.X) / size, 0, 1)
            set(min + (max - min) * rel)
        end

        local dragging, dragInput = false, nil
        connect(hitbox.InputBegan, function(input)
            local t = input.UserInputType
            if t == Enum.UserInputType.MouseButton1 or t == Enum.UserInputType.Touch then
                dragging = true
                dragInput = input
                fromX(input.Position.X)
            end
        end)
        connect(UserInputService.InputChanged, function(input)
            if dragging and (input == dragInput or input.UserInputType == Enum.UserInputType.MouseMovement) then
                fromX(input.Position.X)
            end
        end)
        connect(UserInputService.InputEnded, function(input)
            if input == dragInput or input.UserInputType == Enum.UserInputType.MouseButton1 then
                dragging = false
            end
        end)

        render()
        UI.Setters[key] = set
        return set
    end

    -- Rangée de pastilles de couleur (valeur = index dans la liste fournie)
    function UI.ColorRow(page, text, key, colors, callback)
        local holder = new("Frame", {
            Size = UDim2.new(1, 0, 0, 0),
            AutomaticSize = Enum.AutomaticSize.Y,
            BackgroundColor3 = Theme.Element,
            LayoutOrder = nextOrder(page),
        }, page)
        corner(holder, 8)
        new("UIPadding", {
            PaddingTop = UDim.new(0, 8),
            PaddingBottom = UDim.new(0, 8),
            PaddingLeft = UDim.new(0, 12),
            PaddingRight = UDim.new(0, 12),
        }, holder)
        new("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }, holder)

        new("TextLabel", {
            Size = UDim2.new(1, 0, 0, 16),
            BackgroundTransparency = 1,
            Font = Enum.Font.GothamMedium,
            Text = text,
            TextSize = 13,
            TextColor3 = Theme.Text,
            TextXAlignment = Enum.TextXAlignment.Left,
            LayoutOrder = 1,
        }, holder)

        local row = new("Frame", {
            Size = UDim2.new(1, 0, 0, 22),
            BackgroundTransparency = 1,
            LayoutOrder = 2,
        }, holder)
        new("UIListLayout", {
            FillDirection = Enum.FillDirection.Horizontal,
            Padding = UDim.new(0, 6),
            SortOrder = Enum.SortOrder.LayoutOrder,
            VerticalAlignment = Enum.VerticalAlignment.Center,
        }, row)

        local strokes = {}
        local function render()
            for i, s in ipairs(strokes) do
                s.Transparency = (i == Config[key]) and 0 or 1
            end
        end

        local function set(index)
            if type(index) ~= "number" or not colors[index] then return end
            Config[key] = index
            render()
            scheduleSave()
            if callback then
                safeCall(callback, index)
            end
        end

        for i, color in ipairs(colors) do
            local sw = new("TextButton", {
                Size = UDim2.fromOffset(22, 22),
                BackgroundColor3 = color,
                Text = "",
                AutoButtonColor = false,
                LayoutOrder = i,
            }, row)
            corner(sw, 11)
            strokes[i] = new("UIStroke", {
                Color = Color3.new(1, 1, 1),
                Thickness = 2,
                Transparency = 1,
                ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
            }, sw)
            connect(sw.Activated, function()
                set(i)
            end)
        end

        render()
        UI.Setters[key] = set
        return set
    end

    function UI.Button(page, text, callback, color)
        local btn = new("TextButton", {
            Size = UDim2.new(1, 0, 0, 38),
            BackgroundColor3 = color or Theme.ElementHi,
            Font = Enum.Font.GothamBold,
            Text = text,
            TextSize = 13,
            TextColor3 = Theme.Text,
            AutoButtonColor = true,
            LayoutOrder = nextOrder(page),
        }, page)
        corner(btn, 8)
        connect(btn.Activated, function()
            safeCall(callback)
        end)
        return btn
    end

    --==================================================================--
    -- MODULE ESP
    -- Roblox n'affiche qu'environ 31 Highlight simultanés : on n'active que les plus proches,
    -- les entités passant toujours en priorité.
    --==================================================================--
    local MAX_HIGHLIGHTS = 28
    local ESP = { Registry = {} }
    local candidates = {}

    local function colorOf(category)
        return Palette[Config["Color_" .. category]] or Palette[9]
    end

    local function resolvePart(obj)
        if obj:IsA("BasePart") then
            return obj
        end
        if obj:IsA("Model") then
            return obj.PrimaryPart
                or obj:FindFirstChild("HumanoidRootPart")
                or obj:FindFirstChildWhichIsA("BasePart", true)
        end
        return nil
    end

    local function setEntryColor(entry, color)
        if entry.Color == color then return end
        entry.Color = color
        entry.Highlight.FillColor = color
        entry.Highlight.OutlineColor = color
        entry.Text.TextColor3 = color
    end

    function ESP.Remove(obj)
        local entry = ESP.Registry[obj]
        if not entry then return end
        ESP.Registry[obj] = nil
        if entry.Conn then entry.Conn:Disconnect() end
        pcall(function() entry.Highlight:Destroy() end)
        pcall(function() entry.Billboard:Destroy() end)
    end

    function ESP.Add(obj, category, label, part, attempt)
        if not Hub.Alive or ESP.Registry[obj] or not obj.Parent then return end

        part = (part and part.Parent and part) or resolvePart(obj)
        if not part then
            -- Modèle encore en cours d'assemblage/streaming : quelques tentatives sans bloquer
            attempt = (attempt or 0) + 1
            if attempt <= 5 then
                task.delay(0.4 * attempt, function()
                    ESP.Add(obj, category, label, nil, attempt)
                end)
            end
            return
        end

        local color = colorOf(category)

        local hl = new("Highlight", {
            Adornee = obj,
            FillColor = color,
            OutlineColor = color,
            FillTransparency = Config.EspFill / 100,
            OutlineTransparency = 0,
            DepthMode = Enum.HighlightDepthMode.AlwaysOnTop,
            Enabled = false,
        }, HighlightFolder)

        local bb = new("BillboardGui", {
            Adornee = part,
            Size = UDim2.fromOffset(160, 36),
            StudsOffset = Vector3.new(0, 2.5, 0),
            AlwaysOnTop = true,
            LightInfluence = 0,
            Enabled = false,
        }, BillboardFolder)

        local text = new("TextLabel", {
            Size = UDim2.fromScale(1, 1),
            BackgroundTransparency = 1,
            Font = Enum.Font.GothamBold,
            Text = label,
            TextSize = 13,
            TextColor3 = color,
            TextStrokeTransparency = 0.25,
            TextStrokeColor3 = Color3.new(0, 0, 0),
        }, bb)

        local entry = {
            Highlight = hl,
            Billboard = bb,
            Text = text,
            Label = label,
            Category = category,
            Part = part,
            Color = color,
            Dist = 0,
            LastText = "",
        }
        ESP.Registry[obj] = entry

        entry.Conn = obj.AncestryChanged:Connect(function()
            if not obj:IsDescendantOf(workspace) then
                ESP.Remove(obj)
            end
        end)
    end

    function ESP.Refresh()
        local root = getRoot()
        local origin = root and root.Position
        local rainbow = Config.EspRainbow and Color3.fromHSV((os.clock() * 0.15) % 1, 0.75, 1) or nil
        local showNames, showDist = Config.EspNames, Config.EspDistance
        table.clear(candidates)

        for obj, entry in pairs(ESP.Registry) do
            local part = entry.Part
            if not obj.Parent or not part.Parent then
                ESP.Remove(obj)
            else
                local dist = origin and (part.Position - origin).Magnitude or 0
                local visible = Config[entry.Category] == true and dist <= Config.EspMaxDist
                local showText = visible and (showNames or showDist)

                if entry.Billboard.Enabled ~= showText then
                    entry.Billboard.Enabled = showText
                end
                if showText then
                    local meters = math.floor(dist + 0.5)
                    local str
                    if showNames and showDist then
                        str = entry.Label .. "\n[" .. meters .. "m]"
                    elseif showNames then
                        str = entry.Label
                    else
                        str = "[" .. meters .. "m]"
                    end
                    if str ~= entry.LastText then
                        entry.LastText = str
                        entry.Text.Text = str
                    end
                end

                if visible then
                    setEntryColor(entry, rainbow or colorOf(entry.Category))
                end

                if visible and Config.EspOutline then
                    entry.Dist = (entry.Category == "EspEntities") and (dist - 1e6) or dist
                    candidates[#candidates + 1] = entry
                elseif entry.Highlight.Enabled then
                    entry.Highlight.Enabled = false
                end
            end
        end

        table.sort(candidates, function(a, b)
            return a.Dist < b.Dist
        end)
        for i, entry in ipairs(candidates) do
            local on = i <= MAX_HIGHLIGHTS
            if entry.Highlight.Enabled ~= on then
                entry.Highlight.Enabled = on
            end
        end
    end

    function ESP.ApplyFill()
        local t = Config.EspFill / 100
        for _, entry in pairs(ESP.Registry) do
            entry.Highlight.FillTransparency = t
        end
    end

    function ESP.Clear()
        for obj in pairs(ESP.Registry) do
            ESP.Remove(obj)
        end
    end
    onUnload(ESP.Clear)

    task.spawn(function()
        while Hub.Alive do
            safeCall(ESP.Refresh)
            task.wait(0.2)
        end
    end)

    --==================================================================--
    -- TABLES DE DÉTECTION DOORS (lookup O(1) par nom)
    --==================================================================--
    local Detect = {}
    local function register(category, list, extra)
        for name, label in pairs(list) do
            local d = { Label = label, Category = category, ModelOnly = true }
            if extra then
                for k, v in pairs(extra) do
                    d[k] = v
                end
            end
            Detect[name] = d
        end
    end

    register("EspKeys", {
        KeyObtain = "Clé",
        ElectricalKeyObtain = "Clé électrique",
        LeverForGate = "Levier",
        TimerLever = "Levier timer",
    })

    register("EspObjectives", {
        LiveHintBook = "Livre",
        LiveBreakerPolePickup = "Disjoncteur",
        FuseObtain = "Fusible",
        MinesAnchor = "Ancre",
        MinesGenerator = "Générateur",
        WaterPump = "Pompe",
        ElevatorBreaker = "Boîtier élec.",
    })

    register("EspItems", {
        Lighter = "Briquet", Flashlight = "Lampe torche", Lockpick = "Crochets", Lockpicks = "Crochets",
        Vitamins = "Vitamines", Bandage = "Bandage", BandagePack = "Pack bandages", Crucifix = "Crucifix",
        SkeletonKey = "Clé squelette", Battery = "Pile", BatteryPack = "Pack piles", Candle = "Bougie",
        Shears = "Cisailles", Smoothie = "Smoothie", Glowsticks = "Bâtons lumineux", Straplight = "Straplight",
        Bulklight = "Bulklight", Lantern = "Lanterne", LaserPointer = "Laser", AlarmClock = "Réveil",
        Compass = "Boussole", Multitool = "Multitool", StarVial = "Fiole étoile", StarBottle = "Bouteille étoile",
        StarJug = "Jarre étoile", Bread = "Pain", Cheese = "Fromage", RiftSmoothie = "Rift Smoothie",
        TipJar = "Tip Jar", Knockbomb = "Knockbomb", Barrier = "Barrière", Gweenbread = "Gweenbread",
        HolyGrenade = "Grenade sainte", NVCS3000 = "NVCS-3000", Donut = "Donut", ShakeLight = "Shakelight",
    }, { Loot = "item" })

    register("EspGold", { GoldPile = "Or" }, { Loot = "gold" })

    register("EspHiding", {
        Wardrobe = "Armoire", Backdoor_Wardrobe = "Armoire", Bed = "Lit", DoubleBed = "Lit",
        Rooms_Locker = "Casier", Rooms_Locker_Fridge = "Frigo", Locker_Large = "Casier",
        Dumpster = "Benne", Toolshed = "Cabane", CircularVent = "Ventilation",
    })

    register("EspContainers", {
        DrawerContainer = "Tiroir", ChestBox = "Coffre", ChestBoxLocked = "Coffre verrouillé",
        Toolbox = "Boîte à outils", Toolshed_Small = "Armoire à outils", Locker_Small = "Petit casier",
        RolltopContainer = "Bureau", Backdoor_Vault = "Coffre-fort",
    })

    register("EspEntities", {
        RushMoving = "RUSH", AmbushMoving = "AMBUSH", Eyes = "EYES", BackdoorLookman = "LOOKMAN",
        BackdoorRush = "BLITZ", SeekMoving = "SEEK", SeekMovingNewClone = "SEEK", FigureRig = "FIGURE",
        FigureRagdoll = "FIGURE", GiggleCeiling = "GIGGLE", GrumbleRig = "GRUMBLE", GloombatSwarm = "GLOOMBATS",
        A60 = "A-60", A120 = "A-120", JeffTheKiller = "JEFF", Snare = "SNARE",
    }, { ModelOnly = false, Entity = true })

    -- Entités qui méritent une alerte (Snare/Giggle sont des pièges statiques : pas d'alerte)
    local AlertEntities = {
        RUSH = "Cache-toi dans un placard !",
        AMBUSH = "Placard ! Ressors/rentre à chaque passage.",
        EYES = "Ne regarde pas Eyes !",
        LOOKMAN = "Ne le regarde pas !",
        BLITZ = "Cache-toi vite !",
        SEEK = "Cours ! Évite les mains et le feu.",
        ["A-60"] = "Cache-toi immédiatement !",
        ["A-120"] = "Cache-toi immédiatement !",
        FIGURE = "Accroupi et silencieux.",
        SCREECH = "Regarde-le pour le faire fuir !",
        HALT = "Fais demi-tour quand l'écran devient bleu.",
        GLOOMBATS = "Éteins ta lumière !",
        GRUMBLE = "Évite les Grumbles !",
        JEFF = "Jeff ! Fuis ou frappe-le.",
    }

    local EntityLog = {}
    local entityLogLabel = nil
    local lastAlert = {}

    local function alertEntity(name)
        local msg = AlertEntities[name]
        if not msg then return end
        local now = os.clock()
        -- Anti-spam : Rush/Ambush apparaissent en plusieurs instances successives
        if lastAlert[name] and now - lastAlert[name] < 6 then return end
        lastAlert[name] = now

        table.insert(EntityLog, 1, os.date("%H:%M:%S") .. "  " .. name)
        if #EntityLog > 6 then
            table.remove(EntityLog)
        end
        if entityLogLabel then
            entityLogLabel.Text = table.concat(EntityLog, "\n")
        end

        if Config.NotifyEntities then
            notify("⚠ " .. name, msg, Theme.Danger, 5)
        end
    end

    --==================================================================--
    -- PROMPTS (interaction instantanée + portée), originaux mémorisés pour restauration
    --==================================================================--
    local Prompts = { Originals = setmetatable({}, { __mode = "k" }) }
    local REACH_MULT = 1.5

    function Prompts.Apply(prompt)
        local orig = Prompts.Originals[prompt]
        if not orig then return end
        prompt.HoldDuration = Config.InstantPrompt and 0 or orig.Hold
        prompt.MaxActivationDistance = Config.PromptReach and (orig.Dist * REACH_MULT) or orig.Dist
    end

    function Prompts.Register(prompt)
        if Prompts.Originals[prompt] then return end
        Prompts.Originals[prompt] = {
            Hold = prompt.HoldDuration,
            Dist = prompt.MaxActivationDistance,
        }
        if Config.InstantPrompt or Config.PromptReach then
            Prompts.Apply(prompt)
        end
    end

    function Prompts.ApplyAll()
        for prompt in pairs(Prompts.Originals) do
            if prompt.Parent then
                pcall(Prompts.Apply, prompt)
            end
        end
    end

    onUnload(function()
        Config.InstantPrompt = false
        Config.PromptReach = false
        Prompts.ApplyAll()
    end)

    --==================================================================--
    -- AUTO-LOOT (or + objets) via fireproximityprompt
    --==================================================================--
    local LootTargets = setmetatable({}, { __mode = "k" })

    task.spawn(function()
        while Hub.Alive do
            if fireprompt and (Config.AutoGold or Config.AutoItems) then
                local root = getRoot()
                if root then
                    for model, kind in pairs(LootTargets) do
                        if not model.Parent then
                            LootTargets[model] = nil
                        elseif (kind == "gold" and Config.AutoGold) or (kind == "item" and Config.AutoItems) then
                            local prompt = model:FindFirstChildWhichIsA("ProximityPrompt", true)
                            local part = resolvePart(model)
                            if prompt and part and prompt.Enabled
                                and (part.Position - root.Position).Magnitude <= prompt.MaxActivationDistance then
                                pcall(fireprompt, prompt)
                            end
                        end
                    end
                end
            end
            task.wait(0.35)
        end
    end)

    --==================================================================--
    -- CLASSIFICATION DES INSTANCES
    --==================================================================--
    local CurrentRooms = workspace:FindFirstChild("CurrentRooms")

    local function processInstance(inst)
        if not Hub.Alive then return end

        if inst:IsA("ProximityPrompt") then
            Prompts.Register(inst)
            return
        end

        local isModel = inst:IsA("Model")
        if not (isModel or inst:IsA("BasePart")) then return end
        local name = inst.Name

        if name == "Door" and isModel and CurrentRooms and inst.Parent and inst.Parent.Parent == CurrentRooms then
            local roomNumber = tonumber(inst.Parent.Name)
            local label = roomNumber and ("Porte " .. (roomNumber + 1)) or "Porte"
            ESP.Add(inst, "EspDoors", label, inst:FindFirstChild("Door"))
            return
        end

        local d = Detect[name]
        if not d or (d.ModelOnly and not isModel) then return end

        ESP.Add(inst, d.Category, d.Label)
        if d.Loot then
            LootTargets[inst] = d.Loot
        end
        if d.Entity then
            alertEntity(d.Label)
        end
    end

    local hookedRooms = {}
    local function hookRoom(room)
        if hookedRooms[room] or not Hub.Alive then return end
        -- Connexion hors Hub.Connections : libérée dès que la salle disparaît
        hookedRooms[room] = room.DescendantAdded:Connect(processInstance)
        for _, d in ipairs(room:GetDescendants()) do
            processInstance(d)
        end
    end

    local function hookRooms()
        connect(CurrentRooms.ChildAdded, function(room)
            task.defer(hookRoom, room)
        end)
        connect(CurrentRooms.ChildRemoved, function(room)
            local c = hookedRooms[room]
            if c then
                c:Disconnect()
                hookedRooms[room] = nil
            end
        end)
        for _, room in ipairs(CurrentRooms:GetChildren()) do
            hookRoom(room)
        end
    end

    onUnload(function()
        for room, c in pairs(hookedRooms) do
            c:Disconnect()
            hookedRooms[room] = nil
        end
    end)

    if CurrentRooms then
        hookRooms()
    else
        -- Lobby / chargement : on attend la création du dossier des salles
        task.spawn(function()
            local found = workspace:WaitForChild("CurrentRooms", 120)
            if found and Hub.Alive then
                CurrentRooms = found
                hookRooms()
            end
        end)
    end

    -- Entités qui spawn directement dans workspace (Rush, Ambush, Eyes, Seek, A-60…)
    connect(workspace.ChildAdded, function(child)
        task.defer(processInstance, child)
    end)
    for _, child in ipairs(workspace:GetChildren()) do
        local d = Detect[child.Name]
        if d and d.Entity then
            processInstance(child)
        end
    end

    --==================================================================--
    -- ÉCLAIRAGE (Fullbright / No Fog) : suit les changements du jeu pour restaurer proprement
    --==================================================================--
    local LightProps = { "Ambient", "Brightness", "ClockTime", "FogEnd", "FogStart", "GlobalShadows", "OutdoorAmbient" }
    local FullbrightValues = {
        Ambient = Color3.new(1, 1, 1),
        OutdoorAmbient = Color3.new(1, 1, 1),
        Brightness = 2,
        ClockTime = 14,
        GlobalShadows = false,
    }
    local NOFOG_VALUE = 1e6
    local OriginalLighting = {}
    for _, p in ipairs(LightProps) do
        OriginalLighting[p] = Lighting[p]
    end
    local OriginalAtmos = setmetatable({}, { __mode = "k" })

    -- Vrai si la valeur vient de nous : évite d'écraser l'original avec notre propre écriture,
    -- y compris en SignalBehavior.Deferred où un simple flag ne suffit pas
    local function isOurValue(prop, value)
        if Config.Fullbright and FullbrightValues[prop] ~= nil and FullbrightValues[prop] == value then
            return true
        end
        if Config.NoFog and (prop == "FogEnd" or prop == "FogStart") and value == NOFOG_VALUE then
            return true
        end
        return false
    end

    local function applyAtmosphere()
        for _, a in ipairs(Lighting:GetChildren()) do
            if a:IsA("Atmosphere") then
                if Config.NoFog then
                    if OriginalAtmos[a] == nil then
                        OriginalAtmos[a] = a.Density
                    end
                    a.Density = 0
                elseif OriginalAtmos[a] ~= nil then
                    a.Density = OriginalAtmos[a]
                    OriginalAtmos[a] = nil
                end
            end
        end
    end

    local function applyLighting()
        for _, p in ipairs(LightProps) do
            local target = OriginalLighting[p]
            if Config.Fullbright and FullbrightValues[p] ~= nil then
                target = FullbrightValues[p]
            end
            if Config.NoFog and (p == "FogEnd" or p == "FogStart") then
                target = NOFOG_VALUE
            end
            if Lighting[p] ~= target then
                Lighting[p] = target
            end
        end
        applyAtmosphere()
    end

    for _, p in ipairs(LightProps) do
        connect(Lighting:GetPropertyChangedSignal(p), function()
            local value = Lighting[p]
            if isOurValue(p, value) then return end
            OriginalLighting[p] = value
            if Config.Fullbright or Config.NoFog then
                applyLighting()
            end
        end)
    end
    connect(Lighting.ChildAdded, function(child)
        if Config.NoFog and child:IsA("Atmosphere") then
            task.defer(applyAtmosphere)
        end
    end)
    onUnload(function()
        Config.Fullbright = false
        Config.NoFog = false
        applyLighting()
    end)

    --==================================================================--
    -- ANTI-FLOU (Blur / DepthOfField ajoutés par les entités)
    --==================================================================--
    local Effects = setmetatable({}, { __mode = "k" })
    local DisabledEffects = setmetatable({}, { __mode = "k" })

    local function trackEffect(inst)
        if inst:IsA("BlurEffect") or inst:IsA("DepthOfFieldEffect") then
            Effects[inst] = true
        end
    end
    for _, d in ipairs(Lighting:GetDescendants()) do
        trackEffect(d)
    end
    connect(Lighting.DescendantAdded, trackEffect)

    local function restoreEffects()
        for eff in pairs(DisabledEffects) do
            if eff.Parent then
                eff.Enabled = true
            end
            DisabledEffects[eff] = nil
        end
    end
    onUnload(restoreEffects)

    task.spawn(function()
        while Hub.Alive do
            if Config.AntiBlur then
                for eff in pairs(Effects) do
                    if eff.Parent and eff.Enabled then
                        DisabledEffects[eff] = true
                        eff.Enabled = false
                    end
                end
            end
            task.wait(0.25)
        end
    end)

    --==================================================================--
    -- CAMÉRA : Screech / Halt (injectés côté client) + effets + dossier des Highlights
    --==================================================================--
    local cameraConn
    local function hookCamera(cam)
        if cameraConn then
            cameraConn:Disconnect()
            cameraConn = nil
        end
        if not cam then return end
        HighlightFolder.Parent = cam
        for _, c in ipairs(cam:GetChildren()) do
            trackEffect(c)
        end
        cameraConn = cam.ChildAdded:Connect(function(child)
            trackEffect(child)
            local n = child.Name
            if n == "Screech" then
                alertEntity("SCREECH")
                if Config.AntiScreech then
                    task.defer(function()
                        pcall(function() child:Destroy() end)
                    end)
                end
            elseif n == "Shade" or n == "Halt" then
                alertEntity("HALT")
            end
        end)
    end
    hookCamera(workspace.CurrentCamera)
    connect(workspace:GetPropertyChangedSignal("CurrentCamera"), function()
        hookCamera(workspace.CurrentCamera)
    end)
    onUnload(function()
        if cameraConn then cameraConn:Disconnect() end
    end)

    --==================================================================--
    -- ESP JOUEURS
    --==================================================================--
    local function hookPlayer(player)
        if player == LocalPlayer then return end
        local function onChar(char)
            local root = char:WaitForChild("HumanoidRootPart", 10)
            if root and char.Parent and Hub.Alive then
                ESP.Add(char, "EspPlayers", player.DisplayName, root)
            end
        end
        connect(player.CharacterAdded, onChar)
        if player.Character then
            task.spawn(onChar, player.Character)
        end
    end
    for _, p in ipairs(Players:GetPlayers()) do
        hookPlayer(p)
    end
    connect(Players.PlayerAdded, hookPlayer)

    --==================================================================--
    -- VITESSE / SAUT / FOV
    --==================================================================--
    local DefaultWalkSpeed = nil
    local DefaultJump = nil

    connect(RunService.Heartbeat, function()
        local hum = getHumanoid()
        if not hum or hum.Health <= 0 then return end

        if Config.SpeedEnabled and hum.WalkSpeed ~= Config.Speed then
            hum.WalkSpeed = Config.Speed
        end

        if Config.JumpEnabled then
            if hum.UseJumpPower then
                if hum.JumpPower < 40 then hum.JumpPower = 45 end
            elseif hum.JumpHeight < 5 then
                hum.JumpHeight = 6
            end
            local char = hum.Parent
            if char and char:GetAttribute("CanJump") == false then
                char:SetAttribute("CanJump", true)
            end
        end
    end)

    local function setSpeed(state)
        local hum = getHumanoid()
        if not hum then return end
        if state then
            DefaultWalkSpeed = DefaultWalkSpeed or hum.WalkSpeed
        elseif DefaultWalkSpeed then
            hum.WalkSpeed = DefaultWalkSpeed
            DefaultWalkSpeed = nil
        end
    end

    local function setJump(state)
        local hum = getHumanoid()
        if not hum then return end
        if state then
            if not DefaultJump then
                DefaultJump = {
                    Power = hum.JumpPower,
                    Height = hum.JumpHeight,
                    Attr = hum.Parent and hum.Parent:GetAttribute("CanJump"),
                }
            end
            hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, true)
        elseif DefaultJump then
            hum.JumpPower = DefaultJump.Power
            hum.JumpHeight = DefaultJump.Height
            if hum.Parent and DefaultJump.Attr ~= nil then
                hum.Parent:SetAttribute("CanJump", DefaultJump.Attr)
            end
            DefaultJump = nil
        end
    end

    -- Après une mort, les valeurs d'origine appartiennent à l'ancien Humanoid : on les oublie
    connect(LocalPlayer.CharacterAdded, function()
        DefaultWalkSpeed = nil
        DefaultJump = nil
        task.wait(1)
        if Hub.Alive and Config.JumpEnabled then
            setJump(true)
        end
    end)

    local FOV_BIND = randomName()
    local fovBound = false
    local function setFov(state)
        if state and not fovBound then
            fovBound = true
            -- Priorité juste après la caméra du jeu, sinon DOORS réécrase le FOV à chaque frame
            RunService:BindToRenderStep(FOV_BIND, Enum.RenderPriority.Camera.Value + 1, function()
                local cam = workspace.CurrentCamera
                if cam then
                    cam.FieldOfView = Config.Fov
                end
            end)
        elseif not state and fovBound then
            fovBound = false
            pcall(function()
                RunService:UnbindFromRenderStep(FOV_BIND)
            end)
            local cam = workspace.CurrentCamera
            if cam then
                cam.FieldOfView = 70
            end
        end
    end

    onUnload(function()
        Config.SpeedEnabled = false
        setSpeed(false)
        Config.JumpEnabled = false
        setJump(false)
        Config.FovEnabled = false
        setFov(false)
    end)

    --==================================================================--
    -- CONSTRUCTION DES ONGLETS
    --==================================================================--
    local function espToggle(page, text, key)
        UI.Toggle(page, text, key, function() ESP.Refresh() end)
    end

    -- ESP ---------------------------------------------------------------
    local EspTab = UI.Tab("ESP", "👁")
    UI.Section(EspTab, "Progression")
    espToggle(EspTab, "Portes", "EspDoors")
    espToggle(EspTab, "Clés & Leviers", "EspKeys")
    espToggle(EspTab, "Objectifs (livres, disjoncteurs…)", "EspObjectives")
    UI.Section(EspTab, "Butin")
    espToggle(EspTab, "Objets", "EspItems")
    espToggle(EspTab, "Or", "EspGold")
    espToggle(EspTab, "Tiroirs & Coffres", "EspContainers")
    UI.Section(EspTab, "Survie")
    espToggle(EspTab, "Cachettes (armoires, lits…)", "EspHiding")
    espToggle(EspTab, "Entités", "EspEntities")
    espToggle(EspTab, "Joueurs", "EspPlayers")
    UI.Section(EspTab, "Affichage")
    espToggle(EspTab, "Contours (Highlight)", "EspOutline")
    espToggle(EspTab, "Noms", "EspNames")
    espToggle(EspTab, "Distance", "EspDistance")
    espToggle(EspTab, "Mode arc-en-ciel", "EspRainbow")
    UI.Slider(EspTab, "Transparence remplissage", "EspFill", 0, 100, 5, function() ESP.ApplyFill() end, "%")
    UI.Slider(EspTab, "Distance max", "EspMaxDist", 25, 1000, 25, function() ESP.Refresh() end, "m")

    -- MONDE -------------------------------------------------------------
    local WorldTab = UI.Tab("Monde", "🌙")
    UI.Section(WorldTab, "Lumière")
    UI.Toggle(WorldTab, "Fullbright", "Fullbright", function() applyLighting() end)
    UI.Toggle(WorldTab, "Supprimer le brouillard", "NoFog", function() applyLighting() end)
    UI.Toggle(WorldTab, "Anti-flou (effets d'écran)", "AntiBlur", function(state)
        if not state then restoreEffects() end
    end)

    -- JOUEUR ------------------------------------------------------------
    local PlayerTab = UI.Tab("Joueur", "🏃")
    UI.Section(PlayerTab, "Mouvement")
    UI.Toggle(PlayerTab, "Speed Boost", "SpeedEnabled", setSpeed)
    UI.Slider(PlayerTab, "Vitesse", "Speed", 15, 30, 1)
    UI.Label(PlayerTab, "Au-delà de ~22 l'anti-cheat de DOORS peut te ramener en arrière.")
    UI.Toggle(PlayerTab, "Activer le saut", "JumpEnabled", setJump)
    UI.Section(PlayerTab, "Caméra")
    UI.Toggle(PlayerTab, "FOV personnalisé", "FovEnabled", setFov)
    UI.Slider(PlayerTab, "Champ de vision", "Fov", 70, 120, 1, nil, "°")

    -- ENTITÉS -----------------------------------------------------------
    local EntityTab = UI.Tab("Entités", "👹")
    UI.Section(EntityTab, "Détection")
    espToggle(EntityTab, "ESP Entités", "EspEntities")
    UI.Toggle(EntityTab, "Alertes d'entités", "NotifyEntities")
    UI.Section(EntityTab, "Protection")
    UI.Toggle(EntityTab, "Anti-Screech", "AntiScreech")
    UI.Section(EntityTab, "Historique")
    entityLogLabel = UI.Label(EntityTab, "Aucune entité détectée pour l'instant.")
    if #EntityLog > 0 then
        entityLogLabel.Text = table.concat(EntityLog, "\n")
    end

    -- AUTO --------------------------------------------------------------
    local AutoTab = UI.Tab("Auto", "⚡")
    UI.Section(AutoTab, "Interactions")
    UI.Toggle(AutoTab, "Interaction instantanée", "InstantPrompt", function() Prompts.ApplyAll() end)
    UI.Toggle(AutoTab, "Portée d'interaction x1.5", "PromptReach", function() Prompts.ApplyAll() end)
    UI.Section(AutoTab, "Ramassage")
    local function lootWarn(state)
        if state and not fireprompt then
            notify("Abyss", "fireproximityprompt indisponible sur cet exécuteur.", Theme.Danger, 4)
        end
    end
    UI.Toggle(AutoTab, "Auto-ramassage de l'or", "AutoGold", lootWarn)
    UI.Toggle(AutoTab, "Auto-ramassage des objets", "AutoItems", lootWarn)

    -- COULEURS ----------------------------------------------------------
    local ColorTab = UI.Tab("Couleurs", "🎨")
    UI.Section(ColorTab, "Thème de l'interface")
    local themeSwatches = {}
    for i, preset in ipairs(ThemePresets) do
        themeSwatches[i] = preset[1]
    end
    UI.ColorRow(ColorTab, "Couleur d'accent", "ThemeIndex", themeSwatches, applyTheme)
    UI.Section(ColorTab, "Couleurs ESP")
    local function colorRow(text, category)
        UI.ColorRow(ColorTab, text, "Color_" .. category, Palette, function() ESP.Refresh() end)
    end
    colorRow("Portes", "EspDoors")
    colorRow("Clés & Leviers", "EspKeys")
    colorRow("Objectifs", "EspObjectives")
    colorRow("Objets", "EspItems")
    colorRow("Or", "EspGold")
    colorRow("Tiroirs & Coffres", "EspContainers")
    colorRow("Cachettes", "EspHiding")
    colorRow("Entités", "EspEntities")
    colorRow("Joueurs", "EspPlayers")

    -- RÉGLAGES ----------------------------------------------------------
    local SettingsTab = UI.Tab("Réglages", "⚙")
    UI.Section(SettingsTab, "Partie")
    local roomLabel = UI.Label(SettingsTab, "Salle : —")
    task.spawn(function()
        local gameData = ReplicatedStorage:WaitForChild("GameData", 30)
        local latest = gameData and gameData:WaitForChild("LatestRoom", 10)
        if not latest or not Hub.Alive then return end
        local function upd()
            roomLabel.Text = "Salle : " .. tostring(latest.Value)
        end
        upd()
        connect(latest.Changed, upd)
    end)

    UI.Section(SettingsTab, "Interface")
    UI.Slider(SettingsTab, "Taille de l'interface", "UiScale", 60, 140, 5, updateScale, "%")
    UI.Label(SettingsTab, "Bouton « A » : tap pour ouvrir/fermer, glisse pour déplacer. PC : Shift droit.")
    UI.Label(SettingsTab, canSave and "Configuration sauvegardée automatiquement." or "Sauvegarde indisponible sur cet exécuteur.")
    UI.Button(SettingsTab, "Réinitialiser les réglages", function()
        for key, value in pairs(Defaults) do
            local setter = UI.Setters[key]
            if setter and Config[key] ~= value then
                setter(value)
            end
        end
        notify("Abyss", "Réglages réinitialisés.", Theme.Accent, 3)
    end)
    UI.Button(SettingsTab, "Décharger Abyss", function()
        Hub.Unload()
    end, Color3.fromRGB(120, 35, 50))

    --==================================================================--
    -- RESTAURATION DE LA CONFIG (via les setters : valeurs bornées + effets réellement appliqués)
    --==================================================================--
    if Saved then
        loadingSave = true
        for key, default in pairs(Defaults) do
            local value = Saved[key]
            local setter = UI.Setters[key]
            if setter and value ~= nil and type(value) == type(default) and value ~= Config[key] then
                safeCall(setter, value)
            end
        end
        loadingSave = false
    end

    ESP.Refresh()
    notify("ABYSS HUB", "Chargé avec succès. Bonne chance dans l'hôtel.", Theme.Accent, 4)
end

local ok, err = xpcall(Main, function(e)
    return tostring(e) .. "\n" .. debug.traceback()
end)

if not ok then
    warn("[Abyss] Échec du chargement :\n" .. tostring(err))
    sysNotify("ABYSS : ERREUR", string.sub(tostring(err), 1, 180), 15)
    -- Nettoyage complet pour qu'une relance reparte de zéro
    local hub = genv.AbyssHub
    if hub and type(hub.Unload) == "function" then
        pcall(hub.Unload)
    end
end
