-- ABYSS PAINT : partie 1/3. Execute les 3 parties dans l'ordre (1, 2, 3...).
local G = (getgenv and getgenv()) or _G
G.AbyssSrc = {}
G.AbyssSrc[1] = [==[-- ABYSS PAINT // DOORS - Delta Android. Script unique : ESP, floors, protections, crucifix. ASCII
local Players = game:GetService("Players")
local RS = game:GetService("RunService")
local UIS = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")
local TS = game:GetService("TweenService")
local RSt = game:GetService("ReplicatedStorage")
local PPS = game:GetService("ProximityPromptService")
local LP = Players.LocalPlayer
local PG = LP:WaitForChild("PlayerGui")
local G = (getgenv and getgenv()) or _G
for _, k in ipairs({ "AbyssStop", "AbyssLiteStop", "AbyssExtraStop" }) do
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
-- Police : chaque texte cree garde sa police d'origine (retour arriere) et prend la police choisie
local Texts, curFace = setmetatable({}, { __mode = "k" }), nil
local function new(class, props, parent)
	local o = Instance.new(class)
	if props.Text then props.Font, props.TextColor3, props.TextSize = props.Font or CODE, props.TextColor3 or BLACK, props.TextSize or 13 end
	for k, v in pairs(props) do o[k] = v end
	if props.Text then
		Texts[o] = props.Font
		if curFace then pcall(function() o.FontFace = curFace end) end
	end
	o.Parent = parent
	return o
end
-- Border : sinon le contour s'applique au texte
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
	Esp = true, Labels = true, Chams = true, MaxDist = 500,
	Fullbright = false, NoFog = false, Speed = false, SpeedV = 5, SafeSpeed = true, RoomOnly = true, AntiSlide = false,
	Alerts = true, AntiScreech = false, AntiA90 = false, AntiHalt = false, Fov = false, FovV = 90,
	AntiDread = false, AntiSurge = false, NoJumpscare = false, AntiGiggle = false, AntiSnare = false, AntiDupe = false,
	AntiEggs = false, AntiBanana = false, AntiLava = false, AntiWall = false, AntiSeek = false, AntiJeff = false,
	AntiVacuum = false, AntiAlma = false, AntiRansom = false, AntiTrash = false, Oxygen = false, Haste = false,
	LibCode = false, InstantPrompt = false, Jump = false, NoShake = false, HideSeeThrough = false, NoVignette = false,
	CrossAny = true, CrossRange = 80, AutoLoot = false, LootItems = true, RushBanner = true,
	AntiRollback = true, Honcho = true, HonchoAuto = false, FontIdx = 1,
}
for _, c in ipairs(Cats) do
	CatInfo[c[1]] = c
	Cfg["E_" .. c[1]] = c[1] == "Entities" or c[1] == "Monsters" or c[1] == "Players"
end

local Gui = new("ScreenGui", { Name = "AbyssPaint", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 999 }, PG)
table.insert(Cleanups, function() Gui:Destroy() end)
-- ESP hors workspace (gethui/CoreGui) : le jeu ne l'efface pas
local Hold
pcall(function() Hold = new("Folder", { Name = "AbyssEsp" }, (gethui and gethui()) or game:GetService("CoreGui")) end)
table.insert(Cleanups, function() if Hold then Hold:Destroy() end end)

local Notifs = new("Frame", { Size = U2(0, 240, 1, -20), Position = U2(1, -250, 0, 10), BackgroundTransparency = 1 }, Gui)
new("UIListLayout", { Padding = UDim.new(0, 6), VerticalAlignment = Enum.VerticalAlignment.Bottom }, Notifs)
local function notify(title, text, color)
	if not Alive then return end
	local kids = Notifs:GetChildren()
	if #kids > 4 then kids[2]:Destroy() end
	local f = new("Frame", { Size = U2(1, 0, 0, 50), BackgroundColor3 = GREY }, Notifs)
	border(f, 2)
	new("TextLabel", { Size = U2(1, 0, 0, 16), BackgroundColor3 = color or NAVY, BorderSizePixel = 0,
	TextColor3 = WHITE, Text = " " .. title, TextXAlignment = Enum.TextXAlignment.Left }, f)
	new("TextLabel", { Size = U2(1, -8, 0, 32), Position = U2(0, 4, 0, 17), BackgroundTransparency = 1,
	TextSize = 12, TextWrapped = true, Text = text,
	TextXAlignment = Enum.TextXAlignment.Left }, f)
	task.delay(4, function() f:Destroy() end)
end

-- Wrap porte la fenetre et son ombre portee : on deplace / masque le tout d'un bloc
local Wrap = new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = U2(0.5, 0, 0.5, 0), Size = U2(0, 478, 0, 338),
	BackgroundTransparency = 1 }, Gui)
new("Frame", { Size = U2(0, 470, 0, 330), Position = U2(0, 8, 0, 8), BackgroundColor3 = BLACK, BackgroundTransparency = 0.55,
	BorderSizePixel = 0 }, Wrap)
local Main = new("Frame", { Size = U2(0, 470, 0, 330), BackgroundColor3 = GREY, Active = true }, Wrap)
border(Main, 3)
-- relief Windows 95 : liseres clair en haut/gauche
new("Frame", { Size = U2(1, 0, 0, 2), BackgroundColor3 = WHITE, BorderSizePixel = 0 }, Main)
new("Frame", { Size = U2(0, 2, 1, 0), BackgroundColor3 = WHITE, BorderSizePixel = 0 }, Main)
local cam0 = workspace.CurrentCamera
if cam0 then
	new("UIScale", { Scale = math.clamp(math.min(cam0.ViewportSize.X / 660, cam0.ViewportSize.Y / 400), 0.6, 1.3) }, Wrap)
end
local Title = new("TextLabel", { Size = U2(1, -8, 0, 24), Position = U2(0, 4, 0, 4), BackgroundColor3 = WHITE,
	BorderSizePixel = 0, Font = ARC, TextSize = 16, TextColor3 = WHITE, Text = "  ABYSS PAINT.EXE  -  DOORS",
	TextXAlignment = Enum.TextXAlignment.Left, Active = true }, Main)
local TitleGrad = new("UIGradient", { Color = ColorSequence.new(NAVY, RGB(16, 132, 208)) }, Title)
local function winBtn(txt, x)
	local b = new("TextButton", { Size = U2(0, 20, 0, 18), Position = U2(1, x, 0, 3), BackgroundColor3 = GREY,
	BorderSizePixel = 0, TextSize = 14, Text = txt }, Title)
	border(b, 2)
	return b
end
local MinB, CloseB = winBtn("_", -46), winBtn("X", -24)
local Status = new("TextLabel", { Size = U2(1, -8, 0, 18), Position = U2(0, 4, 1, -22), BackgroundColor3 = GREY,
	TextSize = 12, Text = " Pret", TextXAlignment = Enum.TextXAlignment.Left }, Main)
border(Status, 1)

-- Palette MS Paint : touche une couleur pour changer la teinte du titre
local Pal = new("Frame", { Size = U2(1, -8, 0, 20), Position = U2(0, 4, 1, -46), BackgroundTransparency = 1 }, Main)
new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 3) }, Pal)
for _, c in ipairs({ BLACK, DARK, RGB(128, 0, 0), RGB(128, 128, 0), RGB(0, 128, 0), RGB(0, 128, 128), NAVY, RGB(128, 0, 128),
	WHITE, GREY, RED, RGB(255, 255, 0), GREEN, CYAN, RGB(0, 0, 255), RGB(255, 0, 255) }) do
	local sw = new("TextButton", { Size = U2(0, 18, 0, 18), BackgroundColor3 = c, Text = "", AutoButtonColor = false }, Pal)
	border(sw, 1)
	sw.MouseButton1Click:Connect(function() TitleGrad.Color = ColorSequence.new(NAVY, c) end)
end
local Tools = new("ScrollingFrame", { Size = U2(0, 104, 1, -84), Position = U2(0, 4, 0, 32), BackgroundTransparency = 1,
	BorderSizePixel = 0, ScrollBarThickness = 4, ScrollBarImageColor3 = BLACK, CanvasSize = U2(), AutomaticCanvasSize = Enum.AutomaticSize.Y }, Main)
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
	local b = new("TextButton", { Size = U2(1, -6, 0, 30), BackgroundColor3 = GREY, 
	Text = name, LayoutOrder = i, AutoButtonColor = false }, Tools)
	border(b, 2)
	local p = new("ScrollingFrame", { Size = U2(1, -122, 1, -88), Position = U2(0, 114, 0, 34),
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
	TextSize = 12, TextWrapped = true, TextColor3 = DARK, Text = text,
	TextXAlignment = Enum.TextXAlignment.Left, LayoutOrder = nextOrder() }, p)
end
local function section(p, text)
	local f = new("TextLabel", { Size = U2(1, 0, 0, 20), BackgroundColor3 = NAVY, BorderSizePixel = 0, TextColor3 = WHITE,
	TextSize = 12, Text = " " .. text, TextXAlignment = Enum.TextXAlignment.Left, LayoutOrder = nextOrder() }, p)
	new("UIGradient", { Color = ColorSequence.new(NAVY, RGB(16, 132, 208)) }, f)
	return f
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
	local b = new("TextButton", { Size = U2(1, 0, 0, 30), BackgroundColor3 = GREY, 
	Text = "     " .. text, TextXAlignment = Enum.TextXAlignment.Left, LayoutOrder = nextOrder(), AutoButtonColor = false }, p)
	border(b, 2)
	local box = new("TextLabel", { Size = U2(0, 18, 0, 18), Position = U2(0, 5, 0.5, -9), BackgroundColor3 = WHITE,
	Font = ARC, TextSize = 16, TextColor3 = RED, Text = "" }, b)
	border(box, 2)
	if color then new("Frame", { Size = U2(0, 14, 0, 14), Position = U2(1, -20, 0.5, -7), BackgroundColor3 = color, BorderSizePixel = 0 }, b) end
	local function r()
		box.Text = Cfg[key] and "X" or ""
		b.BackgroundColor3 = Cfg[key] and RGB(214, 236, 214) or GREY
	end
	Render[key] = Render[key] or {}
	table.insert(Render[key], r)
	b.MouseButton1Click:Connect(function() set(key, not Cfg[key]) end)
	r()
end
local function stepper(p, text, key, lo, hi, step)
	local f = new("Frame", { Size = U2(1, 0, 0, 30), BackgroundColor3 = GREY, LayoutOrder = nextOrder() }, p)
	border(f, 2)
	local l = new("TextLabel", { Size = U2(1, -90, 1, 0), Position = U2(0, 6, 0, 0), BackgroundTransparency = 1,
	Text = " ", TextXAlignment = Enum.TextXAlignment.Left }, f)
	local function r() l.Text = text .. " : " .. Cfg[key] end
	Render[key] = { r }
	for i, d in ipairs({ -step, step }) do
		local b = new("TextButton", { Size = U2(0, 34, 0, 22), Position = U2(1, i == 1 and -80 or -40, 0.5, -11),
			BackgroundColor3 = WHITE, Font = ARC, TextSize = 16, Text = d < 0 and "-" or "+" }, f)
		border(b, 2)
		b.MouseButton1Click:Connect(function() set(key, math.clamp(Cfg[key] + d, lo, hi)) end)
	end
	r()
end
local function button(p, text, fn)
	local b = new("TextButton", { Size = U2(1, 0, 0, 30), BackgroundColor3 = GREY, 
	Text = text, LayoutOrder = nextOrder(), AutoButtonColor = false }, p)
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

do -- drag tactile
	local drag, inp, st, sp
	Title.InputBegan:Connect(function(i)
		if i.UserInputType == Enum.UserInputType.Touch or i.UserInputType == Enum.UserInputType.MouseButton1 then
			drag, inp, st, sp = true, i, i.Position, Wrap.Position
		end
	end)
	on(UIS.InputChanged, function(i)
		if drag and (i == inp or i.UserInputType == Enum.UserInputType.MouseMovement) then
			local d = i.Position - st
			Wrap.Position = U2(sp.X.Scale, sp.X.Offset + d.X, sp.Y.Scale, sp.Y.Offset + d.Y)
		end
	end)
	on(UIS.InputEnded, function(i)
		if i == inp or i.UserInputType == Enum.UserInputType.MouseButton1 then drag = false end
	end)
end
local Float = new("TextButton", { Size = U2(0, 56, 0, 56), Position = U2(0, 10, 0.4, 0), BackgroundColor3 = WHITE,
	Font = ARC, TextColor3 = NAVY, TextSize = 14, Text = "PAINT", AutoButtonColor = false }, Gui)
border(Float, 3)
for i, c in ipairs({ RED, RGB(255, 200, 0), GREEN, RGB(0, 128, 255) }) do
	new("Frame", { Size = U2(0, 10, 0, 6), Position = U2(0, 3 + (i - 1) * 13, 1, -10), BackgroundColor3 = c, BorderSizePixel = 0 }, Float)
end
do -- bouton flottant deplacable au doigt ; un simple appui ouvre/ferme
	local fd, fi, fs, fp, moved
	Float.InputBegan:Connect(function(i)
		if i.UserInputType == Enum.UserInputType.Touch or i.UserInputType == Enum.UserInputType.MouseButton1 then
			fd, fi, fs, fp, moved = true, i, i.Position, Float.Position, false
		end
	end)
	on(UIS.InputChanged, function(i)
		if fd and (i == fi or i.UserInputType == Enum.UserInputType.MouseMovement) then
			local d = i.Position - fs
			if math.abs(d.X) + math.abs(d.Y) > 8 then moved = true end
			if moved then Float.Position = U2(fp.X.Scale, fp.X.Offset + d.X, fp.Y.Scale, fp.Y.Offset + d.Y) end
		end
	end)
	on(UIS.InputEnded, function(i)
		if i == fi or i.UserInputType == Enum.UserInputType.MouseButton1 then fd = false end
	end)
	Float.MouseButton1Click:Connect(function()
		if not moved then Wrap.Visible = not Wrap.Visible end
		moved = false
	end)
end
MinB.MouseButton1Click:Connect(function() Wrap.Visible = false end)

local Track, Pending = {}, setmetatable({}, { __mode = "k" })
local function isDoors() return workspace:FindFirstChild("CurrentRooms") ~= nil end
local function getPart(o)
	if o:IsA("BasePart") then return o end
	if not o:IsA("Model") then return nil end
	return o.PrimaryPart or o:FindFirstChild("HumanoidRootPart") or o:FindFirstChildWhichIsA("BasePart", true)
end
local function roomOf(o)
	local rooms = workspace:FindFirstChild("CurrentRooms")
	if not rooms then return nil end
	while o and o.Parent ~= rooms do o = o.Parent end
	return o and tonumber(o.Name)
end
local function untrack(o)
	local e = Track[o]
	if not e then return end
	Track[o] = nil
	e.conn:Disconnect()
	if e.hl then e.hl:Destroy() end
	e.bb:Destroy()
end
local function track(o, cat, label, partName)
	if not Alive or Track[o] or not o.Parent or o:IsDescendantOf(Gui) then return end
	local part = (partName and o:FindFirstChild(partName)) or getPart(o)
	if not part then
		Pending[o] = { cat, label, partName } -- streaming
		return
	end
	Pending[o] = nil
	local size = o:IsA("Model") and o:GetExtentsSize() or part.Size
	local hum = o:FindFirstChildOfClass("Humanoid")
	local e = { o = o, cat = cat, label = label, part = part, hum = hum, dist = 0,
	room = cat ~= "Entities" and cat ~= "Monsters" and cat ~= "Players" and roomOf(o) or nil,
	h = hum and 6 or math.clamp(size.Y, 1, 30) }
	local col = CatInfo[cat][3]
	e.bb = new("BillboardGui", { Adornee = part, Size = U2(0, 200, 0, 46), StudsOffset = V3(0, e.h / 2 + 1.5, 0),
	AlwaysOnTop = true, Enabled = false }, Hold or part)
	e.tx = new("TextLabel", { BackgroundTransparency = 1, Size = U2(1, 0, 1, 0), TextSize = 14,
	TextColor3 = col, TextStrokeTransparency = 0, TextStrokeColor3 = BLACK, Text = label }, e.bb)
	e.conn = o.AncestryChanged:Connect(function()
		if not o:IsDescendantOf(workspace) then untrack(o) end
	end)
	Track[o] = e
end

local Names = {}
local function add(cat, list) for k, v in pairs(list) do Names[k] = { cat, v } end end
add("Keys", { KeyObtain = "Cle", ElectricalKeyObtain = "Cle elec", LeverForGate = "Levier", TimerLever = "Levier" })
add("Objectives", { LiveHintBook = "Livre", LiveBreakerPolePickup = "Disjoncteur", FuseObtain = "Fusible",
	MinesAnchor = "Ancre", MinesGenerator = "Generateur", WaterPump = "Pompe", LibraryHintPaper = "Papier indice",
	MinesGateButton = "Bouton grille", GardenGateButton = "Bouton grille", CringlePresent = "Cadeau", VineGuillotine = "Levier lianes" })
add("Gold", { GoldPile = "Or", StardustPickup = "Poussiere" })
add("Items", { Lighter = "Briquet", Flashlight = "Lampe", Lockpick = "Crochets", Vitamins = "Vitamines", Bandage = "Bandage",
	Crucifix = "Crucifix", CrucifixWall = "Crucifix", SkeletonKey = "Cle squelette", Battery = "Pile", Candle = "Bougie",
	Shears = "Cisailles", Glowsticks = "Batons", StarVial = "Fiole", StarJug = "Baril", Shakelight = "Lampe",
	Straplight = "Lampe", BandagePack = "Bandages", BatteryPack = "Piles", ShieldMini = "Bouclier", ShieldBig = "Bouclier" })
add("Chests", { DrawerContainer = "Tiroir", ChestBox = "Coffre", ChestBoxLocked = "Coffre", Toolbox = "Boite a outils",
	Toolbox_Locked = "Boite a outils", Chest_Vine = "Coffre lianes", Toolshed_Small = "Cabane", Locker_Small_Locked = "Casier" })
add("Hiding", { Wardrobe = "Armoire", Backdoor_Wardrobe = "Armoire", RetroWardrobe = "Armoire", Toolshed = "Armoire", Bed = "Lit",
	Double_Bed = "Lit", Rooms_Locker = "Casier", Rooms_Locker_Fridge = "Casier", Locker_Large = "Casier", CircularVent = "Ventilation",
	Dumpster = "Benne" })
add("Entities", { RushMoving = "RUSH", AmbushMoving = "AMBUSH", Eyes = "EYES", SeekMoving = "SEEK", SeekMovingNewClone = "SEEK",
	FigureRig = "FIGURE", FigureRagdoll = "FIGURE", BackdoorRush = "BLITZ", BackdoorLookman = "LOOKMAN", A60 = "A-60",
	A120 = "A-120", GloombatSwarm = "GLOOMBATS", GrumbleRig = "GRUMBLE", Figure = "FIGURE", GiggleCeiling = "GIGGLE",
	Snare = "SNARE", GloomPile = "OEUFS", Groundskeeper = "GROUNDSKEEPER", LiveEntityBramble = "BRAMBLE", JeffTheKiller = "JEFF",
	SallyMoving = "SALLY", MonumentEntity = "MONUMENT", GlitchRush = "RUSH", GlitchAmbush = "AMBUSH", FrozenAmbush = "AMBUSH",
	FakeDoor = "DUPE", DoorFake = "DUPE" })
-- Floors (AbysallContinued) : une categorie ESP par floor, activee pour le floor detecte
local FLOORS = {
	{ "Hotel", { "hotel", "fools", "party" }, RGB(255, 170, 80), {
		LiveHintBook = "Livre", LibraryHintPaper = "Papier indice", LibraryHintPaperHard = "Papier indice",
		LiveBreakerPolePickup = "Disjoncteur", LeverForGate = "Levier grille", ElevatorBreaker = "Boitier ascenseur" } },
	{ "Mines", { "mines", "ripple" }, RGB(255, 120, 40), {
		MinesAnchor = "Ancre", MinesGenerator = "Generateur", FuseObtain = "Fusible", MinesGateButton = "Bouton grille",
		WaterPump = "Pompe", MinecartRig = "Wagon" } },
	{ "Rooms", { "rooms" }, RGB(120, 255, 200), { Rooms_Locker = "Casier", Rooms_Locker_Fridge = "Casier frigo" } },
	{ "Backdoor", { "backdoor" }, RGB(200, 120, 255), { TimerLever = "Levier temps", Backdoor_Wardrobe = "Armoire" } },
	{ "Outdoors", { "garden", "outdoor" }, RGB(120, 220, 80), {
		GardenGateButton = "Bouton grille", Toolshed = "Cabane", Toolshed_Small = "Petite cabane", Chest_Vine = "Coffre lianes",
		VineGuillotine = "Levier lianes", MandrakeLive = "Mandragore" } },
	{ "Archives", { "archive" }, RGB(255, 230, 120), {
		ArchivesStorageBox = "Boite", ArchivesStorageBoxCorrect = "BONNE boite", ArchivesPackageDeposit = "Depot",
		ArchivesClock = "Horloge", ArchivesFishTank = "Aquarium", ArchivesFihTank = "Aquarium" } },
	{ "Stairwell", { "stairwell" }, RGB(150, 200, 255), {
		StairwellLockpickDoor = "Porte garage", StiarwellLockpickDoor = "Porte garage", StairwellFireAlarm = "Alarme incendie",
		ShoppingCart = "Caddie", TV_Stand = "TV (Noise)" } },
}
for _, f in ipairs(FLOORS) do
	local cat = "F_" .. f[1]
	CatInfo[cat] = { cat, "Floor " .. f[1], f[3], 2 }
	Cfg["E_" .. cat] = false
	add(cat, f[4])
end
add("Entities", { Alma = "ALMA", Ransom = "RANSOM", Drones = "DRONES", Scribbles = "SCRIBBLES", Creak = "CREAK", Noise = "NOISE",
	Dread = "DREAD" })
local function rawFloor()
	local gd = RSt:FindFirstChild("GameData")
	local f = gd and gd:FindFirstChild("Floor")
	return f and tostring(f.Value) or nil
end
local function floorOf(raw)
	if not raw then
		-- repli : indice structurel quand GameData manque
		if workspace:FindFirstChild("ArchivesClock", true) then return "Archives" end
		return nil
	end
	local l = string.lower(raw)
	for _, f in ipairs(FLOORS) do
		for _, k in ipairs(f[2]) do
			if string.find(l, k, 1, true) then return f[1] end
		end
	end
	return nil
end

-- Cachette la plus proche : ajoutee aux alertes des entites qui chassent
local HIDE = { Wardrobe = 1, Backdoor_Wardrobe = 1, RetroWardrobe = 1, Toolshed = 1, Bed = 1, Double_Bed = 1, Rooms_Locker = 1,
	Rooms_Locker_Fridge = 1, Locker_Large = 1, CircularVent = 1, Dumpster = 1 }
local RUN = { RUSH = 1, AMBUSH = 1, BLITZ = 1, ["A-60"] = 1, ["A-120"] = 1 }
]==]
pcall(function() game:GetService("StarterGui"):SetCore("SendNotification", { Title = "ABYSS PAINT", Text = "Partie 1/3 OK. Execute la partie 2.", Duration = 8 }) end)
