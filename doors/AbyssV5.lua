-- ABYSS HUB V5 // DOORS
-- Script client unique (executeur mobile ou LocalScript). ASCII uniquement : les editeurs
-- mobiles abiment les caracteres accentues et rendent le script inexecutable.
local VERSION = "5.0"

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UIS = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")
local HttpService = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local LP = Players.LocalPlayer
local PlayerGui = LP:WaitForChild("PlayerGui")

-- Une seule instance a la fois : on arrete proprement les versions precedentes
local G = (getgenv and getgenv()) or _G
for _, k in ipairs({ "AbyssStop", "AbyssLiteStop" }) do
    local f = G[k]
    if type(f) == "function" then
        local ok, err = pcall(f)
        if not ok then warn("[Abyss] arret de l'ancienne instance impossible : " .. tostring(err)) end
    end
end

local Alive = true
local Conns = {}
local Cleanups = {}

--============================================================--
-- JOURNAL + GESTION D'ERREURS
--============================================================--
local Log = { entries = {}, seq = 0, listeners = {} }
local MAX_LOG = 300

local function firstLine(s)
    s = tostring(s)
    return (s:match("^[^\n]*")) or s
end

function Log.add(level, moduleName, msg)
    Log.seq = Log.seq + 1
    local e = { id = Log.seq, t = os.date("%H:%M:%S"), level = level, module = moduleName, msg = tostring(msg) }
    table.insert(Log.entries, e)
    if #Log.entries > MAX_LOG then table.remove(Log.entries, 1) end
    local line = "[Abyss][" .. level .. "][" .. moduleName .. "] " .. e.msg
    if level == "ERROR" or level == "WARN" then warn(line) else print(line) end
    -- Les ecouteurs sont l'UI du journal : leur echec ne doit pas relancer Log.add (boucle infinie),
    -- on le signale donc directement dans la console
    for _, fn in ipairs(Log.listeners) do
        local ok, err = pcall(fn, e)
        if not ok then warn("[Abyss][Log] ecouteur en echec : " .. tostring(err)) end
    end
end

local Modules = {}
local ModuleOrder = {}
local function declare(name)
    Modules[name] = { name = name, errors = 0, lastError = nil, status = "OK" }
    table.insert(ModuleOrder, name)
end
for _, n in ipairs({ "UI", "Config", "ESP", "Detection", "Fullbright", "Joueur", "Auto", "Entites", "Crucifix", "AutoTest" }) do
    declare(n)
end

local onError -- defini par l'UI (notification d'erreur)

local function fail(moduleName, err)
    local m = Modules[moduleName]
    if m then
        m.errors = m.errors + 1
        m.lastError = firstLine(err)
        m.status = "Erreur"
    end
    Log.add("ERROR", moduleName, err)
    if onError then
        local ok, e2 = pcall(onError, moduleName, firstLine(err))
        if not ok then warn("[Abyss] notification d'erreur impossible : " .. tostring(e2)) end
    end
end

-- Execute fn ; une erreur est journalisee avec sa trace et rattachee a son module,
-- sans bloquer les autres modules
local function guard(moduleName, fn, ...)
    local res = table.pack(xpcall(fn, function(e) return debug.traceback(tostring(e), 2) end, ...))
    if not res[1] then
        fail(moduleName, res[2])
        return false, res[2]
    end
    return true, table.unpack(res, 2, res.n)
end

local function on(moduleName, signal, fn)
    local c = signal:Connect(function(...)
        if Alive then guard(moduleName, fn, ...) end
    end)
    table.insert(Conns, c)
    return c
end

local function every(moduleName, interval, fn)
    task.spawn(function()
        while Alive do
            guard(moduleName, fn)
            task.wait(interval)
        end
    end)
end

local function onCleanup(fn)
    table.insert(Cleanups, fn)
end

--============================================================--
-- CONFIGURATION VALIDEE
--============================================================--
local Cfg, Schema, SchemaOrder = {}, {}, {}
local function def(key, default, min, max)
    Schema[key] = { default = default, min = min, max = max }
    table.insert(SchemaOrder, key)
    Cfg[key] = default
end

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

local Accents = {
    { "Rouge", Color3.fromRGB(255, 55, 85) },
    { "Violet", Color3.fromRGB(150, 90, 255) },
    { "Cyan", Color3.fromRGB(60, 200, 255) },
    { "Vert", Color3.fromRGB(70, 220, 130) },
    { "Orange", Color3.fromRGB(255, 150, 50) },
    { "Rose", Color3.fromRGB(255, 90, 190) },
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
local CatByKey = {}
for _, c in ipairs(Cats) do CatByKey[c.key] = c end

-- ESP
def("EspEnabled", true)
for _, c in ipairs(Cats) do
    def("Esp_" .. c.key, false)
    def("Col_" .. c.key, c.col, 1, #Palette)
end
def("EspNames", true)
def("EspDistance", true)
def("EspInfo", false)
def("EspOutlines", true)
def("EspTracers", false)
def("EspRainbow", false)
def("EspFill", 70, 0, 100)
def("EspTextSize", 13, 9, 22)
-- Fullbright
def("Fullbright", false)
def("FBBrightness", 2, 1, 5)
def("NoFog", false)
def("AntiBlur", false)
-- Joueur
def("Speed", false)
def("SpeedValue", 20, 15, 30)
def("Jump", false)
def("Fov", false)
def("FovValue", 90, 70, 120)
-- Entites
def("Alerts", true)
def("AntiScreech", false)
-- Auto
def("InstantPrompt", false)
def("Reach", false)
def("AutoGold", false)
def("AutoItems", false)
def("AutoDrawers", false)
-- Crucifix
def("CrossInfinite", true)
def("CrossUses", 10, 1, 100)
def("CrossRange", 60, 10, 500)
def("CrossAnything", true)
-- Interface
def("Accent", 1, 1, #Accents)
def("UiScale", 100, 60, 140)
def("Animations", true)
def("Compact", false)
def("NotifyWarnings", true)
def("NotifyErrors", true)

local function validate(key, value)
    local s = Schema[key]
    if not s or type(value) ~= type(s.default) then return nil end
    if type(value) == "number" then
        if value ~= value then return nil end
        value = math.clamp(value, s.min, s.max)
    end
    return value
end

local SAVE = "AbyssV5_Doors.json"
local canSave = (type(writefile) == "function" and type(readfile) == "function" and type(isfile) == "function")

do
    if canSave then
        local ok, res = pcall(function()
            if not isfile(SAVE) then return nil end
            return HttpService:JSONDecode(readfile(SAVE))
        end)
        if not ok then
            Log.add("WARN", "Config", "Sauvegarde illisible, reglages par defaut : " .. firstLine(res))
        elseif type(res) == "table" then
            local applied, rejected = 0, 0
            for k, v in pairs(res) do
                local val = validate(k, v)
                if val ~= nil then
                    Cfg[k] = val
                    applied = applied + 1
                else
                    rejected = rejected + 1
                end
            end
            Log.add("INFO", "Config", applied .. " reglages charges, " .. rejected .. " ignores")
        end
    else
        Log.add("WARN", "Config", "writefile/readfile indisponibles : reglages non sauvegardes")
    end
end

local saveQueued = false
local function save()
    if not canSave or saveQueued then return end
    saveQueued = true
    task.delay(1, function()
        saveQueued = false
        if not Alive then return end
        local ok, err = pcall(function() writefile(SAVE, HttpService:JSONEncode(Cfg)) end)
        if not ok then Log.add("WARN", "Config", "Sauvegarde impossible : " .. firstLine(err)) end
    end)
end

--============================================================--
-- ETAT CENTRAL : un seul chemin pour modifier un reglage
--============================================================--
local Renderers, Appliers = {}, {}

local function rerender(key)
    for _, fn in ipairs(Renderers[key] or {}) do guard("UI", fn) end
end

local function addRenderer(key, fn)
    Renderers[key] = Renderers[key] or {}
    table.insert(Renderers[key], fn)
end

-- Associe une cle a la fonction qui l'applique reellement. fn(new, old) peut retourner false
local function bind(key, moduleName, fn)
    Appliers[key] = { module = moduleName, fn = fn }
end

local notify -- defini plus bas

-- Change un reglage ; si l'application echoue, la valeur precedente est restauree et affichee
local function setKey(key, value)
    local val = validate(key, value)
    if val == nil then
        Log.add("WARN", "Config", "Valeur invalide pour " .. key .. " : " .. tostring(value))
        return false
    end
    local old = Cfg[key]
    if old == val then return true end
    Cfg[key] = val
    local ap = Appliers[key]
    if ap then
        local ok, res = guard(ap.module, ap.fn, val, old)
        if not ok or res == false then
            Cfg[key] = old
            rerender(key)
            Log.add("WARN", ap.module, "Echec du changement de " .. key .. ", valeur restauree")
            return false
        end
    end
    rerender(key)
    save()
    return true
end

--============================================================--
-- THEME
--============================================================--
local T = {
    BG = Color3.fromRGB(12, 12, 16),
    Panel = Color3.fromRGB(18, 18, 24),
    Elem = Color3.fromRGB(25, 25, 33),
    ElemHi = Color3.fromRGB(33, 33, 44),
    Line = Color3.fromRGB(44, 44, 58),
    Text = Color3.fromRGB(236, 236, 245),
    Sub = Color3.fromRGB(145, 145, 168),
    Ok = Color3.fromRGB(80, 220, 120),
    Warn = Color3.fromRGB(255, 170, 50),
    Err = Color3.fromRGB(255, 70, 80),
}
local function accent() return Accents[Cfg.Accent][2] end

local ThemeHooks = {}
local function onTheme(fn)
    table.insert(ThemeHooks, fn)
    guard("UI", fn)
end
local function applyTheme()
    for _, fn in ipairs(ThemeHooks) do guard("UI", fn) end
end

--============================================================--
-- UI : PRIMITIVES
--============================================================--
local function make(class, props, parent)
    local o = Instance.new(class)
    for k, v in pairs(props) do o[k] = v end
    if parent then o.Parent = parent end
    return o
end

local function corner(p, r) return make("UICorner", { CornerRadius = UDim.new(0, r or 6) }, p) end
local function stroke(p, color) return make("UIStroke", { Color = color or T.Line, Thickness = 1 }, p) end

local function anim(inst, t, props)
    if not Cfg.Animations or t <= 0 then
        for k, v in pairs(props) do inst[k] = v end
        return
    end
    TweenService:Create(inst, TweenInfo.new(t, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), props):Play()
end

local function rowH() return Cfg.Compact and 30 or 36 end
local Rows = {}
local function regRow(frame)
    table.insert(Rows, frame)
    frame.Size = UDim2.new(1, 0, 0, rowH())
end

local Gui = make("ScreenGui", {
    Name = "AbyssV5", ResetOnSpawn = false, IgnoreGuiInset = true,
    ZIndexBehavior = Enum.ZIndexBehavior.Sibling, DisplayOrder = 999,
})
Gui.Parent = PlayerGui
onCleanup(function() Gui:Destroy() end)

-- Calque des tracers, cree avant la fenetre pour rester dessous
local TracerLayer = make("Frame", { Name = "Tracers", Size = UDim2.new(1, 0, 1, 0), BackgroundTransparency = 1 }, Gui)

--============================================================--
-- NOTIFICATIONS (4 maximum a l'ecran)
--============================================================--
local NotifBox = make("Frame", {
    Name = "Notifications", Size = UDim2.new(0, 250, 1, -20), Position = UDim2.new(1, -260, 0, 10),
    BackgroundTransparency = 1,
}, Gui)
make("UIListLayout", {
    Padding = UDim.new(0, 6), VerticalAlignment = Enum.VerticalAlignment.Bottom,
    SortOrder = Enum.SortOrder.LayoutOrder,
}, NotifBox)

local Active = {}
local MAX_NOTIF = 4
local lastNotif = {}

function notify(kind, title, text)
    if not Alive then return end
    local color = (kind == "ok" and T.Ok) or (kind == "warn" and T.Warn) or (kind == "error" and T.Err) or accent()
    local sig = title .. "|" .. tostring(text)
    if lastNotif[sig] and os.clock() - lastNotif[sig] < 3 then return end
    lastNotif[sig] = os.clock()

    while #Active >= MAX_NOTIF do
        local old = table.remove(Active, 1)
        old:Destroy()
    end

    local f = make("Frame", {
        Name = "Notif", Size = UDim2.new(1, 0, 0, 56), BackgroundColor3 = T.Panel, LayoutOrder = Log.seq + #Active,
    }, NotifBox)
    corner(f, 7)
    stroke(f)
    local bar = make("Frame", { Size = UDim2.new(0, 3, 1, -12), Position = UDim2.new(0, 6, 0, 6), BackgroundColor3 = color, BorderSizePixel = 0 }, f)
    corner(bar, 2)
    make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -24, 0, 18), Position = UDim2.new(0, 16, 0, 6),
        Font = Enum.Font.GothamBold, TextSize = 13, TextXAlignment = Enum.TextXAlignment.Left,
        TextColor3 = color, Text = title, TextTruncate = Enum.TextTruncate.AtEnd,
    }, f)
    make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -24, 0, 26), Position = UDim2.new(0, 16, 0, 25),
        Font = Enum.Font.Gotham, TextSize = 11, TextWrapped = true, TextXAlignment = Enum.TextXAlignment.Left,
        TextYAlignment = Enum.TextYAlignment.Top, TextColor3 = T.Text, Text = tostring(text or ""),
        TextTruncate = Enum.TextTruncate.AtEnd,
    }, f)
    table.insert(Active, f)
    f.Position = UDim2.new(0, 30, 0, 0)
    anim(f, 0.2, { Position = UDim2.new(0, 0, 0, 0) })

    task.delay(4, function()
        for i, x in ipairs(Active) do
            if x == f then table.remove(Active, i) break end
        end
        f:Destroy()
    end)
end

onError = function(moduleName, msg)
    if Cfg.NotifyErrors then notify("error", "Erreur : " .. moduleName, msg) end
end

--============================================================--
-- FENETRE
--============================================================--
local Main = make("Frame", {
    Name = "Main", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
    Size = UDim2.new(0, 540, 0, 330), BackgroundColor3 = T.BG, Active = true, ClipsDescendants = true,
}, Gui)
corner(Main, 9)
stroke(Main)
local MainScale = make("UIScale", {}, Main)

local function baseScale()
    local cam = workspace.CurrentCamera
    local auto = 1
    if cam then
        local vp = cam.ViewportSize
        auto = math.clamp(math.min(vp.X / 760, vp.Y / 400), 0.55, 1.25)
    end
    return auto * Cfg.UiScale / 100
end
local function rescale() MainScale.Scale = baseScale() end
rescale()

local Header = make("Frame", { Name = "Header", Size = UDim2.new(1, 0, 0, 36), BackgroundColor3 = T.Panel, BorderSizePixel = 0, Active = true }, Main)
local HeaderLine = make("Frame", { Size = UDim2.new(1, 0, 0, 1), Position = UDim2.new(0, 0, 1, -1), BorderSizePixel = 0 }, Header)
onTheme(function() HeaderLine.BackgroundColor3 = accent() end)

local Logo = make("TextLabel", {
    Size = UDim2.new(0, 22, 0, 22), Position = UDim2.new(0, 10, 0.5, -11), Font = Enum.Font.GothamBlack,
    TextSize = 13, TextColor3 = T.BG, Text = "A",
}, Header)
corner(Logo, 5)
onTheme(function() Logo.BackgroundColor3 = accent() end)
make("TextLabel", {
    BackgroundTransparency = 1, Size = UDim2.new(0, 120, 1, 0), Position = UDim2.new(0, 40, 0, 0),
    Font = Enum.Font.GothamBlack, TextSize = 15, TextColor3 = T.Text, TextXAlignment = Enum.TextXAlignment.Left,
    Text = "ABYSS HUB",
}, Header)
local VersionPill = make("TextLabel", {
    Size = UDim2.new(0, 70, 0, 18), Position = UDim2.new(0, 136, 0.5, -9), Font = Enum.Font.GothamBold,
    TextSize = 10, BackgroundColor3 = T.Elem, TextColor3 = T.Sub, Text = "DOORS  v" .. VERSION,
}, Header)
corner(VersionPill, 9)

local function headerButton(name, text, x)
    local b = make("TextButton", {
        Name = name, Size = UDim2.new(0, 28, 0, 24), Position = UDim2.new(1, x, 0.5, -12), BackgroundColor3 = T.Elem,
        AutoButtonColor = false, Font = Enum.Font.GothamBold, TextSize = 13, TextColor3 = T.Text, Text = text,
    }, Header)
    corner(b, 5)
    return b
end
local MinBtn = headerButton("Btn_Minimize", "_", -66)
local CloseBtn = headerButton("Btn_Close", "X", -34)

local Side = make("ScrollingFrame", {
    Name = "Sidebar", Size = UDim2.new(0, 132, 1, -58), Position = UDim2.new(0, 0, 0, 36), BackgroundColor3 = T.Panel,
    BorderSizePixel = 0, ScrollBarThickness = 0, CanvasSize = UDim2.new(0, 0, 0, 0),
    AutomaticCanvasSize = Enum.AutomaticSize.Y,
}, Main)
make("UIListLayout", { Padding = UDim.new(0, 3), SortOrder = Enum.SortOrder.LayoutOrder }, Side)
make("UIPadding", { PaddingTop = UDim.new(0, 8), PaddingLeft = UDim.new(0, 7), PaddingRight = UDim.new(0, 7) }, Side)

local Content = make("Frame", {
    Name = "Content", Size = UDim2.new(1, -144, 1, -66), Position = UDim2.new(0, 138, 0, 40), BackgroundTransparency = 1,
}, Main)
local PageTitle = make("TextLabel", {
    BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 20), Font = Enum.Font.GothamBold, TextSize = 15,
    TextColor3 = T.Text, TextXAlignment = Enum.TextXAlignment.Left, Text = "",
}, Content)
local PageSub = make("TextLabel", {
    BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 14), Position = UDim2.new(0, 0, 0, 20),
    Font = Enum.Font.Gotham, TextSize = 11, TextColor3 = T.Sub, TextXAlignment = Enum.TextXAlignment.Left,
    Text = "", TextTruncate = Enum.TextTruncate.AtEnd,
}, Content)
local PageHolder = make("Frame", {
    Name = "Pages", Size = UDim2.new(1, 0, 1, -40), Position = UDim2.new(0, 0, 0, 40), BackgroundTransparency = 1,
    ClipsDescendants = true,
}, Content)

local StatusBar = make("Frame", {
    Name = "StatusBar", Size = UDim2.new(1, 0, 0, 22), Position = UDim2.new(0, 0, 1, -22), BackgroundColor3 = T.Panel,
    BorderSizePixel = 0,
}, Main)
local StatusText = make("TextLabel", {
    BackgroundTransparency = 1, Size = UDim2.new(1, -16, 1, 0), Position = UDim2.new(0, 8, 0, 0),
    Font = Enum.Font.GothamMedium, TextSize = 11, TextColor3 = T.Sub, TextXAlignment = Enum.TextXAlignment.Left,
    Text = "Initialisation...", RichText = true, TextTruncate = Enum.TextTruncate.AtEnd,
}, StatusBar)

-- Deplacement (tactile + souris) par l'en-tete
do
    local dragging, dragInput, start, startPos
    on("UI", Header.InputBegan, function(input)
        local t = input.UserInputType
        if t == Enum.UserInputType.Touch or t == Enum.UserInputType.MouseButton1 then
            dragging, dragInput, start, startPos = true, input, input.Position, Main.Position
        end
    end)
    on("UI", UIS.InputChanged, function(input)
        if dragging and (input == dragInput or input.UserInputType == Enum.UserInputType.MouseMovement) then
            local d = input.Position - start
            Main.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + d.X, startPos.Y.Scale, startPos.Y.Offset + d.Y)
        end
    end)
    on("UI", UIS.InputEnded, function(input)
        if input == dragInput or input.UserInputType == Enum.UserInputType.MouseButton1 then dragging = false end
    end)
end

local OpenBtn = make("TextButton", {
    Name = "Btn_Open", Size = UDim2.new(0, 46, 0, 46), Position = UDim2.new(0, 10, 0.4, 0),
    Font = Enum.Font.GothamBlack, TextSize = 20, TextColor3 = T.BG, Text = "A", AutoButtonColor = false,
}, Gui)
corner(OpenBtn, 12)
onTheme(function() OpenBtn.BackgroundColor3 = accent() end)

local function setWindow(visible)
    if visible then
        Main.Visible = true
        MainScale.Scale = baseScale() * 0.92
        anim(MainScale, 0.18, { Scale = baseScale() })
    else
        Main.Visible = false
    end
end

--============================================================--
-- UI : COMPOSANTS
--============================================================--
local Pages, NavItems, PageInfo = {}, {}, {}
local currentPage = 0
local PageVisibleHooks = {}

local function selectPage(i)
    if not Pages[i] then return end
    currentPage = i
    for k, p in ipairs(Pages) do
        local activeNow = (k == i)
        p.Visible = activeNow
        local n = NavItems[k]
        n.btn.BackgroundColor3 = activeNow and T.ElemHi or T.Panel
        n.txt.TextColor3 = activeNow and T.Text or T.Sub
        n.bar.Visible = activeNow
    end
    PageTitle.Text = PageInfo[i].title
    PageSub.Text = PageInfo[i].sub
    local p = Pages[i]
    p.Position = UDim2.new(0, 14, 0, 0)
    anim(p, 0.18, { Position = UDim2.new(0, 0, 0, 0) })
    if PageVisibleHooks[i] then guard("UI", PageVisibleHooks[i]) end
end
onTheme(function()
    for _, n in ipairs(NavItems) do
        n.bar.BackgroundColor3 = accent()
        n.badge.BackgroundColor3 = accent()
    end
end)

local function newPage(id, title, sub, badgeText)
    local i = #Pages + 1
    local btn = make("TextButton", {
        Name = "Nav_" .. id, Size = UDim2.new(1, 0, 0, 32), BackgroundColor3 = T.Panel, AutoButtonColor = false,
        Text = "", LayoutOrder = i,
    }, Side)
    corner(btn, 6)
    local bar = make("Frame", { Size = UDim2.new(0, 3, 0, 16), Position = UDim2.new(0, 0, 0.5, -8), BorderSizePixel = 0, Visible = false }, btn)
    corner(bar, 2)
    local badge = make("TextLabel", {
        Size = UDim2.new(0, 18, 0, 18), Position = UDim2.new(0, 8, 0.5, -9), Font = Enum.Font.GothamBlack,
        TextSize = 10, TextColor3 = T.BG, Text = badgeText,
    }, btn)
    corner(badge, 4)
    local txt = make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -34, 1, 0), Position = UDim2.new(0, 32, 0, 0),
        Font = Enum.Font.GothamBold, TextSize = 12, TextColor3 = T.Sub, TextXAlignment = Enum.TextXAlignment.Left,
        Text = title, TextTruncate = Enum.TextTruncate.AtEnd,
    }, btn)
    local page = make("ScrollingFrame", {
        Name = "Page_" .. id, Size = UDim2.new(1, 0, 1, 0), BackgroundTransparency = 1, BorderSizePixel = 0,
        ScrollBarThickness = 3, CanvasSize = UDim2.new(0, 0, 0, 0), AutomaticCanvasSize = Enum.AutomaticSize.Y,
        Visible = false,
    }, PageHolder)
    onTheme(function() page.ScrollBarImageColor3 = accent() end)
    make("UIListLayout", { Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }, page)
    make("UIPadding", { PaddingRight = UDim.new(0, 7), PaddingBottom = UDim.new(0, 8) }, page)
    page:SetAttribute("Order", 0)
    Pages[i] = page
    NavItems[i] = { btn = btn, bar = bar, txt = txt, badge = badge }
    PageInfo[i] = { title = title, sub = sub, id = id }
    on("UI", btn.MouseButton1Click, function() selectPage(i) end)
    return page, i
end

local function nextOrder(page)
    local o = page:GetAttribute("Order") + 1
    page:SetAttribute("Order", o)
    return o
end

local function section(page, text)
    local l = make("TextLabel", {
        Size = UDim2.new(1, 0, 0, 22), BackgroundTransparency = 1, Font = Enum.Font.GothamBlack, TextSize = 10,
        TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Bottom,
        Text = string.upper(text), LayoutOrder = nextOrder(page),
    }, page)
    onTheme(function() l.TextColor3 = accent() end)
end

local function note(page, text)
    return make("TextLabel", {
        Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1,
        Font = Enum.Font.Gotham, TextSize = 11, TextWrapped = true, TextColor3 = T.Sub,
        TextXAlignment = Enum.TextXAlignment.Left, Text = text, LayoutOrder = nextOrder(page), RichText = true,
    }, page)
end

-- Ligne "libelle : valeur" mise a jour par les modules ; retourne une fonction set(texte, couleur)
local function info(page, labelText)
    local f = make("Frame", { BackgroundColor3 = T.Elem, LayoutOrder = nextOrder(page) }, page)
    regRow(f)
    corner(f, 6)
    make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(0.45, -10, 1, 0), Position = UDim2.new(0, 10, 0, 0),
        Font = Enum.Font.GothamMedium, TextSize = 12, TextColor3 = T.Sub, TextXAlignment = Enum.TextXAlignment.Left,
        Text = labelText, TextTruncate = Enum.TextTruncate.AtEnd,
    }, f)
    local v = make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(0.55, -10, 1, 0), Position = UDim2.new(0.45, 0, 0, 0),
        Font = Enum.Font.GothamBold, TextSize = 12, TextColor3 = T.Text, TextXAlignment = Enum.TextXAlignment.Right,
        Text = "-", TextTruncate = Enum.TextTruncate.AtEnd,
    }, f)
    return function(text, color)
        v.Text = tostring(text)
        v.TextColor3 = color or T.Text
    end
end

local function toggle(page, text, key)
    local b = make("TextButton", {
        Name = "Toggle_" .. key, BackgroundColor3 = T.Elem, AutoButtonColor = false, Text = "",
        LayoutOrder = nextOrder(page),
    }, page)
    regRow(b)
    corner(b, 6)
    make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -62, 1, 0), Position = UDim2.new(0, 10, 0, 0),
        Font = Enum.Font.GothamMedium, TextSize = 12, TextColor3 = T.Text, TextXAlignment = Enum.TextXAlignment.Left,
        Text = text, TextTruncate = Enum.TextTruncate.AtEnd,
    }, b)
    local track = make("Frame", { Size = UDim2.new(0, 36, 0, 18), Position = UDim2.new(1, -46, 0.5, -9), BackgroundColor3 = T.Line }, b)
    corner(track, 9)
    local knob = make("Frame", { Size = UDim2.new(0, 14, 0, 14), Position = UDim2.new(0, 2, 0.5, -7), BackgroundColor3 = T.Text }, track)
    corner(knob, 7)
    local function render()
        local s = Cfg[key] == true
        anim(track, 0.15, { BackgroundColor3 = s and accent() or T.Line })
        anim(knob, 0.15, { Position = s and UDim2.new(1, -16, 0.5, -7) or UDim2.new(0, 2, 0.5, -7) })
    end
    addRenderer(key, render)
    onTheme(render)
    on("UI", b.MouseButton1Click, function() setKey(key, not Cfg[key]) end)
end

-- Boutons - / + : plus fiables au doigt qu'un slider
local function stepper(page, text, key, step, suffix)
    local s = Schema[key]
    local f = make("Frame", { Name = "Stepper_" .. key, BackgroundColor3 = T.Elem, LayoutOrder = nextOrder(page) }, page)
    regRow(f)
    corner(f, 6)
    local lbl = make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -100, 1, 0), Position = UDim2.new(0, 10, 0, 0),
        Font = Enum.Font.GothamMedium, TextSize = 12, TextColor3 = T.Text, TextXAlignment = Enum.TextXAlignment.Left,
        TextTruncate = Enum.TextTruncate.AtEnd,
    }, f)
    local function render() lbl.Text = text .. " :  " .. tostring(Cfg[key]) .. (suffix or "") end
    addRenderer(key, render)
    local function mk(name, txt, x, delta)
        local b = make("TextButton", {
            Name = name, Size = UDim2.new(0, 38, 0, 24), Position = UDim2.new(1, x, 0.5, -12), BackgroundColor3 = T.BG,
            AutoButtonColor = false, Font = Enum.Font.GothamBlack, TextSize = 14, Text = txt,
        }, f)
        corner(b, 5)
        stroke(b)
        onTheme(function() b.TextColor3 = accent() end)
        on("UI", b.MouseButton1Click, function()
            setKey(key, math.clamp(Cfg[key] + delta, s.min, s.max))
        end)
    end
    mk("Minus", "-", -86, -step)
    mk("Plus", "+", -44, step)
    render()
end

-- Choix dans une liste (couleurs) : chaque tap passe a l'element suivant
local function cycle(page, text, key, list)
    local b = make("TextButton", {
        Name = "Cycle_" .. key, BackgroundColor3 = T.Elem, AutoButtonColor = false, Text = "",
        LayoutOrder = nextOrder(page),
    }, page)
    regRow(b)
    corner(b, 6)
    local lbl = make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -44, 1, 0), Position = UDim2.new(0, 10, 0, 0),
        Font = Enum.Font.GothamMedium, TextSize = 12, TextColor3 = T.Text, TextXAlignment = Enum.TextXAlignment.Left,
        TextTruncate = Enum.TextTruncate.AtEnd,
    }, b)
    local sw = make("Frame", { Size = UDim2.new(0, 18, 0, 18), Position = UDim2.new(1, -28, 0.5, -9) }, b)
    corner(sw, 9)
    stroke(sw)
    local function render()
        local item = list[Cfg[key]]
        lbl.Text = text .. "  -  " .. item[1]
        sw.BackgroundColor3 = item[2]
    end
    addRenderer(key, render)
    on("UI", b.MouseButton1Click, function() setKey(key, (Cfg[key] % #list) + 1) end)
    render()
end

-- Bouton d'action : ignore les clics pendant l'execution pour ne jamais lancer deux fois l'action
local function button(page, text, id, fn, style)
    local b = make("TextButton", {
        Name = "Btn_" .. id, AutoButtonColor = false, Font = Enum.Font.GothamBold, TextSize = 12,
        TextColor3 = T.Text, Text = text, LayoutOrder = nextOrder(page),
    }, page)
    regRow(b)
    corner(b, 6)
    if style == "danger" then
        b.BackgroundColor3 = Color3.fromRGB(110, 30, 45)
    elseif style == "plain" then
        b.BackgroundColor3 = T.ElemHi
        stroke(b)
    else
        onTheme(function() b.BackgroundColor3 = accent() end)
    end
    local busy = false
    on("UI", b.MouseButton1Click, function()
        if busy then return end
        busy = true
        task.spawn(function()
            guard("UI", fn)
            busy = false
        end)
    end)
    return b
end

local function regRowsRefresh()
    for _, r in ipairs(Rows) do
        if r.Parent then r.Size = UDim2.new(1, 0, 0, rowH()) end
    end
end

--============================================================--
-- MODULE ESP
--============================================================--
local ESP = { reg = {}, stats = { markers = 0, visible = 0, outlined = 0 }, tracerTargets = {} }
local MAX_HL = 24
local TEST_NAME = "AbyssTestEntity"

local function colorOf(cat) return Palette[Cfg["Col_" .. cat]][2] end

local function getPart(obj)
    if obj:IsA("BasePart") then return obj end
    if not obj:IsA("Model") then return nil end
    return obj.PrimaryPart or obj:FindFirstChild("HumanoidRootPart") or obj:FindFirstChildWhichIsA("BasePart", true)
end

function ESP.remove(obj)
    local e = ESP.reg[obj]
    if not e then return end
    ESP.reg[obj] = nil
    if e.conn then e.conn:Disconnect() end
    -- La cible peut deja etre detruite (et ses enfants avec) : Destroy sur une instance detruite est sans effet
    e.hl:Destroy()
    e.bb:Destroy()
end

-- Les salles DOORS arrivent en streaming : si la piece n'existe pas encore on retente
function ESP.add(obj, cat, text, partName, tries)
    if not Alive or ESP.reg[obj] or not obj.Parent then return end
    local part = (partName and obj:FindFirstChild(partName)) or getPart(obj)
    if not part then
        tries = (tries or 0) + 1
        if tries <= 8 then
            task.delay(0.5, function() guard("ESP", ESP.add, obj, cat, text, partName, tries) end)
        else
            Log.add("INFO", "ESP", "Aucune piece trouvee pour " .. obj:GetFullName())
        end
        return
    end
    local color = colorOf(cat)
    local hl = make("Highlight", {
        Name = "AbyssHL", Adornee = obj, FillColor = color, OutlineColor = color, FillTransparency = Cfg.EspFill / 100,
        DepthMode = Enum.HighlightDepthMode.AlwaysOnTop, Enabled = false,
    }, obj)
    local bb = make("BillboardGui", {
        Name = "AbyssBB", Adornee = part, Size = UDim2.new(0, 180, 0, 44), StudsOffset = Vector3.new(0, 2.5, 0),
        AlwaysOnTop = true, Enabled = false,
    }, part)
    local t = make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, 0), Font = Enum.Font.GothamBold, TextSize = Cfg.EspTextSize,
        TextColor3 = color, TextStrokeTransparency = 0.3, Text = text,
    }, bb)
    local e = { obj = obj, hl = hl, bb = bb, txt = t, cat = cat, label = text, part = part, color = color, last = "", dist = 0 }
    ESP.reg[obj] = e
    -- Retrait immediat quand la cible quitte le jeu (sans attendre le prochain rafraichissement)
    e.conn = obj.AncestryChanged:Connect(function()
        if not obj:IsDescendantOf(workspace) then guard("ESP", ESP.remove, obj) end
    end)
end

function ESP.refresh()
    local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
    local rainbow = Cfg.EspRainbow and Color3.fromHSV((os.clock() * 0.15) % 1, 0.75, 1) or nil
    local list, markers = {}, 0
    local fill, size = Cfg.EspFill / 100, Cfg.EspTextSize
    for obj, e in pairs(ESP.reg) do
        if not obj.Parent or not e.part.Parent then
            ESP.remove(obj)
        else
            markers = markers + 1
            e.dist = root and (e.part.Position - root.Position).Magnitude or 0
            local visible = Cfg.EspEnabled and Cfg["Esp_" .. e.cat] == true
            local showText = visible and (Cfg.EspNames or Cfg.EspDistance or Cfg.EspInfo)
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
                    local parts = {}
                    if Cfg.EspNames then table.insert(parts, e.label) end
                    if Cfg.EspInfo then table.insert(parts, CatByKey[e.cat].name) end
                    if Cfg.EspDistance then table.insert(parts, "[" .. math.floor(e.dist) .. "m]") end
                    local s = table.concat(parts, "\n")
                    if s ~= e.last then
                        e.last = s
                        e.txt.Text = s
                    end
                    if e.txt.TextSize ~= size then e.txt.TextSize = size end
                end
                e.score = CatByKey[e.cat].prio * 100000 + e.dist
                table.insert(list, e)
            elseif e.hl.Enabled then
                e.hl.Enabled = false
            end
        end
    end
    -- Contours attribues par priorite de categorie puis par distance
    table.sort(list, function(a, b) return a.score < b.score end)
    local outlined = 0
    for i, e in ipairs(list) do
        local want = Cfg.EspOutlines and i <= MAX_HL
        if e.hl.Enabled ~= want then e.hl.Enabled = want end
        if want then outlined = outlined + 1 end
        if e.hl.FillTransparency ~= fill then e.hl.FillTransparency = fill end
    end
    ESP.stats.markers, ESP.stats.visible, ESP.stats.outlined = markers, #list, outlined
    ESP.tracerTargets = list
end

function ESP.clear()
    local n = 0
    for obj in pairs(ESP.reg) do
        ESP.remove(obj)
        n = n + 1
    end
    ESP.stats.markers, ESP.stats.visible, ESP.stats.outlined = 0, 0, 0
    ESP.tracerTargets = {}
    Log.add("INFO", "ESP", n .. " marqueurs supprimes")
    return n
end

function ESP.count(cat)
    local n = 0
    for _, e in pairs(ESP.reg) do
        if e.cat == cat then n = n + 1 end
    end
    return n
end

every("ESP", 0.25, ESP.refresh)
onCleanup(function() ESP.clear() end)

-- Tracers : lignes du bas de l'ecran vers les cibles visibles (15 maximum)
local TracerPool = {}
on("ESP", RunService.RenderStepped, function()
    local cam = workspace.CurrentCamera
    local n = 0
    if Cfg.EspEnabled and Cfg.EspTracers and cam then
        local vp = cam.ViewportSize
        local from = Vector2.new(vp.X / 2, vp.Y - 5)
        for _, e in ipairs(ESP.tracerTargets) do
            if n >= 15 then break end
            if e.part.Parent then
                local p, onScreen = cam:WorldToViewportPoint(e.part.Position)
                if onScreen then
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

--============================================================--
-- MODULE DETECTION
--============================================================--
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
    [TEST_NAME] = { "Entities", "ENTITE TEST" },
}

local LootKind = { Gold = "gold", Items = "item", Chests = "drawer" }

local AlertText = {
    RUSH = "Cache-toi dans un placard !", AMBUSH = "Placard ! Ressors et rentre a chaque passage.",
    EYES = "Ne regarde pas Eyes !", SEEK = "Cours ! Evite les mains.", FIGURE = "Accroupi et silencieux.",
    BLITZ = "Cache-toi vite !", LOOKMAN = "Ne le regarde pas !", ["A-60"] = "Cache-toi tout de suite !",
    ["A-120"] = "Cache-toi tout de suite !", GLOOMBATS = "Eteins ta lumiere !", GRUMBLE = "Evite les Grumbles !",
    JEFF = "Jeff est la !", SCREECH = "Regarde-le pour le faire fuir !", HALT = "Fais demi-tour quand c'est bleu.",
}

local lastAlert = {}
local function alert(name)
    Log.add("INFO", "Entites", "Entite detectee : " .. name)
    if not AlertText[name] then return end
    if lastAlert[name] and os.clock() - lastAlert[name] < 6 then return end
    lastAlert[name] = os.clock()
    if Cfg.Alerts then notify("warn", name, AlertText[name]) end
end

local Loot = setmetatable({}, { __mode = "k" })
local Prompts = setmetatable({}, { __mode = "k" })
local promptCount = 0

local function applyPrompt(pr)
    local o = Prompts[pr]
    if not o or not pr.Parent then return end
    pr.HoldDuration = Cfg.InstantPrompt and 0 or o.hold
    pr.MaxActivationDistance = Cfg.Reach and o.dist * 1.5 or o.dist
end

local Detection = { roomsHooked = false }

function Detection.process(inst)
    if not Alive then return end
    if inst:IsA("ProximityPrompt") then
        if not Prompts[inst] then
            Prompts[inst] = { hold = inst.HoldDuration, dist = inst.MaxActivationDistance }
            promptCount = promptCount + 1
            if Cfg.InstantPrompt or Cfg.Reach then applyPrompt(inst) end
        end
        return
    end
    local isModel = inst:IsA("Model")
    if not (isModel or inst:IsA("BasePart")) then return end

    local rooms = workspace:FindFirstChild("CurrentRooms")
    if inst.Name == "Door" and isModel and rooms and inst.Parent and inst.Parent.Parent == rooms then
        local n = tonumber(inst.Parent.Name)
        ESP.add(inst, "Doors", n and ("Porte " .. (n + 1)) or "Porte", "Door")
        return
    end

    local d = Names[inst.Name]
    if not d then return end
    if d[1] ~= "Entities" and not isModel then return end
    ESP.add(inst, d[1], d[2])
    if LootKind[d[1]] then Loot[inst] = LootKind[d[1]] end
    if d[1] == "Entities" then alert(d[2]) end
end

function Detection.scanAll()
    local rooms = workspace:FindFirstChild("CurrentRooms")
    local n = 0
    if rooms then
        for _, d in ipairs(rooms:GetDescendants()) do
            Detection.process(d)
            n = n + 1
        end
    end
    for _, c in ipairs(workspace:GetChildren()) do Detection.process(c) end
    for _, p in ipairs(Players:GetPlayers()) do
        if p ~= LP and p.Character then
            local r = p.Character:FindFirstChild("HumanoidRootPart")
            if r then ESP.add(p.Character, "Players", p.DisplayName, "HumanoidRootPart") end
        end
    end
    Log.add("INFO", "Detection", "Analyse complete : " .. n .. " objets de salle parcourus")
end

local function hookRooms(rooms)
    if Detection.roomsHooked then return end
    Detection.roomsHooked = true
    for _, d in ipairs(rooms:GetDescendants()) do Detection.process(d) end
    on("Detection", rooms.DescendantAdded, function(d)
        task.defer(function() guard("Detection", Detection.process, d) end)
    end)
    Log.add("INFO", "Detection", "Salles surveillees (" .. #rooms:GetChildren() .. " chargees)")
end

do
    local rooms = workspace:FindFirstChild("CurrentRooms")
    if rooms then
        hookRooms(rooms)
    else
        Log.add("WARN", "Detection", "CurrentRooms introuvable : attente (lobby ou autre jeu ?)")
        task.spawn(function()
            local r = workspace:WaitForChild("CurrentRooms", 120)
            if not Alive then return end
            if r then
                guard("Detection", hookRooms, r)
            else
                Log.add("WARN", "Detection", "CurrentRooms jamais apparu : seuls joueurs et entites de workspace sont suivis")
            end
        end)
    end
end

on("Detection", workspace.ChildAdded, function(c)
    task.defer(function() guard("Detection", Detection.process, c) end)
end)
for _, c in ipairs(workspace:GetChildren()) do
    local d = Names[c.Name]
    if d and d[1] == "Entities" then Detection.process(c) end
end

local function hookPlayer(p)
    if p == LP then return end
    local function onChar(char)
        local r = char:WaitForChild("HumanoidRootPart", 10)
        if r and Alive then ESP.add(char, "Players", p.DisplayName, "HumanoidRootPart") end
    end
    on("Detection", p.CharacterAdded, onChar)
    if p.Character then task.spawn(function() guard("Detection", onChar, p.Character) end) end
end
for _, p in ipairs(Players:GetPlayers()) do hookPlayer(p) end
on("Detection", Players.PlayerAdded, hookPlayer)

--============================================================--
-- MODULE FULLBRIGHT (reversible)
--============================================================--
local FB = { saved = {}, atmos = setmetatable({}, { __mode = "k" }), blurs = setmetatable({}, { __mode = "k" }) }
local LIGHT_PROPS = { "Ambient", "Brightness", "GlobalShadows", "FogEnd", "OutdoorAmbient" }

local function fbActive() return Cfg.Fullbright or Cfg.NoFog end

function FB.snapshot()
    for _, p in ipairs(LIGHT_PROPS) do FB.saved[p] = Lighting[p] end
end
FB.snapshot()

function FB.restore()
    for _, p in ipairs(LIGHT_PROPS) do
        if FB.saved[p] ~= nil then Lighting[p] = FB.saved[p] end
    end
end

function FB.enforce()
    if Cfg.Fullbright then
        Lighting.Ambient = Color3.new(1, 1, 1)
        Lighting.OutdoorAmbient = Color3.new(1, 1, 1)
        Lighting.Brightness = Cfg.FBBrightness
        Lighting.GlobalShadows = false
    end
    if Cfg.NoFog then
        Lighting.FogEnd = 100000
        for _, a in ipairs(Lighting:GetChildren()) do
            if a:IsA("Atmosphere") then
                if FB.atmos[a] == nil then FB.atmos[a] = a.Density end
                if a.Density ~= 0 then a.Density = 0 end
            end
        end
    end
end

function FB.restoreAtmos()
    for a, density in pairs(FB.atmos) do
        if a.Parent then a.Density = density end
        FB.atmos[a] = nil
    end
end

local function trackBlur(o)
    if (o:IsA("BlurEffect") or o:IsA("DepthOfFieldEffect")) and FB.blurs[o] == nil then FB.blurs[o] = o.Enabled end
end
for _, d in ipairs(Lighting:GetDescendants()) do trackBlur(d) end
on("Fullbright", Lighting.DescendantAdded, trackBlur)

function FB.restoreBlurs()
    for b, was in pairs(FB.blurs) do
        if b.Parent then b.Enabled = was end
    end
end

-- Tant que rien n'est actif, on suit l'eclairage du jeu pour restaurer la valeur la plus recente
on("Fullbright", RunService.Heartbeat, function()
    if fbActive() then FB.enforce() else FB.snapshot() end
end)

every("Fullbright", 0.3, function()
    if Cfg.AntiBlur then
        for b in pairs(FB.blurs) do
            if b.Parent and b.Enabled then b.Enabled = false end
        end
    end
end)

local function fbApply(new, old)
    if fbActive() then
        FB.enforce()
    else
        FB.restore()
    end
    if not Cfg.NoFog then FB.restoreAtmos() end
    return true
end
bind("Fullbright", "Fullbright", function(new)
    fbApply()
    Log.add("INFO", "Fullbright", new and "Active" or "Desactive, eclairage restaure")
    notify(new and "ok" or "info", "Fullbright", new and "Active" or "Desactive")
end)
bind("NoFog", "Fullbright", function(new)
    fbApply()
    Log.add("INFO", "Fullbright", new and "Brouillard supprime" or "Brouillard restaure")
end)
bind("FBBrightness", "Fullbright", function() if Cfg.Fullbright then FB.enforce() end end)
bind("AntiBlur", "Fullbright", function(new)
    if not new then FB.restoreBlurs() end
    Log.add("INFO", "Fullbright", new and "Anti-flou active" or "Effets de flou restaures")
end)
onCleanup(function()
    Cfg.Fullbright, Cfg.NoFog = false, false
    FB.restore()
    FB.restoreAtmos()
    FB.restoreBlurs()
end)

--============================================================--
-- MODULE JOUEUR
--============================================================--
local PL = { defaultSpeed = nil, defaultJump = nil }

on("Joueur", RunService.Heartbeat, function()
    local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
    if not hum or hum.Health <= 0 then return end
    if Cfg.Speed then
        if not PL.defaultSpeed then PL.defaultSpeed = hum.WalkSpeed end
        if hum.WalkSpeed ~= Cfg.SpeedValue then hum.WalkSpeed = Cfg.SpeedValue end
    end
    if Cfg.Jump then
        if not PL.defaultJump then PL.defaultJump = { hum.JumpPower, hum.JumpHeight } end
        if hum.UseJumpPower then
            if hum.JumpPower < 40 then hum.JumpPower = 45 end
        elseif hum.JumpHeight < 5 then
            hum.JumpHeight = 6
        end
    end
end)

-- Le FOV passe apres le script camera du jeu, sinon il est ecrase a chaque image
local FOV_BIND = "AbyssFov_" .. tostring(math.random(100000, 999999))
RunService:BindToRenderStep(FOV_BIND, Enum.RenderPriority.Camera.Value + 1, function()
    if Alive and Cfg.Fov and workspace.CurrentCamera then
        workspace.CurrentCamera.FieldOfView = Cfg.FovValue
    end
end)
onCleanup(function() RunService:UnbindFromRenderStep(FOV_BIND) end)

on("Joueur", LP.CharacterAdded, function()
    PL.defaultSpeed, PL.defaultJump = nil, nil
    Log.add("INFO", "Joueur", "Nouveau personnage : valeurs d'origine reinitialisees")
end)

local function humanoid() return LP.Character and LP.Character:FindFirstChildOfClass("Humanoid") end

bind("Speed", "Joueur", function(new)
    local hum = humanoid()
    if not new and hum and PL.defaultSpeed then hum.WalkSpeed = PL.defaultSpeed end
    if not new then PL.defaultSpeed = nil end
    Log.add("INFO", "Joueur", new and ("Speed active (" .. Cfg.SpeedValue .. ")") or "Speed desactive")
end)
bind("Jump", "Joueur", function(new)
    local hum = humanoid()
    if new then
        if hum then hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, true) end
    elseif hum and PL.defaultJump then
        hum.JumpPower, hum.JumpHeight = PL.defaultJump[1], PL.defaultJump[2]
        PL.defaultJump = nil
    end
end)
bind("Fov", "Joueur", function(new)
    if not new and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = 70 end
end)
onCleanup(function()
    local hum = humanoid()
    if hum and PL.defaultSpeed then hum.WalkSpeed = PL.defaultSpeed end
    if hum and PL.defaultJump then hum.JumpPower, hum.JumpHeight = PL.defaultJump[1], PL.defaultJump[2] end
    if Cfg.Fov and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = 70 end
end)

--============================================================--
-- MODULE AUTO
--============================================================--
local function refreshPrompts()
    for pr in pairs(Prompts) do applyPrompt(pr) end
end
bind("InstantPrompt", "Auto", refreshPrompts)
bind("Reach", "Auto", refreshPrompts)
onCleanup(function()
    Cfg.InstantPrompt, Cfg.Reach = false, false
    refreshPrompts()
end)

local fireprompt = (type(fireproximityprompt) == "function") and fireproximityprompt or nil
if not fireprompt then
    Log.add("WARN", "Auto", "fireproximityprompt indisponible : ramassage automatique inactif")
end

-- Les tiroirs ne sont declenches qu'une fois, sinon ils s'ouvrent et se ferment en boucle
local Fired = setmetatable({}, { __mode = "k" })
every("Auto", 0.3, function()
    if not fireprompt or not (Cfg.AutoGold or Cfg.AutoItems or Cfg.AutoDrawers) then return end
    local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
    if not root then return end
    local now = os.clock()
    for obj, kind in pairs(Loot) do
        if not obj.Parent then
            Loot[obj] = nil
        elseif (kind == "gold" and Cfg.AutoGold) or (kind == "item" and Cfg.AutoItems) or (kind == "drawer" and Cfg.AutoDrawers) then
            local last = Fired[obj]
            local ready = (kind == "drawer" and last == nil) or (kind ~= "drawer" and (not last or now - last > 1.5))
            if ready then
                local pr = obj:FindFirstChildWhichIsA("ProximityPrompt", true)
                local pt = getPart(obj)
                if pr and pt and pr.Enabled and (pt.Position - root.Position).Magnitude <= pr.MaxActivationDistance then
                    Fired[obj] = now
                    fireprompt(pr)
                end
            end
        end
    end
end)

--============================================================--
-- MODULE ENTITES (Screech / Halt cote client)
--============================================================--
local camConn
local function hookCam(cam)
    if camConn then camConn:Disconnect() camConn = nil end
    if not cam then return end
    for _, c in ipairs(cam:GetChildren()) do trackBlur(c) end
    camConn = cam.ChildAdded:Connect(function(c)
        guard("Entites", function()
            trackBlur(c)
            if c.Name == "Screech" then
                alert("SCREECH")
                if Cfg.AntiScreech then
                    task.defer(function()
                        if c.Parent then
                            c:Destroy()
                            Log.add("INFO", "Entites", "Screech supprime (anti-Screech)")
                        end
                    end)
                end
            elseif c.Name == "Shade" then
                alert("HALT")
            end
        end)
    end)
end
hookCam(workspace.CurrentCamera)
on("Entites", workspace:GetPropertyChangedSignal("CurrentCamera"), function()
    hookCam(workspace.CurrentCamera)
    rescale()
end)
onCleanup(function() if camConn then camConn:Disconnect() end end)
if workspace.CurrentCamera then
    on("UI", workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"), rescale)
end

--============================================================--
-- MODULE CRUCIFIX (visuel, cote client)
-- L'outil et l'effet n'existent que sur cet appareil : le serveur ne les voit pas,
-- ils ne protegent donc pas des vraies attaques et ne donnent aucune recompense.
--============================================================--
local Cross = {
    left = 0, tool = nil, busy = false, selected = nil, last = "Aucune operation", lastOk = nil,
    testTarget = nil, uses = 0,
}

local function crossCharges()
    return Cfg.CrossInfinite and "Infinies" or tostring(Cross.left)
end

local function topModel(part)
    -- Remonte jusqu'au modele entier (porte, plante, entite...) sans prendre la salle elle-meme
    local rooms = workspace:FindFirstChild("CurrentRooms")
    local node = part
    -- workspace est lui-meme un Model : sans ce garde-fou, tout objet pose dans workspace remonterait jusqu'a lui
    while node.Parent and node.Parent ~= workspace and node.Parent:IsA("Model") and not (rooms and node.Parent.Parent == rooms) do
        node = node.Parent
    end
    return node
end

local function isProtected(obj)
    for _, p in ipairs(Players:GetPlayers()) do
        if p.Character and (obj == p.Character or obj:IsDescendantOf(p.Character)) then return true end
    end
    local rooms = workspace:FindFirstChild("CurrentRooms")
    return (rooms ~= nil and obj.Parent == rooms) or obj == workspace
end

local function nearestEntity(origin)
    local best, bestDist
    for obj, e in pairs(ESP.reg) do
        if e.cat == "Entities" and obj.Parent and e.part.Parent then
            local d = (e.part.Position - origin).Magnitude
            if d <= Cfg.CrossRange and (not bestDist or d < bestDist) then best, bestDist = obj, d end
        end
    end
    return best
end

-- Effet : chaines lumineuses, levitation en rotation puis disparition. onDone(succes) a la fin
function Cross.effect(target, onDone)
    local parts = {}
    if target:IsA("BasePart") then
        parts = { target }
    else
        for _, d in ipairs(target:GetDescendants()) do
            if d:IsA("BasePart") then table.insert(parts, d) end
        end
    end
    if #parts == 0 then
        onDone(false, "La cible ne contient aucune piece")
        return
    end
    local center = target:IsA("Model") and target:GetPivot() or target.CFrame
    local fx = make("Part", {
        Name = "AbyssCrossFX", Anchored = true, CanCollide = false, CanQuery = false, Transparency = 1,
        Size = Vector3.new(1, 1, 1), CFrame = center,
    }, workspace)
    make("ParticleEmitter", {
        Color = ColorSequence.new(Color3.fromRGB(150, 220, 255)), LightEmission = 1, Rate = 60,
        Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(4, 8), SpreadAngle = Vector2.new(180, 180),
        Size = NumberSequence.new(0.4, 0),
    }, fx)
    make("PointLight", { Color = Color3.fromRGB(150, 220, 255), Brightness = 4, Range = 18 }, fx)
    for i = 1, 4 do
        local a = math.rad(i * 90)
        local from = center.Position + Vector3.new(math.cos(a) * 6, -4, math.sin(a) * 6)
        local to = center.Position
        make("Part", {
            Anchored = true, CanCollide = false, CanQuery = false, Material = Enum.Material.Neon,
            Color = Color3.fromRGB(150, 220, 255), Size = Vector3.new(0.25, 0.25, (to - from).Magnitude),
            CFrame = CFrame.lookAt((from + to) / 2, to), Transparency = 0.2,
        }, fx)
    end
    for _, p in ipairs(parts) do p.Anchored = true end

    task.spawn(function()
        local ok, err = guard("Crucifix", function()
            local start, duration = os.clock(), 2
            while Alive and target.Parent and os.clock() - start < duration do
                local t = (os.clock() - start) / duration
                local cf = center * CFrame.new(0, t * 5, 0) * CFrame.Angles(0, t * math.pi * 4, 0)
                if target:IsA("Model") then target:PivotTo(cf) else target.CFrame = cf end
                for _, p in ipairs(parts) do
                    if p.Parent then p.LocalTransparencyModifier = t end
                end
                task.wait()
            end
            target:Destroy()
        end)
        fx:Destroy()
        -- Verification reelle : la cible doit avoir quitte le jeu
        local success = ok and target.Parent == nil
        local why = nil
        if not success then why = err and firstLine(err) or "La cible existe encore" end
        onDone(success, why)
    end)
end

-- Point d'entree unique : valide charges, portee et cible avant d'agir
function Cross.use(target)
    if Cross.busy then return false, "Une operation est deja en cours" end
    local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
    if not root then return false, "Personnage introuvable" end
    if not Cfg.CrossInfinite and Cross.left <= 0 then return false, "Plus de charges" end
    if not target or not target.Parent then return false, "Aucune cible" end
    if isProtected(target) then return false, "Cible protegee (joueur ou salle)" end
    local part = getPart(target)
    if not part then return false, "Cible sans piece" end
    local dist = (part.Position - root.Position).Magnitude
    if dist > Cfg.CrossRange then
        return false, "Hors portee (" .. math.floor(dist) .. " > " .. Cfg.CrossRange .. ")"
    end
    Cross.busy = true
    Cross.selected = target
    if not Cfg.CrossInfinite then Cross.left = Cross.left - 1 end
    Cross.uses = Cross.uses + 1
    local name = target.Name
    Cross.effect(target, function(success, why)
        Cross.busy = false
        Cross.lastOk = success
        Cross.last = success and ("Succes : " .. name .. " retire") or ("Echec : " .. tostring(why))
        Log.add(success and "INFO" or "WARN", "Crucifix", Cross.last)
    end)
    return true
end

local function crossFromTap()
    local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
    local target
    if Cfg.CrossAnything then
        local hit = LP:GetMouse().Target
        if hit then target = topModel(hit) end
    end
    if not target and root then target = nearestEntity(root.Position) end
    local ok, why = Cross.use(target)
    if not ok then
        Cross.last = "Refuse : " .. why
        Cross.lastOk = false
        notify("warn", "Crucifix", why)
        Log.add("WARN", "Crucifix", Cross.last)
    end
end

local function buildCrossModel(hand)
    local wood = Color3.fromRGB(110, 70, 40)
    local m = make("Model", { Name = "AbyssCross" })
    local v = make("Part", {
        Size = Vector3.new(0.25, 1.6, 0.25), Material = Enum.Material.Wood, Color = wood,
        CanCollide = false, CanQuery = false, Massless = true, CFrame = hand.CFrame * CFrame.new(0, -0.9, -0.3),
    }, m)
    local h = make("Part", {
        Size = Vector3.new(0.9, 0.25, 0.25), Material = Enum.Material.Wood, Color = wood,
        CanCollide = false, CanQuery = false, Massless = true, CFrame = v.CFrame * CFrame.new(0, 0.35, 0),
    }, m)
    make("WeldConstraint", { Part0 = v, Part1 = h }, v)
    make("WeldConstraint", { Part0 = hand, Part1 = v }, v)
    m.Parent = hand.Parent
    return m
end

-- Outil sans Handle : un Handle cree cote client n'est pas toujours soude a la main
function Cross.give()
    if Cross.tool and Cross.tool.Parent then
        notify("info", "Crucifix", "Tu as deja le crucifix")
        return false
    end
    local backpack = LP:FindFirstChildOfClass("Backpack")
    if not backpack then
        notify("error", "Crucifix", "Sac a dos introuvable")
        Log.add("WARN", "Crucifix", "Backpack introuvable")
        return false
    end
    Cross.left = Cfg.CrossUses
    local tool = make("Tool", { Name = "Crucifix", RequiresHandle = false, CanBeDropped = false, ToolTip = "Crucifix" })
    local held
    tool.Equipped:Connect(function()
        guard("Crucifix", function()
            local char = LP.Character
            local hand = char and (char:FindFirstChild("RightHand") or char:FindFirstChild("Right Arm"))
            if hand then held = buildCrossModel(hand) else Log.add("WARN", "Crucifix", "Main droite introuvable") end
        end)
    end)
    tool.Unequipped:Connect(function()
        if held then held:Destroy() held = nil end
    end)
    tool.Destroying:Connect(function()
        if held then held:Destroy() held = nil end
    end)
    tool.Activated:Connect(function() guard("Crucifix", crossFromTap) end)
    tool.Parent = backpack
    Cross.tool = tool
    Log.add("INFO", "Crucifix", "Crucifix ajoute au sac (" .. crossCharges() .. " charges)")
    notify("ok", "Crucifix", "Equipe-le puis touche la cible")
    return true
end

function Cross.resetTest()
    if Cross.testTarget and Cross.testTarget.Parent then Cross.testTarget:Destroy() end
    Cross.testTarget = nil
    if Cross.selected and not Cross.selected.Parent then Cross.selected = nil end
    Cross.left = Cfg.CrossUses
    Cross.last, Cross.lastOk = "Scenario reinitialise", nil
    Log.add("TEST", "Crucifix", "Scenario reinitialise, charges : " .. crossCharges())
end

function Cross.spawnTest()
    local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
    if not root then return nil, "Personnage introuvable" end
    if Cross.testTarget and Cross.testTarget.Parent then Cross.testTarget:Destroy() end
    local m = make("Model", { Name = TEST_NAME })
    local p = make("Part", {
        Name = "Body", Anchored = true, CanCollide = false, Size = Vector3.new(3, 5, 1), Material = Enum.Material.Neon,
        Color = Color3.fromRGB(255, 60, 60), CFrame = root.CFrame * CFrame.new(0, 0, -10),
    }, m)
    m.PrimaryPart = p
    m.Parent = workspace
    Cross.testTarget = m
    Cross.selected = m
    return m
end

-- Scenario complet : cree une entite de test, verifie sa detection, la neutralise et verifie le retrait
function Cross.runScenario()
    if Cross.busy then
        notify("warn", "Scenario", "Une operation est deja en cours")
        return
    end
    Log.add("TEST", "Crucifix", "Scenario lance")
    local m, why = Cross.spawnTest()
    if not m then
        Log.add("TEST", "Crucifix", "ECHEC : " .. why)
        notify("error", "Scenario", why)
        return
    end
    task.wait(0.4)
    local detected = ESP.reg[m] ~= nil
    Log.add("TEST", "Crucifix", "Detection de l'entite de test : " .. (detected and "OK" or "ECHEC"))
    local wasInfinite = Cfg.CrossInfinite
    local before = Cross.left
    local ok, reason = Cross.use(m)
    if not ok then
        Log.add("TEST", "Crucifix", "ECHEC : utilisation refusee (" .. reason .. ")")
        notify("error", "Scenario", reason)
        return
    end
    local t0 = os.clock()
    while Cross.busy and os.clock() - t0 < 5 do task.wait(0.1) end
    task.wait(0.4)
    local removed = m.Parent == nil and ESP.reg[m] == nil
    local chargeOk = wasInfinite or Cross.left == before - 1
    local pass = detected and Cross.lastOk == true and removed and chargeOk
    Log.add("TEST", "Crucifix", string.format("Resultat : %s (detection %s, retrait %s, charges %s)",
        pass and "REUSSI" or "ECHEC", tostring(detected), tostring(removed), tostring(chargeOk)))
    notify(pass and "ok" or "error", "Scenario de test", pass and "Reussi" or "Echec : voir Debug")
end

on("Crucifix", LP.CharacterAdded, function()
    if Cross.tool then
        Cross.tool = nil
        Log.add("INFO", "Crucifix", "Reapparition : le crucifix est a reprendre")
    end
end)
onCleanup(function()
    if Cross.tool then Cross.tool:Destroy() end
    if Cross.testTarget and Cross.testTarget.Parent then Cross.testTarget:Destroy() end
end)

--============================================================--
-- MODULE AUTO-TEST (verifications reelles a l'execution)
--============================================================--
local AutoTest = { running = false, lastSummary = "Jamais lance" }

function AutoTest.run()
    if AutoTest.running then return end
    AutoTest.running = true
    local passed, total = 0, 0
    local function check(name, cond, detail)
        total = total + 1
        if cond then passed = passed + 1 end
        Log.add("TEST", "AutoTest", (cond and "OK    " or "ECHEC ") .. name .. (detail and (" - " .. detail) or ""))
    end

    local guis = 0
    for _, g in ipairs(PlayerGui:GetChildren()) do
        if g.Name == "AbyssV5" then guis = guis + 1 end
    end
    check("Interface unique", guis == 1, guis .. " trouvee(s)")
    check("Pages construites", #Pages >= 9, #Pages .. " pages")

    -- ESP : creation, detection, suppression du marqueur a la destruction
    local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
    if root then
        local m = make("Model", { Name = TEST_NAME })
        local p = make("Part", { Anchored = true, CanCollide = false, Transparency = 1, Size = Vector3.new(1, 1, 1), CFrame = root.CFrame }, m)
        m.PrimaryPart = p
        m.Parent = workspace
        task.wait(0.4)
        check("ESP detecte une entite", ESP.reg[m] ~= nil)
        m:Destroy()
        task.wait(0.1)
        check("ESP retire le marqueur detruit", ESP.reg[m] == nil)
    else
        check("Personnage present", false, "tests ESP ignores")
    end

    -- Fullbright : activation puis restauration exacte
    local prevFB = Cfg.Fullbright
    if not prevFB then
        local before = Lighting.Ambient
        setKey("Fullbright", true)
        local on1 = Lighting.Ambient == Color3.new(1, 1, 1)
        setKey("Fullbright", false)
        check("Fullbright s'active", on1)
        check("Fullbright restaure l'eclairage", Lighting.Ambient == before)
    else
        check("Fullbright deja actif", true, "test de restauration ignore pour ne pas changer ton reglage")
    end

    check("Sauvegarde disponible", canSave, (not canSave) and "writefile absent" or nil)
    check("fireproximityprompt disponible", fireprompt ~= nil)
    local errs = 0
    for _, n in ipairs(ModuleOrder) do errs = errs + Modules[n].errors end
    check("Aucune erreur de module", errs == 0, errs .. " erreur(s)")

    AutoTest.lastSummary = passed .. "/" .. total .. " verifications reussies"
    Log.add("TEST", "AutoTest", "Bilan : " .. AutoTest.lastSummary)
    notify(passed == total and "ok" or "warn", "Auto-test", AutoTest.lastSummary)
    AutoTest.running = false
end

--============================================================--
-- PAGES
--============================================================--
-- 1. DASHBOARD
local PDash, iDash = newPage("Dashboard", "Dashboard", "Etat reel des modules", "D")
section(PDash, "Modules")
local dEsp = info(PDash, "ESP")
local dFb = info(PDash, "Fullbright")
local dCross = info(PDash, "Crucifix")
local dEnt = info(PDash, "Entites suivies")
local dMods = info(PDash, "Modules en erreur")
local dRoom = info(PDash, "Salle actuelle")
section(PDash, "Acces rapide")
button(PDash, "ESP : activer / desactiver", "QuickEsp", function() setKey("EspEnabled", not Cfg.EspEnabled) end)
button(PDash, "Fullbright : activer / desactiver", "QuickFb", function() setKey("Fullbright", not Cfg.Fullbright) end)
button(PDash, "Lancer le scenario de test", "QuickScenario", Cross.runScenario, "plain")
section(PDash, "Derniers evenements")
local dEvents = note(PDash, "-")
section(PDash, "Erreurs recentes")
local dErrors = note(PDash, "Aucune")

-- 2. ESP
local PEsp = newPage("ESP", "ESP", "Marqueurs, contours et tracers", "E")
section(PEsp, "General")
toggle(PEsp, "ESP active", "EspEnabled")
local espState = info(PEsp, "Marqueurs")
section(PEsp, "Categories")
for _, c in ipairs(Cats) do toggle(PEsp, c.name, "Esp_" .. c.key) end
section(PEsp, "Affichage")
toggle(PEsp, "Nom", "EspNames")
toggle(PEsp, "Distance", "EspDistance")
toggle(PEsp, "Categorie", "EspInfo")
toggle(PEsp, "Contours", "EspOutlines")
toggle(PEsp, "Tracers", "EspTracers")
toggle(PEsp, "Arc-en-ciel", "EspRainbow")
stepper(PEsp, "Taille du texte", "EspTextSize", 1)
stepper(PEsp, "Transparence", "EspFill", 10, "%")
section(PEsp, "Couleurs")
for _, c in ipairs(Cats) do cycle(PEsp, c.name, "Col_" .. c.key, Palette) end
section(PEsp, "Maintenance")
button(PEsp, "Actualiser (nouvelle analyse)", "EspRescan", function()
    Detection.scanAll()
    ESP.refresh()
    notify("ok", "ESP", ESP.stats.markers .. " marqueurs")
end, "plain")
button(PEsp, "Nettoyer les marqueurs", "EspClear", function()
    local n = ESP.clear()
    notify("info", "ESP", n .. " marqueurs supprimes (Actualiser pour les recreer)")
end, "plain")
button(PEsp, "Reinitialiser les reglages ESP", "EspReset", function()
    for _, key in ipairs(SchemaOrder) do
        if key:sub(1, 3) == "Esp" or key:sub(1, 4) == "Col_" then setKey(key, Schema[key].default) end
    end
    notify("ok", "ESP", "Reglages par defaut")
end, "plain")
bind("EspEnabled", "ESP", function(new)
    ESP.refresh()
    Log.add("INFO", "ESP", new and "Active" or "Desactive")
    notify(new and "ok" or "info", "ESP", new and "Active" or "Desactive")
end)

-- 3. FULLBRIGHT
local PFb = newPage("Fullbright", "Fullbright", "Eclairage reversible", "F")
section(PFb, "Controle")
toggle(PFb, "Fullbright", "Fullbright")
local fbState = info(PFb, "Etat")
stepper(PFb, "Luminosite", "FBBrightness", 1)
toggle(PFb, "Supprimer le brouillard", "NoFog")
toggle(PFb, "Anti-flou", "AntiBlur")
button(PFb, "Restaurer l'eclairage du jeu", "FbRestore", function()
    setKey("Fullbright", false)
    setKey("NoFog", false)
    setKey("AntiBlur", false)
    FB.restore()
    notify("ok", "Fullbright", "Eclairage d'origine restaure")
end, "plain")
button(PFb, "Reinitialiser les reglages", "FbReset", function()
    for _, k in ipairs({ "Fullbright", "FBBrightness", "NoFog", "AntiBlur" }) do setKey(k, Schema[k].default) end
    notify("ok", "Fullbright", "Reglages par defaut")
end, "plain")
section(PFb, "Diagnostic")
local fbAmb = info(PFb, "Ambient actuel")
local fbBri = info(PFb, "Luminosite actuelle")
local fbFog = info(PFb, "FogEnd actuel")
local fbSaved = info(PFb, "Sauvegarde (lum / fog)")

-- 4. JOUEUR
local PPl = newPage("Joueur", "Joueur", "Mouvement et camera", "J")
section(PPl, "Mouvement")
toggle(PPl, "Speed", "Speed")
stepper(PPl, "Vitesse", "SpeedValue", 1)
note(PPl, "Au-dela de ~22, l'anti-cheat de DOORS te ramene en arriere.")
toggle(PPl, "Activer le saut", "Jump")
section(PPl, "Camera")
toggle(PPl, "FOV personnalise", "Fov")
stepper(PPl, "FOV", "FovValue", 5)
local plState = info(PPl, "Vitesse actuelle")

-- 5. ENTITES
local PEnt, iEnt = newPage("Entites", "Entites", "Entites suivies en direct", "N")
section(PEnt, "Options")
toggle(PEnt, "ESP entites", "Esp_Entities")
toggle(PEnt, "Alertes", "Alerts")
toggle(PEnt, "Anti-Screech", "AntiScreech")
section(PEnt, "Liste")
local entEmpty = note(PEnt, "Aucune entite suivie.")
local EntRows = {}
local function entRow(i)
    local r = EntRows[i]
    if r then return r end
    local f = make("Frame", { Name = "EntRow", Size = UDim2.new(1, 0, 0, 44), BackgroundColor3 = T.Elem, LayoutOrder = 10000 + i }, PEnt)
    corner(f, 6)
    local a = make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -16, 0, 20), Position = UDim2.new(0, 10, 0, 4),
        Font = Enum.Font.GothamBold, TextSize = 12, TextColor3 = T.Text, TextXAlignment = Enum.TextXAlignment.Left,
        TextTruncate = Enum.TextTruncate.AtEnd,
    }, f)
    local b = make("TextLabel", {
        BackgroundTransparency = 1, Size = UDim2.new(1, -16, 0, 16), Position = UDim2.new(0, 10, 0, 24),
        Font = Enum.Font.Gotham, TextSize = 11, TextColor3 = T.Sub, TextXAlignment = Enum.TextXAlignment.Left,
        TextTruncate = Enum.TextTruncate.AtEnd,
    }, f)
    r = { frame = f, a = a, b = b }
    EntRows[i] = r
    return r
end

-- 6. CRUCIFIX
local PCr = newPage("Crucifix", "Crucifix", "Outil visuel local + scenario de test", "C")
section(PCr, "Etat")
local cCharges = info(PCr, "Charges")
local cRange = info(PCr, "Portee")
local cState = info(PCr, "Etat")
local cTarget = info(PCr, "Cible")
local cLast = info(PCr, "Derniere operation")
local cErr = info(PCr, "Erreurs du module")
section(PCr, "Actions")
button(PCr, "Obtenir le crucifix", "CrossGive", Cross.give)
button(PCr, "Lancer le scenario de test", "CrossScenario", Cross.runScenario, "plain")
button(PCr, "Reinitialiser le scenario", "CrossReset", Cross.resetTest, "plain")
section(PCr, "Reglages")
toggle(PCr, "Sur n'importe quel objet", "CrossAnything")
toggle(PCr, "Charges infinies", "CrossInfinite")
stepper(PCr, "Charges", "CrossUses", 1)
stepper(PCr, "Portee", "CrossRange", 10)
note(PCr, "Effet visible uniquement sur ton appareil : il ne bloque pas les vraies attaques et ne donne aucune recompense.")

-- 7. AUTO
local PAu = newPage("Auto", "Auto", "Interactions automatiques", "A")
section(PAu, "Interactions")
toggle(PAu, "Interaction instantanee", "InstantPrompt")
toggle(PAu, "Portee x1.5", "Reach")
local auPrompts = info(PAu, "Prompts suivis")
section(PAu, "Ramassage")
toggle(PAu, "Or", "AutoGold")
toggle(PAu, "Objets", "AutoItems")
toggle(PAu, "Ouvrir les tiroirs", "AutoDrawers")
if not fireprompt then note(PAu, "fireproximityprompt est absent de cet executeur : le ramassage ne fera rien.") end

-- 8. DEBUG
local PDbg, iDbg = newPage("Debug", "Debug", "Journal, filtres et auto-test", "L")
section(PDbg, "Outils")
button(PDbg, "Lancer l'auto-test", "AutoTest", AutoTest.run)
local filters = { "TOUT", "INFO", "WARN", "ERROR", "TEST" }
local filterIdx = 1
local search = ""
local logDirty = true
local filterBtn = button(PDbg, "Filtre : TOUT", "LogFilter", function()
    filterIdx = filterIdx % #filters + 1
    logDirty = true
end, "plain")
local searchRow = make("Frame", { BackgroundColor3 = T.Elem, LayoutOrder = nextOrder(PDbg) }, PDbg)
regRow(searchRow)
corner(searchRow, 6)
local searchBox = make("TextBox", {
    Name = "LogSearch", BackgroundTransparency = 1, Size = UDim2.new(1, -20, 1, 0), Position = UDim2.new(0, 10, 0, 0),
    Font = Enum.Font.Gotham, TextSize = 12, TextColor3 = T.Text, PlaceholderText = "Rechercher dans le journal...",
    PlaceholderColor3 = T.Sub, Text = "", ClearTextOnFocus = false, TextXAlignment = Enum.TextXAlignment.Left,
}, searchRow)
on("UI", searchBox:GetPropertyChangedSignal("Text"), function()
    search = string.lower(searchBox.Text)
    logDirty = true
end)
button(PDbg, "Effacer le journal", "LogClear", function()
    table.clear(Log.entries)
    logDirty = true
    Log.add("INFO", "UI", "Journal efface")
end, "plain")
button(PDbg, "Copier le journal", "LogCopy", function()
    if type(setclipboard) ~= "function" then
        Log.add("WARN", "UI", "setclipboard indisponible : copie impossible sur cet executeur")
        notify("warn", "Copie", "Non disponible ici")
        return
    end
    local lines = {}
    for _, e in ipairs(Log.entries) do
        table.insert(lines, e.t .. " [" .. e.level .. "][" .. e.module .. "] " .. e.msg)
    end
    setclipboard(table.concat(lines, "\n"))
    notify("ok", "Copie", #lines .. " lignes copiees")
end, "plain")
local dbgCount = info(PDbg, "Entrees affichees")
local logView = make("TextLabel", {
    Name = "LogView", Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = T.Panel,
    Font = Enum.Font.Code, TextSize = 11, TextWrapped = true, RichText = true, TextColor3 = T.Text,
    TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, Text = "",
    LayoutOrder = nextOrder(PDbg),
}, PDbg)
corner(logView, 6)
make("UIPadding", { PaddingLeft = UDim.new(0, 8), PaddingRight = UDim.new(0, 8), PaddingTop = UDim.new(0, 6), PaddingBottom = UDim.new(0, 6) }, logView)

local LEVEL_HEX = { INFO = "#9a9ab4", WARN = "#ffaa32", ERROR = "#ff4650", TEST = "#50dc78" }
local function esc(s)
    return (s:gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"))
end

local function renderLog()
    logDirty = false
    local f = filters[filterIdx]
    filterBtn.Text = "Filtre : " .. f
    local out, shown = {}, 0
    for i = #Log.entries, 1, -1 do
        local e = Log.entries[i]
        if (f == "TOUT" or e.level == f) and (search == "" or string.find(string.lower(e.module .. " " .. e.msg), search, 1, true)) then
            shown = shown + 1
            if shown <= 80 then
                -- Seule la premiere ligne est affichee : les traces completes restent dans la copie
                table.insert(out, string.format('<font color="%s">%s %s</font> <b>%s</b> %s',
                    LEVEL_HEX[e.level] or "#ffffff", e.t, e.level, esc(e.module), esc(firstLine(e.msg))))
            end
        end
    end
    logView.Text = shown == 0 and "Aucune entree." or table.concat(out, "\n")
    dbgCount(math.min(shown, 80) .. " / " .. shown)
end
table.insert(Log.listeners, function() logDirty = true end)
PageVisibleHooks[iDbg] = renderLog

-- 9. SETTINGS
local PSet = newPage("Settings", "Reglages", "Interface et sauvegarde", "S")
section(PSet, "Apparence")
cycle(PSet, "Couleur d'accent", "Accent", Accents)
stepper(PSet, "Echelle", "UiScale", 5, "%")
toggle(PSet, "Animations", "Animations")
toggle(PSet, "Affichage compact", "Compact")
section(PSet, "Diagnostic")
toggle(PSet, "Notifier les avertissements", "NotifyWarnings")
toggle(PSet, "Notifier les erreurs", "NotifyErrors")
note(PSet, canSave and "Reglages sauvegardes automatiquement." or "Sauvegarde indisponible sur cet executeur.")
section(PSet, "Script")
button(PSet, "Restaurer tous les reglages par defaut", "ResetAll", function()
    for _, key in ipairs(SchemaOrder) do setKey(key, Schema[key].default) end
    notify("ok", "Reglages", "Valeurs par defaut restaurees")
end, "plain")
local closeArmed = 0
local function requestClose()
    if os.clock() - closeArmed < 3 then
        G.AbyssStop()
    else
        closeArmed = os.clock()
        notify("warn", "Fermer le script", "Appuie encore dans les 3 secondes pour confirmer")
    end
end
button(PSet, "Fermer le script", "Unload", requestClose, "danger")

bind("Accent", "UI", applyTheme)
bind("UiScale", "UI", rescale)
bind("Compact", "UI", regRowsRefresh)

-- Les avertissements journalises deviennent des notifications si l'option est active
table.insert(Log.listeners, function(e)
    if e.level == "WARN" and Cfg.NotifyWarnings and e.module ~= "Crucifix" then
        notify("warn", e.module, firstLine(e.msg))
    end
end)

--============================================================--
-- ACTUALISATION DES INDICATEURS (etat reel des modules)
--============================================================--
local function yesNo(b) return b and "Actif" or "Inactif" end
local function stateColor(b) return b and T.Ok or T.Sub end

every("UI", 0.5, function()
    local s = ESP.stats
    local entN = ESP.count("Entities")
    local errs, bad = 0, {}
    for _, n in ipairs(ModuleOrder) do
        local m = Modules[n]
        errs = errs + m.errors
        if m.errors > 0 then table.insert(bad, n .. " (" .. m.errors .. ")") end
    end
    local crossState = Cross.busy and "En cours" or ((not Cfg.CrossInfinite and Cross.left <= 0 and Cross.tool) and "Sans charge")
        or (Cross.tool and Cross.tool.Parent and "Equipable") or "Non obtenu"

    StatusText.Text = string.format("ESP <b>%s</b>  |  Fullbright <b>%s</b>  |  Entites <b>%d</b>  |  Marqueurs <b>%d</b>  |  Erreurs <b>%d</b>",
        Cfg.EspEnabled and "ON" or "OFF", Cfg.Fullbright and "ON" or "OFF", entN, s.markers, errs)

    if currentPage == iDash then
        dEsp(yesNo(Cfg.EspEnabled) .. "  -  " .. s.visible .. " visibles / " .. s.markers, stateColor(Cfg.EspEnabled))
        dFb(yesNo(Cfg.Fullbright) .. (Cfg.NoFog and "  +  sans brouillard" or ""), stateColor(Cfg.Fullbright))
        dCross(crossState .. "  -  " .. crossCharges() .. " charges")
        dEnt(tostring(entN))
        dMods(#bad == 0 and "Aucun" or table.concat(bad, ", "), #bad == 0 and T.Ok or T.Err)
        local gd = ReplicatedStorage:FindFirstChild("GameData")
        local latest = gd and gd:FindFirstChild("LatestRoom")
        dRoom(latest and tostring(latest.Value) or "Inconnue (hors partie DOORS ?)")
        local ev, er = {}, {}
        for i = #Log.entries, 1, -1 do
            local e = Log.entries[i]
            if e.level == "ERROR" then
                if #er < 3 then table.insert(er, e.t .. "  " .. e.module .. " : " .. esc(firstLine(e.msg))) end
            elseif #ev < 5 then
                table.insert(ev, e.t .. "  " .. e.module .. " : " .. esc(firstLine(e.msg)))
            end
            if #ev >= 5 and #er >= 3 then break end
        end
        dEvents.Text = #ev > 0 and table.concat(ev, "\n") or "-"
        dErrors.Text = #er > 0 and table.concat(er, "\n") or "Aucune"
    elseif currentPage == 2 then
        espState(s.markers .. " suivis, " .. s.visible .. " visibles, " .. s.outlined .. " contours")
    elseif currentPage == 3 then
        fbState(yesNo(fbActive()), stateColor(fbActive()))
        local a = Lighting.Ambient
        fbAmb(string.format("%d, %d, %d", math.floor(a.R * 255 + 0.5), math.floor(a.G * 255 + 0.5), math.floor(a.B * 255 + 0.5)))
        fbBri(string.format("%.2f", Lighting.Brightness))
        fbFog(string.format("%.0f", Lighting.FogEnd))
        fbSaved(string.format("%.2f / %.0f", FB.saved.Brightness or 0, FB.saved.FogEnd or 0))
    elseif currentPage == 4 then
        local hum = humanoid()
        plState(hum and string.format("%.1f", hum.WalkSpeed) or "Pas de personnage")
    elseif currentPage == iEnt then
        local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
        local list = {}
        for obj, e in pairs(ESP.reg) do
            if e.cat == "Entities" and obj.Parent then table.insert(list, e) end
        end
        table.sort(list, function(a, b) return a.dist < b.dist end)
        entEmpty.Visible = #list == 0
        for i, e in ipairs(list) do
            local r = entRow(i)
            r.frame.Visible = true
            local inRange = root and e.dist <= Cfg.CrossRange
            r.a.Text = e.label .. "   (" .. math.floor(e.dist) .. "m)"
            r.a.TextColor3 = e.color
            r.b.Text = "Categorie : Entites  |  Etat : actif  |  " .. (inRange and "A portee du crucifix" or "Hors portee")
                .. "  |  " .. e.obj.Name
        end
        for i = #list + 1, #EntRows do EntRows[i].frame.Visible = false end
    elseif currentPage == 6 then
        cCharges(crossCharges())
        cRange(Cfg.CrossRange .. " studs")
        cState(crossState)
        cTarget(Cross.selected and Cross.selected.Parent and Cross.selected.Name or "Aucune")
        cLast(Cross.last, Cross.lastOk == true and T.Ok or (Cross.lastOk == false and T.Err or T.Text))
        local m = Modules.Crucifix
        cErr(m.errors == 0 and "Aucune" or (m.errors .. " : " .. tostring(m.lastError)), m.errors == 0 and T.Ok or T.Err)
    elseif currentPage == 7 then
        auPrompts(tostring(promptCount))
    elseif currentPage == iDbg and logDirty then
        renderLog()
    end
end)

--============================================================--
-- FENETRE : OUVERTURE / FERMETURE / ARRET
--============================================================--
on("UI", OpenBtn.MouseButton1Click, function() setWindow(not Main.Visible) end)
on("UI", MinBtn.MouseButton1Click, function() setWindow(false) end)
on("UI", CloseBtn.MouseButton1Click, requestClose)

local function stop()
    if not Alive then return end
    Alive = false
    for _, c in ipairs(Conns) do c:Disconnect() end
    table.clear(Conns)
    -- Ordre inverse : les modules crees en dernier sont arretes en premier
    for i = #Cleanups, 1, -1 do
        local ok, err = pcall(Cleanups[i])
        if not ok then warn("[Abyss] nettoyage " .. i .. " en echec : " .. tostring(err)) end
    end
    if G.AbyssStop == stop then G.AbyssStop = nil end
    print("[Abyss] arrete proprement")
end
G.AbyssStop = stop

selectPage(1)
Log.add("INFO", "UI", "Abyss Hub v" .. VERSION .. " charge (" .. #Pages .. " pages)")
notify("ok", "Abyss Hub v" .. VERSION, "Charge. Bouton A pour ouvrir/fermer.")
