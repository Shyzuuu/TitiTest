--!nocheck
-- Environnement Roblox simule (headless) pour executer les scripts Abyss hors du jeu.
-- Il reproduit l'API utilisee par le script : instances, signaux, services, types de donnees,
-- planificateur task.* et fonctions d'executeur. Ce n'est PAS un moteur Roblox complet.

local Mock = { errors = {}, console = {}, now = 0, fired = {}, clipboard = nil, files = {} }

local function record(kind, msg)
    table.insert(Mock.errors, kind .. ": " .. tostring(msg))
end

--============================== DATATYPES ==============================--
local function typed(tbl, name, mt)
    mt.__type = name
    return setmetatable(tbl, mt)
end

local V3MT = {}
local function V3(x, y, z) return typed({ X = x or 0, Y = y or 0, Z = z or 0 }, "Vector3", V3MT) end
V3MT.__add = function(a, b) return V3(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
V3MT.__sub = function(a, b) return V3(a.X - b.X, a.Y - b.Y, a.Z - b.Z) end
V3MT.__mul = function(a, b)
    if type(a) == "number" then return V3(a * b.X, a * b.Y, a * b.Z) end
    if type(b) == "number" then return V3(a.X * b, a.Y * b, a.Z * b) end
    return V3(a.X * b.X, a.Y * b.Y, a.Z * b.Z)
end
V3MT.__div = function(a, b) return V3(a.X / b, a.Y / b, a.Z / b) end
V3MT.__eq = function(a, b) return a.X == b.X and a.Y == b.Y and a.Z == b.Z end
V3MT.__index = function(v, k)
    if k == "Magnitude" then return math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z) end
    if k == "Unit" then local m = math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z) return V3(v.X / m, v.Y / m, v.Z / m) end
    error("Vector3." .. tostring(k) .. " inexistant", 2)
end
local Vector3 = { new = V3, zero = V3(0, 0, 0) }

local V2MT = {}
local function V2(x, y) return typed({ X = x or 0, Y = y or 0 }, "Vector2", V2MT) end
V2MT.__add = function(a, b) return V2(a.X + b.X, a.Y + b.Y) end
V2MT.__sub = function(a, b) return V2(a.X - b.X, a.Y - b.Y) end
V2MT.__eq = function(a, b) return a.X == b.X and a.Y == b.Y end
V2MT.__index = function(v, k)
    if k == "Magnitude" then return math.sqrt(v.X * v.X + v.Y * v.Y) end
    error("Vector2." .. tostring(k) .. " inexistant", 2)
end
local Vector2 = { new = V2, zero = V2(0, 0) }

-- CFrame simplifie : translation uniquement (les rotations sont ignorees)
local CFMT = {}
local function CF(x, y, z)
    if type(x) == "table" then return typed({ Position = x }, "CFrame", CFMT) end
    return typed({ Position = V3(x, y, z) }, "CFrame", CFMT)
end
CFMT.__mul = function(a, b)
    if getmetatable(b) == V3MT then return a.Position + b end
    return CF(a.Position + b.Position)
end
CFMT.__index = function(c, k)
    if k == "X" then return c.Position.X elseif k == "Y" then return c.Position.Y elseif k == "Z" then return c.Position.Z end
    error("CFrame." .. tostring(k) .. " inexistant", 2)
end
local CFrame = {
    new = function(x, y, z) return CF(x or 0, y or 0, z or 0) end,
    Angles = function() return CF(0, 0, 0) end,
    lookAt = function(a) return CF(a) end,
}
CFrame.identity = CF(0, 0, 0)

local C3MT = {}
local function C3(r, g, b) return typed({ R = r or 0, G = g or 0, B = b or 0 }, "Color3", C3MT) end
C3MT.__eq = function(a, b) return math.abs(a.R - b.R) < 1e-6 and math.abs(a.G - b.G) < 1e-6 and math.abs(a.B - b.B) < 1e-6 end
C3MT.__index = function(_, k) error("Color3." .. tostring(k) .. " inexistant", 2) end
local Color3 = {
    new = C3,
    fromRGB = function(r, g, b) return C3(r / 255, g / 255, b / 255) end,
    fromHSV = function(h, s, v) return C3(v, v * (1 - s), v * (1 - s * h)) end,
}

local UDMT = { __index = function(_, k) error("UDim." .. tostring(k) .. " inexistant", 2) end }
local function UD(s, o) return typed({ Scale = s or 0, Offset = o or 0 }, "UDim", UDMT) end
local UDim = { new = UD }
local UD2MT = { __index = function(_, k) error("UDim2." .. tostring(k) .. " inexistant", 2) end }
UD2MT.__eq = function(a, b) return a.X.Scale == b.X.Scale and a.X.Offset == b.X.Offset and a.Y.Scale == b.Y.Scale and a.Y.Offset == b.Y.Offset end
local function UD2(xs, xo, ys, yo) return typed({ X = UD(xs, xo), Y = UD(ys, yo) }, "UDim2", UD2MT) end
local UDim2 = {
    new = UD2,
    fromOffset = function(x, y) return UD2(0, x, 0, y) end,
    fromScale = function(x, y) return UD2(x, 0, y, 0) end,
}

local function plain(name) return { new = function(...) return typed({ args = { ... } }, name, {}) end } end
local ColorSequence, NumberSequence, NumberRange, TweenInfo =
    plain("ColorSequence"), plain("NumberSequence"), plain("NumberRange"), plain("TweenInfo")

-- Enum : Enum.Type.Item cree a la demande ; les valeurs connues sont fixees
local enumValues = { RenderPriority = { Camera = 200, Input = 100, Character = 300 } }
local Enum = setmetatable({}, {
    __index = function(t, typeName)
        local items = setmetatable({}, {
            __index = function(it, itemName)
                local v = typed({ Name = itemName, EnumType = typeName,
                    Value = (enumValues[typeName] and enumValues[typeName][itemName]) or 0 }, "EnumItem", {})
                rawset(it, itemName, v)
                return v
            end,
        })
        rawset(t, typeName, items)
        return items
    end,
})

--============================== SIGNAUX ==============================--
local SignalMT = {}
SignalMT.__index = SignalMT
local function Signal(name)
    return setmetatable({ handlers = {}, name = name }, SignalMT)
end
function SignalMT:Connect(fn)
    assert(type(fn) == "function", "Connect attend une fonction (" .. tostring(self.name) .. ")")
    local h = { fn = fn, connected = true }
    table.insert(self.handlers, h)
    local conn = { Connected = true }
    function conn.Disconnect()
        h.connected = false
        conn.Connected = false
    end
    return conn
end
function SignalMT:Fire(...)
    local list = table.clone(self.handlers)
    for _, h in ipairs(list) do
        if h.connected then
            local co = coroutine.create(h.fn)
            local ok, err = coroutine.resume(co, ...)
            if not ok then record("signal " .. tostring(self.name), debug.traceback(co, tostring(err))) end
            Mock.trackCoroutine(co)
        end
    end
end
function SignalMT:ConnectedCount()
    local n = 0
    for _, h in ipairs(self.handlers) do if h.connected then n = n + 1 end end
    return n
end
function SignalMT:Wait() return coroutine.yield() end

--============================== PLANIFICATEUR ==============================--
local queue = {}
function Mock.trackCoroutine(co)
    -- Les coroutines suspendues par task.wait se sont deja inscrites elles-memes
end
local function schedule(co, at, ...)
    table.insert(queue, { co = co, at = at, args = table.pack(...) })
end
local function resume(co, ...)
    local ok, err = coroutine.resume(co, ...)
    if not ok then record("coroutine", debug.traceback(co, tostring(err))) end
end

local task = {}
function task.spawn(fn, ...)
    local co = type(fn) == "thread" and fn or coroutine.create(fn)
    resume(co, ...)
    return co
end
function task.defer(fn, ...)
    local co = coroutine.create(fn)
    schedule(co, Mock.now, ...)
    return co
end
function task.delay(t, fn, ...)
    local co = coroutine.create(fn)
    schedule(co, Mock.now + (t or 0), ...)
    return co
end
function task.wait(t)
    local co = coroutine.running()
    local start = Mock.now
    schedule(co, Mock.now + math.max(t or 0, 1 / 60))
    coroutine.yield()
    return Mock.now - start
end

--============================== INSTANCES ==============================--
local Super = {
    Part = "BasePart", MeshPart = "BasePart", BasePart = "PVInstance", Model = "PVInstance", Workspace = "Model",
    PVInstance = "Instance", ScreenGui = "LayerCollector", BillboardGui = "LayerCollector", LayerCollector = "GuiBase2d",
    Frame = "GuiObject", TextLabel = "GuiObject", TextBox = "GuiObject", ScrollingFrame = "GuiObject",
    TextButton = "GuiButton", ImageButton = "GuiButton", GuiButton = "GuiObject", GuiObject = "GuiBase2d",
    GuiBase2d = "Instance", Tool = "BackpackItem", BackpackItem = "Instance", BlurEffect = "PostEffect",
    DepthOfFieldEffect = "PostEffect", PostEffect = "Instance", PlayerGui = "BasePlayerGui", BasePlayerGui = "Instance",
}

local Events = {
    Changed = true, ChildAdded = true, ChildRemoved = true, DescendantAdded = true, DescendantRemoving = true,
    AncestryChanged = true, Destroying = true, MouseButton1Click = true, Activated = true, InputBegan = true,
    InputChanged = true, InputEnded = true, Equipped = true, Unequipped = true, CharacterAdded = true,
    PlayerAdded = true, PlayerRemoving = true, Heartbeat = true, RenderStepped = true, Stepped = true,
    FocusLost = true, Focused = true, Triggered = true,
}

local Defaults = {
    Instance = { Archivable = true },
    GuiObject = { Visible = true, BackgroundTransparency = 0, Text = "", TextSize = 14, Rotation = 0,
        AbsoluteSize = V2(100, 30), AbsolutePosition = V2(0, 0) },
    LayerCollector = { Enabled = true },
    BasePart = { Anchored = false, CanCollide = true, Transparency = 0, LocalTransparencyModifier = 0, Size = V3(1, 1, 1) },
    Humanoid = { WalkSpeed = 16, JumpPower = 50, JumpHeight = 7.2, UseJumpPower = false, Health = 100, MaxHealth = 100 },
    Highlight = { Enabled = true, FillTransparency = 0.5 },
    ProximityPrompt = { HoldDuration = 1, MaxActivationDistance = 10, Enabled = true },
    Camera = { FieldOfView = 70, ViewportSize = V2(800, 400) },
    Atmosphere = { Density = 0.3 },
    PostEffect = { Enabled = true },
    TextBox = { PlaceholderText = "" },
}

local InstMT = {}
local all = setmetatable({}, { __mode = "k" })

local function isA(class, target)
    local c = class
    while c do
        if c == target then return true end
        c = Super[c]
    end
    return target == "Instance"
end

local function defaultFor(self, key)
    local c = self.ClassName
    while c do
        local d = Defaults[c]
        if d and d[key] ~= nil then return d[key] end
        c = Super[c]
    end
    local d = Defaults.Instance
    return d[key]
end

local Methods = {}

local function new(className, props)
    local self = { __props = { Name = className }, __children = {}, __signals = {}, __attrs = {}, __propSignals = {},
        ClassName = className, __destroyed = false }
    setmetatable(self, InstMT)
    all[self] = true
    if props then for k, v in pairs(props) do self[k] = v end end
    return self
end

local function signalOf(self, name)
    local s = self.__signals[name]
    if not s then
        s = Signal(self.__props.Name .. "." .. name)
        self.__signals[name] = s
    end
    return s
end

local function descendants(self, out)
    out = out or {}
    for _, c in ipairs(self.__children) do
        table.insert(out, c)
        descendants(c, out)
    end
    return out
end

local function setParent(self, parent)
    if self.__destroyed then error("The Parent property of " .. self.__props.Name .. " is locked", 3) end
    local old = self.__props.Parent
    if old == parent then return end
    if parent == self then error("Parent circulaire", 3) end
    if old then
        for i, c in ipairs(old.__children) do
            if c == self then table.remove(old.__children, i) break end
        end
        local a = old
        while a do
            signalOf(a, "DescendantRemoving"):Fire(self)
            a = a.__props.Parent
        end
        signalOf(old, "ChildRemoved"):Fire(self)
    end
    self.__props.Parent = parent
    if parent then table.insert(parent.__children, self) end
    signalOf(self, "AncestryChanged"):Fire(self, parent)
    for _, d in ipairs(descendants(self)) do signalOf(d, "AncestryChanged"):Fire(self, parent) end
    if parent then
        signalOf(parent, "ChildAdded"):Fire(self)
        local list = { self }
        for _, d in ipairs(descendants(self)) do table.insert(list, d) end
        local a = parent
        while a do
            for _, d in ipairs(list) do signalOf(a, "DescendantAdded"):Fire(d) end
            a = a.__props.Parent
        end
    end
end

InstMT.__type = "Instance"
InstMT.__tostring = function(self) return self.__props.Name end
InstMT.__index = function(self, key)
    if key == "Parent" or key == "Name" then return self.__props[key] end
    if Methods[key] then return Methods[key] end
    if Events[key] then return signalOf(self, key) end
    local v = self.__props[key]
    if v ~= nil then return v end
    if key == "Position" and isA(self.ClassName, "BasePart") then
        return (self.__props.CFrame or CF(0, 0, 0)).Position
    end
    if key == "CFrame" and isA(self.ClassName, "BasePart") then return CF(0, 0, 0) end
    local customs = rawget(self, "__custom")
    local custom = customs and customs[key]
    if custom ~= nil then return custom end
    -- Un enfant portant ce nom (acces style game.Workspace.X)
    for _, c in ipairs(self.__children) do
        if c.__props.Name == key then return c end
    end
    return defaultFor(self, key)
end
InstMT.__newindex = function(self, key, value)
    -- Champs internes du mock (prefixe __) : stockes directement, jamais comme proprietes Roblox
    if type(key) == "string" and key:sub(1, 2) == "__" then
        rawset(self, key, value)
        return
    end
    if key == "Parent" then
        if value ~= nil and getmetatable(value) ~= InstMT then error("Parent invalide : " .. tostring(value), 2) end
        setParent(self, value)
        return
    end
    if Events[key] or Methods[key] then error("Impossible d'assigner " .. key, 2) end
    if key == "Position" and isA(self.ClassName, "BasePart") then key, value = "CFrame", CF(value) end
    local old = self.__props[key]
    self.__props[key] = value
    if old ~= value then
        local ps = self.__propSignals[key]
        if ps then ps:Fire() end
        local ch = self.__signals.Changed
        if ch then ch:Fire(key) end
    end
end

function Methods.GetChildren(self) return table.clone(self.__children) end
function Methods.GetDescendants(self) return descendants(self) end
function Methods.FindFirstChild(self, name, recursive)
    local list = recursive and descendants(self) or self.__children
    for _, c in ipairs(list) do if c.__props.Name == name then return c end end
    return nil
end
function Methods.FindFirstChildOfClass(self, class)
    for _, c in ipairs(self.__children) do if c.ClassName == class then return c end end
    return nil
end
function Methods.FindFirstChildWhichIsA(self, class, recursive)
    local list = recursive and descendants(self) or self.__children
    for _, c in ipairs(list) do if isA(c.ClassName, class) then return c end end
    return nil
end
function Methods.WaitForChild(self, name, timeout)
    local c = Methods.FindFirstChild(self, name)
    if c then return c end
    local limit = Mock.now + (timeout or 5)
    while Mock.now < limit do
        task.wait(0.1)
        c = Methods.FindFirstChild(self, name)
        if c then return c end
    end
    return nil
end
function Methods.IsA(self, class) return isA(self.ClassName, class) end
function Methods.IsDescendantOf(self, anc)
    local p = self.__props.Parent
    while p do
        if p == anc then return true end
        p = p.__props.Parent
    end
    return false
end
function Methods.GetFullName(self)
    local parts, n = {}, self
    while n and n.ClassName ~= "DataModel" do
        table.insert(parts, 1, n.__props.Name)
        n = n.__props.Parent
    end
    return table.concat(parts, ".")
end
function Methods.Destroy(self)
    if self.__destroyed then return end
    signalOf(self, "Destroying"):Fire()
    for _, c in ipairs(table.clone(self.__children)) do Methods.Destroy(c) end
    if self.__props.Parent then setParent(self, nil) end
    self.__destroyed = true
    for _, s in pairs(self.__signals) do
        for _, h in ipairs(s.handlers) do h.connected = false end
    end
end
function Methods.ClearAllChildren(self)
    for _, c in ipairs(table.clone(self.__children)) do Methods.Destroy(c) end
end
function Methods.GetPropertyChangedSignal(self, prop)
    local s = self.__propSignals[prop]
    if not s then
        s = Signal(self.__props.Name .. ":" .. prop)
        self.__propSignals[prop] = s
    end
    return s
end
function Methods.SetAttribute(self, k, v) self.__attrs[k] = v end
function Methods.GetAttribute(self, k) return self.__attrs[k] end
function Methods.GetPivot(self)
    if self.ClassName == "Model" then
        local p = self.__props.PrimaryPart or Methods.FindFirstChildWhichIsA(self, "BasePart", true)
        return p and p.CFrame or CF(0, 0, 0)
    end
    return self.CFrame
end
function Methods.PivotTo(self, cf)
    if self.ClassName == "Model" then
        local pivot = Methods.GetPivot(self)
        local delta = cf.Position - pivot.Position
        for _, d in ipairs(descendants(self)) do
            if isA(d.ClassName, "BasePart") then d.CFrame = CF(d.CFrame.Position + delta) end
        end
    else
        self.CFrame = cf
    end
end
function Methods.SetStateEnabled() end
function Methods.Clone(self)
    local c = new(self.ClassName)
    for k, v in pairs(self.__props) do if k ~= "Parent" then c.__props[k] = v end end
    for _, ch in ipairs(self.__children) do Methods.Clone(ch).Parent = c end
    return c
end

-- Methodes de services (rattachees via __custom)
local function service(className, custom)
    local s = new(className)
    s.__custom = custom or {}
    return s
end

--============================== MONDE ==============================--
local game = new("DataModel")
game.__props.Name = "Game"
local Workspace = service("Workspace")
Workspace.Name = "Workspace"
Workspace.Parent = game

local Camera = new("Camera")
Camera.Parent = Workspace
Workspace.__props.CurrentCamera = Camera
function Methods.WorldToViewportPoint(self, pos)
    return V3(400, 200, 1), true
end

local Lighting = service("Lighting")
Lighting.Name = "Lighting"
Lighting.Parent = game
Lighting.Ambient = C3(0.2, 0.2, 0.2)
Lighting.OutdoorAmbient = C3(0.3, 0.3, 0.3)
Lighting.Brightness = 1
Lighting.GlobalShadows = true
Lighting.FogEnd = 500

local RunService = service("RunService")
local bound = {}
RunService.__custom.BindToRenderStep = function(_, name, prio, fn) bound[name] = { prio = prio, fn = fn } end
RunService.__custom.UnbindFromRenderStep = function(_, name) bound[name] = nil end
Mock.bound = bound

local TweenService = service("TweenService")
TweenService.__custom.Create = function(_, inst, info, props)
    return { Play = function() for k, v in pairs(props) do inst[k] = v end end, Cancel = function() end }
end

local jsonStore, jsonId = {}, 0
local HttpService = service("HttpService")
HttpService.__custom.JSONEncode = function(_, t)
    jsonId = jsonId + 1
    jsonStore["json#" .. jsonId] = table.clone(t)
    return "json#" .. jsonId
end
HttpService.__custom.JSONDecode = function(_, s)
    local t = jsonStore[s]
    if not t then error("Can't parse JSON") end
    return table.clone(t)
end

local StarterGui = service("StarterGui")
StarterGui.__custom.SetCore = function() end
local UserInputService = service("UserInputService")
local ReplicatedStorage = service("ReplicatedStorage")
ReplicatedStorage.Parent = game
local CoreGui = service("CoreGui")
CoreGui.Parent = game

local Players = service("Players")
Players.Parent = game

local function makeCharacter(name)
    local char = new("Model", { Name = name })
    local root = new("Part", { Name = "HumanoidRootPart", CFrame = CF(0, 3, 0) })
    root.Parent = char
    char.PrimaryPart = root
    new("Humanoid").Parent = char
    new("Part", { Name = "RightHand", CFrame = CF(1, 3, 0) }).Parent = char
    return char
end
Mock.makeCharacter = makeCharacter

local function makePlayer(name)
    local p = new("Player", { Name = name, DisplayName = name })
    p.Parent = Players
    return p
end

local LP = makePlayer("Tester")
new("PlayerGui", { Name = "PlayerGui" }).Parent = LP
new("Backpack", { Name = "Backpack" }).Parent = LP
LP.Character = makeCharacter("Tester")
LP.Character.Parent = Workspace
local mouse = { Target = nil }
LP.__custom = { GetMouse = function() return mouse end }
Mock.mouse = mouse

Players.__custom.LocalPlayer = LP
Players.__custom.GetPlayers = function()
    local out = {}
    for _, c in ipairs(Players.__children) do if c.ClassName == "Player" then table.insert(out, c) end end
    return out
end

local other = makePlayer("Friend")
other.Character = makeCharacter("Friend")
other.Character.Parent = Workspace

local services = {
    Players = Players, RunService = RunService, UserInputService = UserInputService, Lighting = Lighting,
    HttpService = HttpService, TweenService = TweenService, ReplicatedStorage = ReplicatedStorage,
    StarterGui = StarterGui, CoreGui = CoreGui, Workspace = Workspace,
}
game.__custom = {
    GetService = function(_, name)
        local s = services[name]
        if not s then error("Service inconnu du mock : " .. tostring(name)) end
        return s
    end,
    IsLoaded = function() return true end,
}

--============================== API PUBLIQUE ==============================--
function Mock.step(dt, frames)
    frames = frames or 1
    for _ = 1, frames do
        Mock.now = Mock.now + dt / frames
        RunService.Heartbeat:Fire(dt / frames)
        local list = {}
        for _, b in pairs(bound) do table.insert(list, b) end
        table.sort(list, function(a, b) return a.prio < b.prio end)
        for _, b in ipairs(list) do
            local ok, err = pcall(b.fn, dt / frames)
            if not ok then record("renderstep", err) end
        end
        RunService.RenderStepped:Fire(dt / frames)
        -- Reprend toutes les coroutines arrivees a echeance (y compris celles planifiees pendant la boucle)
        local guard = 0
        while true do
            guard = guard + 1
            if guard > 10000 then record("scheduler", "boucle infinie") break end
            local idx
            for i, q in ipairs(queue) do
                if q.at <= Mock.now then idx = i break end
            end
            if not idx then break end
            local q = table.remove(queue, idx)
            if coroutine.status(q.co) == "suspended" then resume(q.co, table.unpack(q.args, 1, q.args.n)) end
        end
    end
end

function Mock.run(seconds, fps)
    fps = fps or 30
    local frames = math.max(1, math.floor(seconds * fps))
    for _ = 1, frames do Mock.step(1 / fps) end
end

function Mock.new(className, props) return new(className, props) end

function Mock.env()
    local G = {}
    local env = {
        game = game, workspace = Workspace, Instance = { new = function(c, parent)
            local i = new(c)
            if parent then i.Parent = parent end
            return i
        end },
        Enum = Enum, Color3 = Color3, UDim = UDim, UDim2 = UDim2, Vector2 = Vector2, Vector3 = Vector3, CFrame = CFrame,
        ColorSequence = ColorSequence, NumberSequence = NumberSequence, NumberRange = NumberRange, TweenInfo = TweenInfo,
        task = task,
        typeof = function(v)
            local mt = getmetatable(v)
            if type(mt) == "table" and mt.__type then return mt.__type end
            return type(v)
        end,
        print = function(...)
            local t = {}
            for i = 1, select("#", ...) do t[i] = tostring(select(i, ...)) end
            table.insert(Mock.console, table.concat(t, " "))
        end,
        warn = function(...)
            local t = {}
            for i = 1, select("#", ...) do t[i] = tostring(select(i, ...)) end
            table.insert(Mock.console, "WARN " .. table.concat(t, " "))
        end,
        getgenv = function() return G end,
        writefile = function(name, data) Mock.files[name] = data end,
        readfile = function(name)
            if Mock.files[name] == nil then error("fichier absent") end
            return Mock.files[name]
        end,
        isfile = function(name) return Mock.files[name] ~= nil end,
        setclipboard = function(s) Mock.clipboard = s end,
        fireproximityprompt = function(p)
            Mock.fired[p] = (Mock.fired[p] or 0) + 1
        end,
        os = setmetatable({ clock = function() return Mock.now end }, { __index = os }),
    }
    env._G = G
    setmetatable(env, { __index = getfenv(0) })
    return env, G
end

Mock.game, Mock.Workspace, Mock.Lighting, Mock.Players, Mock.LP, Mock.RunService = game, Workspace, Lighting, Players, LP, RunService
Mock.UIS, Mock.Camera, Mock.Other, Mock.ReplicatedStorage = UserInputService, Camera, other, ReplicatedStorage
Mock.C3, Mock.V3, Mock.CF = C3, V3, CF
Mock.InstMT = InstMT

-- Charge et execute un script dans l'environnement simule (dans une coroutine, comme un executeur)
function Mock.exec(source, chunkName, env)
    local fn, err = loadstring(source, chunkName)
    if not fn then error("Compilation : " .. tostring(err)) end
    setfenv(fn, env)
    local co = coroutine.create(fn)
    local ok, e = coroutine.resume(co)
    if not ok then record("script", debug.traceback(co, tostring(e))) end
    return co
end

return Mock
