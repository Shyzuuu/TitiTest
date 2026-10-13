-- ABYSS PAINT : partie 1/3. Execute les 3 parties dans l'ordre (1, 2, 3...).
local G = (getgenv and getgenv()) or _G
G.AbyssSrc = {}
G.AbyssSrc[1] = [==[-- ABYSS HUB // Delta Android. Verrou par code puis choix du jeu (DOORS, Universel). ASCII
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

-- ===== Verrou par code + choix du jeu =====
-- Le code n'est jamais ecrit dans le script : seule son empreinte (hash FNV-1a sale, 2000 tours) l'est.
local KEY_HASH = 1409457349
local function keyHash(str)
	local x = 2166136261
	for r = 1, 2000 do
		for i = 1, #str do
			x = bit32.bxor(x, string.byte(str, i))
			-- x * 16777619 mod 2^32, decompose pour rester exact en double precision
			x = (bit32.lshift(x, 24) + x * 403) % 4294967296
		end
		x = bit32.bxor(x, r)
	end
	return x
end
local GAMES = {
	{ "DOORS", "ESP, floors, protections, auto-loot, Honcho, crucifix" },
	{ "Universel", "Anti-AFK et serveur (tous les jeux)" },
}
local choice
do
	local gate = Instance.new("ScreenGui")
	gate.Name, gate.ResetOnSpawn, gate.DisplayOrder, gate.IgnoreGuiInset = "AbyssGate", false, 1001, true
	gate.Parent = PG
	local function mk(class, props, parent)
		local o = Instance.new(class)
		for k, v in pairs(props) do o[k] = v end
		o.Parent = parent
		return o
	end
	local win = mk("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = U2(0.5, 0, 0.5, 0), Size = U2(0, 300, 0, 230),
		BackgroundColor3 = GREY, BorderColor3 = BLACK, BorderSizePixel = 3, Active = true }, gate)
	local bar = mk("TextLabel", { Size = U2(1, -8, 0, 24), Position = U2(0, 4, 0, 4), BackgroundColor3 = WHITE, BorderSizePixel = 0,
		Font = ARC, TextSize = 16, TextColor3 = WHITE, Text = "  ABYSS HUB - VERROU", TextXAlignment = Enum.TextXAlignment.Left }, win)
	mk("UIGradient", { Color = ColorSequence.new(NAVY, RGB(16, 132, 208)) }, bar)
	local info = mk("TextLabel", { Size = U2(1, -16, 0, 34), Position = U2(0, 8, 0, 34), BackgroundTransparency = 1, Font = CODE,
		TextSize = 13, TextColor3 = BLACK, TextWrapped = true, Text = "Entre le code pour deverrouiller." }, win)
	local box = mk("TextBox", { Size = U2(1, -16, 0, 34), Position = U2(0, 8, 0, 74), BackgroundColor3 = WHITE, BorderColor3 = BLACK,
		BorderSizePixel = 2, Font = CODE, TextSize = 18, TextColor3 = BLACK, Text = "", PlaceholderText = "code",
		ClearTextOnFocus = false }, win)
	local list = mk("Frame", { Size = U2(1, -16, 1, -80), Position = U2(0, 8, 0, 72), BackgroundTransparency = 1, Visible = false }, win)
	mk("UIListLayout", { Padding = UDim.new(0, 6) }, list)
	local function btn(parent, text, h)
		return mk("TextButton", { Size = U2(1, 0, 0, h or 34), BackgroundColor3 = GREY, BorderColor3 = BLACK, BorderSizePixel = 2,
			Font = CODE, TextSize = 13, TextColor3 = BLACK, Text = text, AutoButtonColor = true }, parent)
	end
	local unlockB = btn(win, "Deverrouiller")
	unlockB.Position = U2(0, 8, 0, 116)
	unlockB.Size = U2(1, -16, 0, 34)
	local quitB = btn(win, "Fermer")
	quitB.Position = U2(0, 8, 0, 158)
	quitB.Size = U2(1, -16, 0, 30)
	local closed, tries, waiting = false, 0, false
	local function showGames()
		box.Visible, unlockB.Visible, quitB.Visible, list.Visible = false, false, false, true
		bar.Text = "  ABYSS HUB - CHOIX DU JEU"
		info.Text = "Choisis le jeu :"
		for _, g in ipairs(GAMES) do
			local b = btn(list, g[1] .. "  -  " .. g[2], 40)
			b.TextWrapped = true
			b.MouseButton1Click:Connect(function() choice = g[1] end)
		end
		btn(list, "Fermer", 30).MouseButton1Click:Connect(function() closed = true end)
	end
	local function tryKey()
		if keyHash("AbyssPaint#" .. box.Text) == KEY_HASH then
			G.AbyssUnlocked = true
			showGames()
		else
			tries = tries + 1
			box.Text = ""
			info.Text = "Code faux (" .. tries .. "). Reessaie."
			-- attente croissante : rend les essais en serie penibles
			if tries >= 3 then
				waiting, unlockB.Text = true, "Attends..."
				task.wait(math.min(tries * 2, 20))
				waiting, unlockB.Text = false, "Deverrouiller"
			end
		end
	end
	unlockB.MouseButton1Click:Connect(function() if not waiting then tryKey() end end)
	box.FocusLost:Connect(function(enter) if enter and not waiting then tryKey() end end)
	quitB.MouseButton1Click:Connect(function() closed = true end)
	-- deja deverrouille dans cette session : on passe directement au choix du jeu
	if G.AbyssUnlocked then showGames() end
	while not choice and not closed and gate.Parent do task.wait(0.1) end
	gate:Destroy()
end
if not choice then return end

if choice == "Universel" then
	-- ===== Universel : anti-AFK + serveur =====
	local VU = game:GetService("VirtualUser")
	local TPS = game:GetService("TeleportService")
	local alive, conns = true, {}
	local gui = Instance.new("ScreenGui")
	gui.Name, gui.ResetOnSpawn, gui.DisplayOrder = "AbyssUniversal", false, 999
	gui.Parent = PG
	local win = Instance.new("Frame")
	win.Size, win.Position, win.BackgroundColor3, win.BorderColor3, win.BorderSizePixel = U2(0, 260, 0, 170), U2(0, 10, 0.5, -85), GREY, BLACK, 3
	win.Active, win.Parent = true, gui
	local lay = Instance.new("UIListLayout")
	lay.Padding, lay.Parent = UDim.new(0, 6), win
	local pad = Instance.new("UIPadding")
	pad.PaddingTop, pad.PaddingLeft, pad.PaddingRight, pad.Parent = UDim.new(0, 6), UDim.new(0, 6), UDim.new(0, 6), win
	local function item(class, text)
		local o = Instance.new(class)
		o.Size, o.BackgroundColor3, o.BorderColor3, o.BorderSizePixel = U2(1, 0, 0, 30), GREY, BLACK, 2
		o.Font, o.TextSize, o.TextColor3, o.Text, o.Parent = CODE, 13, BLACK, text, win
		return o
	end
	local status = item("TextLabel", "Anti-AFK : actif (0 kick evite)")
	local saved = 0
	-- Idled = Roblox va deconnecter pour inactivite : un clic virtuel remet le compteur a zero
	table.insert(conns, LP.Idled:Connect(function()
		if not alive then return end
		pcall(function()
			VU:CaptureController()
			VU:ClickButton2(Vector2.new())
		end)
		saved = saved + 1
		status.Text = "Anti-AFK : actif (" .. saved .. " kick evite)"
	end))
	item("TextButton", "Rejoindre ce serveur").MouseButton1Click:Connect(function()
		pcall(function() TPS:TeleportToPlaceInstance(game.PlaceId, game.JobId, LP) end)
	end)
	item("TextButton", "Autre serveur").MouseButton1Click:Connect(function()
		pcall(function() TPS:Teleport(game.PlaceId, LP) end)
	end)
	local function stopU()
		if not alive then return end
		alive = false
		for _, c in ipairs(conns) do c:Disconnect() end
		gui:Destroy()
		if G.AbyssStop == stopU then G.AbyssStop = nil end
	end
	item("TextButton", "Fermer").MouseButton1Click:Connect(stopU)
	G.AbyssStop = stopU
	return
end

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
]==]
pcall(function() game:GetService("StarterGui"):SetCore("SendNotification", { Title = "ABYSS PAINT", Text = "Partie 1/3 OK. Execute la partie 2.", Duration = 8 }) end)
