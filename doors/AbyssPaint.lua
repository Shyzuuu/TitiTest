-- ABYSS PAINT // theme MS Paint - Delta Android. ASCII et < 30 Ko (au-dela, Delta n'execute rien).
local Players = game:GetService("Players")
local RS = game:GetService("RunService")
local UIS = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")
local TS = game:GetService("TweenService")
local LP = Players.LocalPlayer
local PG = LP:WaitForChild("PlayerGui")
local G = (getgenv and getgenv()) or _G
for _, k in ipairs({ "AbyssStop", "AbyssLiteStop" }) do
  if type(G[k]) == "function" then pcall(G[k]) end
end

local U2, RGB, V3, CODE, ARC = UDim2.new, Color3.fromRGB, Vector3.new, Enum.Font.Code, Enum.Font.Arcade
local GREY, DARK, BLACK, WHITE = RGB(192, 192, 192), RGB(128, 128, 128), Color3.new(0, 0, 0), Color3.new(1, 1, 1)
local NAVY, GREEN, RED, CYAN = RGB(0, 0, 128), RGB(0, 255, 0), RGB(255, 0, 0), RGB(0, 255, 255)

local Boot = Instance.new("ScreenGui")
Boot.Name, Boot.ResetOnSpawn, Boot.DisplayOrder = "AbyssBoot", false, 1000
Boot.Parent = PG
local BootTxt = Instance.new("TextLabel")
BootTxt.Size, BootTxt.Position = U2(0, 340, 0, 40), U2(0.5, -170, 0, 30)
BootTxt.BackgroundColor3, BootTxt.TextColor3, BootTxt.BorderColor3, BootTxt.BorderSizePixel = GREY, BLACK, BLACK, 3
BootTxt.TextWrapped, BootTxt.TextSize, BootTxt.Font = true, 14, CODE
BootTxt.Text = "ABYSS PAINT : chargement..."
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
local function new(class, props, parent)
  local o = Instance.new(class)
  for k, v in pairs(props) do o[k] = v end
  o.Parent = parent
  return o
end
-- Bordure noire epaisse ; Border obligatoire sinon le contour s'applique au texte des boutons
local function border(o, t) new("UIStroke", { Color = BLACK, Thickness = t or 2, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, o) end

local Cats = {
  { "Entities", "Entites", RED, 1 }, { "Monsters", "Monstres/PNJ", RGB(255, 128, 0), 1 },
  { "Players", "Joueurs (DOORS)", GREEN, 2 }, { "Doors", "Portes", CYAN, 2 }, { "Keys", "Cles/Leviers", RGB(255, 255, 0), 3 },
  { "Objectives", "Objectifs", RGB(0, 255, 128), 3 }, { "Items", "Objets", RGB(255, 0, 255), 4 },
  { "Gold", "Or", RGB(255, 200, 0), 4 }, { "Chests", "Tiroirs/Coffres", RGB(0, 128, 255), 5 },
  { "Hiding", "Cachettes", RGB(150, 150, 255), 5 },
}
local CatInfo = {}
local Cfg = {
  Esp = true, Boxes = true, Names = true, Dist = true, Health = true, Chams = false, MaxDist = 500,
  Fullbright = false, NoFog = false, Speed = false, SpeedV = 20, Fov = false, FovV = 90,
  Alerts = true, AntiScreech = false, AntiA90 = false, AntiHalt = false,
  CrossAny = true, CrossRange = 80,
}
for _, c in ipairs(Cats) do
  CatInfo[c[1]] = c
  Cfg["E_" .. c[1]] = c[1] == "Entities" or c[1] == "Monsters" or c[1] == "Players"
end

local Gui = new("ScreenGui", { Name = "AbyssPaint", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 999 }, PG)
table.insert(Cleanups, function() Gui:Destroy() end)
local Layer = new("Frame", { Size = U2(1, 0, 1, 0), BackgroundTransparency = 1 }, Gui)

local Notifs = new("Frame", { Size = U2(0, 240, 1, -20), Position = U2(1, -250, 0, 10), BackgroundTransparency = 1 }, Gui)
new("UIListLayout", { Padding = UDim.new(0, 6), VerticalAlignment = Enum.VerticalAlignment.Bottom }, Notifs)
local function notify(title, text, color)
  if not Alive then return end
  local kids = Notifs:GetChildren()
  if #kids > 4 then kids[2]:Destroy() end
  local f = new("Frame", { Size = U2(1, 0, 0, 50), BackgroundColor3 = GREY }, Notifs)
  border(f, 2)
  new("TextLabel", { Size = U2(1, 0, 0, 16), BackgroundColor3 = color or NAVY, BorderSizePixel = 0,
  Font = CODE, TextSize = 13, TextColor3 = WHITE, Text = " " .. title, TextXAlignment = Enum.TextXAlignment.Left }, f)
  new("TextLabel", { Size = U2(1, -8, 0, 32), Position = U2(0, 4, 0, 17), BackgroundTransparency = 1,
  Font = CODE, TextSize = 12, TextColor3 = BLACK, TextWrapped = true, Text = text,
  TextXAlignment = Enum.TextXAlignment.Left }, f)
  task.delay(4, function() f:Destroy() end)
end

local Main = new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = U2(0.5, 0, 0.5, 0),
  Size = U2(0, 470, 0, 300), BackgroundColor3 = GREY, Active = true }, Gui)
border(Main, 3)
local cam0 = workspace.CurrentCamera
if cam0 then
  new("UIScale", { Scale = math.clamp(math.min(cam0.ViewportSize.X / 660, cam0.ViewportSize.Y / 370), 0.6, 1.3) }, Main)
end
local Title = new("TextLabel", { Size = U2(1, -8, 0, 24), Position = U2(0, 4, 0, 4), BackgroundColor3 = NAVY,
  BorderSizePixel = 0, Font = ARC, TextSize = 16, TextColor3 = WHITE, Text = " ABYSS PAINT.EXE",
  TextXAlignment = Enum.TextXAlignment.Left, Active = true }, Main)
local function winBtn(txt, x)
  local b = new("TextButton", { Size = U2(0, 20, 0, 18), Position = U2(1, x, 0, 3), BackgroundColor3 = GREY,
  BorderSizePixel = 0, Font = CODE, TextSize = 14, TextColor3 = BLACK, Text = txt }, Title)
  border(b, 2)
  return b
end
local MinB, CloseB = winBtn("_", -48), winBtn("X", -24)
local Status = new("TextLabel", { Size = U2(1, -8, 0, 18), Position = U2(0, 4, 1, -22), BackgroundColor3 = GREY,
  Font = CODE, TextSize = 12, TextColor3 = BLACK, Text = " Pret", TextXAlignment = Enum.TextXAlignment.Left }, Main)
border(Status, 1)

local Tools = new("Frame", { Size = U2(0, 104, 1, -60), Position = U2(0, 4, 0, 32), BackgroundTransparency = 1 }, Main)
new("UIListLayout", { Padding = UDim.new(0, 4) }, Tools)
local Pages, Tabs = {}, {}
local function select(i)
  for k, p in ipairs(Pages) do
    p.Visible = k == i
    Tabs[k].BackgroundColor3 = k == i and BLACK or GREY
    Tabs[k].TextColor3 = k == i and GREEN or BLACK
  end
end
local function page(name)
  local i = #Pages + 1
  local b = new("TextButton", { Size = U2(1, 0, 0, 30), BackgroundColor3 = GREY, Font = CODE,
  TextSize = 13, TextColor3 = BLACK, Text = name, LayoutOrder = i, AutoButtonColor = false }, Tools)
  border(b, 2)
  local p = new("ScrollingFrame", { Size = U2(1, -122, 1, -64), Position = U2(0, 114, 0, 34),
  BackgroundColor3 = WHITE, ScrollBarThickness = 6, ScrollBarImageColor3 = BLACK, CanvasSize = U2(),
  AutomaticCanvasSize = Enum.AutomaticSize.Y, Visible = false, BorderSizePixel = 0 }, Main)
  border(p, 2)
  new("UIListLayout", { Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }, p)
  new("UIPadding", { PaddingTop = UDim.new(0, 5), PaddingLeft = UDim.new(0, 5), PaddingRight = UDim.new(0, 10) }, p)
  Pages[i], Tabs[i] = p, b
  b.MouseButton1Click:Connect(function() select(i) end)
  return p
end

local order = 0
local function nextOrder() order = order + 1 return order end
local function label(p, text)
  return new("TextLabel", { Size = U2(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1,
  Font = CODE, TextSize = 12, TextWrapped = true, TextColor3 = DARK, Text = text,
  TextXAlignment = Enum.TextXAlignment.Left, LayoutOrder = nextOrder() }, p)
end
local Render, Apply = {}, {}
local function set(key, v)
  Cfg[key] = v
  for _, f in ipairs(Render[key] or {}) do f() end
  if Apply[key] then
    local s, e = pcall(Apply[key], v)
    if not s then notify("Erreur", tostring(e), RED) end
  end
end
local function toggle(p, text, key, color)
  local b = new("TextButton", { Size = U2(1, 0, 0, 30), BackgroundColor3 = GREY, Font = CODE, TextSize = 13,
  TextColor3 = BLACK, Text = "     " .. text, TextXAlignment = Enum.TextXAlignment.Left, LayoutOrder = nextOrder(), AutoButtonColor = false }, p)
  border(b, 2)
  local box = new("TextLabel", { Size = U2(0, 18, 0, 18), Position = U2(0, 5, 0.5, -9), BackgroundColor3 = WHITE,
  Font = ARC, TextSize = 16, TextColor3 = RED, Text = "" }, b)
  border(box, 2)
  if color then new("Frame", { Size = U2(0, 14, 0, 14), Position = U2(1, -20, 0.5, -7), BackgroundColor3 = color, BorderSizePixel = 0 }, b) end
  local function r() box.Text = Cfg[key] and "X" or "" end
  Render[key] = Render[key] or {}
  table.insert(Render[key], r)
  b.MouseButton1Click:Connect(function() set(key, not Cfg[key]) end)
  r()
end
local function stepper(p, text, key, lo, hi, step)
  local f = new("Frame", { Size = U2(1, 0, 0, 30), BackgroundColor3 = GREY, LayoutOrder = nextOrder() }, p)
  border(f, 2)
  local l = new("TextLabel", { Size = U2(1, -90, 1, 0), Position = U2(0, 6, 0, 0), BackgroundTransparency = 1,
  Font = CODE, TextSize = 13, TextColor3 = BLACK, TextXAlignment = Enum.TextXAlignment.Left }, f)
  local function r() l.Text = text .. " : " .. Cfg[key] end
  Render[key] = { r }
  for i, d in ipairs({ -step, step }) do
    local b = new("TextButton", { Size = U2(0, 34, 0, 22), Position = U2(1, i == 1 and -80 or -40, 0.5, -11),
      BackgroundColor3 = WHITE, Font = ARC, TextSize = 16, TextColor3 = BLACK, Text = d < 0 and "-" or "+" }, f)
    border(b, 2)
    b.MouseButton1Click:Connect(function() set(key, math.clamp(Cfg[key] + d, lo, hi)) end)
  end
  r()
end
local function button(p, text, fn)
  local b = new("TextButton", { Size = U2(1, 0, 0, 30), BackgroundColor3 = GREY, Font = CODE, TextSize = 13,
  TextColor3 = BLACK, Text = text, LayoutOrder = nextOrder(), AutoButtonColor = false }, p)
  border(b, 2)
  local busy = false
  b.MouseButton1Click:Connect(function()
    if busy then return end
    busy = true
    b.BackgroundColor3 = DARK
    local s, e = pcall(fn)
    if not s then notify("Erreur", tostring(e), RED) end
    b.BackgroundColor3 = GREY
    busy = false
  end)
end

do -- deplacement de la fenetre au doigt par la barre de titre
  local drag, inp, st, sp
  Title.InputBegan:Connect(function(i)
    if i.UserInputType == Enum.UserInputType.Touch or i.UserInputType == Enum.UserInputType.MouseButton1 then
      drag, inp, st, sp = true, i, i.Position, Main.Position
    end
  end)
  on(UIS.InputChanged, function(i)
    if drag and (i == inp or i.UserInputType == Enum.UserInputType.MouseMovement) then
      local d = i.Position - st
      Main.Position = U2(sp.X.Scale, sp.X.Offset + d.X, sp.Y.Scale, sp.Y.Offset + d.Y)
    end
  end)
  on(UIS.InputEnded, function(i)
    if i == inp or i.UserInputType == Enum.UserInputType.MouseButton1 then drag = false end
  end)
end
local Float = new("TextButton", { Size = U2(0, 52, 0, 52), Position = U2(0, 10, 0.4, 0), BackgroundColor3 = WHITE,
  Font = ARC, TextSize = 13, TextColor3 = RED, Text = "PAINT", AutoButtonColor = false }, Gui)
border(Float, 3)
new("Frame", { Size = U2(1, -8, 0, 6), Position = U2(0, 4, 1, -10), BackgroundColor3 = CYAN, BorderSizePixel = 0 }, Float)
Float.MouseButton1Click:Connect(function() Main.Visible = not Main.Visible end)
MinB.MouseButton1Click:Connect(function() Main.Visible = false end)

local Track, Pending = {}, {}
local Shown = {}
local function isDoors() return workspace:FindFirstChild("CurrentRooms") ~= nil end
local function getPart(o)
  if o:IsA("BasePart") then return o end
  if not o:IsA("Model") then return nil end
  return o.PrimaryPart or o:FindFirstChild("HumanoidRootPart") or o:FindFirstChildWhichIsA("BasePart", true)
end
local function untrack(o)
  local e = Track[o]
  if not e then return end
  Track[o] = nil
  e.conn:Disconnect()
  if e.hl then e.hl:Destroy() end
end
local function track(o, cat, label, partName)
  if not Alive or Track[o] or not o.Parent or o:IsDescendantOf(Gui) then return end
  local part = (partName and o:FindFirstChild(partName)) or getPart(o)
  if not part then
    Pending[o] = { cat, label, partName } -- repris quand une piece arrive (streaming)
    return
  end
  Pending[o] = nil
  local size = o:IsA("Model") and o:GetExtentsSize() or part.Size
  local hum = o:FindFirstChildOfClass("Humanoid")
  local e = { o = o, cat = cat, label = label, part = part, hum = hum, dist = 0,
  h = hum and 6 or math.clamp(size.Y, 1, 30), r = hum and 0.6 or math.clamp(math.max(size.X, size.Z) / math.max(size.Y, 0.1), 0.3, 2) }
  -- Liberation immediate quand la cible quitte le jeu : pas de fuite memoire
  e.conn = o.AncestryChanged:Connect(function()
    if not o:IsDescendantOf(workspace) then untrack(o) end
  end)
  Track[o] = e
end

local Names = {}
local function add(cat, list) for k, v in pairs(list) do Names[k] = { cat, v } end end
add("Keys", { KeyObtain = "Cle", ElectricalKeyObtain = "Cle elec", LeverForGate = "Levier", TimerLever = "Levier" })
add("Objectives", { LiveHintBook = "Livre", LiveBreakerPolePickup = "Disjoncteur", FuseObtain = "Fusible",
  MinesAnchor = "Ancre", MinesGenerator = "Generateur", WaterPump = "Pompe" })
add("Gold", { GoldPile = "Or" })
add("Items", { Lighter = "Briquet", Flashlight = "Lampe", Lockpick = "Crochets", Vitamins = "Vitamines", Bandage = "Bandage",
  Crucifix = "Crucifix", SkeletonKey = "Cle squelette", Battery = "Pile", Candle = "Bougie", Shears = "Cisailles" })
add("Chests", { DrawerContainer = "Tiroir", ChestBox = "Coffre", ChestBoxLocked = "Coffre", Toolbox = "Boite a outils" })
add("Hiding", { Wardrobe = "Armoire", Backdoor_Wardrobe = "Armoire", Bed = "Lit", Rooms_Locker = "Casier", Locker_Large = "Casier" })
add("Entities", { RushMoving = "RUSH", AmbushMoving = "AMBUSH", Eyes = "EYES", SeekMoving = "SEEK", SeekMovingNewClone = "SEEK",
  FigureRig = "FIGURE", FigureRagdoll = "FIGURE", BackdoorRush = "BLITZ", BackdoorLookman = "LOOKMAN", A60 = "A-60",
  A120 = "A-120", GloombatSwarm = "GLOOMBATS", GrumbleRig = "GRUMBLE" })
local Tips = { RUSH = "Cache-toi !", AMBUSH = "Cache-toi !", EYES = "Ne regarde pas !", SEEK = "Cours !",
  BLITZ = "Cache-toi !", ["A-60"] = "Cache-toi !", ["A-120"] = "Cache-toi !", ["A-90"] = "Ne bouge plus !",
  SCREECH = "Regarde-le !", HALT = "Demi-tour au bleu." }
local last = {}
local function alert(n)
  if not Cfg.Alerts or not Tips[n] or (last[n] and os.clock() - last[n] < 6) then return end
  last[n] = os.clock()
  notify("! " .. n, Tips[n], RED)
end

local function process(i)
  if not Alive or not i.Parent then return end
  if i:IsA("Humanoid") then
    local m = i.Parent
    if m and m:IsA("Model") and not Players:GetPlayerFromCharacter(m) then track(m, "Monsters", m.Name) end
    return
  end
  if i:IsA("BasePart") and i.Parent and Pending[i.Parent] then
    local p = Pending[i.Parent]
    track(i.Parent, p[1], p[2], p[3])
  end
  local model = i:IsA("Model")
  if not (model or i:IsA("BasePart")) then return end
  local rooms = workspace:FindFirstChild("CurrentRooms")
  if i.Name == "Door" and model and rooms and i.Parent and i.Parent.Parent == rooms then
    local n = tonumber(i.Parent.Name)
    return track(i, "Doors", n and ("Porte " .. (n + 1)) or "Porte", "Door")
  end
  local d = Names[i.Name]
  if not d or (d[1] ~= "Entities" and not model) then return end
  track(i, d[1], d[2])
  if d[1] == "Entities" then alert(d[2]) end
end
on(workspace.DescendantAdded, function(i) task.defer(process, i) end)
task.spawn(function()
  for n, i in ipairs(workspace:GetDescendants()) do
    process(i)
    if n % 400 == 0 then task.wait() end -- analyse initiale etalee : pas de gel sur mobile
  end
end)
local function hookPlayer(p)
  if p == LP then return end
  local function f(ch)
    local r = ch:WaitForChild("HumanoidRootPart", 10)
    if r and Alive then track(ch, "Players", p.DisplayName .. " (@" .. p.Name .. ")", "HumanoidRootPart") end
  end
  on(p.CharacterAdded, f)
  if p.Character then task.spawn(f, p.Character) end
end
for _, p in ipairs(Players:GetPlayers()) do hookPlayer(p) end
on(Players.PlayerAdded, hookPlayer)

local MAX = 40
local countLabel
loop(0.2, function()
  local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
  local list, total, doors = {}, 0, isDoors()
  for o, e in pairs(Track) do
    if not o.Parent or not e.part.Parent then
      untrack(o)
    else
      total = total + 1
      e.dist = root and (e.part.Position - root.Position).Magnitude or 0
      -- ESP joueurs limite a DOORS (cooperatif) : pas de wallhack dans les jeux JcJ
      local vis = Cfg.Esp and Cfg["E_" .. e.cat] and e.dist <= Cfg.MaxDist and (e.cat ~= "Players" or doors)
      if vis then
        e.s = CatInfo[e.cat][4] * 100000 + e.dist
        table.insert(list, e)
      elseif e.hl then
        e.hl.Enabled = false
      end
    end
  end
  table.sort(list, function(a, b) return a.s < b.s end)
  for i = MAX + 1, #list do list[i] = nil end
  for i, e in ipairs(list) do
    local col = CatInfo[e.cat][3]
    if Cfg.Chams and i <= 24 then
      e.hl = e.hl or new("Highlight", { Adornee = e.o, FillColor = col, OutlineColor = col, FillTransparency = 0.75,
        DepthMode = Enum.HighlightDepthMode.AlwaysOnTop }, e.o)
      e.hl.Enabled = true
    elseif e.hl then
      e.hl.Enabled = false
    end
  end
  Shown = list
  if countLabel then countLabel.Text = "Cibles suivies : " .. total .. " | dessinees : " .. #list end
  Status.Text = " ESP " .. (Cfg.Esp and "ON" or "OFF") .. " | cibles " .. total .. " | Fullbright " .. (Cfg.Fullbright and "ON" or "OFF")
end)

local Slots = {}
local function slot(i)
  if Slots[i] then return Slots[i] end
  local box = new("Frame", { BackgroundTransparency = 1, Visible = false }, Layer)
  local st = new("UIStroke", { Thickness = 2 }, box)
  local function txt(y)
    return new("TextLabel", { BackgroundTransparency = 1, Size = U2(0, 220, 0, 14), Position = U2(0.5, -110, y, y == 0 and -16 or 2),
      Font = CODE, TextSize = 13, TextStrokeTransparency = 0, TextStrokeColor3 = BLACK }, box)
  end
  local bar = new("Frame", { Size = U2(0, 4, 1, 0), Position = U2(0, -7, 0, 0), BackgroundColor3 = BLACK, BorderSizePixel = 0 }, box)
  local fill = new("Frame", { AnchorPoint = Vector2.new(0, 1), Position = U2(0, 0, 1, 0), BorderSizePixel = 0 }, bar)
  Slots[i] = { box = box, st = st, top = txt(0), bot = txt(1), bar = bar, fill = fill }
  return Slots[i]
end
on(RS.RenderStepped, function()
  local cam, n = workspace.CurrentCamera, 0
  if Cfg.Esp and cam then
    for _, e in ipairs(Shown) do
      local part = e.part
      if part.Parent then
        local c = part.Position
        local a, onA = cam:WorldToViewportPoint(c + V3(0, e.h / 2, 0))
        local b, onB = cam:WorldToViewportPoint(c - V3(0, e.h / 2, 0))
        if (onA or onB) and a.Z > 0 and b.Z > 0 then
          n = n + 1
          local s, col = slot(n), CatInfo[e.cat][3]
          local h = math.max(math.abs(b.Y - a.Y), 8)
          local w = math.max(h * e.r, 8)
          s.box.Visible = true
          s.box.Position = U2(0, (a.X + b.X) / 2 - w / 2, 0, math.min(a.Y, b.Y))
          s.box.Size = U2(0, w, 0, h)
          s.st.Color, s.st.Transparency = col, Cfg.Boxes and 0 or 1
          s.top.Text, s.top.TextColor3, s.top.Visible = e.label, col, Cfg.Names
          local info = Cfg.Dist and ("[" .. math.floor(e.dist) .. "m]") or ""
          local hum = e.hum
          if hum and Cfg.Health then info = info .. " " .. math.floor(hum.Health) .. "/" .. math.floor(hum.MaxHealth) .. "PV" end
          s.bot.Text, s.bot.TextColor3, s.bot.Visible = info, WHITE, info ~= ""
          s.bar.Visible = hum ~= nil and Cfg.Health
          if hum then
            local r = math.clamp(hum.Health / math.max(hum.MaxHealth, 1), 0, 1)
            s.fill.Size, s.fill.BackgroundColor3 = U2(1, 0, r, 0), r > 0.5 and GREEN or RED
          end
        end
      end
    end
  end
  for i = n + 1, #Slots do
    local s = Slots[i]
    if s.box.Visible then s.box.Visible = false end
  end
end)
table.insert(Cleanups, function() for o in pairs(Track) do untrack(o) end end)

local Rules = { Screech = { "AntiScreech", "SCREECH" }, A90 = { "AntiA90", "A-90" }, Shade = { "AntiHalt", "HALT" } }
local protN, protLabel = 0, nil
local function protect(i)
  local r = Rules[i.Name]
  if not r or i:IsDescendantOf(Gui) then return end
  alert(r[2])
  if not Cfg[r[1]] then return end
  task.defer(function()
    if Alive and i.Parent and Cfg[r[1]] then
      i:Destroy()
      protN = protN + 1
      if protLabel then protLabel.Text = "Protections declenchees : " .. protN .. " (derniere : " .. r[2] .. ")" end
    end
  end)
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
  Apply[k] = function(v)
    if not v then return end
    local cam = workspace.CurrentCamera
    if cam then for _, c in ipairs(cam:GetChildren()) do protect(c) end end
    for _, d in ipairs(PG:GetDescendants()) do if Rules[d.Name] then protect(d) end end
  end
end

local saved, atmos, PROPS = {}, {}, { "Ambient", "Brightness", "GlobalShadows", "FogEnd", "OutdoorAmbient" }
local function snap() for _, p in ipairs(PROPS) do saved[p] = Lighting[p] end end
local function restore()
  for _, p in ipairs(PROPS) do Lighting[p] = saved[p] end
  for a, d in pairs(atmos) do
    if a.Parent then a.Density = d end
    atmos[a] = nil
  end
end
snap()
local defSpeed
on(RS.Heartbeat, function()
  -- Tant que rien n'est actif on suit l'eclairage du jeu pour restaurer la valeur la plus recente
  if Cfg.Fullbright or Cfg.NoFog then
    if Cfg.Fullbright then
      Lighting.Ambient, Lighting.OutdoorAmbient, Lighting.Brightness, Lighting.GlobalShadows = WHITE, WHITE, 2, false
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
RS:BindToRenderStep("AbyssPaintFov", Enum.RenderPriority.Camera.Value + 1, function()
  if Alive and Cfg.Fov and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = Cfg.FovV end
end)
Apply.Fov = function(v) if not v and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = 70 end end
table.insert(Cleanups, function()
  RS:UnbindFromRenderStep("AbyssPaintFov")
  restore()
  Apply.Speed(false)
  Apply.Fov(false)
end)
-- Sequence : gel + flash, cercle lumineux au sol, chaines qui jaillissent et s'enroulent,
-- tremblement, aspiration dans le sol, eclair final. Identique pour toute cible.
local busy, crossTool, crossLabel = false, nil, nil
local GLOW = RGB(140, 220, 255)
local function tween(o, t, props) TS:Create(o, TweenInfo.new(t, Enum.EasingStyle.Quad), props):Play() end
local function crucify(target)
  local parts = {}
  for _, d in ipairs(target:GetDescendants()) do if d:IsA("BasePart") then table.insert(parts, d) end end
  if target:IsA("BasePart") then table.insert(parts, target) end
  if #parts == 0 then return end
  busy = true
  local isModel = target:IsA("Model")
  local cf0 = isModel and target:GetPivot() or target.CFrame
  local size = isModel and target:GetExtentsSize() or target.Size
  local h, R = math.clamp(size.Y, 2, 30), math.clamp(math.max(size.X, size.Z), 4, 14)
  local rp = RaycastParams.new()
  rp.FilterType = Enum.RaycastFilterType.Exclude
  rp.FilterDescendantsInstances = { target, LP.Character }
  local hit = workspace:Raycast(cf0.Position, V3(0, -80, 0), rp)
  local base = V3(cf0.Position.X, hit and hit.Position.Y + 0.05 or cf0.Position.Y - h / 2, cf0.Position.Z)
  for _, p in ipairs(parts) do p.Anchored = true end
  local fx = new("Model", { Name = "AbyssCrossFX" }, workspace)
  local hl = new("Highlight", { Adornee = target, FillColor = WHITE, OutlineColor = GLOW, FillTransparency = 0,
  DepthMode = Enum.HighlightDepthMode.Occluded }, fx)
  tween(hl, 0.6, { FillColor = GLOW, FillTransparency = 0.5 })
  local ring = new("Part", { Shape = Enum.PartType.Cylinder, Anchored = true, CanCollide = false, CanQuery = false,
  Material = Enum.Material.Neon, Color = GLOW, Size = V3(0.15, 0.5, 0.5), Transparency = 0.15,
  CFrame = CFrame.new(base) * CFrame.Angles(0, 0, math.rad(90)) }, fx)
  tween(ring, 0.35, { Size = V3(0.15, R * 2, R * 2) })
  local light = new("PointLight", { Color = GLOW, Brightness = 0, Range = R * 3 }, ring)
  tween(light, 0.35, { Brightness = 8 })
  new("ParticleEmitter", { Color = ColorSequence.new(GLOW), LightEmission = 1, Rate = 80, Lifetime = NumberRange.new(0.5, 1),
  Speed = NumberRange.new(3, 7), SpreadAngle = Vector2.new(25, 25), Size = NumberSequence.new(0.4, 0),
  EmissionDirection = Enum.NormalId.Right }, ring)
  local chains = {}
  for i = 1, 6 do
    local a = i / 6 * math.pi * 2
    local c = { from = base + V3(math.cos(a) * R, 0, math.sin(a) * R), links = {} }
    for k = 1, 9 do
      c.links[k] = new("Part", { Anchored = true, CanCollide = false, CanQuery = false, Material = Enum.Material.Neon,
        Color = RGB(210, 245, 255), Size = V3(0.3, 0.3, 0.75), Transparency = 1 }, fx)
    end
    chains[i] = c
  end
  local function drawChains(grow, to)
    for _, c in ipairs(chains) do
      local dir = to - c.from
      for k, l in ipairs(c.links) do
        local f = (k - 0.5) / #c.links
        if f <= grow then
          l.Transparency = 0.05
          l.CFrame = CFrame.lookAt(c.from + dir * f, to) * CFrame.Angles(0, 0, (k % 2) * math.pi / 2)
        else
          l.Transparency = 1
        end
      end
    end
  end
  local function place(cf) if isModel then target:PivotTo(cf) else target.CFrame = cf end end
  local function phase(dur, fn)
    local t0 = os.clock()
    while Alive and target.Parent do
      local t = math.min((os.clock() - t0) / dur, 1)
      fn(t)
      if t >= 1 then break end
      RS.Heartbeat:Wait()
    end
  end
  task.spawn(function()
    local okA, e = pcall(function()
      task.wait(0.35)
      phase(0.5, function(t) -- les chaines jaillissent et attrapent la cible
        place(cf0 * CFrame.new((math.random() - 0.5) * 0.2, 0, (math.random() - 0.5) * 0.2))
        drawChains(t, cf0.Position)
      end)
      phase(0.6, function(t) -- la cible se debat
        local amp = 0.25 + t * 0.5
        place(cf0 * CFrame.new((math.random() - 0.5) * amp, 0, (math.random() - 0.5) * amp))
        light.Brightness = 8 + math.sin(t * 40) * 4
        drawChains(1, cf0.Position)
      end)
      phase(1.2, function(t) -- aspiration dans le sol
        local ease = t * t
        local cf = cf0 * CFrame.new(0, -(h + 2) * ease, 0) * CFrame.Angles(0, ease * 6, 0)
        place(cf)
        drawChains(1, cf.Position)
        for _, p in ipairs(parts) do if p.Parent then p.LocalTransparencyModifier = ease end end
      end)
      light.Brightness, light.Range = 25, R * 5 -- eclair final
      task.wait(0.08)
      tween(ring, 0.4, { Size = V3(0.15, 0.2, 0.2), Transparency = 1 })
      tween(light, 0.4, { Brightness = 0 })
      for _, c in ipairs(chains) do for _, l in ipairs(c.links) do tween(l, 0.3, { Transparency = 1 }) end end
      task.wait(0.4)
    end)
    -- Etat toujours remis a zero, meme si la cible a disparu en cours de route
    if target.Parent then target:Destroy() end
    fx:Destroy()
    busy = false
    if crossLabel then crossLabel.Text = okA and "Derniere cible : bannie" or ("Erreur : " .. tostring(e)) end
  end)
end
local function topModel(p)
  local rooms = workspace:FindFirstChild("CurrentRooms")
  while p.Parent and p.Parent ~= workspace and p.Parent:IsA("Model") and not (rooms and p.Parent.Parent == rooms) do p = p.Parent end
  return p
end
local function useCross()
  if busy then return notify("Crucifix", "Animation en cours...") end
  local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
  if not root then return end
  local target
  local tap = LP:GetMouse().Target
  if Cfg.CrossAny and tap then target = topModel(tap) end
  if not target then -- sinon : monstre / entite le plus proche
    local best
    for o, e in pairs(Track) do
      if (e.cat == "Entities" or e.cat == "Monsters") and o.Parent and (not best or e.dist < best) then target, best = o, e.dist end
    end
  end
  if not target or target == workspace or Players:GetPlayerFromCharacter(target) or target:IsDescendantOf(LP.Character) then
    return notify("Crucifix", "Aucune cible valide.")
  end
  local pt = getPart(target)
  if not pt or (pt.Position - root.Position).Magnitude > Cfg.CrossRange then return notify("Crucifix", "Hors portee.") end
  crucify(target)
end
local function giveCross()
  if crossTool and crossTool.Parent then return notify("Crucifix", "Deja dans ton sac.") end
  local bp = LP:FindFirstChildOfClass("Backpack")
  if not bp then return notify("Crucifix", "Sac introuvable.") end
  local tool, held = new("Tool", { Name = "Crucifix", RequiresHandle = false, CanBeDropped = false }, nil), nil
  tool.Equipped:Connect(function()
    local ch = LP.Character
    local hand = ch and (ch:FindFirstChild("RightHand") or ch:FindFirstChild("Right Arm"))
    if not hand then return end
    held = new("Part", { Size = V3(0.25, 1.6, 0.25), Material = Enum.Material.Wood, Color = RGB(110, 70, 40),
      CanCollide = false, Massless = true, CFrame = hand.CFrame * CFrame.new(0, -0.9, -0.3) }, nil)
    local bar = new("Part", { Size = V3(0.9, 0.25, 0.25), Material = Enum.Material.Wood, Color = held.Color,
      CanCollide = false, Massless = true, CFrame = held.CFrame * CFrame.new(0, 0.35, 0) }, held)
    new("WeldConstraint", { Part0 = held, Part1 = bar }, held)
    new("WeldConstraint", { Part0 = hand, Part1 = held }, held)
    held.Parent = ch
  end)
  tool.Unequipped:Connect(function() if held then held:Destroy() held = nil end end)
  tool.Activated:Connect(function()
    local s, e = pcall(useCross)
    if not s then busy = false notify("Erreur", tostring(e), RED) end
  end)
  tool.Parent = bp
  crossTool = tool
  notify("Crucifix", "Equipe-le puis touche le monstre.")
end
table.insert(Cleanups, function() if crossTool then crossTool:Destroy() end end)

local P = page("ESP")
toggle(P, "ESP actif", "Esp")
countLabel = label(P, "Cibles suivies : 0")
toggle(P, "Boites", "Boxes")
toggle(P, "Noms", "Names")
toggle(P, "Distance", "Dist")
toggle(P, "Vie", "Health")
toggle(P, "Chams (contours)", "Chams")
stepper(P, "Distance max", "MaxDist", 50, 2000, 50)
for _, c in ipairs(Cats) do toggle(P, c[2], "E_" .. c[1], c[3]) end
label(P, "ESP joueurs actif uniquement dans DOORS (cooperatif).")
P = page("Monde")
toggle(P, "Fullbright", "Fullbright")
toggle(P, "Sans brouillard", "NoFog")
toggle(P, "Speed", "Speed")
stepper(P, "Vitesse", "SpeedV", 15, 30, 1)
toggle(P, "FOV", "Fov")
stepper(P, "FOV", "FovV", 70, 120, 5)
P = page("Entites")
toggle(P, "Alertes", "Alerts")
toggle(P, "Anti-Screech", "AntiScreech")
toggle(P, "Anti-A90 (exp.)", "AntiA90")
toggle(P, "Anti-Halt (exp.)", "AntiHalt")
protLabel = label(P, "Protections declenchees : 0")
P = page("Crucifix")
button(P, "Obtenir le crucifix", giveCross)
toggle(P, "Viser ce que je touche", "CrossAny")
stepper(P, "Portee", "CrossRange", 10, 300, 10)
crossLabel = label(P, "Visuel local : toi seul vois l'effet.")
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
CloseB.MouseButton1Click:Connect(stop)
select(1)
notify("ABYSS PAINT", "Charge ! Bouton PAINT pour ouvrir.")
end)

if ok then
  Boot:Destroy()
else
  BootTxt.Size, BootTxt.Position = U2(0, 440, 0, 90), U2(0.5, -220, 0, 30)
  BootTxt.BackgroundColor3, BootTxt.TextColor3 = RED, WHITE
  BootTxt.Text = "ABYSS ERREUR (envoie ce texte) :\n" .. tostring(err)
  warn("[Abyss] " .. tostring(err))
end
