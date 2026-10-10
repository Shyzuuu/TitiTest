-- ABYSS LITE // DOORS - version courte pour Delta Android (ASCII uniquement)
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UIS = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")

local LP = Players.LocalPlayer
local PlayerGui = LP:WaitForChild("PlayerGui")

-- Relance : on detruit l'ancienne instance
local G = getgenv and getgenv() or _G
if G.AbyssLiteStop then pcall(G.AbyssLiteStop) end

local Alive = true
local Conns = {}
local function on(sig, fn)
    local c = sig:Connect(fn)
    table.insert(Conns, c)
    return c
end

local Cfg = {
    Doors = false, Keys = false, Objectives = false, Items = false, Gold = false,
    Hiding = false, Entities = false, Players = false,
    Fullbright = false, NoFog = false,
    Speed = false, SpeedValue = 20,
    Fov = false, FovValue = 90,
    Alerts = true, InstantPrompt = false, AutoGold = false,
}

local Colors = {
    Doors = Color3.fromRGB(70, 210, 255),
    Keys = Color3.fromRGB(255, 225, 60),
    Objectives = Color3.fromRGB(90, 255, 120),
    Items = Color3.fromRGB(170, 90, 255),
    Gold = Color3.fromRGB(255, 150, 40),
    Hiding = Color3.fromRGB(70, 120, 255),
    Entities = Color3.fromRGB(255, 60, 60),
    Players = Color3.fromRGB(255, 255, 255),
}

local ACCENT = Color3.fromRGB(150, 90, 255)
local BG = Color3.fromRGB(16, 14, 24)
local EL = Color3.fromRGB(30, 26, 46)
local OFF = Color3.fromRGB(60, 55, 80)

--================ UI ================--
local Gui = Instance.new("ScreenGui")
Gui.Name = "AbyssLite"
Gui.ResetOnSpawn = false
Gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
Gui.DisplayOrder = 999
Gui.Parent = PlayerGui

local function corner(p, r)
    local c = Instance.new("UICorner")
    c.CornerRadius = UDim.new(0, r or 8)
    c.Parent = p
end

local function notify(title, text, color)
    if not Alive then return end
    local f = Instance.new("Frame")
    f.Size = UDim2.new(0, 230, 0, 52)
    f.Position = UDim2.new(1, -240, 1, -70)
    f.BackgroundColor3 = BG
    f.Parent = Gui
    corner(f, 8)
    local s = Instance.new("UIStroke")
    s.Color = color or ACCENT
    s.Thickness = 2
    s.Parent = f
    local t = Instance.new("TextLabel")
    t.BackgroundTransparency = 1
    t.Size = UDim2.new(1, -16, 1, -8)
    t.Position = UDim2.new(0, 8, 0, 4)
    t.Font = Enum.Font.GothamBold
    t.TextSize = 13
    t.TextWrapped = true
    t.TextXAlignment = Enum.TextXAlignment.Left
    t.TextColor3 = Color3.new(1, 1, 1)
    t.Text = title .. "\n" .. text
    t.Parent = f
    task.delay(4, function() f:Destroy() end)
end

local Main = Instance.new("Frame")
Main.Size = UDim2.new(0, 300, 0, 330)
Main.Position = UDim2.new(0.5, -150, 0.5, -165)
Main.BackgroundColor3 = BG
Main.Active = true
Main.Parent = Gui
corner(Main, 12)
local ms = Instance.new("UIStroke")
ms.Color = ACCENT
ms.Thickness = 2
ms.Parent = Main

local Top = Instance.new("TextLabel")
Top.Size = UDim2.new(1, 0, 0, 36)
Top.BackgroundColor3 = EL
Top.Font = Enum.Font.GothamBlack
Top.TextSize = 18
Top.TextColor3 = ACCENT
Top.Text = "ABYSS // DOORS"
Top.Active = true
Top.Parent = Main
corner(Top, 12)

-- Onglets
local TabBar = Instance.new("Frame")
TabBar.Size = UDim2.new(1, -12, 0, 30)
TabBar.Position = UDim2.new(0, 6, 0, 40)
TabBar.BackgroundTransparency = 1
TabBar.Parent = Main
local tl = Instance.new("UIListLayout")
tl.FillDirection = Enum.FillDirection.Horizontal
tl.Padding = UDim.new(0, 4)
tl.Parent = TabBar

local Pages, TabBtns = {}, {}
local function selectTab(i)
    for k, p in ipairs(Pages) do
        p.Visible = (k == i)
        TabBtns[k].BackgroundColor3 = (k == i) and ACCENT or EL
    end
end

local function newTab(name)
    local i = #Pages + 1
    local b = Instance.new("TextButton")
    b.Size = UDim2.new(0.25, -3, 1, 0)
    b.BackgroundColor3 = EL
    b.Font = Enum.Font.GothamBold
    b.TextSize = 12
    b.TextColor3 = Color3.new(1, 1, 1)
    b.Text = name
    b.Parent = TabBar
    corner(b, 6)

    local p = Instance.new("ScrollingFrame")
    p.Size = UDim2.new(1, -12, 1, -80)
    p.Position = UDim2.new(0, 6, 0, 74)
    p.BackgroundTransparency = 1
    p.BorderSizePixel = 0
    p.ScrollBarThickness = 4
    p.ScrollBarImageColor3 = ACCENT
    p.CanvasSize = UDim2.new(0, 0, 0, 0)
    p.AutomaticCanvasSize = Enum.AutomaticSize.Y
    p.Visible = false
    p.Parent = Main
    local l = Instance.new("UIListLayout")
    l.Padding = UDim.new(0, 5)
    l.SortOrder = Enum.SortOrder.LayoutOrder
    l.Parent = p

    Pages[i] = p
    TabBtns[i] = b
    b.MouseButton1Click:Connect(function() selectTab(i) end)
    return p
end

local order = 0
local function toggle(page, text, key, cb)
    order = order + 1
    local b = Instance.new("TextButton")
    b.Size = UDim2.new(1, -6, 0, 34)
    b.BackgroundColor3 = EL
    b.Font = Enum.Font.GothamMedium
    b.TextSize = 13
    b.TextColor3 = Color3.new(1, 1, 1)
    b.TextXAlignment = Enum.TextXAlignment.Left
    b.Text = "   " .. text
    b.LayoutOrder = order
    b.Parent = page
    corner(b, 7)
    local dot = Instance.new("Frame")
    dot.Size = UDim2.new(0, 34, 0, 18)
    dot.Position = UDim2.new(1, -42, 0.5, -9)
    dot.BackgroundColor3 = OFF
    dot.Parent = b
    corner(dot, 9)
    local function render()
        dot.BackgroundColor3 = Cfg[key] and ACCENT or OFF
    end
    b.MouseButton1Click:Connect(function()
        Cfg[key] = not Cfg[key]
        render()
        if cb then pcall(cb, Cfg[key]) end
    end)
    render()
end

-- Boutons - / + pour les valeurs (plus fiable qu'un slider au doigt)
local function stepper(page, text, key, min, max, step, cb)
    order = order + 1
    local f = Instance.new("Frame")
    f.Size = UDim2.new(1, -6, 0, 34)
    f.BackgroundColor3 = EL
    f.LayoutOrder = order
    f.Parent = page
    corner(f, 7)
    local lbl = Instance.new("TextLabel")
    lbl.BackgroundTransparency = 1
    lbl.Size = UDim2.new(1, -90, 1, 0)
    lbl.Position = UDim2.new(0, 10, 0, 0)
    lbl.Font = Enum.Font.GothamMedium
    lbl.TextSize = 13
    lbl.TextColor3 = Color3.new(1, 1, 1)
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = f
    local function render()
        lbl.Text = text .. " : " .. tostring(Cfg[key])
    end
    local function mk(txt, x, delta)
        local b = Instance.new("TextButton")
        b.Size = UDim2.new(0, 36, 0, 26)
        b.Position = UDim2.new(1, x, 0.5, -13)
        b.BackgroundColor3 = ACCENT
        b.Font = Enum.Font.GothamBlack
        b.TextSize = 16
        b.TextColor3 = Color3.new(1, 1, 1)
        b.Text = txt
        b.Parent = f
        corner(b, 6)
        b.MouseButton1Click:Connect(function()
            Cfg[key] = math.clamp(Cfg[key] + delta, min, max)
            render()
            if cb then pcall(cb, Cfg[key]) end
        end)
    end
    mk("-", -82, -step)
    mk("+", -42, step)
    render()
end

local function button(page, text, cb)
    order = order + 1
    local b = Instance.new("TextButton")
    b.Size = UDim2.new(1, -6, 0, 34)
    b.BackgroundColor3 = Color3.fromRGB(120, 35, 50)
    b.Font = Enum.Font.GothamBold
    b.TextSize = 13
    b.TextColor3 = Color3.new(1, 1, 1)
    b.Text = text
    b.LayoutOrder = order
    b.Parent = page
    corner(b, 7)
    b.MouseButton1Click:Connect(function() pcall(cb) end)
end

-- Deplacement de la fenetre par la barre du haut
do
    local dragging, start, startPos, dragInput
    Top.InputBegan:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
            dragging = true
            dragInput = input
            start = input.Position
            startPos = Main.Position
        end
    end)
    on(UIS.InputChanged, function(input)
        if dragging and (input == dragInput or input.UserInputType == Enum.UserInputType.MouseMovement) then
            local d = input.Position - start
            Main.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + d.X, startPos.Y.Scale, startPos.Y.Offset + d.Y)
        end
    end)
    on(UIS.InputEnded, function(input)
        if input == dragInput or input.UserInputType == Enum.UserInputType.MouseButton1 then
            dragging = false
        end
    end)
end

-- Bouton rond pour ouvrir/fermer
local Open = Instance.new("TextButton")
Open.Size = UDim2.new(0, 48, 0, 48)
Open.Position = UDim2.new(0, 10, 0.4, 0)
Open.BackgroundColor3 = ACCENT
Open.Font = Enum.Font.GothamBlack
Open.TextSize = 22
Open.TextColor3 = Color3.new(1, 1, 1)
Open.Text = "A"
Open.Parent = Gui
corner(Open, 24)
Open.MouseButton1Click:Connect(function()
    Main.Visible = not Main.Visible
end)

--================ ESP ================--
local ESP = {}

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

local function addEsp(obj, cat, label, part)
    if ESP[obj] or not obj.Parent then return end
    part = part or getPart(obj)
    if not part then return end

    local hl = Instance.new("Highlight")
    hl.Adornee = obj
    hl.FillColor = Colors[cat]
    hl.OutlineColor = Colors[cat]
    hl.FillTransparency = 0.7
    hl.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
    hl.Enabled = false
    hl.Parent = obj

    local bb = Instance.new("BillboardGui")
    bb.Adornee = part
    bb.Size = UDim2.new(0, 150, 0, 34)
    bb.StudsOffset = Vector3.new(0, 2.5, 0)
    bb.AlwaysOnTop = true
    bb.Enabled = false
    bb.Parent = part

    local t = Instance.new("TextLabel")
    t.BackgroundTransparency = 1
    t.Size = UDim2.new(1, 0, 1, 0)
    t.Font = Enum.Font.GothamBold
    t.TextSize = 13
    t.TextColor3 = Colors[cat]
    t.TextStrokeTransparency = 0.3
    t.Text = label
    t.Parent = bb

    ESP[obj] = { hl = hl, bb = bb, txt = t, cat = cat, label = label, part = part }
end

-- Roblox affiche ~31 Highlight max : on n'allume que les plus proches (entites prioritaires)
local function refreshEsp()
    local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
    local list = {}
    for obj, e in pairs(ESP) do
        if not obj.Parent or not e.part.Parent then
            removeEsp(obj)
        else
            local on = Cfg[e.cat] == true
            local dist = root and (e.part.Position - root.Position).Magnitude or 0
            e.bb.Enabled = on
            if on then
                e.txt.Text = e.label .. " [" .. math.floor(dist) .. "m]"
                e.d = (e.cat == "Entities") and (dist - 100000) or dist
                table.insert(list, e)
            else
                e.hl.Enabled = false
            end
        end
    end
    table.sort(list, function(a, b) return a.d < b.d end)
    for i, e in ipairs(list) do
        e.hl.Enabled = i <= 28
    end
end

task.spawn(function()
    while Alive do
        pcall(refreshEsp)
        task.wait(0.25)
    end
end)

--================ DETECTION ================--
local Names = {
    KeyObtain = { "Keys", "Cle" }, ElectricalKeyObtain = { "Keys", "Cle elec" }, LeverForGate = { "Keys", "Levier" },
    LiveHintBook = { "Objectives", "Livre" }, LiveBreakerPolePickup = { "Objectives", "Disjoncteur" },
    FuseObtain = { "Objectives", "Fusible" }, MinesAnchor = { "Objectives", "Ancre" }, MinesGenerator = { "Objectives", "Generateur" },
    GoldPile = { "Gold", "Or" },
    Lighter = { "Items", "Briquet" }, Flashlight = { "Items", "Lampe" }, Lockpick = { "Items", "Crochets" },
    Vitamins = { "Items", "Vitamines" }, Bandage = { "Items", "Bandage" }, Crucifix = { "Items", "Crucifix" },
    SkeletonKey = { "Items", "Cle squelette" }, Battery = { "Items", "Pile" }, Candle = { "Items", "Bougie" },
    Shears = { "Items", "Cisailles" }, Smoothie = { "Items", "Smoothie" }, Glowsticks = { "Items", "Glowsticks" },
    Straplight = { "Items", "Straplight" }, Lantern = { "Items", "Lanterne" }, BandagePack = { "Items", "Bandages" },
    BatteryPack = { "Items", "Piles" }, AlarmClock = { "Items", "Reveil" }, Bulklight = { "Items", "Bulklight" },
    Wardrobe = { "Hiding", "Armoire" }, Bed = { "Hiding", "Lit" }, Rooms_Locker = { "Hiding", "Casier" },
    Backdoor_Wardrobe = { "Hiding", "Armoire" }, Locker_Large = { "Hiding", "Casier" }, Dumpster = { "Hiding", "Benne" },
    RushMoving = { "Entities", "RUSH" }, AmbushMoving = { "Entities", "AMBUSH" }, Eyes = { "Entities", "EYES" },
    SeekMoving = { "Entities", "SEEK" }, SeekMovingNewClone = { "Entities", "SEEK" }, FigureRig = { "Entities", "FIGURE" },
    BackdoorRush = { "Entities", "BLITZ" }, BackdoorLookman = { "Entities", "LOOKMAN" }, A60 = { "Entities", "A-60" },
    A120 = { "Entities", "A-120" }, GloombatSwarm = { "Entities", "GLOOMBATS" }, GrumbleRig = { "Entities", "GRUMBLE" },
}

local Alerts = {
    RUSH = "Cache-toi !", AMBUSH = "Cache-toi et ressors !", EYES = "Ne regarde pas !", SEEK = "Cours !",
    FIGURE = "Reste silencieux", BLITZ = "Cache-toi !", LOOKMAN = "Ne regarde pas !", ["A-60"] = "Cache-toi !",
    ["A-120"] = "Cache-toi !", GLOOMBATS = "Eteins ta lumiere !", SCREECH = "Regarde-le !", HALT = "Recule !",
}
local lastAlert = {}
local function alert(name)
    if not Cfg.Alerts or not Alerts[name] then return end
    if lastAlert[name] and os.clock() - lastAlert[name] < 6 then return end
    lastAlert[name] = os.clock()
    notify("! " .. name, Alerts[name], Color3.fromRGB(255, 60, 60))
end

local Gold = {}
local Prompts = {}

local function process(inst)
    if not Alive then return end
    if inst:IsA("ProximityPrompt") then
        if not Prompts[inst] then
            Prompts[inst] = inst.HoldDuration
            if Cfg.InstantPrompt then inst.HoldDuration = 0 end
        end
        return
    end
    if not (inst:IsA("Model") or inst:IsA("BasePart")) then return end

    local rooms = workspace:FindFirstChild("CurrentRooms")
    if inst.Name == "Door" and inst:IsA("Model") and rooms and inst.Parent and inst.Parent.Parent == rooms then
        local n = tonumber(inst.Parent.Name)
        addEsp(inst, "Doors", n and ("Porte " .. (n + 1)) or "Porte", inst:FindFirstChild("Door"))
        return
    end

    local d = Names[inst.Name]
    if not d then return end
    if d[1] ~= "Entities" and not inst:IsA("Model") then return end
    addEsp(inst, d[1], d[2])
    if d[1] == "Gold" then Gold[inst] = true end
    if d[1] == "Entities" then alert(d[2]) end
end

local function hookRooms(rooms)
    for _, d in ipairs(rooms:GetDescendants()) do process(d) end
    on(rooms.DescendantAdded, function(d) task.defer(process, d) end)
end

task.spawn(function()
    local rooms = workspace:WaitForChild("CurrentRooms", 60)
    if rooms and Alive then hookRooms(rooms) end
end)

on(workspace.ChildAdded, function(c) task.defer(process, c) end)

local cam = workspace.CurrentCamera
if cam then
    on(cam.ChildAdded, function(c)
        if c.Name == "Screech" then alert("SCREECH") end
        if c.Name == "Shade" then alert("HALT") end
    end)
end

local function hookPlayer(p)
    if p == LP then return end
    local function onChar(char)
        local r = char:WaitForChild("HumanoidRootPart", 10)
        if r then addEsp(char, "Players", p.DisplayName, r) end
    end
    on(p.CharacterAdded, onChar)
    if p.Character then task.spawn(onChar, p.Character) end
end
for _, p in ipairs(Players:GetPlayers()) do hookPlayer(p) end
on(Players.PlayerAdded, hookPlayer)

--================ MONDE / JOUEUR ================--
local orig = {
    Ambient = Lighting.Ambient, Brightness = Lighting.Brightness,
    GlobalShadows = Lighting.GlobalShadows, FogEnd = Lighting.FogEnd,
}

local function applyLight()
    if Cfg.Fullbright then
        Lighting.Ambient = Color3.new(1, 1, 1)
        Lighting.Brightness = 2
        Lighting.GlobalShadows = false
    end
    if Cfg.NoFog then
        Lighting.FogEnd = 100000
        for _, a in ipairs(Lighting:GetChildren()) do
            if a:IsA("Atmosphere") then a.Density = 0 end
        end
    end
end

local function restoreLight()
    Lighting.Ambient = orig.Ambient
    Lighting.Brightness = orig.Brightness
    Lighting.GlobalShadows = orig.GlobalShadows
    Lighting.FogEnd = orig.FogEnd
end

local defaultSpeed = nil
on(RunService.RenderStepped, function()
    if Cfg.Fullbright or Cfg.NoFog then applyLight() end
    local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
    if hum and Cfg.Speed then
        hum.WalkSpeed = Cfg.SpeedValue
    end
    if Cfg.Fov and workspace.CurrentCamera then
        workspace.CurrentCamera.FieldOfView = Cfg.FovValue
    end
end)

task.spawn(function()
    while Alive do
        if Cfg.AutoGold and fireproximityprompt then
            local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
            if root then
                for g in pairs(Gold) do
                    if not g.Parent then
                        Gold[g] = nil
                    else
                        local pr = g:FindFirstChildWhichIsA("ProximityPrompt", true)
                        local pt = getPart(g)
                        if pr and pt and (pt.Position - root.Position).Magnitude < 12 then
                            pcall(fireproximityprompt, pr)
                        end
                    end
                end
            end
        end
        task.wait(0.4)
    end
end)

--================ ONGLETS ================--
local P1 = newTab("ESP")
toggle(P1, "Portes", "Doors")
toggle(P1, "Cles & Leviers", "Keys")
toggle(P1, "Objectifs", "Objectives")
toggle(P1, "Objets", "Items")
toggle(P1, "Or", "Gold")
toggle(P1, "Cachettes", "Hiding")
toggle(P1, "Entites", "Entities")
toggle(P1, "Joueurs", "Players")

local P2 = newTab("Monde")
toggle(P2, "Fullbright", "Fullbright", function(s) if not s and not Cfg.NoFog then restoreLight() end end)
toggle(P2, "Sans brouillard", "NoFog", function(s) if not s and not Cfg.Fullbright then restoreLight() end end)
toggle(P2, "Alertes entites", "Alerts")

local P3 = newTab("Joueur")
toggle(P3, "Speed", "Speed", function(s)
    local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
    if not hum then return end
    if s then defaultSpeed = hum.WalkSpeed elseif defaultSpeed then hum.WalkSpeed = defaultSpeed end
end)
stepper(P3, "Vitesse", "SpeedValue", 15, 30, 1)
toggle(P3, "FOV", "Fov", function(s)
    if not s and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = 70 end
end)
stepper(P3, "FOV", "FovValue", 70, 120, 5)

local P4 = newTab("Auto")
toggle(P4, "Interaction instantanee", "InstantPrompt", function(s)
    for pr, hold in pairs(Prompts) do
        if pr.Parent then pr.HoldDuration = s and 0 or hold end
    end
end)
toggle(P4, "Auto ramasser l'or", "AutoGold")

local function stop()
    if not Alive then return end
    Alive = false
    for _, c in ipairs(Conns) do pcall(function() c:Disconnect() end) end
    for obj in pairs(ESP) do removeEsp(obj) end
    for pr, hold in pairs(Prompts) do
        if pr.Parent then pcall(function() pr.HoldDuration = hold end) end
    end
    pcall(restoreLight)
    local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
    if hum and defaultSpeed and Cfg.Speed then hum.WalkSpeed = defaultSpeed end
    if Cfg.Fov and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = 70 end
    Gui:Destroy()
    G.AbyssLiteStop = nil
end
G.AbyssLiteStop = stop
button(P4, "Fermer le script", stop)

selectTab(1)
notify("ABYSS", "Charge ! Touche le bouton A.", ACCENT)
