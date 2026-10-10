-- ABYSS MINI // DOORS - Delta Android. ASCII et < 30 Ko : au-dela, l'editeur de Delta n'execute rien.
local Players = game:GetService("Players")
local RS = game:GetService("RunService")
local UIS = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")
local LP = Players.LocalPlayer
local PG = LP:WaitForChild("PlayerGui")
local G = (getgenv and getgenv()) or _G
for _, k in ipairs({ "AbyssStop", "AbyssLiteStop" }) do
  if type(G[k]) == "function" then pcall(G[k]) end
end

-- Bandeau de demarrage : prouve que le script tourne et affiche l'erreur s'il plante
local Boot = Instance.new("ScreenGui")
Boot.Name, Boot.ResetOnSpawn, Boot.DisplayOrder = "AbyssBoot", false, 1000
Boot.Parent = PG
local BootTxt = Instance.new("TextLabel")
BootTxt.Size, BootTxt.Position = UDim2.new(0, 320, 0, 40), UDim2.new(0.5, -160, 0, 30)
BootTxt.BackgroundColor3, BootTxt.TextColor3 = Color3.fromRGB(20, 20, 28), Color3.new(1, 1, 1)
BootTxt.TextWrapped, BootTxt.TextSize, BootTxt.Font = true, 13, Enum.Font.GothamBold
BootTxt.Text = "ABYSS : chargement..."
BootTxt.Parent = Boot

local ok, err = pcall(function()
local Alive, Conns, Cleanups = true, {}, {}
local function on(sig, fn)
  local c = sig:Connect(function(...)
    if not Alive then return end
    local s, e = pcall(fn, ...)
    if not s then warn("[Abyss] " .. tostring(e)) end
  end)
  table.insert(Conns, c)
  return c
end
local function loop(dt, fn)
  task.spawn(function()
    while Alive do
      local s, e = pcall(fn)
      if not s then warn("[Abyss] " .. tostring(e)) end
      task.wait(dt)
    end
  end)
end

local Pal = {
  { "Rouge", Color3.fromRGB(255, 60, 60) }, { "Orange", Color3.fromRGB(255, 150, 40) },
  { "Jaune", Color3.fromRGB(255, 225, 60) }, { "Vert", Color3.fromRGB(90, 255, 120) },
  { "Cyan", Color3.fromRGB(70, 210, 255) }, { "Bleu", Color3.fromRGB(70, 120, 255) },
  { "Violet", Color3.fromRGB(170, 90, 255) }, { "Rose", Color3.fromRGB(255, 100, 200) },
  { "Blanc", Color3.fromRGB(255, 255, 255) },
}
-- prio : plus petit = contour prioritaire (Roblox limite le nombre de Highlight affiches)
local Cats = {
  { "Entities", "Entites", 1, 1 }, { "Doors", "Portes", 5, 2 }, { "Keys", "Cles", 3, 3 },
  { "Levers", "Leviers", 2, 3 }, { "Books", "Livres", 4, 4 }, { "Breakers", "Disjoncteurs", 4, 4 },
  { "Objectives", "Objectifs Mines", 4, 4 }, { "Items", "Objets", 7, 5 }, { "Gold", "Or", 2, 5 },
  { "Players", "Joueurs", 9, 6 }, { "Chests", "Tiroirs/Coffres", 8, 7 }, { "Hiding", "Cachettes", 6, 7 },
}
local Prio = {}
local Cfg = {
  Names = true, Dist = true, Outlines = true, Fullbright = false, NoFog = false, Speed = false, SpeedV = 20,
  Fov = false, FovV = 90, Alerts = true, AntiScreech = false, AntiA90 = false, AntiHalt = false,
  Instant = false, Reach = false, AutoGold = false, AutoDrawers = false, CrossAny = true, CrossRange = 60,
}
for _, c in ipairs(Cats) do
  Cfg["E_" .. c[1]] = false
  Cfg["C_" .. c[1]] = c[3]
  Prio[c[1]] = c[4]
end

local ACC, BG, EL, OFF, W = Color3.fromRGB(255, 55, 85), Color3.fromRGB(13, 13, 17), Color3.fromRGB(26, 26, 34),
  Color3.fromRGB(55, 55, 70), Color3.new(1, 1, 1)

local function new(class, props, parent)
  local o = Instance.new(class)
  for k, v in pairs(props) do o[k] = v end
  o.Parent = parent
  return o
end
local function round(p, r) new("UICorner", { CornerRadius = UDim.new(0, r or 6) }, p) end

local Gui = new("ScreenGui", { Name = "AbyssMini", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 999 }, PG)
table.insert(Cleanups, function() Gui:Destroy() end)

local Notifs = new("Frame", { Size = UDim2.new(0, 230, 1, -20), Position = UDim2.new(1, -240, 0, 10), BackgroundTransparency = 1 }, Gui)
new("UIListLayout", { Padding = UDim.new(0, 5), VerticalAlignment = Enum.VerticalAlignment.Bottom }, Notifs)
local function notify(title, text, color)
  if not Alive then return end
  local kids = Notifs:GetChildren()
  if #kids > 4 then kids[2]:Destroy() end -- kids[1] est le UIListLayout
  local f = new("Frame", { Size = UDim2.new(1, 0, 0, 46), BackgroundColor3 = BG }, Notifs)
  round(f, 6)
  new("UIStroke", { Color = color or ACC, Thickness = 1.5 }, f)
  new("TextLabel", {
    BackgroundTransparency = 1, Size = UDim2.new(1, -14, 1, -6), Position = UDim2.new(0, 8, 0, 3),
    Font = Enum.Font.GothamBold, TextSize = 12, TextWrapped = true, TextColor3 = W,
    TextXAlignment = Enum.TextXAlignment.Left, Text = title .. "\n" .. text,
  }, f)
  task.delay(4, function() f:Destroy() end)
end

-- Fenetre : barre laterale + pages
local Main = new("Frame", {
  AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0), Size = UDim2.new(0, 440, 0, 290),
  BackgroundColor3 = BG, Active = true, ClipsDescendants = true,
}, Gui)
round(Main, 8)
new("UIStroke", { Color = Color3.fromRGB(45, 45, 58) }, Main)
local Scale = new("UIScale", {}, Main)
local cam0 = workspace.CurrentCamera
if cam0 then Scale.Scale = math.clamp(math.min(cam0.ViewportSize.X / 640, cam0.ViewportSize.Y / 360), 0.6, 1.2) end

local Head = new("TextLabel", {
  Size = UDim2.new(1, 0, 0, 32), BackgroundColor3 = Color3.fromRGB(19, 19, 25), Font = Enum.Font.GothamBlack,
  TextSize = 14, TextColor3 = W, Text = "   ABYSS MINI  |  DOORS", TextXAlignment = Enum.TextXAlignment.Left, Active = true,
}, Main)
new("Frame", { Size = UDim2.new(1, 0, 0, 2), Position = UDim2.new(0, 0, 1, -2), BackgroundColor3 = ACC, BorderSizePixel = 0 }, Head)
local Hide = new("TextButton", {
  Size = UDim2.new(0, 26, 0, 22), Position = UDim2.new(1, -32, 0.5, -11), BackgroundColor3 = EL,
  Text = "-", TextColor3 = W, Font = Enum.Font.GothamBold, TextSize = 16,
}, Head)
round(Hide, 5)

local Side = new("Frame", { Size = UDim2.new(0, 104, 1, -32), Position = UDim2.new(0, 0, 0, 32), BackgroundColor3 = Color3.fromRGB(19, 19, 25), BorderSizePixel = 0 }, Main)
new("UIListLayout", { Padding = UDim.new(0, 3) }, Side)
new("UIPadding", { PaddingTop = UDim.new(0, 6), PaddingLeft = UDim.new(0, 5), PaddingRight = UDim.new(0, 5) }, Side)

local Pages, Tabs = {}, {}
local function select(i)
  for k, p in ipairs(Pages) do
    p.Visible = k == i
    Tabs[k].BackgroundColor3 = k == i and ACC or EL
  end
end
local function page(name)
  local i = #Pages + 1
  local b = new("TextButton", {
    Size = UDim2.new(1, 0, 0, 30), BackgroundColor3 = EL, Text = name, TextColor3 = W,
    Font = Enum.Font.GothamBold, TextSize = 12, LayoutOrder = i,
  }, Side)
  round(b, 5)
  local p = new("ScrollingFrame", {
    Size = UDim2.new(1, -116, 1, -40), Position = UDim2.new(0, 110, 0, 36), BackgroundTransparency = 1,
    BorderSizePixel = 0, ScrollBarThickness = 3, ScrollBarImageColor3 = ACC, CanvasSize = UDim2.new(),
    AutomaticCanvasSize = Enum.AutomaticSize.Y, Visible = false,
  }, Main)
  new("UIListLayout", { Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }, p)
  Pages[i], Tabs[i] = p, b
  b.MouseButton1Click:Connect(function() select(i) end)
  return p
end

local order = 0
local function row(p, h)
  order = order + 1
  return order
end
local function label(p, text)
  return new("TextLabel", {
    Size = UDim2.new(1, -6, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1,
    Font = Enum.Font.Gotham, TextSize = 11, TextWrapped = true, TextColor3 = Color3.fromRGB(150, 150, 170),
    TextXAlignment = Enum.TextXAlignment.Left, Text = text, LayoutOrder = row(p),
  }, p)
end
local Render = {}
local Apply = {}
local function set(key, v)
  Cfg[key] = v
  for _, f in ipairs(Render[key] or {}) do f() end
  if Apply[key] then
    local s, e = pcall(Apply[key], v)
    if not s then notify("Erreur", tostring(e), Color3.fromRGB(255, 70, 80)) end
  end
end
local function toggle(p, text, key)
  local b = new("TextButton", {
    Size = UDim2.new(1, -6, 0, 32), BackgroundColor3 = EL, Text = "  " .. text, TextColor3 = W,
    Font = Enum.Font.GothamMedium, TextSize = 12, TextXAlignment = Enum.TextXAlignment.Left, LayoutOrder = row(p),
  }, p)
  round(b, 5)
  local t = new("Frame", { Size = UDim2.new(0, 34, 0, 18), Position = UDim2.new(1, -42, 0.5, -9), BackgroundColor3 = OFF }, b)
  round(t, 9)
  local k = new("Frame", { Size = UDim2.new(0, 14, 0, 14), BackgroundColor3 = W }, t)
  round(k, 7)
  local function r()
    t.BackgroundColor3 = Cfg[key] and ACC or OFF
    k.Position = Cfg[key] and UDim2.new(1, -16, 0.5, -7) or UDim2.new(0, 2, 0.5, -7)
  end
  Render[key] = Render[key] or {}
  table.insert(Render[key], r)
  b.MouseButton1Click:Connect(function() set(key, not Cfg[key]) end)
  r()
end
local function stepper(p, text, key, lo, hi, step)
  local f = new("Frame", { Size = UDim2.new(1, -6, 0, 32), BackgroundColor3 = EL, LayoutOrder = row(p) }, p)
  round(f, 5)
  local l = new("TextLabel", {
    BackgroundTransparency = 1, Size = UDim2.new(1, -90, 1, 0), Position = UDim2.new(0, 8, 0, 0),
    Font = Enum.Font.GothamMedium, TextSize = 12, TextColor3 = W, TextXAlignment = Enum.TextXAlignment.Left,
  }, f)
  local function r() l.Text = text .. " : " .. Cfg[key] end
  Render[key] = { r }
  for i, d in ipairs({ -step, step }) do
    local b = new("TextButton", {
      Size = UDim2.new(0, 36, 0, 24), Position = UDim2.new(1, i == 1 and -82 or -42, 0.5, -12), BackgroundColor3 = ACC,
      Text = d < 0 and "-" or "+", TextColor3 = W, Font = Enum.Font.GothamBlack, TextSize = 15,
    }, f)
    round(b, 5)
    b.MouseButton1Click:Connect(function() set(key, math.clamp(Cfg[key] + d, lo, hi)) end)
  end
  r()
end
local function colorBtn(p, text, key)
  local b = new("TextButton", {
    Size = UDim2.new(1, -6, 0, 32), BackgroundColor3 = EL, TextColor3 = W, Font = Enum.Font.GothamMedium,
    TextSize = 12, TextXAlignment = Enum.TextXAlignment.Left, LayoutOrder = row(p),
  }, p)
  round(b, 5)
  local sw = new("Frame", { Size = UDim2.new(0, 18, 0, 18), Position = UDim2.new(1, -28, 0.5, -9) }, b)
  round(sw, 9)
  local function r()
    b.Text = "  " .. text .. " - " .. Pal[Cfg[key]][1]
    sw.BackgroundColor3 = Pal[Cfg[key]][2]
  end
  Render[key] = { r }
  b.MouseButton1Click:Connect(function() set(key, Cfg[key] % #Pal + 1) end)
  r()
end
local function button(p, text, fn)
  local b = new("TextButton", {
    Size = UDim2.new(1, -6, 0, 32), BackgroundColor3 = ACC, Text = text, TextColor3 = W,
    Font = Enum.Font.GothamBold, TextSize = 12, LayoutOrder = row(p),
  }, p)
  round(b, 5)
  local busy = false
  b.MouseButton1Click:Connect(function()
    if busy then return end
    busy = true
    local s, e = pcall(fn)
    if not s then notify("Erreur", tostring(e), Color3.fromRGB(255, 70, 80)) end
    busy = false
  end)
end

-- Deplacement de la fenetre
do
  local drag, inp, st, sp
  Head.InputBegan:Connect(function(i)
    if i.UserInputType == Enum.UserInputType.Touch or i.UserInputType == Enum.UserInputType.MouseButton1 then
      drag, inp, st, sp = true, i, i.Position, Main.Position
    end
  end)
  on(UIS.InputChanged, function(i)
    if drag and (i == inp or i.UserInputType == Enum.UserInputType.MouseMovement) then
      local d = i.Position - st
      Main.Position = UDim2.new(sp.X.Scale, sp.X.Offset + d.X, sp.Y.Scale, sp.Y.Offset + d.Y)
    end
  end)
  on(UIS.InputEnded, function(i)
    if i == inp or i.UserInputType == Enum.UserInputType.MouseButton1 then drag = false end
  end)
end
local Open = new("TextButton", {
  Size = UDim2.new(0, 46, 0, 46), Position = UDim2.new(0, 10, 0.4, 0), BackgroundColor3 = ACC,
  Text = "A", TextColor3 = W, Font = Enum.Font.GothamBlack, TextSize = 20,
}, Gui)
round(Open, 12)
Open.MouseButton1Click:Connect(function() Main.Visible = not Main.Visible end)
Hide.MouseButton1Click:Connect(function() Main.Visible = false end)

--================ ESP ================--
local ESP = {}
local function getPart(o)
  if o:IsA("BasePart") then return o end
  if not o:IsA("Model") then return nil end
  return o.PrimaryPart or o:FindFirstChild("HumanoidRootPart") or o:FindFirstChildWhichIsA("BasePart", true)
end
local function unesp(o)
  local e = ESP[o]
  if not e then return end
  ESP[o] = nil
  e.h:Destroy()
  e.b:Destroy()
end
-- Les salles arrivent en streaming : si la piece manque encore, on retente
local function esp(o, cat, text, partName, n)
  if not Alive or ESP[o] or not o.Parent then return end
  local part = (partName and o:FindFirstChild(partName)) or getPart(o)
  if not part then
    if (n or 0) < 8 then task.delay(0.5, function() esp(o, cat, text, partName, (n or 0) + 1) end) end
    return
  end
  local col = Pal[Cfg["C_" .. cat]][2]
  local h = new("Highlight", { Adornee = o, FillColor = col, OutlineColor = col, FillTransparency = 0.7,
    DepthMode = Enum.HighlightDepthMode.AlwaysOnTop, Enabled = false }, o)
  local b = new("BillboardGui", { Adornee = part, Size = UDim2.new(0, 160, 0, 34), StudsOffset = Vector3.new(0, 2.5, 0),
    AlwaysOnTop = true, Enabled = false }, part)
  local t = new("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, 0), Font = Enum.Font.GothamBold,
    TextSize = 13, TextColor3 = col, TextStrokeTransparency = 0.3, Text = text }, b)
  ESP[o] = { h = h, b = b, t = t, cat = cat, label = text, part = part, col = col, dist = 0 }
end
loop(0.25, function()
  local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
  local list = {}
  for o, e in pairs(ESP) do
    if not o.Parent or not e.part.Parent then
      unesp(o)
    else
      local vis = Cfg["E_" .. e.cat]
      e.dist = root and (e.part.Position - root.Position).Magnitude or 0
      e.b.Enabled = vis and (Cfg.Names or Cfg.Dist)
      if vis then
        local col = Pal[Cfg["C_" .. e.cat]][2]
        if col ~= e.col then
          e.col = col
          e.h.FillColor, e.h.OutlineColor, e.t.TextColor3 = col, col, col
        end
        local m = "[" .. math.floor(e.dist) .. "m]"
        e.t.Text = (Cfg.Names and Cfg.Dist) and (e.label .. "\n" .. m) or (Cfg.Names and e.label or m)
        e.s = Prio[e.cat] * 100000 + e.dist
        table.insert(list, e)
      else
        e.h.Enabled = false
      end
    end
  end
  table.sort(list, function(a, b) return a.s < b.s end)
  for i, e in ipairs(list) do e.h.Enabled = Cfg.Outlines and i <= 24 end
end)
table.insert(Cleanups, function() for o in pairs(ESP) do unesp(o) end end)

--================ DETECTION ================--
local function add(cat, list)
  local t = {}
  for k, v in pairs(list) do t[k] = { cat, v } end
  return t
end
local Names = {}
for _, part in ipairs({
  add("Keys", { KeyObtain = "Cle", ElectricalKeyObtain = "Cle elec" }),
  add("Levers", { LeverForGate = "Levier", TimerLever = "Levier timer" }),
  add("Books", { LiveHintBook = "Livre" }),
  add("Breakers", { LiveBreakerPolePickup = "Disjoncteur" }),
  add("Objectives", { FuseObtain = "Fusible", MinesAnchor = "Ancre", MinesGenerator = "Generateur", WaterPump = "Pompe" }),
  add("Gold", { GoldPile = "Or" }),
  add("Items", { Lighter = "Briquet", Flashlight = "Lampe", Lockpick = "Crochets", Vitamins = "Vitamines",
    Bandage = "Bandage", BandagePack = "Bandages", Crucifix = "Crucifix", SkeletonKey = "Cle squelette",
    Battery = "Pile", BatteryPack = "Piles", Candle = "Bougie", Shears = "Cisailles", Smoothie = "Smoothie",
    Glowsticks = "Glowsticks", Straplight = "Straplight", Lantern = "Lanterne", AlarmClock = "Reveil",
    Bulklight = "Bulklight", LaserPointer = "Laser", Compass = "Boussole", Multitool = "Multitool",
    StarVial = "Fiole etoile", ShakeLight = "Shakelight" }),
  add("Chests", { DrawerContainer = "Tiroir", ChestBox = "Coffre", ChestBoxLocked = "Coffre verrouille",
    Toolbox = "Boite a outils", Locker_Small = "Petit casier", RolltopContainer = "Bureau" }),
  add("Hiding", { Wardrobe = "Armoire", Backdoor_Wardrobe = "Armoire", Bed = "Lit", DoubleBed = "Lit",
    Rooms_Locker = "Casier", Rooms_Locker_Fridge = "Frigo", Locker_Large = "Casier", Dumpster = "Benne", Toolshed = "Cabane" }),
  add("Entities", { RushMoving = "RUSH", AmbushMoving = "AMBUSH", Eyes = "EYES", SeekMoving = "SEEK",
    SeekMovingNewClone = "SEEK", FigureRig = "FIGURE", FigureRagdoll = "FIGURE", BackdoorRush = "BLITZ",
    BackdoorLookman = "LOOKMAN", A60 = "A-60", A120 = "A-120", GloombatSwarm = "GLOOMBATS",
    GrumbleRig = "GRUMBLE", GiggleCeiling = "GIGGLE", Snare = "SNARE", JeffTheKiller = "JEFF" }),
}) do
  for k, v in pairs(part) do Names[k] = v end
end
local Tips = {
  RUSH = "Cache-toi !", AMBUSH = "Cache-toi et ressors !", EYES = "Ne regarde pas !", SEEK = "Cours !",
  FIGURE = "Silence, accroupi.", BLITZ = "Cache-toi !", LOOKMAN = "Ne regarde pas !", ["A-60"] = "Cache-toi !",
  ["A-120"] = "Cache-toi !", ["A-90"] = "Ne bouge plus !", GLOOMBATS = "Eteins ta lumiere !",
  SCREECH = "Regarde-le !", HALT = "Demi-tour quand c'est bleu.", JEFF = "Jeff est la !",
}
local last = {}
local function alert(n)
  if not Cfg.Alerts or not Tips[n] or (last[n] and os.clock() - last[n] < 6) then return end
  last[n] = os.clock()
  notify("! " .. n, Tips[n], Color3.fromRGB(255, 170, 50))
end

local Loot, Prompts, Fired = {}, {}, {}
local function applyPrompt(pr)
  local o = Prompts[pr]
  if o and pr.Parent then
    pr.HoldDuration = Cfg.Instant and 0 or o[1]
    pr.MaxActivationDistance = Cfg.Reach and o[2] * 1.5 or o[2]
  end
end
local function process(i)
  if not Alive then return end
  if i:IsA("ProximityPrompt") then
    if not Prompts[i] then
      Prompts[i] = { i.HoldDuration, i.MaxActivationDistance }
      applyPrompt(i)
    end
    return
  end
  local model = i:IsA("Model")
  if not (model or i:IsA("BasePart")) then return end
  local rooms = workspace:FindFirstChild("CurrentRooms")
  if i.Name == "Door" and model and rooms and i.Parent and i.Parent.Parent == rooms then
    local n = tonumber(i.Parent.Name)
    esp(i, "Doors", n and ("Porte " .. (n + 1)) or "Porte", "Door")
    return
  end
  local d = Names[i.Name]
  if not d or (d[1] ~= "Entities" and not model) then return end
  esp(i, d[1], d[2])
  if d[1] == "Gold" then Loot[i] = "gold" elseif d[1] == "Chests" then Loot[i] = "drawer" end
  if d[1] == "Entities" then alert(d[2]) end
end
task.spawn(function()
  local rooms = workspace:WaitForChild("CurrentRooms", 120)
  if not rooms or not Alive then return end
  for _, d in ipairs(rooms:GetDescendants()) do process(d) end
  on(rooms.DescendantAdded, function(d) task.defer(process, d) end)
end)
on(workspace.ChildAdded, function(c) task.defer(process, c) end)
for _, c in ipairs(workspace:GetChildren()) do process(c) end
local function hookPlayer(p)
  if p == LP then return end
  local function f(ch)
    local r = ch:WaitForChild("HumanoidRootPart", 10)
    if r and Alive then esp(ch, "Players", p.DisplayName, "HumanoidRootPart") end
  end
  on(p.CharacterAdded, f)
  if p.Character then task.spawn(f, p.Character) end
end
for _, p in ipairs(Players:GetPlayers()) do hookPlayer(p) end
on(Players.PlayerAdded, hookPlayer)

--================ PROTECTIONS (objets d'entites crees cote client) ================--
local Rules = { Screech = { "AntiScreech", "SCREECH" }, A90 = { "AntiA90", "A-90" }, Shade = { "AntiHalt", "HALT" } }
local protCount = 0
local protLabel
local function protect(i)
  local r = Rules[i.Name]
  if not r or i:IsDescendantOf(Gui) then return end
  alert(r[2])
  if not Cfg[r[1]] then return end
  task.defer(function()
    if Alive and i.Parent and Cfg[r[1]] then
      i:Destroy()
      protCount = protCount + 1
      if protLabel then protLabel.Text = "Protections declenchees : " .. protCount .. " (derniere : " .. r[2] .. ")" end
    end
  end)
end
local function scanProtect()
  local cam = workspace.CurrentCamera
  if cam then for _, c in ipairs(cam:GetChildren()) do protect(c) end end
  for _, d in ipairs(PG:GetDescendants()) do if Rules[d.Name] then protect(d) end end
end
on(PG.DescendantAdded, function(d) if Rules[d.Name] then protect(d) end end)
local camConn
local function hookCam()
  if camConn then camConn:Disconnect() end
  local cam = workspace.CurrentCamera
  if cam then camConn = cam.ChildAdded:Connect(function(c) pcall(protect, c) end) end
end
hookCam()
on(workspace:GetPropertyChangedSignal("CurrentCamera"), hookCam)
table.insert(Cleanups, function() if camConn then camConn:Disconnect() end end)
for _, k in ipairs({ "AntiScreech", "AntiA90", "AntiHalt" }) do
  Apply[k] = function(v) if v then scanProtect() end end
end

--================ MONDE / JOUEUR ================--
local saved, atmos = {}, {}
local LP_PROPS = { "Ambient", "Brightness", "GlobalShadows", "FogEnd", "OutdoorAmbient" }
local function snap() for _, p in ipairs(LP_PROPS) do saved[p] = Lighting[p] end end
local function restore()
  for _, p in ipairs(LP_PROPS) do Lighting[p] = saved[p] end
  for a, d in pairs(atmos) do
    if a.Parent then a.Density = d end
    atmos[a] = nil
  end
end
snap()
local defSpeed
on(RS.Heartbeat, function()
  -- Tant que rien n'est actif on suit l'eclairage du jeu, pour restaurer la valeur la plus recente
  if Cfg.Fullbright or Cfg.NoFog then
    if Cfg.Fullbright then
      Lighting.Ambient, Lighting.OutdoorAmbient = W, W
      Lighting.Brightness, Lighting.GlobalShadows = 2, false
    end
    if Cfg.NoFog then
      Lighting.FogEnd = 100000
      for _, a in ipairs(Lighting:GetChildren()) do
        if a:IsA("Atmosphere") then
          if atmos[a] == nil then atmos[a] = a.Density end
          a.Density = 0
        end
      end
    end
  else
    snap()
  end
  local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
  if hum and hum.Health > 0 and Cfg.Speed then
    defSpeed = defSpeed or hum.WalkSpeed
    hum.WalkSpeed = Cfg.SpeedV
  end
end)
local function lightOff() if not Cfg.Fullbright and not Cfg.NoFog then restore() end end
Apply.Fullbright, Apply.NoFog = lightOff, lightOff
Apply.Speed = function(v)
  local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
  if not v and hum and defSpeed then hum.WalkSpeed = defSpeed end
  if not v then defSpeed = nil end
end
on(LP.CharacterAdded, function() defSpeed = nil end)
-- Le FOV passe apres la camera du jeu, sinon il est ecrase a chaque image
local FOVB = "AbyssMiniFov"
RS:BindToRenderStep(FOVB, Enum.RenderPriority.Camera.Value + 1, function()
  if Alive and Cfg.Fov and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = Cfg.FovV end
end)
Apply.Fov = function(v) if not v and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = 70 end end
table.insert(Cleanups, function()
  RS:UnbindFromRenderStep(FOVB)
  restore()
  Apply.Speed(false)
  Apply.Fov(false)
end)

--================ AUTO ================--
local function refreshPrompts() for pr in pairs(Prompts) do applyPrompt(pr) end end
Apply.Instant, Apply.Reach = refreshPrompts, refreshPrompts
table.insert(Cleanups, function() Cfg.Instant, Cfg.Reach = false, false refreshPrompts() end)
local fire = type(fireproximityprompt) == "function" and fireproximityprompt or nil
-- Un tiroir n'est declenche qu'une fois, sinon il s'ouvre et se ferme en boucle
loop(0.3, function()
  if not fire or not (Cfg.AutoGold or Cfg.AutoDrawers) then return end
  local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
  if not root then return end
  for o, kind in pairs(Loot) do
    if not o.Parent then
      Loot[o] = nil
    elseif (kind == "gold" and Cfg.AutoGold) or (kind == "drawer" and Cfg.AutoDrawers and not Fired[o]) then
      local pr, pt = o:FindFirstChildWhichIsA("ProximityPrompt", true), getPart(o)
      if pr and pt and pr.Enabled and (pt.Position - root.Position).Magnitude <= pr.MaxActivationDistance then
        Fired[o] = true
        fire(pr)
      end
    end
  end
end)

--================ CRUCIFIX (visuel, local) ================--
local crossTool
local function topModel(p)
  local rooms = workspace:FindFirstChild("CurrentRooms")
  -- workspace est lui-meme un Model : on s'arrete avant lui
  while p.Parent and p.Parent ~= workspace and p.Parent:IsA("Model") and not (rooms and p.Parent.Parent == rooms) do
    p = p.Parent
  end
  return p
end
local function protectedTarget(o)
  for _, p in ipairs(Players:GetPlayers()) do
    if p.Character and (o == p.Character or o:IsDescendantOf(p.Character)) then return true end
  end
  local rooms = workspace:FindFirstChild("CurrentRooms")
  return o == workspace or (rooms ~= nil and o.Parent == rooms)
end
local busy = false
local function crucify(target)
  local parts = {}
  for _, d in ipairs(target:GetDescendants()) do if d:IsA("BasePart") then table.insert(parts, d) end end
  if target:IsA("BasePart") then table.insert(parts, target) end
  if #parts == 0 then return end
  busy = true
  local center = target:IsA("Model") and target:GetPivot() or target.CFrame
  local fx = new("Part", { Anchored = true, CanCollide = false, Transparency = 1, Size = Vector3.new(1, 1, 1), CFrame = center }, workspace)
  new("PointLight", { Color = Color3.fromRGB(150, 220, 255), Brightness = 4, Range = 18 }, fx)
  new("ParticleEmitter", { Color = ColorSequence.new(Color3.fromRGB(150, 220, 255)), LightEmission = 1, Rate = 60,
    Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(4, 8), SpreadAngle = Vector2.new(180, 180) }, fx)
  for _, p in ipairs(parts) do p.Anchored = true end
  task.spawn(function()
    local t0 = os.clock()
    while Alive and target.Parent and os.clock() - t0 < 2 do
      local t = (os.clock() - t0) / 2
      local cf = center * CFrame.new(0, t * 5, 0) * CFrame.Angles(0, t * 12, 0)
      pcall(function()
        if target:IsA("Model") then target:PivotTo(cf) else target.CFrame = cf end
      end)
      for _, p in ipairs(parts) do if p.Parent then p.LocalTransparencyModifier = t end end
      task.wait()
    end
    target:Destroy()
    fx:Destroy()
    busy = false
  end)
end
local function useCross()
  if busy then return end
  local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
  if not root then return end
  local target
  if Cfg.CrossAny and LP:GetMouse().Target then target = topModel(LP:GetMouse().Target) end
  if not target then
    local best
    for o, e in pairs(ESP) do
      if e.cat == "Entities" and o.Parent and (not best or e.dist < best) then target, best = o, e.dist end
    end
  end
  if not target or protectedTarget(target) then return notify("Crucifix", "Aucune cible valide.") end
  local pt = getPart(target)
  if not pt or (pt.Position - root.Position).Magnitude > Cfg.CrossRange then return notify("Crucifix", "Hors portee.") end
  crucify(target)
end
local function giveCross()
  if crossTool and crossTool.Parent then return notify("Crucifix", "Deja dans ton sac.") end
  local bp = LP:FindFirstChildOfClass("Backpack")
  if not bp then return notify("Crucifix", "Sac introuvable.") end
  local tool = new("Tool", { Name = "Crucifix", RequiresHandle = false, CanBeDropped = false }, nil)
  local held
  tool.Equipped:Connect(function()
    local ch = LP.Character
    local hand = ch and (ch:FindFirstChild("RightHand") or ch:FindFirstChild("Right Arm"))
    if not hand then return end
    held = new("Part", { Size = Vector3.new(0.25, 1.6, 0.25), Material = Enum.Material.Wood, Color = Color3.fromRGB(110, 70, 40),
      CanCollide = false, Massless = true, CFrame = hand.CFrame * CFrame.new(0, -0.9, -0.3) }, nil)
    local bar = new("Part", { Size = Vector3.new(0.9, 0.25, 0.25), Material = Enum.Material.Wood, Color = held.Color,
      CanCollide = false, Massless = true, CFrame = held.CFrame * CFrame.new(0, 0.35, 0) }, held)
    new("WeldConstraint", { Part0 = held, Part1 = bar }, held)
    new("WeldConstraint", { Part0 = hand, Part1 = held }, held)
    held.Parent = ch
  end)
  tool.Unequipped:Connect(function() if held then held:Destroy() held = nil end end)
  tool.Activated:Connect(function() pcall(useCross) end)
  tool.Parent = bp
  crossTool = tool
  notify("Crucifix", "Equipe-le puis touche la cible.")
end
table.insert(Cleanups, function() if crossTool then crossTool:Destroy() end end)

--================ PAGES ================--
local P = page("ESP")
for _, c in ipairs(Cats) do toggle(P, c[2], "E_" .. c[1]) end
toggle(P, "Noms", "Names")
toggle(P, "Distance", "Dist")
toggle(P, "Contours", "Outlines")
P = page("Couleurs")
for _, c in ipairs(Cats) do colorBtn(P, c[2], "C_" .. c[1]) end
P = page("Monde")
toggle(P, "Fullbright", "Fullbright")
toggle(P, "Sans brouillard", "NoFog")
toggle(P, "Speed", "Speed")
stepper(P, "Vitesse", "SpeedV", 15, 30, 1)
label(P, "Au-dela de ~22, l'anti-cheat te ramene en arriere.")
toggle(P, "FOV", "Fov")
stepper(P, "FOV", "FovV", 70, 120, 5)
P = page("Entites")
toggle(P, "Alertes", "Alerts")
toggle(P, "Anti-Screech", "AntiScreech")
toggle(P, "Anti-A90 (experimental)", "AntiA90")
toggle(P, "Anti-Halt (experimental)", "AntiHalt")
protLabel = label(P, "Protections declenchees : 0")
label(P, "Impossibles cote client : god mode, objets illimites, TP porte 50/100, anti-Figure.")
P = page("Auto")
toggle(P, "Interaction instantanee", "Instant")
toggle(P, "Portee x1.5", "Reach")
toggle(P, "Ramasser l'or", "AutoGold")
toggle(P, "Ouvrir les tiroirs", "AutoDrawers")
if not fire then label(P, "fireproximityprompt absent : ramassage inactif.") end
P = page("Crucifix")
button(P, "Obtenir le crucifix", giveCross)
toggle(P, "Sur n'importe quel objet", "CrossAny")
stepper(P, "Portee", "CrossRange", 10, 300, 10)
label(P, "Visuel uniquement : toi seul le vois, il ne bloque pas les vraies attaques.")
P = page("Script")
button(P, "Fermer le script", function() G.AbyssStop() end)

local function stop()
  if not Alive then return end
  Alive = false
  for _, c in ipairs(Conns) do c:Disconnect() end
  for i = #Cleanups, 1, -1 do pcall(Cleanups[i]) end
  if G.AbyssStop == stop then G.AbyssStop = nil end
end
G.AbyssStop = stop
select(1)
notify("ABYSS MINI", "Charge ! Bouton A pour ouvrir/fermer.")
end)

if ok then
  Boot:Destroy()
else
  BootTxt.Size = UDim2.new(0, 420, 0, 90)
  BootTxt.Position = UDim2.new(0.5, -210, 0, 30)
  BootTxt.BackgroundColor3 = Color3.fromRGB(140, 25, 35)
  BootTxt.Text = "ABYSS ERREUR (envoie ce texte) :\n" .. tostring(err)
  warn("[Abyss] " .. tostring(err))
end
