-- ABYSS HUB V3 // DOORS - Delta Android (ASCII uniquement)
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UIS = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local LP = Players.LocalPlayer
local PlayerGui = LP:WaitForChild("PlayerGui")

-- Relance : on arrete proprement l'ancienne instance
local G = getgenv and getgenv() or _G
if G.AbyssStop then pcall(G.AbyssStop) end
if G.AbyssLiteStop then pcall(G.AbyssLiteStop) end

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
}
for _, c in ipairs(Cats) do
    Cfg["Esp_" .. c.key] = false
    Cfg["Col_" .. c.key] = c.col
end

local SAVE = "AbyssV3_Doors.json"
local canSave = writefile and readfile and isfile
pcall(function()
    if canSave and isfile(SAVE) then
        local data = HttpService:JSONDecode(readfile(SAVE))
        for k, v in pairs(data) do
            if Cfg[k] ~= nil and type(v) == type(Cfg[k]) then Cfg[k] = v end
        end
    end
end)

local saveQueued = false
local function save()
    if not canSave or saveQueued then return end
    saveQueued = true
    task.delay(1, function()
        saveQueued = false
        pcall(function() writefile(SAVE, HttpService:JSONEncode(Cfg)) end)
    end)
end

local ACCENT = Color3.fromRGB(150, 90, 255)
local ACCENT2 = Color3.fromRGB(70, 200, 255)
local BG = Color3.fromRGB(16, 14, 24)
local EL = Color3.fromRGB(30, 26, 46)
local OFF = Color3.fromRGB(60, 55, 80)
local WHITE = Color3.new(1, 1, 1)

--================ UI DE BASE ================--
local Gui = Instance.new("ScreenGui")
Gui.Name = "AbyssV3"
Gui.ResetOnSpawn = false
Gui.IgnoreGuiInset = true
Gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
Gui.DisplayOrder = 999
Gui.Parent = PlayerGui

local function corner(p, r)
    local c = Instance.new("UICorner")
    c.CornerRadius = UDim.new(0, r or 8)
    c.Parent = p
end

local function make(class, props, parent)
    local o = Instance.new(class)
    for k, v in pairs(props) do o[k] = v end
    o.Parent = parent
    return o
end

-- Calque des tracers, cree avant le menu pour rester dessous
local TracerLayer = make("Frame", { Size = UDim2.new(1, 0, 1, 0), BackgroundTransparency = 1 }, Gui)

local NotifBox = make("Frame", {
    Size = UDim2.new(0, 240, 1, -20), Position = UDim2.new(1, -250, 0, 10), BackgroundTransparency = 1,
}, Gui)
make("UIListLayout", {
    Padding = UDim.new(0, 6), VerticalAlignment = Enum.VerticalAlignment.Bottom,
    SortOrder = Enum.SortOrder.LayoutOrder,
}, NotifBox)

local notifN = 0
local function notify(title, text, color)
    if not Alive then return end
    notifN = notifN + 1
    local f = make("Frame", { Size = UDim2.new(1, 0, 0, 52), BackgroundColor3 = BG, LayoutOrder = notifN }, NotifBox)
    corner(f, 8)
    make("UIStroke", { Color = color or ACCENT, Thickness = 2 }, f)
    make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -16, 1, -8), Position = UDim2.new(0, 8, 0, 4),
        Font = Enum.Font.GothamBold, TextSize = 13, TextWrapped = true,
        TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = WHITE, Text = title .. "\n" .. text,
    }, f)
    task.delay(4, function() f:Destroy() end)
end

local Main = make("Frame", {
    Size = UDim2.new(0, 340, 0, 370), Position = UDim2.new(0.5, -170, 0.5, -185),
    BackgroundColor3 = BG, Active = true,
}, Gui)
corner(Main, 12)
make("UIStroke", { Color = ACCENT, Thickness = 2 }, Main)

local Top = make("TextLabel", {
    Size = UDim2.new(1, 0, 0, 38), BackgroundColor3 = EL, Font = Enum.Font.GothamBlack,
    TextSize = 18, TextColor3 = WHITE, Text = "ABYSS HUB  V3  //  DOORS", Active = true,
}, Main)
corner(Top, 12)
make("UIGradient", { Color = ColorSequence.new(ACCENT, ACCENT2) }, Top)

local TabBar = make("ScrollingFrame", {
    Size = UDim2.new(1, -12, 0, 32), Position = UDim2.new(0, 6, 0, 42), BackgroundTransparency = 1,
    BorderSizePixel = 0, ScrollBarThickness = 0, CanvasSize = UDim2.new(0, 0, 0, 0),
    AutomaticCanvasSize = Enum.AutomaticSize.X, ScrollingDirection = Enum.ScrollingDirection.X,
}, Main)
make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 4) }, TabBar)

local Pages, TabBtns = {}, {}
local function selectTab(i)
    for k, p in ipairs(Pages) do
        p.Visible = (k == i)
        TabBtns[k].BackgroundColor3 = (k == i) and ACCENT or EL
    end
end

local function newTab(name)
    local i = #Pages + 1
    local b = make("TextButton", {
        Size = UDim2.new(0, 78, 1, 0), BackgroundColor3 = EL, Font = Enum.Font.GothamBold,
        TextSize = 12, TextColor3 = WHITE, Text = name,
    }, TabBar)
    corner(b, 6)
    local p = make("ScrollingFrame", {
        Size = UDim2.new(1, -12, 1, -86), Position = UDim2.new(0, 6, 0, 80), BackgroundTransparency = 1,
        BorderSizePixel = 0, ScrollBarThickness = 4, ScrollBarImageColor3 = ACCENT,
        CanvasSize = UDim2.new(0, 0, 0, 0), AutomaticCanvasSize = Enum.AutomaticSize.Y, Visible = false,
    }, Main)
    make("UIListLayout", { Padding = UDim.new(0, 5), SortOrder = Enum.SortOrder.LayoutOrder }, p)
    Pages[i] = p
    TabBtns[i] = b
    b.MouseButton1Click:Connect(function() selectTab(i) end)
    return p
end

local order = 0
local function nextOrder()
    order = order + 1
    return order
end

local function section(page, text)
    make("TextLabel", {
        Size = UDim2.new(1, -6, 0, 20), BackgroundTransparency = 1, Font = Enum.Font.GothamBlack,
        TextSize = 11, TextColor3 = ACCENT2, TextXAlignment = Enum.TextXAlignment.Left,
        Text = string.upper(text), LayoutOrder = nextOrder(),
    }, page)
end

local function label(page, text)
    return make("TextLabel", {
        Size = UDim2.new(1, -6, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1,
        Font = Enum.Font.Gotham, TextSize = 12, TextWrapped = true, TextColor3 = Color3.fromRGB(160, 155, 185),
        TextXAlignment = Enum.TextXAlignment.Left, Text = text, LayoutOrder = nextOrder(),
    }, page)
end

local function toggle(page, text, key, cb)
    local b = make("TextButton", {
        Size = UDim2.new(1, -6, 0, 34), BackgroundColor3 = EL, Font = Enum.Font.GothamMedium,
        TextSize = 13, TextColor3 = WHITE, TextXAlignment = Enum.TextXAlignment.Left,
        Text = "   " .. text, LayoutOrder = nextOrder(),
    }, page)
    corner(b, 7)
    local track = make("Frame", {
        Size = UDim2.new(0, 38, 0, 20), Position = UDim2.new(1, -46, 0.5, -10), BackgroundColor3 = OFF,
    }, b)
    corner(track, 10)
    local knob = make("Frame", { Size = UDim2.new(0, 14, 0, 14), BackgroundColor3 = WHITE }, track)
    corner(knob, 7)
    local function render()
        track.BackgroundColor3 = Cfg[key] and ACCENT or OFF
        knob.Position = Cfg[key] and UDim2.new(1, -17, 0.5, -7) or UDim2.new(0, 3, 0.5, -7)
    end
    b.MouseButton1Click:Connect(function()
        Cfg[key] = not Cfg[key]
        render()
        save()
        if cb then pcall(cb, Cfg[key]) end
    end)
    render()
end

-- Boutons - / + : bien plus fiables au doigt qu'un slider
local function stepper(page, text, key, min, max, step, cb)
    local f = make("Frame", { Size = UDim2.new(1, -6, 0, 34), BackgroundColor3 = EL, LayoutOrder = nextOrder() }, page)
    corner(f, 7)
    local lbl = make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -96, 1, 0), Position = UDim2.new(0, 10, 0, 0),
        Font = Enum.Font.GothamMedium, TextSize = 13, TextColor3 = WHITE, TextXAlignment = Enum.TextXAlignment.Left,
    }, f)
    local function render() lbl.Text = text .. " : " .. tostring(Cfg[key]) end
    local function mk(txt, x, delta)
        local b = make("TextButton", {
            Size = UDim2.new(0, 38, 0, 26), Position = UDim2.new(1, x, 0.5, -13), BackgroundColor3 = ACCENT,
            Font = Enum.Font.GothamBlack, TextSize = 16, TextColor3 = WHITE, Text = txt,
        }, f)
        corner(b, 6)
        b.MouseButton1Click:Connect(function()
            Cfg[key] = math.clamp(Cfg[key] + delta, min, max)
            render()
            save()
            if cb then pcall(cb, Cfg[key]) end
        end)
    end
    mk("-", -88, -step)
    mk("+", -46, step)
    render()
end

-- Bouton couleur : chaque tap passe a la couleur suivante
local function colorPicker(page, text, key, cb)
    local b = make("TextButton", {
        Size = UDim2.new(1, -6, 0, 34), BackgroundColor3 = EL, Font = Enum.Font.GothamMedium,
        TextSize = 13, TextColor3 = WHITE, TextXAlignment = Enum.TextXAlignment.Left, LayoutOrder = nextOrder(),
    }, page)
    corner(b, 7)
    local sw = make("Frame", { Size = UDim2.new(0, 22, 0, 22), Position = UDim2.new(1, -32, 0.5, -11) }, b)
    corner(sw, 11)
    local function render()
        local p = Palette[Cfg[key]] or Palette[9]
        b.Text = "   " .. text .. "  (" .. p[1] .. ")"
        sw.BackgroundColor3 = p[2]
    end
    b.MouseButton1Click:Connect(function()
        Cfg[key] = (Cfg[key] % #Palette) + 1
        render()
        save()
        if cb then pcall(cb) end
    end)
    render()
end

local function button(page, text, cb, color)
    local b = make("TextButton", {
        Size = UDim2.new(1, -6, 0, 34), BackgroundColor3 = color or ACCENT, Font = Enum.Font.GothamBold,
        TextSize = 13, TextColor3 = WHITE, Text = text, LayoutOrder = nextOrder(),
    }, page)
    corner(b, 7)
    b.MouseButton1Click:Connect(function() pcall(cb) end)
end

-- Deplacement de la fenetre
do
    local dragging, start, startPos, dragInput
    Top.InputBegan:Connect(function(input)
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
    Size = UDim2.new(0, 50, 0, 50), Position = UDim2.new(0, 10, 0.4, 0), BackgroundColor3 = WHITE,
    Font = Enum.Font.GothamBlack, TextSize = 22, TextColor3 = WHITE, Text = "A",
}, Gui)
corner(Open, 25)
make("UIGradient", { Color = ColorSequence.new(ACCENT, ACCENT2), Rotation = 45 }, Open)
Open.MouseButton1Click:Connect(function() Main.Visible = not Main.Visible end)

--================ ESP ================--
local ESP = {}
local TracerTargets = {}
local MAX_HL = 24

local function colorOf(cat)
    local p = Palette[Cfg["Col_" .. cat]] or Palette[9]
    return p[2]
end

local function getPart(obj)
    if obj:IsA("BasePart") then return obj end
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
        if tries <= 8 then
            task.delay(0.5, function() addEsp(obj, cat, text, partName, tries) end)
        end
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
    ESP[obj] = { hl = hl, bb = bb, txt = t, cat = cat, label = text, part = part, color = color }
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
            e.bb.Enabled = showText
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
                    if Cfg.Names and Cfg.Distance then
                        e.txt.Text = e.label .. "\n[" .. m .. "m]"
                    elseif Cfg.Names then
                        e.txt.Text = e.label
                    else
                        e.txt.Text = "[" .. m .. "m]"
                    end
                end
                e.score = CatPrio[e.cat] * 100000 + dist
                table.insert(list, e)
            else
                e.hl.Enabled = false
            end
        end
    end
    -- Contours attribues par priorite de categorie puis par distance
    table.sort(list, function(a, b) return a.score < b.score end)
    local fill = Cfg.Fill / 100
    for i, e in ipairs(list) do
        e.hl.Enabled = Cfg.Outlines and i <= MAX_HL
        e.hl.FillTransparency = fill
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
    for i = n + 1, #TracerPool do TracerPool[i].Visible = false end
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
    if Cfg.Alerts then notify("! " .. name, AlertText[name], Color3.fromRGB(255, 60, 60)) end
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
            if Cfg.InstantPrompt or Cfg.Reach then applyPrompt(inst) end
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
    if o:IsA("BlurEffect") or o:IsA("DepthOfFieldEffect") then Blurs[o] = o.Enabled end
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
on(RunService.RenderStepped, function()
    -- Tant que rien n'est actif, on suit l'eclairage du jeu pour pouvoir le restaurer fidelement
    if Cfg.Fullbright or Cfg.NoFog then
        if Cfg.Fullbright then
            Lighting.Ambient = WHITE
            Lighting.Brightness = 2
            Lighting.GlobalShadows = false
        end
        if Cfg.NoFog then
            Lighting.FogEnd = 100000
        end
    else
        snapshot()
    end

    local char = LP.Character
    local hum = char and char:FindFirstChildOfClass("Humanoid")
    if hum then
        if Cfg.Speed then hum.WalkSpeed = Cfg.SpeedValue end
        if Cfg.Jump then
            if hum.UseJumpPower then
                if hum.JumpPower < 40 then hum.JumpPower = 45 end
            elseif hum.JumpHeight < 5 then
                hum.JumpHeight = 6
            end
        end
    end
    if Cfg.Fov and workspace.CurrentCamera then
        workspace.CurrentCamera.FieldOfView = Cfg.FovValue
    end
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

-- Auto-ramassage : or, objets, tiroirs (fireproximityprompt requis)
task.spawn(function()
    while Alive do
        if fireproximityprompt and (Cfg.AutoGold or Cfg.AutoItems or Cfg.AutoDrawers) then
            local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
            if root then
                for obj, kind in pairs(Loot) do
                    if not obj.Parent then
                        Loot[obj] = nil
                    elseif (kind == "gold" and Cfg.AutoGold) or (kind == "item" and Cfg.AutoItems)
                        or (kind == "drawer" and Cfg.AutoDrawers) then
                        local pr = obj:FindFirstChildWhichIsA("ProximityPrompt", true)
                        local pt = getPart(obj)
                        if pr and pt and pr.Enabled and (pt.Position - root.Position).Magnitude <= pr.MaxActivationDistance then
                            pcall(fireproximityprompt, pr)
                        end
                    end
                end
            end
        end
        task.wait(0.35)
    end
end)

--================ ONGLETS ================--
local PE = newTab("ESP")
section(PE, "Categories")
for _, c in ipairs(Cats) do toggle(PE, c.name, "Esp_" .. c.key) end
section(PE, "Affichage")
toggle(PE, "Contours", "Outlines")
toggle(PE, "Noms", "Names")
toggle(PE, "Distance", "Distance")
toggle(PE, "Tracers (lignes)", "Tracers")
toggle(PE, "Arc-en-ciel", "Rainbow")
stepper(PE, "Transparence %", "Fill", 0, 100, 10)

local PC = newTab("Couleurs")
section(PC, "Touche pour changer la couleur")
for _, c in ipairs(Cats) do colorPicker(PC, c.name, "Col_" .. c.key) end

local PW = newTab("Monde")
section(PW, "Lumiere")
toggle(PW, "Fullbright", "Fullbright", function(s) if not s and not Cfg.NoFog then restoreLight() end end)
toggle(PW, "Sans brouillard", "NoFog", function(s) if not s and not Cfg.Fullbright then restoreLight() end end)
toggle(PW, "Anti-flou", "AntiBlur", function(s)
    if not s then
        for b, was in pairs(Blurs) do if b.Parent then b.Enabled = was end end
    end
end)

local PP = newTab("Joueur")
section(PP, "Mouvement")
toggle(PP, "Speed", "Speed", function(s)
    local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
    if not hum then return end
    if s then defaultSpeed = hum.WalkSpeed elseif defaultSpeed then hum.WalkSpeed = defaultSpeed end
end)
stepper(PP, "Vitesse", "SpeedValue", 15, 30, 1)
label(PP, "Au-dela de ~22 l'anti-cheat de DOORS te ramene en arriere.")
toggle(PP, "Activer le saut", "Jump", function(s)
    local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
    if not hum then return end
    if s then
        defaultJump = { hum.JumpPower, hum.JumpHeight }
        hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, true)
    elseif defaultJump then
        hum.JumpPower, hum.JumpHeight = defaultJump[1], defaultJump[2]
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
    for obj in pairs(ESP) do removeEsp(obj) end
    Cfg.InstantPrompt, Cfg.Reach = false, false
    refreshPrompts()
    pcall(restoreLight)
    for b, was in pairs(Blurs) do if b.Parent then pcall(function() b.Enabled = was end) end end
    local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
    if hum and Cfg.Speed and defaultSpeed then hum.WalkSpeed = defaultSpeed end
    if Cfg.Fov and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = 70 end
    Gui:Destroy()
    G.AbyssStop = nil
end
G.AbyssStop = stop
button(PI, "Fermer le script", stop, Color3.fromRGB(120, 35, 50))

selectTab(1)
notify("ABYSS HUB V3", "Charge ! Touche le bouton A.", ACCENT)
