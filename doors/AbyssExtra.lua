-- ABYSS EXTRA // complement d'Abyss Paint (floors + protections Abysall). ASCII < 32 Ko
local Players = game:GetService("Players")
local RS = game:GetService("RunService")
local UIS = game:GetService("UserInputService")
local RSt = game:GetService("ReplicatedStorage")
local PPS = game:GetService("ProximityPromptService")
local LP = Players.LocalPlayer
local PG = LP:WaitForChild("PlayerGui")
local G = (getgenv and getgenv()) or _G
if type(G.AbyssExtraStop) == "function" then pcall(G.AbyssExtraStop) end

local U2, RGB, CODE, ARC = UDim2.new, Color3.fromRGB, Enum.Font.Code, Enum.Font.Arcade
local GREY, DARK, BLACK, WHITE = RGB(192, 192, 192), RGB(128, 128, 128), Color3.new(0, 0, 0), Color3.new(1, 1, 1)
local NAVY, GREEN, RED = RGB(0, 0, 128), RGB(0, 255, 0), RGB(255, 0, 0)

local Boot = Instance.new("ScreenGui")
Boot.Name, Boot.ResetOnSpawn, Boot.DisplayOrder = "AbyssExtraBoot", false, 1000
Boot.Parent = PG
local BootTxt = Instance.new("TextLabel")
BootTxt.Size, BootTxt.Position = U2(0, 340, 0, 40), U2(0.5, -170, 0, 80)
BootTxt.BackgroundColor3, BootTxt.TextColor3, BootTxt.BorderColor3, BootTxt.BorderSizePixel = GREY, BLACK, BLACK, 3
BootTxt.TextWrapped, BootTxt.TextSize, BootTxt.Font = true, 14, CODE
BootTxt.Text = "ABYSS EXTRA : chargement..."
BootTxt.Parent = Boot

local ok, err = pcall(function()
local Alive, Conns, Cleanups = true, {}, {}
local function on(sig, fn)
	local c = sig:Connect(function(...)
		if not Alive then return end
		local s, e = pcall(fn, ...)
		if not s then warn("[AbyssExtra] " .. tostring(e)) end
	end)
	table.insert(Conns, c)
	return c
end
local function loop(dt, fn)
	task.spawn(function()
		while Alive do
			local s, e = pcall(fn)
			if not s then warn("[AbyssExtra] " .. tostring(e)) end
			task.wait(dt)
		end
	end)
end
local function new(class, props, parent)
	local o = Instance.new(class)
	if props.Text then props.Font, props.TextColor3, props.TextSize = props.Font or CODE, props.TextColor3 or BLACK, props.TextSize or 13 end
	for k, v in pairs(props) do o[k] = v end
	o.Parent = parent
	return o
end
local function border(o, t) new("UIStroke", { Color = BLACK, Thickness = t or 2, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, o) end
local function api()
	local a = G.AbyssAPI
	return a and a.alive() and a or nil
end

local Cfg = {
	AntiScreech = false, AntiA90 = false, AntiDread = false, AntiHalt = false, AntiSurge = false, NoJumpscare = false,
	AntiGiggle = false, AntiSnare = false, AntiDupe = false, AntiEggs = false, AntiBanana = false, AntiLava = false,
	AntiWall = false, AntiSeek = false, AntiJeff = false, AntiVacuum = false, AntiAlma = false, AntiRansom = false,
	AntiTrash = false, HideAlert = true, Oxygen = false, Haste = false, LibCode = false, InstantPrompt = false,
	Jump = false, NoShake = false, HideSeeThrough = false, NoVignette = false,
}

local Gui = new("ScreenGui", { Name = "AbyssExtra", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 998 }, PG)
table.insert(Cleanups, function() Gui:Destroy() end)
local Notifs = new("Frame", { Size = U2(0, 240, 1, -20), Position = U2(0, 70, 0, 10), BackgroundTransparency = 1 }, Gui)
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
	TextSize = 12, TextWrapped = true, Text = text, TextXAlignment = Enum.TextXAlignment.Left }, f)
	task.delay(4, function() f:Destroy() end)
end

local Main = new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = U2(0.5, 30, 0.5, 30),
	Size = U2(0, 470, 0, 300), BackgroundColor3 = GREY, Active = true, Visible = false }, Gui)
border(Main, 3)
local cam0 = workspace.CurrentCamera
if cam0 then
	new("UIScale", { Scale = math.clamp(math.min(cam0.ViewportSize.X / 660, cam0.ViewportSize.Y / 370), 0.6, 1.3) }, Main)
end
local Title = new("TextLabel", { Size = U2(1, -8, 0, 24), Position = U2(0, 4, 0, 4), BackgroundColor3 = NAVY,
	BorderSizePixel = 0, Font = ARC, TextSize = 16, TextColor3 = WHITE, Text = " ABYSS EXTRA.EXE",
	TextXAlignment = Enum.TextXAlignment.Left, Active = true }, Main)
local CloseB = new("TextButton", { Size = U2(0, 20, 0, 18), Position = U2(1, -24, 0, 3), BackgroundColor3 = GREY,
	BorderSizePixel = 0, TextSize = 14, Text = "X" }, Title)
border(CloseB, 2)
local Status = new("TextLabel", { Size = U2(1, -8, 0, 18), Position = U2(0, 4, 1, -22), BackgroundColor3 = GREY,
	TextSize = 12, Text = " Pret", TextXAlignment = Enum.TextXAlignment.Left }, Main)
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
	local b = new("TextButton", { Size = U2(1, 0, 0, 30), BackgroundColor3 = GREY, Text = name, LayoutOrder = i, AutoButtonColor = false }, Tools)
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
	TextSize = 12, TextWrapped = true, TextColor3 = DARK, Text = text,
	TextXAlignment = Enum.TextXAlignment.Left, LayoutOrder = nextOrder() }, p)
end
local Render, Apply = {}, {}
-- tbl : Cfg local, ou fonction renvoyant le Cfg d'Abyss Paint (categories ESP floor)
local function getT(tbl) if type(tbl) == "function" then return tbl() end return tbl or Cfg end
local function set(key, v, tbl)
	local t = getT(tbl)
	if not t then return notify("Abyss Extra", "Lance Abyss Paint d'abord.", RED) end
	t[key] = v
	for _, f in ipairs(Render[key] or {}) do f() end
	if Apply[key] then
		local s, e = pcall(Apply[key], v)
		if not s then notify("Erreur", tostring(e), RED) end
	end
end
local function toggle(p, text, key, color, tbl)
	local b = new("TextButton", { Size = U2(1, 0, 0, 30), BackgroundColor3 = GREY, Text = "     " .. text,
	TextXAlignment = Enum.TextXAlignment.Left, LayoutOrder = nextOrder(), AutoButtonColor = false }, p)
	border(b, 2)
	local box = new("TextLabel", { Size = U2(0, 18, 0, 18), Position = U2(0, 5, 0.5, -9), BackgroundColor3 = WHITE,
	Font = ARC, TextSize = 16, TextColor3 = RED, Text = "" }, b)
	border(box, 2)
	if color then new("Frame", { Size = U2(0, 14, 0, 14), Position = U2(1, -20, 0.5, -7), BackgroundColor3 = color, BorderSizePixel = 0 }, b) end
	local function r()
		local t = getT(tbl)
		box.Text = (t and t[key]) and "X" or ""
	end
	Render[key] = Render[key] or {}
	table.insert(Render[key], r)
	b.MouseButton1Click:Connect(function()
		local t = getT(tbl)
		set(key, not (t and t[key]), tbl)
	end)
	r()
	return r
end
local function button(p, text, fn)
	local b = new("TextButton", { Size = U2(1, 0, 0, 30), BackgroundColor3 = GREY, Text = text, LayoutOrder = nextOrder(), AutoButtonColor = false }, p)
	border(b, 2)
	b.MouseButton1Click:Connect(function()
		local s, e = pcall(fn)
		if not s then notify("Erreur", tostring(e), RED) end
	end)
end

do -- drag tactile
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
local Float = new("TextButton", { Size = U2(0, 52, 0, 52), Position = U2(0, 10, 0.4, 60), BackgroundColor3 = WHITE,
	Font = ARC, TextColor3 = NAVY, Text = "EXTRA", AutoButtonColor = false }, Gui)
border(Float, 3)
Float.MouseButton1Click:Connect(function() Main.Visible = not Main.Visible end)

-- ===== Floor =====
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
-- Entites ajoutees par AbysallContinued (Archives / Stairwell)
local NEW_ENT = { Alma = "ALMA", Ransom = "RANSOM", Drones = "DRONES", Scribbles = "SCRIBBLES", Creak = "CREAK", Noise = "NOISE",
	Dread = "DREAD", MandrakeHole = "MANDRAGORE" }

local function rawFloor()
	local gd = RSt:FindFirstChild("GameData")
	local f = gd and gd:FindFirstChild("Floor")
	return f and tostring(f.Value) or nil
end
local function floorOf(raw)
	if not raw then
		-- repli : indices structurels quand GameData manque
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

local registered = false
local function register()
	local A = api()
	if not A then return false end
	local cur = floorOf(rawFloor())
	for i, f in ipairs(FLOORS) do
		local cat = "F_" .. f[1]
		A.CatInfo[cat] = { cat, "Floor " .. f[1], f[3], 2 }
		if A.Cfg["E_" .. cat] == nil then A.Cfg["E_" .. cat] = (f[1] == cur) end
		for k, v in pairs(f[4]) do A.Names[k] = { cat, v } end
	end
	for k, v in pairs(NEW_ENT) do A.Names[k] = { "Entities", v } end
	-- re-classement des objets deja suivis sous une ancienne categorie
	for o, e in pairs(A.Track) do
		local d = A.Names[o.Name]
		if d and d[1] ~= e.cat then A.untrack(o) end
	end
	task.spawn(function()
		for n, i in ipairs(workspace:GetDescendants()) do
			if not Alive then return end
			A.process(i)
			if n % 400 == 0 then task.wait() end
		end
	end)
	registered = true
	for _, f in ipairs(FLOORS) do
		for _, r in ipairs(Render["E_F_" .. f[1]] or {}) do r() end
	end
	return true
end

-- ===== Protections : modules clients renommes (methode Abysall) =====
local MODS = {
	AntiScreech = { "Screech", "GlitchScreech" }, AntiA90 = { "A90" }, AntiDread = { "Dread" }, AntiHalt = { "Shade" },
	NoJumpscare = { "SpiderJumpscare", "Jumpscares" },
}
local renamed = {}
local function modRoots()
	local out = {}
	local mui = PG:FindFirstChild("MainUI")
	local rl = mui and mui:FindFirstChild("RemoteListener", true)
	if rl then table.insert(out, rl) end
	local fr = RSt:FindFirstChild("FloorReplicated")
	if fr then table.insert(out, fr) end
	return out, mui
end
local function syncMods()
	local want = { SurgeVignette = Cfg.AntiSurge }
	for key, list in pairs(MODS) do
		if Cfg[key] then for _, n in ipairs(list) do want[n] = true end end
	end
	-- restauration de ce qui n'est plus demande
	for o, orig in pairs(renamed) do
		if not (want[orig] or (Cfg.NoJumpscare and string.find(orig, "Jumpscare", 1, true))) then
			if o.Parent then o.Name = orig end
			renamed[o] = nil
		end
	end
	local roots, mui = modRoots()
	for _, root in ipairs(roots) do
		for _, d in ipairs(root:GetDescendants()) do
			local n = d.Name
			local jump = Cfg.NoJumpscare and d.ClassName == "ModuleScript" and string.find(n, "Jumpscare", 1, true)
				and not string.find(n, "_Disabled", 1, true)
			if (want[n] or jump) and not renamed[d] then
				renamed[d] = n
				d.Name = n .. "_Disabled"
			end
		end
	end
	local sv = mui and mui:FindFirstChild("SurgeVignette", true)
	if Cfg.AntiSurge and sv and not renamed[sv] then
		renamed[sv] = "SurgeVignette"
		sv.Name = "SurgeVignette_Disabled"
	end
end
for key in pairs(MODS) do Apply[key] = syncMods end
Apply.AntiSurge = syncMods

-- ===== Protections : contact local coupe (CanTouch), comme Abysall =====
local HAZ = {
	GiggleCeiling = "AntiGiggle", Snare = "AntiSnare", FakeDoor = "AntiDupe", DoorFake = "AntiDupe", GloomPile = "AntiEggs",
	BananaPeel = "AntiBanana", Lava = "AntiLava", ScaryWall = "AntiWall", Seek_Arm = "AntiSeek",
	ChandelierObstruction = "AntiSeek", JeffTheKiller = "AntiJeff", SideroomSpace = "AntiVacuum",
}
local Haz = setmetatable({}, { __mode = "k" })
local touchOld = setmetatable({}, { __mode = "k" })
local function hazard(o)
	local key = HAZ[o.Name]
	if not key or not o.Parent then return end
	local on = Cfg[key] and Alive
	local parts = o:IsA("BasePart") and { o } or o:GetDescendants()
	for _, p in ipairs(parts) do
		if p:IsA("BasePart") then
			if touchOld[p] == nil then touchOld[p] = p.CanTouch end
			p.CanTouch = (not on) and touchOld[p]
			-- Vacuum : la salle piege devient un mur au lieu d'aspirer
			if key == "AntiVacuum" and p.Name == "Collision" then p.CanCollide = on and true or false end
		elseif p:IsA("ProximityPrompt") and key == "AntiDupe" then
			p.Enabled = not on
		end
	end
	Haz[o] = key
end
for _, key in pairs(HAZ) do
	Apply[key] = function() for o in pairs(Haz) do if o.Parent then hazard(o) end end end
end

-- ===== Suppression locale d'entites (Archives) =====
local KILL = { Alma = "AntiAlma", Ransom = "AntiRansom" }
local function trash(n)
	return string.sub(n, 1, 6) == "Binder" or string.sub(n, 1, 4) == "Shoe" or string.sub(n, 1, 5) == "Shelf"
end
local function killCheck(c)
	local key = KILL[c.Name]
	if (key and Cfg[key]) or (Cfg.AntiTrash and trash(c.Name)) then
		task.defer(function() if Alive and c.Parent then c:Destroy() end end)
	end
end
local function killAll() for _, c in ipairs(workspace:GetChildren()) do killCheck(c) end end
Apply.AntiAlma, Apply.AntiRansom, Apply.AntiTrash = killAll, killAll, killAll

-- ===== Alertes cachette (A-60, A-120, Rush...) =====
local HIDE = { Wardrobe = 1, Backdoor_Wardrobe = 1, RetroWardrobe = 1, Toolshed = 1, Bed = 1, Double_Bed = 1, Rooms_Locker = 1,
	Rooms_Locker_Fridge = 1, Locker_Large = 1, CircularVent = 1, Dumpster = 1 }
local RUN = { A60 = "A-60", A120 = "A-120", RushMoving = "RUSH", AmbushMoving = "AMBUSH", BackdoorRush = "BLITZ", GlitchRush = "RUSH" }
local function nearestHide()
	local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
	local rooms = workspace:FindFirstChild("CurrentRooms")
	if not root or not rooms then return nil end
	local best
	for _, d in ipairs(rooms:GetDescendants()) do
		if HIDE[d.Name] and d:IsA("Model") then
			local ok2, cf = pcall(d.GetPivot, d)
			if ok2 then
				local m = (cf.Position - root.Position).Magnitude
				if not best or m < best then best = m end
			end
		end
	end
	return best
end

on(workspace.ChildAdded, function(c)
	killCheck(c)
	local n = RUN[c.Name]
	if n and Cfg.HideAlert then
		local m = nearestHide()
		notify("! " .. n, m and ("Cachette a " .. math.floor(m) .. " m") or "Aucune cachette proche", RED)
	end
end)
on(workspace.DescendantAdded, function(d)
	if HAZ[d.Name] then task.defer(hazard, d) end
	if d:IsA("BasePart") and d.Parent and HAZ[d.Parent.Name] then task.defer(hazard, d.Parent) end
	if Cfg.InstantPrompt and d:IsA("ProximityPrompt") then d.HoldDuration = 0 end
end)
task.spawn(function()
	for n, d in ipairs(workspace:GetDescendants()) do
		if HAZ[d.Name] then hazard(d) end
		if n % 500 == 0 then task.wait() end
	end
end)

-- ===== Infos : oxygene, Haste, code bibliotheque =====
local function libraryCode()
	local ch = LP.Character
	local bp = LP:FindFirstChildOfClass("Backpack")
	local paper
	for _, n in ipairs({ "LibraryHintPaper", "LibraryHintPaperHard" }) do
		paper = paper or (ch and ch:FindFirstChild(n)) or (bp and bp:FindFirstChild(n))
	end
	local perm = PG:FindFirstChild("PermUI")
	local hints = perm and perm:FindFirstChild("Hints")
	if not paper or not paper:FindFirstChild("UI") or not hints then return nil end
	local code = {}
	local len = string.find(string.lower(rawFloor() or ""), "fools", 1, true) and 10 or 5
	for i = 1, len do code[i] = "_" end
	-- meme symbole (ImageRectOffset) sur le papier et dans les indices => chiffre a la position du papier
	for _, h in ipairs(hints:GetChildren()) do
		local tl = h:IsA("ImageLabel") and h:FindFirstChildOfClass("TextLabel")
		if tl then
			for _, u in ipairs(paper.UI:GetChildren()) do
				local idx = tonumber(u.Name)
				if u:IsA("ImageLabel") and idx and code[idx] and u.ImageRectOffset == h.ImageRectOffset then code[idx] = tl.Text end
			end
		end
	end
	return table.concat(code)
end
local lastCode, lastOxy, lastHaste = nil, nil, nil
local function fmt(t)
	t = math.max(0, math.floor(tonumber(t) or 0))
	return string.format("%02d:%02d", math.floor(t / 60), t % 60)
end

-- ===== Personnage / visuel =====
local jumpOld, shakeMod
local hideParts = setmetatable({}, { __mode = "k" })
local function seeThrough()
	local ch = LP.Character
	local want = {}
	if Cfg.HideSeeThrough and ch and ch:GetAttribute("Hiding") then
		local rooms = workspace:FindFirstChild("CurrentRooms")
		for _, d in ipairs(rooms and rooms:GetDescendants() or {}) do
			if d.Name == "HiddenPlayer" and d:IsA("ObjectValue") and d.Value == ch then
				local m = d.Parent
				while m and m.Parent and not HIDE[m.Name] do m = m.Parent end
				for _, p in ipairs((m or d.Parent):GetDescendants()) do
					if p:IsA("BasePart") then want[p] = true end
				end
				break
			end
		end
	end
	for p in pairs(hideParts) do
		if not want[p] then p.LocalTransparencyModifier = 0 hideParts[p] = nil end
	end
	for p in pairs(want) do p.LocalTransparencyModifier = 0.6 hideParts[p] = true end
end
Apply.Jump = function(v)
	local ch = LP.Character
	if not ch then return end
	if v then
		if jumpOld == nil then jumpOld = ch:GetAttribute("CanJump") or false end
		ch:SetAttribute("CanJump", true)
	elseif jumpOld ~= nil then
		ch:SetAttribute("CanJump", jumpOld)
		jumpOld = nil
	end
end
on(LP.CharacterAdded, function(ch)
	jumpOld = nil
	task.wait(1)
	if Cfg.Jump then Apply.Jump(true) end
end)
Apply.InstantPrompt = function(v)
	if not v then return end
	for _, d in ipairs(workspace:GetDescendants()) do if d:IsA("ProximityPrompt") then d.HoldDuration = 0 end end
end
on(PPS.PromptButtonHoldBegan, function(p) if Cfg.InstantPrompt then p.HoldDuration = 0 end end)
local vigOld = {}
local function vignette()
	local mui = PG:FindFirstChild("MainUI")
	local v = mui and mui:FindFirstChild("HideVignette", true)
	if not v then return end
	if Cfg.NoVignette then
		if vigOld[v] == nil then vigOld[v] = v.Image end
		v.Image = ""
	elseif vigOld[v] ~= nil then
		v.Image = vigOld[v]
		vigOld[v] = nil
	end
end
Apply.NoVignette = vignette
on(RS.RenderStepped, function()
	if not Cfg.NoShake then return end
	if shakeMod == nil then
		-- module client de DOORS : csgo = decalage de tremblement camera
		local mui = PG:FindFirstChild("MainUI")
		local mg = mui and mui:FindFirstChild("Main_Game", true)
		local s, m = pcall(require, mg)
		shakeMod = (s and type(m) == "table") and m or false
	end
	if shakeMod then shakeMod.csgo = CFrame.new() end
end)

loop(1, function()
	syncMods()
	vignette()
	seeThrough()
	if not registered then register() end
	local ch = LP.Character
	local oxy = ch and ch:GetAttribute("Oxygen")
	if Cfg.Oxygen and oxy and lastOxy and oxy < lastOxy and math.floor(oxy) % 10 == 0 then
		notify("Oxygene", math.floor(oxy) .. " %", NAVY)
	end
	lastOxy = oxy
	local fr = RSt:FindFirstChild("FloorReplicated")
	local dt = fr and fr:FindFirstChild("DigitalTimer")
	if Cfg.Haste and dt and dt.Value ~= lastHaste and dt.Value % 30 == 0 then
		notify("Haste", "Temps restant : " .. fmt(dt.Value), RED)
	end
	lastHaste = dt and dt.Value
	if Cfg.LibCode then
		local c = libraryCode()
		if c and c ~= lastCode and not string.find(c, "_", 1, true) then notify("Code bibliotheque", c, GREEN) end
		lastCode = c
	end
	local f = floorOf(rawFloor())
	Status.Text = " Floor : " .. (f or rawFloor() or "?") .. " | ESP floor " .. (api() and "relie" or "Paint absent")
		.. (oxy and (" | O2 " .. math.floor(oxy)) or "") .. (dt and (" | Haste " .. fmt(dt.Value)) or "")
end)

table.insert(Cleanups, function()
	for k in pairs(Cfg) do if type(Cfg[k]) == "boolean" and k ~= "HideAlert" then Cfg[k] = false end end
	syncMods()
	for o in pairs(Haz) do if o.Parent then pcall(hazard, o) end end
	vignette()
	seeThrough()
	Apply.Jump(false)
	if shakeMod then shakeMod.csgo = CFrame.new() end
end)

-- ===== Interface =====
local P = page("Floors")
local floorLbl = label(P, "Floor detecte : ?")
for _, f in ipairs(FLOORS) do
	toggle(P, "ESP " .. f[1], "E_F_" .. f[1], f[3], function() local A = api() return A and A.Cfg end)
end
button(P, "Relier a Abyss Paint", function()
	local r = register()
	notify("Abyss Extra", r and "ESP floor relie a Abyss Paint." or "Lance Abyss Paint d'abord.", r and NAVY or RED)
end)
label(P, "Les categories floor utilisent l'ESP d'Abyss Paint (meme etiquettes et contours).")
P = page("Anti")
label(P, "Supprimer (modules clients) :")
toggle(P, "Anti-Screech", "AntiScreech")
toggle(P, "Anti-A90", "AntiA90")
toggle(P, "Anti-Halt", "AntiHalt")
toggle(P, "Anti-Dread", "AntiDread")
toggle(P, "Anti-Surge", "AntiSurge")
toggle(P, "Sans jumpscares", "NoJumpscare")
label(P, "Contact coupe (CanTouch) :")
toggle(P, "Anti-Giggle", "AntiGiggle")
toggle(P, "Anti-Snare", "AntiSnare")
toggle(P, "Anti-Dupe", "AntiDupe")
toggle(P, "Anti-oeufs Gloombat", "AntiEggs")
toggle(P, "Anti-banane", "AntiBanana")
toggle(P, "Anti-lave", "AntiLava")
toggle(P, "Anti-mur (Seeking Wall)", "AntiWall")
toggle(P, "Anti-obstacles Seek", "AntiSeek")
toggle(P, "Anti-Jeff", "AntiJeff")
toggle(P, "Anti-Vacuum", "AntiVacuum")
label(P, "Archives :")
toggle(P, "Anti-Alma", "AntiAlma")
toggle(P, "Anti-Ransom", "AntiRansom")
toggle(P, "Anti-dechets placard", "AntiTrash")
label(P, "A-60 / A-120 / Rush : pas de bypass client, alerte + cachette la plus proche.")
toggle(P, "Alerte cachette", "HideAlert")
P = page("Infos")
toggle(P, "Oxygene", "Oxygen")
toggle(P, "Minuteur Haste", "Haste")
toggle(P, "Code bibliotheque", "LibCode")
P = page("Perso")
toggle(P, "Saut active", "Jump")
toggle(P, "Prompts instantanes", "InstantPrompt")
toggle(P, "Sans tremblement camera", "NoShake")
toggle(P, "Cachette transparente", "HideSeeThrough")
toggle(P, "Sans vignette cachette", "NoVignette")
P = page("Script")
button(P, "Fermer Abyss Extra", function() G.AbyssExtraStop() end)

local function stop()
	if not Alive then return end
	for i = #Cleanups, 1, -1 do pcall(Cleanups[i]) end
	Alive = false
	for _, c in ipairs(Conns) do c:Disconnect() end
	if G.AbyssExtraStop == stop then G.AbyssExtraStop = nil end
end
G.AbyssExtraStop = stop
CloseB.MouseButton1Click:Connect(stop)
select(1)
local f0 = floorOf(rawFloor())
floorLbl.Text = "Floor detecte : " .. (f0 or rawFloor() or "inconnu")
notify("ABYSS EXTRA", "Charge ! Bouton EXTRA." .. (api() and "" or " Paint absent : ESP floor inactif."))
end)

if ok then
	Boot:Destroy()
else
	BootTxt.Size, BootTxt.Position = U2(0, 440, 0, 90), U2(0.5, -220, 0, 80)
	BootTxt.BackgroundColor3, BootTxt.TextColor3 = RED, WHITE
	BootTxt.Text = "ABYSS EXTRA ERREUR (envoie ce texte) :\n" .. tostring(err)
	warn("[AbyssExtra] " .. tostring(err))
end
