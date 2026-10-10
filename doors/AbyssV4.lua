-- ABYSS HUB V4 // DOORS - Delta Android (ASCII uniquement)
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UIS = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")
local HttpService = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local LP = Players.LocalPlayer
local PlayerGui = LP:WaitForChild("PlayerGui")

-- Relance : on arrete proprement les anciennes versions
local G = getgenv and getgenv() or _G
for _, k in ipairs({ "AbyssStop", "AbyssLiteStop" }) do
    if G[k] then pcall(G[k]) end
end

local Alive = true
local Conns = {}
local function on(sig, fn)
    local c = sig:Connect(fn)
    table.insert(Conns, c)
    return c
end

--================ PALETTE / CATEGORIES ================--
local Palette = {
    { "Rouge", Color3.fromRGB(255, 60, 60) },
    { "Orange", Color3.fromRGB(255, 150, 40) },
    { "Jaune", Color3.fromRGB(255, 225, 60) },
    { "Vert", Color3.fromRGB(90, 255, 120) },
    { "Cyan", Color3.fromRGB(70, 210, 255) },
    { "Bleu", Color3.fromRGB(70, 120, 255) },
    { "Violet", Color3.fromRGB(170, 90, 255) },
    { "Rose", Color3.fromRGB(255, 100, 200) },
    { "Blanc", Color3.fromRGB(255, 255, 255) },
}

-- prio : plus petit = contour prioritaire (Roblox limite le nombre de Highlight affiches)
local Cats = {
    { key = "Entities", name = "Entites", col = 1, prio = 1 },
    { key = "Doors", name = "Portes", col = 5, prio = 2 },
    { key = "Keys", name = "Cles", col = 3, prio = 3 },
    { key = "Levers", name = "Leviers", col = 2, prio = 3 },
    { key = "Books", name = "Livres", col = 4, prio = 4 },
    { key = "Breakers", name = "Disjoncteurs", col = 4, prio = 4 },
    { key = "Objectives", name = "Objectifs Mines", col = 4, prio = 4 },
    { key = "Items", name = "Objets", col = 7, prio = 5 },
    { key = "Gold", name = "Or", col = 2, prio = 5 },
    { key = "Players", name = "Joueurs", col = 9, prio = 6 },
    { key = "Chests", name = "Tiroirs & Coffres", col = 8, prio = 7 },
    { key = "Hiding", name = "Cachettes", col = 6, prio = 7 },
}
local CatPrio = {}
for _, c in ipairs(Cats) do CatPrio[c.key] = c.prio end

--================ CONFIG ================--
local Cfg = {
    Outlines = true, Names = true, Distance = true, Tracers = false, Rainbow = false, Fill = 70,
    Fullbright = false, NoFog = false, AntiBlur = false,
    Speed = false, SpeedValue = 20, Jump = false, Fov = false, FovValue = 90,
    Alerts = true, AntiScreech = false,
    InstantPrompt = false, Reach = false, AutoGold = false, AutoItems = false, AutoDrawers = false,
    CrossUses = 10, CrossInfinite = true, CrossRange = 60, CrossAnything = true,
}
for _, c in ipairs(Cats) do
    Cfg["Esp_" .. c.key] = false
    Cfg["Col_" .. c.key] = c.col
end

local SAVE = "AbyssV4_Doors.json"
local canSave = (writefile and readfile and isfile) and true or false
pcall(function()
    if canSave and isfile(SAVE) then
        local data = HttpService:JSONDecode(readfile(SAVE))
        for k, v in pairs(data) do
            if Cfg[k] ~= nil and type(v) == type(Cfg[k]) then Cfg[k] = v end
        end
    end
end)

-- Compatibilite avec les variables _G du script crucifix d'origine
if type(_G.Uses) == "number" then
    Cfg.CrossInfinite = _G.Uses >= 1000
    Cfg.CrossUses = math.clamp(math.floor(_G.Uses), 1, 100)
end
if type(_G.Range) == "number" then Cfg.CrossRange = math.clamp(math.floor(_G.Range), 10, 500) end
if type(_G.OnAnything) == "boolean" then Cfg.CrossAnything = _G.OnAnything end

local saveQueued = false
local function save()
    if not canSave or saveQueued then return end
    saveQueued = true
    task.delay(1, function()
        saveQueued = false
        pcall(function() writefile(SAVE, HttpService:JSONEncode(Cfg)) end)
    end)
end

--================ THEME ================--
local ACCENT = Color3.fromRGB(255, 55, 85)
local ACCENT2 = Color3.fromRGB(255, 140, 60)
local BG = Color3.fromRGB(13, 13, 17)
local SIDE = Color3.fromRGB(19, 19, 25)
local EL = Color3.fromRGB(26, 26, 34)
local LINE = Color3.fromRGB(40, 40, 52)
local SUB = Color3.fromRGB(140, 140, 160)
local WHITE = Color3.new(1, 1, 1)

--================ UI DE BASE ================--
local Gui = Instance.new("ScreenGui")
Gui.Name = "AbyssV4"
Gui.ResetOnSpawn = false
Gui.IgnoreGuiInset = true
Gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
Gui.DisplayOrder = 999
Gui.Parent = PlayerGui

local function make(class, props, parent)
    local o = Instance.new(class)
    for k, v in pairs(props) do o[k] = v end
    o.Parent = parent
    return o
end

local function corner(p, r)
    return make("UICorner", { CornerRadius = UDim.new(0, r or 6) }, p)
end

local function gradient(p, rot)
    return make("UIGradient", { Color = ColorSequence.new(ACCENT, ACCENT2), Rotation = rot or 0 }, p)
end

-- Calque des tracers, cree avant le menu pour rester dessous
local TracerLayer = make("Frame", { Size = UDim2.new(1, 0, 1, 0), BackgroundTransparency = 1 }, Gui)

local NotifBox = make("Frame", {
    Size = UDim2.new(0, 240, 1, -20), Position = UDim2.new(1, -250, 0, 10), BackgroundTransparency = 1,
}, Gui)
make("UIListLayout", {
    Padding = UDim.new(0, 6), VerticalAlignment = Enum.VerticalAlignment.Bottom, SortOrder = Enum.SortOrder.LayoutOrder,
}, NotifBox)

local notifN = 0
local function notify(title, text, color)
    if not Alive then return end
    notifN = notifN + 1
    local f = make("Frame", { Size = UDim2.new(1, 0, 0, 54), BackgroundColor3 = BG, LayoutOrder = notifN }, NotifBox)
    corner(f, 6)
    make("UIStroke", { Color = LINE, Thickness = 1 }, f)
    local bar = make("Frame", { Size = UDim2.new(0, 3, 1, 0), BackgroundColor3 = color or ACCENT, BorderSizePixel = 0 }, f)
    corner(bar, 2)
    make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -18, 0, 18), Position = UDim2.new(0, 12, 0, 6),
        Font = Enum.Font.GothamBold, TextSize = 13, TextXAlignment = Enum.TextXAlignment.Left,
        TextColor3 = color or ACCENT, Text = title,
    }, f)
    make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -18, 0, 24), Position = UDim2.new(0, 12, 0, 25),
        Font = Enum.Font.Gotham, TextSize = 12, TextWrapped = true, TextXAlignment = Enum.TextXAlignment.Left,
        TextYAlignment = Enum.TextYAlignment.Top, TextColor3 = WHITE, Text = text,
    }, f)
    task.delay(4, function() f:Destroy() end)
end

local Main = make("Frame", {
    AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0), Size = UDim2.new(0, 460, 0, 300),
    BackgroundColor3 = BG, Active = true, ClipsDescendants = true,
}, Gui)
corner(Main, 8)
make("UIStroke", { Color = LINE, Thickness = 1 }, Main)

-- Taille adaptee a l'ecran du telephone
local Scale = make("UIScale", {}, Main)
local function rescale()
    local cam = workspace.CurrentCamera
    if not cam then return end
    local vp = cam.ViewportSize
    Scale.Scale = math.clamp(math.min(vp.X / 700, vp.Y / 380), 0.6, 1.2)
end
rescale()
if workspace.CurrentCamera then
    on(workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"), rescale)
end

-- Barre de titre
local Header = make("Frame", { Size = UDim2.new(1, 0, 0, 34), BackgroundColor3 = SIDE, BorderSizePixel = 0, Active = true }, Main)
make("Frame", { Size = UDim2.new(1, 0, 0, 2), Position = UDim2.new(0, 0, 1, -2), BorderSizePixel = 0, BackgroundColor3 = WHITE }, Header).Name = "Line"
gradient(Header.Line)
local TitleLbl = make("TextLabel", {
    BackgroundTransparency = 1, Size = UDim2.new(0, 200, 1, 0), Position = UDim2.new(0, 12, 0, 0),
    Font = Enum.Font.GothamBlack, TextSize = 16, TextColor3 = WHITE, TextXAlignment = Enum.TextXAlignment.Left,
    Text = "ABYSS HUB",
}, Header)
gradient(TitleLbl)
make("TextLabel", {
    BackgroundTransparency = 1, Size = UDim2.new(0, 200, 1, 0), Position = UDim2.new(0, 112, 0, 0),
    Font = Enum.Font.GothamMedium, TextSize = 12, TextColor3 = SUB, TextXAlignment = Enum.TextXAlignment.Left,
    Text = "DOORS  |  v4",
}, Header)
local MinBtn = make("TextButton", {
    Size = UDim2.new(0, 26, 0, 22), Position = UDim2.new(1, -32, 0.5, -11), BackgroundColor3 = EL,
    Font = Enum.Font.GothamBold, TextSize = 16, TextColor3 = WHITE, Text = "-",
}, Header)
corner(MinBtn, 5)

-- Barre laterale + contenu
local Side = make("ScrollingFrame", {
    Size = UDim2.new(0, 116, 1, -34), Position = UDim2.new(0, 0, 0, 34), BackgroundColor3 = SIDE,
    BorderSizePixel = 0, ScrollBarThickness = 0, CanvasSize = UDim2.new(0, 0, 0, 0),
    AutomaticCanvasSize = Enum.AutomaticSize.Y,
}, Main)
make("UIListLayout", { Padding = UDim.new(0, 2), SortOrder = Enum.SortOrder.LayoutOrder }, Side)
make("UIPadding", { PaddingTop = UDim.new(0, 6), PaddingLeft = UDim.new(0, 6), PaddingRight = UDim.new(0, 6) }, Side)

local PageTitle = make("TextLabel", {
    BackgroundTransparency = 1, Size = UDim2.new(1, -132, 0, 28), Position = UDim2.new(0, 126, 0, 38),
    Font = Enum.Font.GothamBold, TextSize = 15, TextColor3 = WHITE, TextXAlignment = Enum.TextXAlignment.Left, Text = "",
}, Main)

local Pages, Tabs = {}, {}
local function selectTab(i)
    for k, p in ipairs(Pages) do
        local active = (k == i)
        p.Visible = active
        Tabs[k].btn.BackgroundColor3 = active and EL or SIDE
        Tabs[k].btn.TextColor3 = active and WHITE or SUB
        Tabs[k].bar.Visible = active
        if active then PageTitle.Text = Tabs[k].name end
    end
end

local function newTab(name)
    local i = #Pages + 1
    local b = make("TextButton", {
        Size = UDim2.new(1, 0, 0, 30), BackgroundColor3 = SIDE, BorderSizePixel = 0, AutoButtonColor = false,
        Font = Enum.Font.GothamBold, TextSize = 12, TextColor3 = SUB, TextXAlignment = Enum.TextXAlignment.Left,
        Text = "    " .. name, LayoutOrder = i,
    }, Side)
    corner(b, 5)
    local bar = make("Frame", {
        Size = UDim2.new(0, 3, 0, 16), Position = UDim2.new(0, 4, 0.5, -8), BorderSizePixel = 0,
        BackgroundColor3 = ACCENT, Visible = false,
    }, b)
    corner(bar, 2)
    local p = make("ScrollingFrame", {
        Size = UDim2.new(1, -132, 1, -74), Position = UDim2.new(0, 124, 0, 68), BackgroundTransparency = 1,
        BorderSizePixel = 0, ScrollBarThickness = 3, ScrollBarImageColor3 = ACCENT,
        CanvasSize = UDim2.new(0, 0, 0, 0), AutomaticCanvasSize = Enum.AutomaticSize.Y, Visible = false,
    }, Main)
    make("UIListLayout", { Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }, p)
    make("UIPadding", { PaddingRight = UDim.new(0, 6), PaddingBottom = UDim.new(0, 6) }, p)
    Pages[i] = p
    Tabs[i] = { btn = b, bar = bar, name = name }
    b.MouseButton1Click:Connect(function() selectTab(i) end)
    return p
end

local order = 0
local function nextOrder()
    order = order + 1
    return order
end

local function section(page, text)
    local f = make("Frame", { Size = UDim2.new(1, 0, 0, 22), BackgroundTransparency = 1, LayoutOrder = nextOrder() }, page)
    make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, 0), Font = Enum.Font.GothamBlack, TextSize = 11,
        TextColor3 = ACCENT, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Bottom,
        Text = string.upper(text),
    }, f)
end

local function label(page, text)
    return make("TextLabel", {
        Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1,
        Font = Enum.Font.Gotham, TextSize = 11, TextWrapped = true, TextColor3 = SUB,
        TextXAlignment = Enum.TextXAlignment.Left, Text = text, LayoutOrder = nextOrder(),
    }, page)
end

-- Plusieurs boutons peuvent piloter la meme cle : on les redessine tous ensemble
local Renderers = {}
local function rerender(key)
    for _, fn in ipairs(Renderers[key] or {}) do pcall(fn) end
end

local Callbacks = {}
local function setCfg(key, value)
    Cfg[key] = value
    rerender(key)
    save()
    for _, cb in ipairs(Callbacks[key] or {}) do pcall(cb, value) end
end

local function toggle(page, text, key, cb)
    if cb then
        Callbacks[key] = Callbacks[key] or {}
        table.insert(Callbacks[key], cb)
    end
    local b = make("TextButton", {
        Size = UDim2.new(1, 0, 0, 32), BackgroundColor3 = EL, AutoButtonColor = false, Font = Enum.Font.GothamMedium,
        TextSize = 12, TextColor3 = WHITE, TextXAlignment = Enum.TextXAlignment.Left, Text = "   " .. text,
        LayoutOrder = nextOrder(),
    }, page)
    corner(b, 5)
    local box = make("Frame", {
        Size = UDim2.new(0, 18, 0, 18), Position = UDim2.new(1, -28, 0.5, -9), BackgroundColor3 = BG,
    }, b)
    corner(box, 4)
    local boxStroke = make("UIStroke", { Color = LINE, Thickness = 1 }, box)
    local fill = make("Frame", {
        Size = UDim2.new(1, -6, 1, -6), Position = UDim2.new(0, 3, 0, 3), BackgroundColor3 = WHITE, BorderSizePixel = 0,
    }, box)
    corner(fill, 3)
    gradient(fill, 45)
    local function render()
        fill.Visible = Cfg[key] == true
        boxStroke.Color = Cfg[key] and ACCENT or LINE
    end
    Renderers[key] = Renderers[key] or {}
    table.insert(Renderers[key], render)
    b.MouseButton1Click:Connect(function() setCfg(key, not Cfg[key]) end)
    render()
end

-- Boutons - / + : bien plus fiables au doigt qu'un slider
local function stepper(page, text, key, min, max, step, cb)
    if cb then
        Callbacks[key] = Callbacks[key] or {}
        table.insert(Callbacks[key], cb)
    end
    local f = make("Frame", { Size = UDim2.new(1, 0, 0, 32), BackgroundColor3 = EL, LayoutOrder = nextOrder() }, page)
    corner(f, 5)
    local lbl = make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -96, 1, 0), Position = UDim2.new(0, 10, 0, 0),
        Font = Enum.Font.GothamMedium, TextSize = 12, TextColor3 = WHITE, TextXAlignment = Enum.TextXAlignment.Left,
    }, f)
    local function render() lbl.Text = text .. " :  " .. tostring(Cfg[key]) end
    Renderers[key] = Renderers[key] or {}
    table.insert(Renderers[key], render)
    local function mk(txt, x, delta)
        local b = make("TextButton", {
            Size = UDim2.new(0, 36, 0, 24), Position = UDim2.new(1, x, 0.5, -12), BackgroundColor3 = BG,
            Font = Enum.Font.GothamBlack, TextSize = 15, TextColor3 = ACCENT, Text = txt,
        }, f)
        corner(b, 4)
        make("UIStroke", { Color = LINE, Thickness = 1 }, b)
        b.MouseButton1Click:Connect(function()
            setCfg(key, math.clamp(Cfg[key] + delta, min, max))
        end)
    end
    mk("-", -84, -step)
    mk("+", -44, step)
    render()
end

-- Bouton couleur : chaque tap passe a la couleur suivante
local function colorPicker(page, text, key)
    local b = make("TextButton", {
        Size = UDim2.new(1, 0, 0, 32), BackgroundColor3 = EL, AutoButtonColor = false, Font = Enum.Font.GothamMedium,
        TextSize = 12, TextColor3 = WHITE, TextXAlignment = Enum.TextXAlignment.Left, LayoutOrder = nextOrder(),
    }, page)
    corner(b, 5)
    local sw = make("Frame", { Size = UDim2.new(0, 18, 0, 18), Position = UDim2.new(1, -28, 0.5, -9) }, b)
    corner(sw, 9)
    local function render()
        local p = Palette[Cfg[key]] or Palette[9]
        b.Text = "   " .. text .. "   -   " .. p[1]
        sw.BackgroundColor3 = p[2]
    end
    Renderers[key] = Renderers[key] or {}
    table.insert(Renderers[key], render)
    b.MouseButton1Click:Connect(function() setCfg(key, (Cfg[key] % #Palette) + 1) end)
    render()
end

local function button(page, text, cb, color)
    local b = make("TextButton", {
        Size = UDim2.new(1, 0, 0, 32), BackgroundColor3 = color or ACCENT, Font = Enum.Font.GothamBold,
        TextSize = 12, TextColor3 = WHITE, Text = text, LayoutOrder = nextOrder(),
    }, page)
    corner(b, 5)
    if not color then gradient(b) end
    b.MouseButton1Click:Connect(function()
        local ok, err = pcall(cb)
        if not ok then notify("Erreur", tostring(err), ACCENT) end
    end)
end

-- Deplacement de la fenetre par la barre de titre
do
    local dragging, start, startPos, dragInput
    Header.InputBegan:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
            dragging, dragInput, start, startPos = true, input, input.Position, Main.Position
        end
    end)
    on(UIS.InputChanged, function(input)
        if dragging and (input == dragInput or input.UserInputType == Enum.UserInputType.MouseMovement) then
            local d = input.Position - start
            Main.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + d.X, startPos.Y.Scale, startPos.Y.Offset + d.Y)
        end
    end)
    on(UIS.InputEnded, function(input)
        if input == dragInput or input.UserInputType == Enum.UserInputType.MouseButton1 then dragging = false end
    end)
end

local Open = make("TextButton", {
    Size = UDim2.new(0, 46, 0, 46), Position = UDim2.new(0, 10, 0.4, 0), BackgroundColor3 = WHITE,
    Font = Enum.Font.GothamBlack, TextSize = 20, TextColor3 = WHITE, Text = "A",
}, Gui)
corner(Open, 10)
gradient(Open, 45)
Open.MouseButton1Click:Connect(function() Main.Visible = not Main.Visible end)
MinBtn.MouseButton1Click:Connect(function() Main.Visible = false end)

--================ ESP ================--
local ESP = {}
local TracerTargets = {}
local MAX_HL = 24

local function colorOf(cat)
    return (Palette[Cfg["Col_" .. cat]] or Palette[9])[2]
end

local function getPart(obj)
    if obj:IsA("BasePart") then return obj end
    if not obj:IsA("Model") then return nil end
    return obj.PrimaryPart or obj:FindFirstChild("HumanoidRootPart") or obj:FindFirstChildWhichIsA("BasePart", true)
end

local function removeEsp(obj)
    local e = ESP[obj]
    if not e then return end
    ESP[obj] = nil
    pcall(function() e.hl:Destroy() end)
    pcall(function() e.bb:Destroy() end)
end

-- Les salles DOORS arrivent en streaming : si la piece n'existe pas encore on retente
local function addEsp(obj, cat, text, partName, tries)
    if not Alive or ESP[obj] or not obj.Parent then return end
    local part = (partName and obj:FindFirstChild(partName)) or getPart(obj)
    if not part then
        tries = (tries or 0) + 1
        if tries <= 8 then task.delay(0.5, function() addEsp(obj, cat, text, partName, tries) end) end
        return
    end
    local color = colorOf(cat)
    local hl = make("Highlight", {
        Adornee = obj, FillColor = color, OutlineColor = color, FillTransparency = Cfg.Fill / 100,
        DepthMode = Enum.HighlightDepthMode.AlwaysOnTop, Enabled = false,
    }, obj)
    local bb = make("BillboardGui", {
        Adornee = part, Size = UDim2.new(0, 160, 0, 36), StudsOffset = Vector3.new(0, 2.5, 0),
        AlwaysOnTop = true, Enabled = false,
    }, part)
    local t = make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, 0), Font = Enum.Font.GothamBold, TextSize = 13,
        TextColor3 = color, TextStrokeTransparency = 0.3, Text = text,
    }, bb)
    ESP[obj] = { hl = hl, bb = bb, txt = t, cat = cat, label = text, part = part, color = color, last = "" }
end

local function refreshEsp()
    local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
    local rainbow = Cfg.Rainbow and Color3.fromHSV((os.clock() * 0.15) % 1, 0.75, 1) or nil
    local list = {}
    for obj, e in pairs(ESP) do
        if not obj.Parent or not e.part.Parent then
            removeEsp(obj)
        else
            local visible = Cfg["Esp_" .. e.cat] == true
            local dist = root and (e.part.Position - root.Position).Magnitude or 0
            local showText = visible and (Cfg.Names or Cfg.Distance)
            if e.bb.Enabled ~= showText then e.bb.Enabled = showText end
            if visible then
                local col = rainbow or colorOf(e.cat)
                if e.color ~= col then
                    e.color = col
                    e.hl.FillColor = col
                    e.hl.OutlineColor = col
                    e.txt.TextColor3 = col
                end
                if showText then
                    local m = math.floor(dist)
                    local s
                    if Cfg.Names and Cfg.Distance then
                        s = e.label .. "\n[" .. m .. "m]"
                    elseif Cfg.Names then
                        s = e.label
                    else
                        s = "[" .. m .. "m]"
                    end
                    if s ~= e.last then
                        e.last = s
                        e.txt.Text = s
                    end
                end
                e.score = CatPrio[e.cat] * 100000 + dist
                table.insert(list, e)
            elseif e.hl.Enabled then
                e.hl.Enabled = false
            end
        end
    end
    -- Contours attribues par priorite de categorie puis par distance
    table.sort(list, function(a, b) return a.score < b.score end)
    local fill = Cfg.Fill / 100
    for i, e in ipairs(list) do
        local want = Cfg.Outlines and i <= MAX_HL
        if e.hl.Enabled ~= want then e.hl.Enabled = want end
        if e.hl.FillTransparency ~= fill then e.hl.FillTransparency = fill end
    end
    TracerTargets = list
end

task.spawn(function()
    while Alive do
        pcall(refreshEsp)
        task.wait(0.25)
    end
end)

-- Tracers : lignes du bas de l'ecran vers les cibles (15 max)
local TracerPool = {}
on(RunService.RenderStepped, function()
    local cam = workspace.CurrentCamera
    local n = 0
    if Cfg.Tracers and cam then
        local vp = cam.ViewportSize
        local from = Vector2.new(vp.X / 2, vp.Y - 5)
        for _, e in ipairs(TracerTargets) do
            if n >= 15 then break end
            if e.part.Parent then
                local p, visible = cam:WorldToViewportPoint(e.part.Position)
                if visible then
                    n = n + 1
                    local f = TracerPool[n]
                    if not f then
                        f = make("Frame", { BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5) }, TracerLayer)
                        TracerPool[n] = f
                    end
                    local to = Vector2.new(p.X, p.Y)
                    local d = to - from
                    f.Visible = true
                    f.BackgroundColor3 = e.color
                    f.Size = UDim2.new(0, d.Magnitude, 0, 2)
                    f.Position = UDim2.new(0, (from.X + to.X) / 2, 0, (from.Y + to.Y) / 2)
                    f.Rotation = math.deg(math.atan2(d.Y, d.X))
                end
            end
        end
    end
    for i = n + 1, #TracerPool do
        if TracerPool[i].Visible then TracerPool[i].Visible = false end
    end
end)

--================ DETECTION ================--
local Names = {
    KeyObtain = { "Keys", "Cle" }, ElectricalKeyObtain = { "Keys", "Cle electrique" },
    LeverForGate = { "Levers", "Levier" }, TimerLever = { "Levers", "Levier timer" },
    LiveHintBook = { "Books", "Livre" },
    LiveBreakerPolePickup = { "Breakers", "Disjoncteur" },
    FuseObtain = { "Objectives", "Fusible" }, MinesAnchor = { "Objectives", "Ancre" },
    MinesGenerator = { "Objectives", "Generateur" }, WaterPump = { "Objectives", "Pompe" },
    GoldPile = { "Gold", "Or" },
    Lighter = { "Items", "Briquet" }, Flashlight = { "Items", "Lampe" }, Lockpick = { "Items", "Crochets" },
    Vitamins = { "Items", "Vitamines" }, Bandage = { "Items", "Bandage" }, BandagePack = { "Items", "Bandages" },
    Crucifix = { "Items", "Crucifix" }, SkeletonKey = { "Items", "Cle squelette" }, Battery = { "Items", "Pile" },
    BatteryPack = { "Items", "Piles" }, Candle = { "Items", "Bougie" }, Shears = { "Items", "Cisailles" },
    Smoothie = { "Items", "Smoothie" }, Glowsticks = { "Items", "Glowsticks" }, Straplight = { "Items", "Straplight" },
    Lantern = { "Items", "Lanterne" }, AlarmClock = { "Items", "Reveil" }, Bulklight = { "Items", "Bulklight" },
    LaserPointer = { "Items", "Laser" }, Compass = { "Items", "Boussole" }, Multitool = { "Items", "Multitool" },
    StarVial = { "Items", "Fiole etoile" }, StarBottle = { "Items", "Bouteille etoile" }, Bread = { "Items", "Pain" },
    Cheese = { "Items", "Fromage" }, TipJar = { "Items", "Tip Jar" }, ShakeLight = { "Items", "Shakelight" },
    DrawerContainer = { "Chests", "Tiroir" }, ChestBox = { "Chests", "Coffre" },
    ChestBoxLocked = { "Chests", "Coffre verrouille" }, Toolbox = { "Chests", "Boite a outils" },
    Locker_Small = { "Chests", "Petit casier" }, RolltopContainer = { "Chests", "Bureau" },
    Wardrobe = { "Hiding", "Armoire" }, Backdoor_Wardrobe = { "Hiding", "Armoire" }, Bed = { "Hiding", "Lit" },
    DoubleBed = { "Hiding", "Lit" }, Rooms_Locker = { "Hiding", "Casier" }, Rooms_Locker_Fridge = { "Hiding", "Frigo" },
    Locker_Large = { "Hiding", "Casier" }, Dumpster = { "Hiding", "Benne" }, Toolshed = { "Hiding", "Cabane" },
    RushMoving = { "Entities", "RUSH" }, AmbushMoving = { "Entities", "AMBUSH" }, Eyes = { "Entities", "EYES" },
    SeekMoving = { "Entities", "SEEK" }, SeekMovingNewClone = { "Entities", "SEEK" },
    FigureRig = { "Entities", "FIGURE" }, FigureRagdoll = { "Entities", "FIGURE" },
    BackdoorRush = { "Entities", "BLITZ" }, BackdoorLookman = { "Entities", "LOOKMAN" },
    A60 = { "Entities", "A-60" }, A120 = { "Entities", "A-120" }, GloombatSwarm = { "Entities", "GLOOMBATS" },
    GrumbleRig = { "Entities", "GRUMBLE" }, GiggleCeiling = { "Entities", "GIGGLE" }, Snare = { "Entities", "SNARE" },
    JeffTheKiller = { "Entities", "JEFF" },
}

local LootKind = { Gold = "gold", Items = "item", Chests = "drawer" }

local AlertText = {
    RUSH = "Cache-toi dans un placard !", AMBUSH = "Placard ! Ressors et rentre a chaque passage.",
    EYES = "Ne regarde pas Eyes !", SEEK = "Cours ! Evite les mains.", FIGURE = "Accroupi et silencieux.",
    BLITZ = "Cache-toi vite !", LOOKMAN = "Ne le regarde pas !", ["A-60"] = "Cache-toi tout de suite !",
    ["A-120"] = "Cache-toi tout de suite !", GLOOMBATS = "Eteins ta lumiere !", GRUMBLE = "Evite les Grumbles !",
    JEFF = "Jeff est la !", SCREECH = "Regarde-le pour le faire fuir !", HALT = "Fais demi-tour quand c'est bleu.",
}

local History = {}
local historyLabel
local lastAlert = {}
local function alert(name)
    if not AlertText[name] then return end
    if lastAlert[name] and os.clock() - lastAlert[name] < 6 then return end
    lastAlert[name] = os.clock()
    table.insert(History, 1, os.date("%H:%M:%S") .. "  " .. name)
    if #History > 8 then table.remove(History) end
    if historyLabel then historyLabel.Text = table.concat(History, "\n") end
    if Cfg.Alerts then notify(name, AlertText[name], Color3.fromRGB(255, 60, 60)) end
end

local Loot = setmetatable({}, { __mode = "k" })
local Prompts = setmetatable({}, { __mode = "k" })

local function applyPrompt(pr)
    local o = Prompts[pr]
    if not o then return end
    pr.HoldDuration = Cfg.InstantPrompt and 0 or o.hold
    pr.MaxActivationDistance = Cfg.Reach and o.dist * 1.5 or o.dist
end

local function process(inst)
    if not Alive then return end
    if inst:IsA("ProximityPrompt") then
        if not Prompts[inst] then
            Prompts[inst] = { hold = inst.HoldDuration, dist = inst.MaxActivationDistance }
            if Cfg.InstantPrompt or Cfg.Reach then pcall(applyPrompt, inst) end
        end
        return
    end
    local isModel = inst:IsA("Model")
    if not (isModel or inst:IsA("BasePart")) then return end

    local rooms = workspace:FindFirstChild("CurrentRooms")
    if inst.Name == "Door" and isModel and rooms and inst.Parent and inst.Parent.Parent == rooms then
        local n = tonumber(inst.Parent.Name)
        addEsp(inst, "Doors", n and ("Porte " .. (n + 1)) or "Porte", "Door")
        return
    end

    local d = Names[inst.Name]
    if not d then return end
    if d[1] ~= "Entities" and not isModel then return end
    addEsp(inst, d[1], d[2])
    if LootKind[d[1]] then Loot[inst] = LootKind[d[1]] end
    if d[1] == "Entities" then alert(d[2]) end
end

local function hookRooms(rooms)
    for _, d in ipairs(rooms:GetDescendants()) do process(d) end
    on(rooms.DescendantAdded, function(d) task.defer(process, d) end)
end

task.spawn(function()
    local rooms = workspace:WaitForChild("CurrentRooms", 120)
    if rooms and Alive then hookRooms(rooms) end
end)

on(workspace.ChildAdded, function(c) task.defer(process, c) end)
for _, c in ipairs(workspace:GetChildren()) do
    local d = Names[c.Name]
    if d and d[1] == "Entities" then process(c) end
end

local function hookPlayer(p)
    if p == LP then return end
    local function onChar(char)
        local r = char:WaitForChild("HumanoidRootPart", 10)
        if r and Alive then addEsp(char, "Players", p.DisplayName, "HumanoidRootPart") end
    end
    on(p.CharacterAdded, onChar)
    if p.Character then task.spawn(onChar, p.Character) end
end
for _, p in ipairs(Players:GetPlayers()) do hookPlayer(p) end
on(Players.PlayerAdded, hookPlayer)

--================ CAMERA : SCREECH / HALT / FLOU ================--
local Blurs = setmetatable({}, { __mode = "k" })
local function trackBlur(o)
    if (o:IsA("BlurEffect") or o:IsA("DepthOfFieldEffect")) and Blurs[o] == nil then Blurs[o] = o.Enabled end
end
for _, d in ipairs(Lighting:GetDescendants()) do trackBlur(d) end
on(Lighting.DescendantAdded, trackBlur)

local camConn
local function hookCam(cam)
    if camConn then camConn:Disconnect() end
    if not cam then return end
    for _, c in ipairs(cam:GetChildren()) do trackBlur(c) end
    camConn = cam.ChildAdded:Connect(function(c)
        trackBlur(c)
        if c.Name == "Screech" then
            alert("SCREECH")
            if Cfg.AntiScreech then task.defer(function() pcall(function() c:Destroy() end) end) end
        elseif c.Name == "Shade" then
            alert("HALT")
        end
    end)
end
hookCam(workspace.CurrentCamera)
on(workspace:GetPropertyChangedSignal("CurrentCamera"), function() hookCam(workspace.CurrentCamera) end)

--================ MONDE / JOUEUR ================--
local orig = {}
local function snapshot()
    orig.Ambient = Lighting.Ambient
    orig.Brightness = Lighting.Brightness
    orig.GlobalShadows = Lighting.GlobalShadows
    orig.FogEnd = Lighting.FogEnd
end
snapshot()

local function restoreLight()
    Lighting.Ambient = orig.Ambient
    Lighting.Brightness = orig.Brightness
    Lighting.GlobalShadows = orig.GlobalShadows
    Lighting.FogEnd = orig.FogEnd
end

local defaultSpeed, defaultJump
on(RunService.Heartbeat, function()
    -- Tant que rien n'est actif, on suit l'eclairage du jeu pour pouvoir le restaurer fidelement
    if Cfg.Fullbright or Cfg.NoFog then
        if Cfg.Fullbright then
            Lighting.Ambient = WHITE
            Lighting.Brightness = 2
            Lighting.GlobalShadows = false
        end
        if Cfg.NoFog then Lighting.FogEnd = 100000 end
    else
        snapshot()
    end

    local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
    if hum and hum.Health > 0 then
        if Cfg.Speed then
            if not defaultSpeed then defaultSpeed = hum.WalkSpeed end
            if hum.WalkSpeed ~= Cfg.SpeedValue then hum.WalkSpeed = Cfg.SpeedValue end
        end
        if Cfg.Jump then
            if not defaultJump then defaultJump = { hum.JumpPower, hum.JumpHeight } end
            if hum.UseJumpPower then
                if hum.JumpPower < 40 then hum.JumpPower = 45 end
            elseif hum.JumpHeight < 5 then
                hum.JumpHeight = 6
            end
        end
    end
end)

-- Le FOV doit passer apres le script camera du jeu, sinon il est ecrase a chaque frame
local FOV_BIND = "AbyssFov" .. tostring(math.random(1000, 9999))
RunService:BindToRenderStep(FOV_BIND, Enum.RenderPriority.Camera.Value + 1, function()
    if Cfg.Fov and workspace.CurrentCamera then
        workspace.CurrentCamera.FieldOfView = Cfg.FovValue
    end
end)

-- Apres une mort les valeurs memorisees appartiennent a l'ancien personnage
on(LP.CharacterAdded, function()
    defaultSpeed, defaultJump = nil, nil
end)

task.spawn(function()
    while Alive do
        if Cfg.NoFog then
            for _, a in ipairs(Lighting:GetChildren()) do
                if a:IsA("Atmosphere") then a.Density = 0 end
            end
        end
        if Cfg.AntiBlur then
            for b in pairs(Blurs) do
                if b.Parent and b.Enabled then b.Enabled = false end
            end
        end
        task.wait(0.3)
    end
end)

-- Auto-ramassage. Les tiroirs ne sont declenches qu'une fois, sinon ils s'ouvrent/ferment en boucle
local Fired = setmetatable({}, { __mode = "k" })
task.spawn(function()
    while Alive do
        if fireproximityprompt and (Cfg.AutoGold or Cfg.AutoItems or Cfg.AutoDrawers) then
            local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
            if root then
                local now = os.clock()
                for obj, kind in pairs(Loot) do
                    if not obj.Parent then
                        Loot[obj] = nil
                    elseif (kind == "gold" and Cfg.AutoGold) or (kind == "item" and Cfg.AutoItems)
                        or (kind == "drawer" and Cfg.AutoDrawers) then
                        local last = Fired[obj]
                        local ready = (kind == "drawer" and last == nil) or (kind ~= "drawer" and (not last or now - last > 1.5))
                        if ready then
                            local pr = obj:FindFirstChildWhichIsA("ProximityPrompt", true)
                            local pt = getPart(obj)
                            if pr and pt and pr.Enabled and (pt.Position - root.Position).Magnitude <= pr.MaxActivationDistance then
                                Fired[obj] = now
                                pcall(fireproximityprompt, pr)
                            end
                        end
                    end
                end
            end
        end
        task.wait(0.3)
    end
end)

--================ CRUCIFIX (VISUEL, COTE CLIENT) ================--
-- Outil local : le serveur ne le voit pas. L'effet (chaines, levitation, disparition)
-- n'existe que sur ton ecran et ne protege pas des vraies attaques d'entites.
local crossUsesLeft = 0
local crossTool

local function topModel(part)
    -- Remonte jusqu'au modele entier (porte, plante, entite...) sans jamais prendre la salle elle-meme
    local rooms = workspace:FindFirstChild("CurrentRooms")
    local node = part
    while node.Parent and node.Parent:IsA("Model") and not (rooms and node.Parent.Parent == rooms) do
        node = node.Parent
    end
    return node
end

local function isProtected(obj)
    local char = LP.Character
    if char and (obj == char or obj:IsDescendantOf(char)) then return true end
    for _, p in ipairs(Players:GetPlayers()) do
        if p.Character and (obj == p.Character or obj:IsDescendantOf(p.Character)) then return true end
    end
    local rooms = workspace:FindFirstChild("CurrentRooms")
    if rooms and obj.Parent == rooms then return true end
    return false
end

local function nearestEntity(origin)
    local best, bestDist
    for obj, e in pairs(ESP) do
        if e.cat == "Entities" and obj.Parent and e.part.Parent then
            local d = (e.part.Position - origin).Magnitude
            if d <= Cfg.CrossRange and (not bestDist or d < bestDist) then best, bestDist = obj, d end
        end
    end
    return best
end

local function crucifyEffect(target)
    local parts = {}
    if target:IsA("BasePart") then
        parts = { target }
    else
        for _, d in ipairs(target:GetDescendants()) do
            if d:IsA("BasePart") then table.insert(parts, d) end
        end
    end
    if #parts == 0 then return end

    local hl = make("Highlight", {
        FillColor = Color3.fromRGB(120, 200, 255), OutlineColor = WHITE, FillTransparency = 0.3,
        DepthMode = Enum.HighlightDepthMode.AlwaysOnTop,
    }, target)

    local center = target:IsA("Model") and target:GetPivot() or target.CFrame
    local anchor = make("Part", {
        Anchored = true, CanCollide = false, Transparency = 1, Size = Vector3.new(1, 1, 1), CFrame = center,
    }, workspace)
    make("ParticleEmitter", {
        Color = ColorSequence.new(Color3.fromRGB(150, 220, 255)), LightEmission = 1, Rate = 60,
        Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(4, 8), SpreadAngle = Vector2.new(180, 180),
        Size = NumberSequence.new(0.4, 0),
    }, anchor)
    make("PointLight", { Color = Color3.fromRGB(150, 220, 255), Brightness = 4, Range = 18 }, anchor)

    -- Chaines : 4 rayons qui partent du sol vers la cible
    for i = 1, 4 do
        local a = math.rad(i * 90)
        local from = center.Position + Vector3.new(math.cos(a) * 6, -4, math.sin(a) * 6)
        local to = center.Position
        local len = (to - from).Magnitude
        make("Part", {
            Anchored = true, CanCollide = false, Material = Enum.Material.Neon, Color = Color3.fromRGB(150, 220, 255),
            Size = Vector3.new(0.25, 0.25, len), CFrame = CFrame.lookAt((from + to) / 2, to), Transparency = 0.2,
        }, anchor)
    end

    for _, p in ipairs(parts) do p.Anchored = true end

    task.spawn(function()
        local start = os.clock()
        local duration = 2.5
        while os.clock() - start < duration and target.Parent do
            local t = (os.clock() - start) / duration
            local cf = center * CFrame.new(0, t * 5, 0) * CFrame.Angles(0, t * math.pi * 4, 0)
            if target:IsA("Model") then
                pcall(function() target:PivotTo(cf) end)
            else
                target.CFrame = cf
            end
            for _, p in ipairs(parts) do
                if p.Parent then p.LocalTransparencyModifier = t end
            end
            task.wait()
        end
        pcall(function() target:Destroy() end)
        pcall(function() hl:Destroy() end)
        task.wait(0.4)
        anchor:Destroy()
    end)
end

local function useCross()
    local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
    if not root then return end
    if not Cfg.CrossInfinite and crossUsesLeft <= 0 then
        notify("Crucifix", "Plus d'utilisations.", ACCENT)
        return
    end

    local target
    if Cfg.CrossAnything then
        local mouse = LP:GetMouse()
        local hit = mouse.Target
        if hit and (hit.Position - root.Position).Magnitude <= Cfg.CrossRange then
            target = topModel(hit)
        end
    end
    target = target or nearestEntity(root.Position)

    if not target or isProtected(target) then
        notify("Crucifix", Cfg.CrossAnything and "Vise un objet ou une entite a portee." or "Aucune entite a portee.", ACCENT)
        return
    end

    if not Cfg.CrossInfinite then crossUsesLeft = crossUsesLeft - 1 end
    crucifyEffect(target)
end

-- Outil sans Handle : un Handle cree cote client n'est pas toujours soude a la main,
-- on soude donc nous-memes le modele du crucifix a l'equipement
local function buildCrossModel(hand)
    local wood = Color3.fromRGB(110, 70, 40)
    local m = make("Model", { Name = "AbyssCross" }, nil)
    local v = make("Part", {
        Size = Vector3.new(0.25, 1.6, 0.25), Material = Enum.Material.Wood, Color = wood,
        CanCollide = false, Massless = true, CanQuery = false,
        CFrame = hand.CFrame * CFrame.new(0, -0.9, -0.3),
    }, m)
    local h = make("Part", {
        Size = Vector3.new(0.9, 0.25, 0.25), Material = Enum.Material.Wood, Color = wood,
        CanCollide = false, Massless = true, CanQuery = false, CFrame = v.CFrame * CFrame.new(0, 0.35, 0),
    }, m)
    make("WeldConstraint", { Part0 = v, Part1 = h }, v)
    make("WeldConstraint", { Part0 = hand, Part1 = v }, v)
    m.Parent = hand.Parent
    return m
end

local function giveCross()
    if crossTool and crossTool.Parent then
        notify("Crucifix", "Tu as deja le crucifix.", ACCENT)
        return
    end
    crossUsesLeft = Cfg.CrossUses
    local tool = make("Tool", { Name = "Crucifix", RequiresHandle = false, CanBeDropped = false, ToolTip = "Crucifix" }, nil)
    local held
    tool.Equipped:Connect(function()
        local char = LP.Character
        local hand = char and (char:FindFirstChild("RightHand") or char:FindFirstChild("Right Arm"))
        if hand then held = buildCrossModel(hand) end
    end)
    tool.Unequipped:Connect(function()
        if held then held:Destroy() held = nil end
    end)
    tool.Destroying:Connect(function()
        if held then held:Destroy() held = nil end
    end)
    tool.Activated:Connect(function() pcall(useCross) end)
    tool.Parent = LP:WaitForChild("Backpack")
    crossTool = tool
    notify("Crucifix", "Equipe-le puis touche ce que tu veux viser.", ACCENT)
end

--================ ONGLETS ================--
local PE = newTab("ESP")
section(PE, "Categories")
for _, c in ipairs(Cats) do toggle(PE, c.name, "Esp_" .. c.key) end
section(PE, "Affichage")
toggle(PE, "Contours", "Outlines")
toggle(PE, "Noms", "Names")
toggle(PE, "Distance", "Distance")
toggle(PE, "Tracers", "Tracers")
toggle(PE, "Arc-en-ciel", "Rainbow")
stepper(PE, "Transparence %", "Fill", 0, 100, 10)

local PC = newTab("Couleurs")
section(PC, "Touche pour changer")
for _, c in ipairs(Cats) do colorPicker(PC, c.name, "Col_" .. c.key) end

local PW = newTab("Monde")
section(PW, "Lumiere")
toggle(PW, "Fullbright", "Fullbright", function(s) if not s and not Cfg.NoFog then restoreLight() end end)
toggle(PW, "Sans brouillard", "NoFog", function(s) if not s and not Cfg.Fullbright then restoreLight() end end)
toggle(PW, "Anti-flou", "AntiBlur", function(s)
    if not s then for b, was in pairs(Blurs) do if b.Parent then b.Enabled = was end end end
end)

local PP = newTab("Joueur")
section(PP, "Mouvement")
toggle(PP, "Speed", "Speed", function(s)
    local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
    if not s and hum and defaultSpeed then hum.WalkSpeed = defaultSpeed end
    if not s then defaultSpeed = nil end
end)
stepper(PP, "Vitesse", "SpeedValue", 15, 30, 1)
label(PP, "Au-dela de ~22 l'anti-cheat de DOORS te ramene en arriere.")
toggle(PP, "Activer le saut", "Jump", function(s)
    local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
    if not hum then return end
    if s then
        hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, true)
    elseif defaultJump then
        hum.JumpPower, hum.JumpHeight = defaultJump[1], defaultJump[2]
        defaultJump = nil
    end
end)
section(PP, "Camera")
toggle(PP, "FOV", "Fov", function(s)
    if not s and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = 70 end
end)
stepper(PP, "FOV", "FovValue", 70, 120, 5)

local PN = newTab("Entites")
section(PN, "Detection")
toggle(PN, "ESP Entites", "Esp_Entities")
toggle(PN, "Alertes", "Alerts")
section(PN, "Protection")
toggle(PN, "Anti-Screech", "AntiScreech")
section(PN, "Historique")
historyLabel = label(PN, "Aucune entite pour l'instant.")

local PX = newTab("Crucifix")
section(PX, "Outil")
button(PX, "Obtenir le crucifix", giveCross)
label(PX, "Effet visuel uniquement : toi seul le vois, il ne bloque pas les vraies attaques.")
section(PX, "Reglages")
toggle(PX, "Sur n'importe quoi", "CrossAnything")
toggle(PX, "Utilisations infinies", "CrossInfinite")
stepper(PX, "Utilisations", "CrossUses", 1, 100, 1)
stepper(PX, "Portee", "CrossRange", 10, 500, 10)

local PA = newTab("Auto")
section(PA, "Interactions")
local function refreshPrompts()
    for pr in pairs(Prompts) do if pr.Parent then pcall(applyPrompt, pr) end end
end
toggle(PA, "Interaction instantanee", "InstantPrompt", refreshPrompts)
toggle(PA, "Portee x1.5", "Reach", refreshPrompts)
section(PA, "Ramassage auto")
toggle(PA, "Or", "AutoGold")
toggle(PA, "Objets", "AutoItems")
toggle(PA, "Ouvrir les tiroirs", "AutoDrawers")
if not fireproximityprompt then label(PA, "fireproximityprompt indisponible : ramassage auto desactive.") end

local PI = newTab("Infos")
section(PI, "Partie")
local roomLabel = label(PI, "Salle : -")
task.spawn(function()
    local gd = ReplicatedStorage:WaitForChild("GameData", 30)
    local latest = gd and gd:WaitForChild("LatestRoom", 10)
    if not latest or not Alive then return end
    local function upd() roomLabel.Text = "Salle : " .. tostring(latest.Value) end
    upd()
    on(latest.Changed, upd)
end)
section(PI, "Script")
label(PI, canSave and "Reglages sauvegardes automatiquement." or "Sauvegarde indisponible.")

local function stop()
    if not Alive then return end
    Alive = false
    for _, c in ipairs(Conns) do pcall(function() c:Disconnect() end) end
    if camConn then pcall(function() camConn:Disconnect() end) end
    pcall(function() RunService:UnbindFromRenderStep(FOV_BIND) end)
    for obj in pairs(ESP) do removeEsp(obj) end
    Cfg.InstantPrompt, Cfg.Reach = false, false
    refreshPrompts()
    pcall(restoreLight)
    for b, was in pairs(Blurs) do if b.Parent then pcall(function() b.Enabled = was end) end end
    local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
    if hum and defaultSpeed then hum.WalkSpeed = defaultSpeed end
    if Cfg.Fov and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = 70 end
    if crossTool then pcall(function() crossTool:Destroy() end) end
    Gui:Destroy()
    G.AbyssStop = nil
end
G.AbyssStop = stop
button(PI, "Fermer le script", stop, Color3.fromRGB(110, 30, 45))

selectTab(1)
notify("ABYSS HUB", "Charge ! Touche le bouton A.", ACCENT)
