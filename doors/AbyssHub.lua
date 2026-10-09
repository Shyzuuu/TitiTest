--[[
    ▄▀█ █▄▄ █▄█ █▀ █▀
    █▀█ █▄█ ░█░ ▄█ ▄█   ABYSS HUB // DOORS

    Cible    : Roblox DOORS (Hotel+, Mines, Backdoor)
    Exécuteur: Delta Android (UNC standard), compatible PC
    UI       : 100 % maison, aucun loadstring externe (rien ne peut casser côté réseau)
]]

if not game:IsLoaded() then
    game.Loaded:Wait()
end

local genv = (typeof(getgenv) == "function" and getgenv()) or _G

-- Ré-exécution : on décharge proprement l'instance précédente au lieu de dupliquer UI + connexions
if genv.AbyssHub and type(genv.AbyssHub.Unload) == "function" then
    pcall(genv.AbyssHub.Unload)
end

-- Notification native Roblox : visible même si notre propre UI ne peut pas se créer
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
local Players                = game:GetService("Players")
local RunService             = game:GetService("RunService")
local UserInputService       = game:GetService("UserInputService")
local TweenService           = game:GetService("TweenService")
local Lighting               = game:GetService("Lighting")
local ReplicatedStorage      = game:GetService("ReplicatedStorage")
local CoreGui                = game:GetService("CoreGui")

local LocalPlayer = Players.LocalPlayer
local fireprompt  = (typeof(fireproximityprompt) == "function") and fireproximityprompt or nil

--==================================================================--
-- ÉTAT GLOBAL
--==================================================================--
local Hub = { Alive = true, Connections = {} }
genv.AbyssHub = Hub

local Config = {
    -- Visuels
    EspDoors      = false,
    EspKeys       = false,
    EspObjectives = false,
    EspItems      = false,
    EspGold       = false,
    EspPlayers    = false,
    Fullbright    = false,
    NoFog         = false,
    -- Joueur
    SpeedEnabled  = false,
    Speed         = 20,
    FovEnabled    = false,
    Fov           = 90,
    -- Entités
    EspEntities   = false,
    NotifyEntities = true,
    -- Auto
    InstantPrompt = false,
    PromptReach   = false,
    AutoGold      = false,
}

local Theme = {
    Background = Color3.fromRGB(14, 12, 22),
    Sidebar    = Color3.fromRGB(20, 17, 32),
    Element    = Color3.fromRGB(28, 24, 44),
    ElementHi  = Color3.fromRGB(38, 33, 60),
    Accent     = Color3.fromRGB(150, 90, 255),
    Accent2    = Color3.fromRGB(70, 200, 255),
    Text       = Color3.fromRGB(235, 232, 245),
    SubText    = Color3.fromRGB(150, 145, 175),
    Off        = Color3.fromRGB(55, 50, 75),

    Door       = Color3.fromRGB(80, 200, 255),
    Key        = Color3.fromRGB(255, 220, 60),
    Objective  = Color3.fromRGB(120, 255, 140),
    Item       = Color3.fromRGB(200, 140, 255),
    Gold       = Color3.fromRGB(255, 180, 40),
    Entity     = Color3.fromRGB(255, 60, 60),
    Player     = Color3.fromRGB(255, 255, 255),
}

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

local function getCharacter()
    return LocalPlayer.Character
end

local function getHumanoid()
    local char = getCharacter()
    return char and char:FindFirstChildOfClass("Humanoid")
end

local function getRoot()
    local char = getCharacter()
    return char and char:FindFirstChild("HumanoidRootPart")
end

--==================================================================--
-- CONTENEUR UI (gethui > CoreGui > PlayerGui selon ce que Delta autorise)
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
    -- Certains gethui() mobiles renvoient une instance hors DataModel : l'UI y existe mais n'est jamais rendue
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

local GuiParent = resolveGuiParent()

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

local function stroke(parent, color, thickness, transparency)
    return new("UIStroke", {
        Color = color or Theme.Accent,
        Thickness = thickness or 1,
        Transparency = transparency or 0.5,
        ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
    }, parent)
end

local function tween(inst, time, props)
    local t = TweenService:Create(inst, TweenInfo.new(time, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), props)
    t:Play()
    return t
end

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

-- Filet de sécurité : si le conteneur choisi rejette/supprime l'UI, on bascule sur PlayerGui
if not ScreenGui:IsDescendantOf(game) then
    ScreenGui.Parent = LocalPlayer:WaitForChild("PlayerGui")
end

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
    notifOrder = notifOrder + 1
    local card = new("Frame", {
        Size = UDim2.fromOffset(230, 54),
        BackgroundColor3 = Theme.Background,
        BackgroundTransparency = 1,
        LayoutOrder = notifOrder,
    }, NotifHolder)
    corner(card, 8)
    local s = stroke(card, color or Theme.Accent, 1.5, 1)
    local bar = new("Frame", {
        Size = UDim2.new(0, 3, 1, -12),
        Position = UDim2.fromOffset(6, 6),
        BackgroundColor3 = color or Theme.Accent,
        BorderSizePixel = 0,
        BackgroundTransparency = 1,
    }, card)
    corner(bar, 2)
    local t1 = new("TextLabel", {
        Position = UDim2.fromOffset(16, 6),
        Size = UDim2.new(1, -22, 0, 18),
        BackgroundTransparency = 1,
        Font = Enum.Font.GothamBold,
        Text = title,
        TextSize = 14,
        TextColor3 = color or Theme.Accent,
        TextXAlignment = Enum.TextXAlignment.Left,
        TextTransparency = 1,
    }, card)
    local t2 = new("TextLabel", {
        Position = UDim2.fromOffset(16, 25),
        Size = UDim2.new(1, -22, 0, 22),
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
-- DRAG (souris + tactile). Retourne une fonction "a-t-on glissé ?" pour distinguer tap/drag
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
    Size = UDim2.fromOffset(460, 300),
    BackgroundColor3 = Theme.Background,
    BorderSizePixel = 0,
    ClipsDescendants = true,
}, ScreenGui)
corner(Main, 12)
stroke(Main, Theme.Accent, 1.5, 0.35)

-- Mise à l'échelle auto : petit écran Android → fenêtre réduite, tablette/PC → taille normale
local MainScale = new("UIScale", { Scale = 1 }, Main)
local function updateScale()
    local cam = workspace.CurrentCamera
    if not cam then return end
    local vp = cam.ViewportSize
    MainScale.Scale = math.clamp(math.min(vp.X / 620, vp.Y / 400), 0.65, 1.15)
end
updateScale()
if workspace.CurrentCamera then
    connect(workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"), updateScale)
end

local TopBar = new("Frame", {
    Size = UDim2.new(1, 0, 0, 38),
    BackgroundColor3 = Theme.Sidebar,
    BorderSizePixel = 0,
}, Main)

local Title = new("TextLabel", {
    Position = UDim2.fromOffset(14, 0),
    Size = UDim2.new(0, 120, 1, 0),
    BackgroundTransparency = 1,
    Font = Enum.Font.GothamBlack,
    Text = "ABYSS",
    TextSize = 20,
    TextColor3 = Color3.new(1, 1, 1),
    TextXAlignment = Enum.TextXAlignment.Left,
}, TopBar)
new("UIGradient", {
    Color = ColorSequence.new(Theme.Accent, Theme.Accent2),
}, Title)

new("TextLabel", {
    Position = UDim2.fromOffset(86, 0),
    Size = UDim2.new(0, 200, 1, 0),
    BackgroundTransparency = 1,
    Font = Enum.Font.GothamMedium,
    Text = "// DOORS",
    TextSize = 13,
    TextColor3 = Theme.SubText,
    TextXAlignment = Enum.TextXAlignment.Left,
}, TopBar)

local CloseBtn = new("TextButton", {
    AnchorPoint = Vector2.new(1, 0.5),
    Position = UDim2.new(1, -8, 0.5, 0),
    Size = UDim2.fromOffset(26, 26),
    BackgroundColor3 = Theme.Element,
    Font = Enum.Font.GothamBold,
    Text = "–",
    TextSize = 16,
    TextColor3 = Theme.Text,
    AutoButtonColor = false,
}, TopBar)
corner(CloseBtn, 6)

makeDraggable(TopBar, Main)

local Sidebar = new("Frame", {
    Position = UDim2.fromOffset(0, 38),
    Size = UDim2.new(0, 112, 1, -38),
    BackgroundColor3 = Theme.Sidebar,
    BorderSizePixel = 0,
}, Main)
new("UIListLayout", {
    Padding = UDim.new(0, 4),
    SortOrder = Enum.SortOrder.LayoutOrder,
    HorizontalAlignment = Enum.HorizontalAlignment.Center,
}, Sidebar)
new("UIPadding", { PaddingTop = UDim.new(0, 8) }, Sidebar)

local PageHolder = new("Frame", {
    Position = UDim2.fromOffset(112, 38),
    Size = UDim2.new(1, -112, 1, -38),
    BackgroundTransparency = 1,
}, Main)

--==================================================================--
-- BOUTON FLOTTANT (ouvrir/fermer, déplaçable au doigt)
--==================================================================--
local FloatBtn = new("TextButton", {
    AnchorPoint = Vector2.new(0.5, 0.5),
    Position = UDim2.new(0, 50, 0.35, 0),
    Size = UDim2.fromOffset(48, 48),
    BackgroundColor3 = Theme.Background,
    Font = Enum.Font.GothamBlack,
    Text = "A",
    TextSize = 22,
    TextColor3 = Color3.new(1, 1, 1),
    AutoButtonColor = false,
}, ScreenGui)
corner(FloatBtn, 24)
stroke(FloatBtn, Theme.Accent, 2, 0.1)
new("UIGradient", { Color = ColorSequence.new(Theme.Accent, Theme.Accent2), Rotation = 45 }, FloatBtn)
local floatDragged = makeDraggable(FloatBtn, FloatBtn)

local function setMainVisible(state)
    Main.Visible = state
end

connect(FloatBtn.Activated, function()
    if floatDragged() then return end
    setMainVisible(not Main.Visible)
end)
connect(CloseBtn.Activated, function()
    setMainVisible(false)
end)

--==================================================================--
-- MINI LIBRAIRIE D'ÉLÉMENTS
--==================================================================--
local UI = { Tabs = {}, Pages = {} }

function UI.Tab(name, icon)
    local index = #UI.Tabs + 1

    local btn = new("TextButton", {
        Size = UDim2.new(1, -14, 0, 32),
        BackgroundColor3 = Theme.Element,
        BackgroundTransparency = 1,
        Font = Enum.Font.GothamBold,
        Text = "  " .. icon .. "  " .. name,
        TextSize = 13,
        TextColor3 = Theme.SubText,
        TextXAlignment = Enum.TextXAlignment.Left,
        AutoButtonColor = false,
        LayoutOrder = index,
    }, Sidebar)
    corner(btn, 6)

    local page = new("ScrollingFrame", {
        Size = UDim2.fromScale(1, 1),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
        ScrollBarThickness = 3,
        ScrollBarImageColor3 = Theme.Accent,
        CanvasSize = UDim2.new(),
        AutomaticCanvasSize = Enum.AutomaticSize.Y,
        ScrollingDirection = Enum.ScrollingDirection.Y,
        Visible = false,
    }, PageHolder)
    new("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }, page)
    new("UIPadding", {
        PaddingTop = UDim.new(0, 8),
        PaddingBottom = UDim.new(0, 8),
        PaddingLeft = UDim.new(0, 8),
        PaddingRight = UDim.new(0, 10),
    }, page)

    UI.Tabs[index] = btn
    UI.Pages[index] = page

    local function select()
        for i, b in ipairs(UI.Tabs) do
            local active = (i == index)
            UI.Pages[i].Visible = active
            tween(b, 0.2, {
                BackgroundTransparency = active and 0 or 1,
                TextColor3 = active and Theme.Text or Theme.SubText,
            })
        end
    end
    connect(btn.Activated, select)
    if index == 1 then
        select()
    end

    page:SetAttribute("Order", 0)
    return page
end

local function nextOrder(page)
    local o = (page:GetAttribute("Order") or 0) + 1
    page:SetAttribute("Order", o)
    return o
end

function UI.Section(page, text)
    new("TextLabel", {
        Size = UDim2.new(1, 0, 0, 20),
        BackgroundTransparency = 1,
        Font = Enum.Font.GothamBlack,
        Text = string.upper(text),
        TextSize = 11,
        TextColor3 = Theme.Accent,
        TextXAlignment = Enum.TextXAlignment.Left,
        LayoutOrder = nextOrder(page),
    }, page)
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
        Size = UDim2.new(1, 0, 0, 36),
        BackgroundColor3 = Theme.Element,
        Text = "",
        AutoButtonColor = false,
        LayoutOrder = nextOrder(page),
    }, page)
    corner(holder, 8)

    new("TextLabel", {
        Position = UDim2.fromOffset(12, 0),
        Size = UDim2.new(1, -64, 1, 0),
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
        Size = UDim2.fromOffset(38, 20),
        BackgroundColor3 = Theme.Off,
        BorderSizePixel = 0,
    }, holder)
    corner(track, 10)
    local knob = new("Frame", {
        AnchorPoint = Vector2.new(0, 0.5),
        Position = UDim2.new(0, 3, 0.5, 0),
        Size = UDim2.fromOffset(14, 14),
        BackgroundColor3 = Color3.new(1, 1, 1),
        BorderSizePixel = 0,
    }, track)
    corner(knob, 7)

    local function render(state, instant)
        local time = instant and 0 or 0.2
        tween(track, time, { BackgroundColor3 = state and Theme.Accent or Theme.Off })
        tween(knob, time, { Position = state and UDim2.new(1, -17, 0.5, 0) or UDim2.new(0, 3, 0.5, 0) })
    end

    local function set(state)
        Config[key] = state
        render(state)
        if callback then
            safeCall(callback, state)
        end
    end

    connect(holder.Activated, function()
        set(not Config[key])
    end)
    render(Config[key], true)

    return set
end

function UI.Slider(page, text, key, min, max, step, callback)
    local holder = new("Frame", {
        Size = UDim2.new(1, 0, 0, 52),
        BackgroundColor3 = Theme.Element,
        LayoutOrder = nextOrder(page),
    }, page)
    corner(holder, 8)

    new("TextLabel", {
        Position = UDim2.fromOffset(12, 6),
        Size = UDim2.new(1, -80, 0, 18),
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
        Size = UDim2.fromOffset(60, 18),
        BackgroundTransparency = 1,
        Font = Enum.Font.GothamBold,
        Text = tostring(Config[key]),
        TextSize = 13,
        TextColor3 = Theme.Accent2,
        TextXAlignment = Enum.TextXAlignment.Right,
    }, holder)

    local bar = new("Frame", {
        Position = UDim2.new(0, 12, 0, 34),
        Size = UDim2.new(1, -24, 0, 6),
        BackgroundColor3 = Theme.Off,
        BorderSizePixel = 0,
    }, holder)
    corner(bar, 3)
    local fill = new("Frame", {
        Size = UDim2.fromScale(0, 1),
        BackgroundColor3 = Theme.Accent,
        BorderSizePixel = 0,
    }, bar)
    corner(fill, 3)
    new("UIGradient", { Color = ColorSequence.new(Theme.Accent, Theme.Accent2) }, fill)

    -- Zone de touche élargie : une barre de 6px est inutilisable au doigt
    local hitbox = new("TextButton", {
        AnchorPoint = Vector2.new(0, 0.5),
        Position = UDim2.new(0, 0, 0.5, 0),
        Size = UDim2.new(1, 0, 0, 28),
        BackgroundTransparency = 1,
        Text = "",
    }, bar)

    local decimals = 0
    if step < 1 then
        decimals = math.max(0, math.ceil(-math.log10(step)))
    end
    local fmt = "%." .. decimals .. "f"

    local function render(value)
        fill.Size = UDim2.fromScale((value - min) / (max - min), 1)
        valueLabel.Text = string.format(fmt, value)
    end

    local function set(value)
        value = math.clamp(math.floor(value / step + 0.5) * step, min, max)
        if Config[key] == value then return end
        Config[key] = value
        render(value)
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

    render(Config[key])
    return set
end

function UI.Button(page, text, callback, color)
    local btn = new("TextButton", {
        Size = UDim2.new(1, 0, 0, 36),
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
-- MODULE ESP (Highlight + Billboard, un seul ticker throttlé pour les distances)
--==================================================================--
local ESP = { Registry = {} }

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

function ESP.Remove(obj)
    local entry = ESP.Registry[obj]
    if not entry then return end
    ESP.Registry[obj] = nil
    if entry.Conn then entry.Conn:Disconnect() end
    if entry.Highlight then entry.Highlight:Destroy() end
    if entry.Billboard then entry.Billboard:Destroy() end
end

function ESP.Add(obj, category, label, color, part, attempt)
    if not Hub.Alive or ESP.Registry[obj] or not obj.Parent then return end

    part = (part and part.Parent and part) or resolvePart(obj)
    if not part then
        -- Modèles streamés/assemblés après création : on retente quelques fois sans bloquer
        attempt = (attempt or 0) + 1
        if attempt <= 4 then
            task.delay(0.5 * attempt, function()
                ESP.Add(obj, category, label, color, nil, attempt)
            end)
        end
        return
    end

    local enabled = Config[category] == true

    local hl = new("Highlight", {
        Adornee = obj,
        FillColor = color,
        OutlineColor = color,
        FillTransparency = 0.7,
        OutlineTransparency = 0,
        DepthMode = Enum.HighlightDepthMode.AlwaysOnTop,
        Enabled = enabled,
    }, obj)

    local bb = new("BillboardGui", {
        Adornee = part,
        Size = UDim2.fromOffset(140, 32),
        StudsOffset = Vector3.new(0, 2.5, 0),
        AlwaysOnTop = true,
        LightInfluence = 0,
        MaxDistance = 1000,
        Enabled = enabled,
    }, part)

    local text = new("TextLabel", {
        Size = UDim2.fromScale(1, 1),
        BackgroundTransparency = 1,
        Font = Enum.Font.GothamBold,
        Text = label,
        TextSize = 13,
        TextColor3 = color,
        TextStrokeTransparency = 0.3,
        TextStrokeColor3 = Color3.new(0, 0, 0),
    }, bb)

    local entry = {
        Highlight = hl,
        Billboard = bb,
        Text = text,
        Label = label,
        Category = category,
        Part = part,
    }
    ESP.Registry[obj] = entry

    entry.Conn = obj.AncestryChanged:Connect(function()
        if not obj:IsDescendantOf(workspace) then
            ESP.Remove(obj)
        end
    end)
end

function ESP.SetCategory(category, state)
    for _, entry in pairs(ESP.Registry) do
        if entry.Category == category then
            entry.Highlight.Enabled = state
            entry.Billboard.Enabled = state
        end
    end
end

function ESP.Clear()
    for obj in pairs(ESP.Registry) do
        ESP.Remove(obj)
    end
end

-- Mise à jour des distances à 5 Hz : inutile de le faire à chaque frame
task.spawn(function()
    while Hub.Alive do
        local root = getRoot()
        local origin = root and root.Position
        for obj, entry in pairs(ESP.Registry) do
            local part = entry.Part
            if not part or not part.Parent then
                ESP.Remove(obj)
            elseif entry.Billboard.Enabled then
                if origin then
                    local dist = (part.Position - origin).Magnitude
                    entry.Text.Text = string.format("%s\n[%dm]", entry.Label, math.floor(dist + 0.5))
                else
                    entry.Text.Text = entry.Label
                end
            end
        end
        task.wait(0.2)
    end
end)

--==================================================================--
-- TABLES DE DÉTECTION DOORS (lookup O(1) par nom)
--==================================================================--
local ObjectiveNames = {
    KeyObtain             = { "Clé", "EspKeys", Theme.Key },
    ElectricalKeyObtain   = { "Clé électrique", "EspKeys", Theme.Key },
    LeverForGate          = { "Levier", "EspKeys", Theme.Key },
    FuseObtain            = { "Fusible", "EspObjectives", Theme.Objective },
    LiveHintBook          = { "Livre", "EspObjectives", Theme.Objective },
    LiveBreakerPolePickup = { "Disjoncteur", "EspObjectives", Theme.Objective },
    MinesAnchor           = { "Ancre", "EspObjectives", Theme.Objective },
    MinesGenerator        = { "Générateur", "EspObjectives", Theme.Objective },
    TimerLever            = { "Levier timer", "EspObjectives", Theme.Objective },
}

local ItemNames = {
    Lighter       = "Briquet",
    Flashlight    = "Lampe torche",
    Lockpick      = "Crochets",
    Lockpicks     = "Crochets",
    Vitamins      = "Vitamines",
    Bandage       = "Bandage",
    BandagePack   = "Pack bandages",
    Crucifix      = "Crucifix",
    SkeletonKey   = "Clé squelette",
    Battery       = "Pile",
    BatteryPack   = "Pack piles",
    Candle        = "Bougie",
    Shears        = "Cisailles",
    Smoothie      = "Smoothie",
    Glowsticks    = "Bâtons lumineux",
    Straplight    = "Straplight",
    Bulklight     = "Bulklight",
    Lantern       = "Lanterne",
    LaserPointer  = "Laser",
    AlarmClock    = "Réveil",
    Compass       = "Boussole",
    Multitool     = "Multitool",
    StarVial      = "Fiole étoile",
    StarBottle    = "Bouteille étoile",
    StarJug       = "Jarre étoile",
    Bread         = "Pain",
    Cheese        = "Fromage",
    RiftSmoothie  = "Rift Smoothie",
    TipJar        = "Tip Jar",
    Knockbomb     = "Knockbomb",
    Barrier       = "Barrière",
}

local EntityNames = {
    RushMoving         = "RUSH",
    AmbushMoving       = "AMBUSH",
    Eyes               = "EYES",
    BackdoorLookman    = "LOOKMAN",
    BackdoorRush       = "BLITZ",
    SeekMoving         = "SEEK",
    SeekMovingNewClone = "SEEK",
    FigureRig          = "FIGURE",
    FigureRagdoll      = "FIGURE",
    GiggleCeiling      = "GIGGLE",
    GrumbleRig         = "GRUMBLE",
    GloombatSwarm      = "GLOOMBATS",
    A60                = "A-60",
    A120               = "A-120",
    JeffTheKiller      = "JEFF",
    Snare              = "SNARE",
}

-- Entités qui méritent une alerte (Snare/Giggle sont des assets statiques : pas d'alerte)
local AlertEntities = {
    RUSH = "Cache-toi dans un placard !",
    AMBUSH = "Placard + ressors/rentre plusieurs fois !",
    EYES = "Ne regarde pas Eyes !",
    LOOKMAN = "Ne le regarde pas !",
    BLITZ = "Cache-toi vite !",
    SEEK = "Cours ! Évite les mains et le feu.",
    ["A-60"] = "Cache-toi immédiatement !",
    ["A-120"] = "Cache-toi immédiatement !",
    FIGURE = "Reste accroupi et silencieux.",
    SCREECH = "Regarde-le pour le faire fuir !",
    HALT = "Recule quand l'écran devient bleu.",
    GLOOMBATS = "Éteins ta lumière !",
}

local lastAlert = {}
local function alertEntity(name)
    if not Config.NotifyEntities then return end
    local msg = AlertEntities[name]
    if not msg then return end
    local now = os.clock()
    -- Anti-spam : Rush/Ambush apparaissent en plusieurs instances successives
    if lastAlert[name] and now - lastAlert[name] < 6 then return end
    lastAlert[name] = now
    notify("⚠ " .. name, msg, Theme.Entity, 5)
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
            Prompts.Apply(prompt)
        end
    end
end

--==================================================================--
-- AUTO-LOOT OR (fireproximityprompt requis)
--==================================================================--
local GoldPiles = setmetatable({}, { __mode = "k" })

task.spawn(function()
    while Hub.Alive do
        if Config.AutoGold and fireprompt then
            local root = getRoot()
            if root then
                for pile in pairs(GoldPiles) do
                    if pile.Parent then
                        local prompt = pile:FindFirstChildWhichIsA("ProximityPrompt", true)
                        local part = resolvePart(pile)
                        if prompt and part and prompt.Enabled
                            and (part.Position - root.Position).Magnitude <= prompt.MaxActivationDistance then
                            pcall(fireprompt, prompt)
                        end
                    else
                        GoldPiles[pile] = nil
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

    if not (inst:IsA("Model") or inst:IsA("BasePart")) then return end
    local name = inst.Name

    if name == "Door" and inst:IsA("Model") and CurrentRooms and inst.Parent and inst.Parent.Parent == CurrentRooms then
        local roomNumber = tonumber(inst.Parent.Name)
        local label = roomNumber and ("Porte " .. (roomNumber + 1)) or "Porte"
        ESP.Add(inst, "EspDoors", label, Theme.Door, inst:FindFirstChild("Door"))
        return
    end

    local objective = ObjectiveNames[name]
    if objective then
        ESP.Add(inst, objective[2], objective[1], objective[3])
        return
    end

    if name == "GoldPile" then
        GoldPiles[inst] = true
        ESP.Add(inst, "EspGold", "Or", Theme.Gold)
        return
    end

    if ItemNames[name] and inst:IsA("Model") then
        ESP.Add(inst, "EspItems", ItemNames[name], Theme.Item)
        return
    end

    local entity = EntityNames[name]
    if entity then
        ESP.Add(inst, "EspEntities", entity, Theme.Entity)
        alertEntity(entity)
    end
end

local hookedRooms = {}
local function hookRoom(room)
    if hookedRooms[room] then return end
    -- Connexion hors Hub.Connections : elle est libérée dès que la salle disparaît
    hookedRooms[room] = room.DescendantAdded:Connect(processInstance)
    for _, d in ipairs(room:GetDescendants()) do
        processInstance(d)
    end
end

local function hookRooms()
    if not CurrentRooms then return end
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

if CurrentRooms then
    hookRooms()
else
    -- Lobby / chargement : on attend la création du dossier des salles
    task.spawn(function()
        CurrentRooms = workspace:WaitForChild("CurrentRooms", 60)
        if CurrentRooms and Hub.Alive then
            hookRooms()
        end
    end)
end

-- Entités qui spawn directement dans workspace (Rush, Ambush, Eyes, Seek, A-60…)
connect(workspace.ChildAdded, function(child)
    task.defer(processInstance, child)
end)
for _, child in ipairs(workspace:GetChildren()) do
    if EntityNames[child.Name] then
        processInstance(child)
    end
end

-- Screech et Halt sont injectés côté client dans la caméra
local cameraConn
local function hookCamera(cam)
    if cameraConn then cameraConn:Disconnect() end
    if not cam then return end
    cameraConn = cam.ChildAdded:Connect(function(child)
        local n = child.Name
        if n == "Screech" then
            alertEntity("SCREECH")
        elseif n == "Shade" or n == "Halt" then
            alertEntity("HALT")
        end
    end)
end
hookCamera(workspace.CurrentCamera)
connect(workspace:GetPropertyChangedSignal("CurrentCamera"), function()
    hookCamera(workspace.CurrentCamera)
end)

--==================================================================--
-- ESP JOUEURS
--==================================================================--
local function hookPlayer(player)
    if player == LocalPlayer then return end
    local function onChar(char)
        task.wait(0.5)
        if char.Parent then
            ESP.Add(char, "EspPlayers", player.DisplayName, Theme.Player, char:FindFirstChild("HumanoidRootPart"))
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
-- ÉCLAIRAGE (Fullbright / No Fog) — suit les changements du jeu pour restaurer proprement
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

-- Vrai si la valeur courante vient de nous (évite d'écraser l'original avec notre propre écriture,
-- y compris en SignalBehavior.Deferred où un simple flag ne suffit pas)
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

--==================================================================--
-- VITESSE + FOV
--==================================================================--
local DefaultWalkSpeed = nil

connect(RunService.Heartbeat, function()
    if not Config.SpeedEnabled then return end
    local hum = getHumanoid()
    if hum and hum.Health > 0 and hum.WalkSpeed ~= Config.Speed then
        hum.WalkSpeed = Config.Speed
    end
end)

local FOV_BIND = randomName()
local function setFovBinding(state)
    if state then
        -- Priorité juste après la caméra du jeu, sinon DOORS réécrase le FOV chaque frame
        RunService:BindToRenderStep(FOV_BIND, Enum.RenderPriority.Camera.Value + 1, function()
            local cam = workspace.CurrentCamera
            if cam then
                cam.FieldOfView = Config.Fov
            end
        end)
    else
        pcall(function()
            RunService:UnbindFromRenderStep(FOV_BIND)
        end)
        local cam = workspace.CurrentCamera
        if cam then
            cam.FieldOfView = 70
        end
    end
end

--==================================================================--
-- CONSTRUCTION DES ONGLETS
--==================================================================--

-- VISUELS -------------------------------------------------------------
local Visuals = UI.Tab("Visuels", "👁")
UI.Section(Visuals, "ESP")
UI.Toggle(Visuals, "Portes", "EspDoors", function(s) ESP.SetCategory("EspDoors", s) end)
UI.Toggle(Visuals, "Clés & Leviers", "EspKeys", function(s) ESP.SetCategory("EspKeys", s) end)
UI.Toggle(Visuals, "Objectifs (Livres, Disjoncteurs…)", "EspObjectives", function(s) ESP.SetCategory("EspObjectives", s) end)
UI.Toggle(Visuals, "Objets", "EspItems", function(s) ESP.SetCategory("EspItems", s) end)
UI.Toggle(Visuals, "Or", "EspGold", function(s) ESP.SetCategory("EspGold", s) end)
UI.Toggle(Visuals, "Joueurs", "EspPlayers", function(s) ESP.SetCategory("EspPlayers", s) end)
UI.Section(Visuals, "Monde")
UI.Toggle(Visuals, "Fullbright", "Fullbright", function() applyLighting() end)
UI.Toggle(Visuals, "Supprimer le brouillard", "NoFog", function() applyLighting() end)

-- JOUEUR --------------------------------------------------------------
local PlayerTab = UI.Tab("Joueur", "🏃")
UI.Section(PlayerTab, "Mouvement")
UI.Toggle(PlayerTab, "Speed Boost", "SpeedEnabled", function(state)
    local hum = getHumanoid()
    if not hum then return end
    if state then
        DefaultWalkSpeed = hum.WalkSpeed
    elseif DefaultWalkSpeed then
        hum.WalkSpeed = DefaultWalkSpeed
    end
end)
UI.Slider(PlayerTab, "Vitesse", "Speed", 15, 30, 1)
UI.Label(PlayerTab, "Au-delà de ~22 l'anti-cheat de DOORS peut te téléporter en arrière.")
UI.Section(PlayerTab, "Caméra")
UI.Toggle(PlayerTab, "FOV personnalisé", "FovEnabled", setFovBinding)
UI.Slider(PlayerTab, "Champ de vision", "Fov", 70, 120, 1)

-- ENTITÉS -------------------------------------------------------------
local EntityTab = UI.Tab("Entités", "👹")
UI.Section(EntityTab, "Détection")
UI.Toggle(EntityTab, "ESP Entités", "EspEntities", function(s) ESP.SetCategory("EspEntities", s) end)
UI.Toggle(EntityTab, "Alertes d'entités", "NotifyEntities")
UI.Label(EntityTab, "Rush, Ambush, Eyes, Seek, Figure, Screech, Halt, Blitz, Lookman, A-60, A-120, Gloombats…")

-- AUTO ----------------------------------------------------------------
local AutoTab = UI.Tab("Auto", "⚡")
UI.Section(AutoTab, "Interactions")
UI.Toggle(AutoTab, "Interaction instantanée", "InstantPrompt", function() Prompts.ApplyAll() end)
UI.Toggle(AutoTab, "Portée d'interaction x1.5", "PromptReach", function() Prompts.ApplyAll() end)
UI.Toggle(AutoTab, "Auto-ramassage de l'or", "AutoGold", function(state)
    if state and not fireprompt then
        notify("Abyss", "fireproximityprompt indisponible sur cet exécuteur.", Theme.Entity, 4)
    end
end)

-- INFOS ---------------------------------------------------------------
local InfoTab = UI.Tab("Infos", "⚙")
UI.Section(InfoTab, "Partie")
local roomLabel = UI.Label(InfoTab, "Salle : —")

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

UI.Section(InfoTab, "Interface")
UI.Label(InfoTab, "Bouton « A » flottant : tap pour ouvrir/fermer, glisse pour déplacer.")
UI.Button(InfoTab, "Décharger Abyss", function()
    Hub.Unload()
end, Color3.fromRGB(120, 35, 50))

--==================================================================--
-- DÉCHARGEMENT COMPLET (restaure tout l'état du jeu)
--==================================================================--
function Hub.Unload()
    if not Hub.Alive then return end
    Hub.Alive = false

    Config.Fullbright = false
    Config.NoFog = false
    pcall(applyLighting)

    Config.InstantPrompt = false
    Config.PromptReach = false
    pcall(Prompts.ApplyAll)

    if Config.SpeedEnabled then
        Config.SpeedEnabled = false
        local hum = getHumanoid()
        if hum and DefaultWalkSpeed then
            hum.WalkSpeed = DefaultWalkSpeed
        end
    end

    if Config.FovEnabled then
        Config.FovEnabled = false
        pcall(setFovBinding, false)
    end

    for _, c in ipairs(Hub.Connections) do
        pcall(function() c:Disconnect() end)
    end
    table.clear(Hub.Connections)
    for room, c in pairs(hookedRooms) do
        c:Disconnect()
        hookedRooms[room] = nil
    end
    if cameraConn then
        cameraConn:Disconnect()
        cameraConn = nil
    end

    ESP.Clear()
    pcall(function() ScreenGui:Destroy() end)

    if genv.AbyssHub == Hub then
        genv.AbyssHub = nil
    end
end

notify("ABYSS HUB", "Chargé avec succès. Bonne chance dans l'hôtel.", Theme.Accent, 4)
end

local ok, err = xpcall(Main, function(e)
    return tostring(e) .. "\n" .. debug.traceback()
end)

if not ok then
    warn("[Abyss] Échec du chargement :\n" .. tostring(err))
    sysNotify("ABYSS : ERREUR", string.sub(tostring(err), 1, 180), 15)
    -- Nettoyage partiel pour qu'une relance reparte de zéro
    local hub = genv.AbyssHub
    if hub and type(hub.Unload) == "function" then
        pcall(hub.Unload)
    elseif hub and type(hub.Connections) == "table" then
        for _, c in ipairs(hub.Connections) do
            pcall(function() c:Disconnect() end)
        end
        genv.AbyssHub = nil
    end
end
