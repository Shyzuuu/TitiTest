-- ABYSS HUB // Delta Android. Verrou par code puis choix du jeu (DOORS, Universel). ASCII
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
local banner
local function nearestHide()
	local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
	local rooms = workspace:FindFirstChild("CurrentRooms")
	if not root or not rooms then return nil end
	local best
	for _, d in ipairs(rooms:GetDescendants()) do
		if HIDE[d.Name] and d:IsA("Model") then
			local okP, cf = pcall(d.GetPivot, d)
			if okP then
				local m = (cf.Position - root.Position).Magnitude
				if not best or m < best then best = m end
			end
		end
	end
	return best
end

-- Bandeau rouge clignotant en haut de l'ecran pendant le passage d'une entite qui chasse
local Banner = new("TextLabel", { AnchorPoint = Vector2.new(0.5, 0), Position = U2(0.5, 0, 0, 60), Size = U2(0, 420, 0, 54),
	BackgroundColor3 = RGB(170, 0, 0), BackgroundTransparency = 0.1, Font = ARC, TextSize = 22, TextColor3 = WHITE,
	TextStrokeTransparency = 0, TextWrapped = true, Text = "", Visible = false }, Gui)
border(Banner, 3)
local Flash = new("Frame", { Size = U2(1, 0, 1, 0), BackgroundColor3 = RED, BackgroundTransparency = 1, BorderSizePixel = 0,
	Active = false, ZIndex = 0 }, Gui)
local bannerId = 0
banner = function(n, tip)
	bannerId = bannerId + 1
	local id = bannerId
	Banner.Text = "!! " .. n .. " !!\n" .. tip
	Banner.Visible = true
	task.spawn(function()
		for k = 1, 16 do
			if not Alive or id ~= bannerId then return end
			Banner.BackgroundColor3 = (k % 2 == 0) and RGB(170, 0, 0) or RED
			Flash.BackgroundTransparency = (k <= 4 and k % 2 == 1) and 0.75 or 1
			task.wait(0.35)
		end
		if id == bannerId then Banner.Visible = false Flash.BackgroundTransparency = 1 end
	end)
end

local H = "Cache-toi !"
local Tips = { RUSH = H, AMBUSH = H, EYES = "Ne regarde pas !", SEEK = "Cours !", BLITZ = H, ["A-60"] = H, ["A-120"] = H, ["A-90"] = "Ne bouge plus !",
	SCREECH = "Regarde-le !", HALT = "Demi-tour au bleu." }
local last = {}
local function alert(n)
	if not Cfg.Alerts or not Tips[n] or (last[n] and os.clock() - last[n] < 6) then return end
	last[n] = os.clock()
	local tip = Tips[n]
	if RUN[n] then
		local m = nearestHide()
		tip = tip .. (m and (" Cachette a " .. math.floor(m) .. " m") or " Aucune cachette proche")
	end
	notify("! " .. n, tip, RED)
	if RUN[n] and Cfg.RushBanner and banner then banner(n, tip) end
end

local DUPE = { FakeDoor = true, DoorFake = true }
local function isDupe(o) return o:IsA("Model") and o:FindFirstChild("Hidden") ~= nil end
local function process(i)
	if not Alive or not i.Parent then return end
	-- la piece Hidden arrive parfois apres le modele (streaming) : on re-teste le parent
	if i.Name == "Hidden" and i.Parent and DUPE[i.Parent.Name] then return process(i.Parent) end
	if DUPE[i.Name] and not isDupe(i) then return end
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
	local lb, gv = d[2], i:GetAttribute("GoldValue")
	if gv then lb = lb .. " [" .. tostring(gv) .. "]" end
	if i:GetAttribute("Locked") then lb = lb .. " (verrou)" end
	track(i, d[1], lb)
	if d[1] == "Entities" then alert(d[2]) end
end
on(workspace.DescendantAdded, function(i) task.defer(process, i) end)
task.spawn(function()
	for n, i in ipairs(workspace:GetDescendants()) do
		process(i)
		if n % 400 == 0 then task.wait() end
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

local MAX, curFloor = 40, nil
loop(0.2, function()
	local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
	local list, total, doors = {}, 0, isDoors()
	local cur = tonumber(LP:GetAttribute("CurrentRoom"))
	for o, e in pairs(Track) do
		if not o.Parent or not e.part.Parent then
			untrack(o)
		else
			total = total + 1
			e.dist = root and (e.part.Position - root.Position).Magnitude or 0
			-- joueurs : DOORS seulement (coop)
			local vis = Cfg.Esp and Cfg["E_" .. e.cat] and e.dist <= Cfg.MaxDist and (e.cat ~= "Players" or doors)
			-- salle actuelle + porte suivante : limite de Highlights
			if vis and Cfg.RoomOnly and cur and e.room then vis = e.room == cur or (e.cat == "Doors" and e.room == cur + 1) end
			e.on = false
			if vis then
				e.s = CatInfo[e.cat][4] * 100000 + e.dist
				table.insert(list, e)
			end
		end
	end
	table.sort(list, function(a, b) return a.s < b.s end)
	for i = MAX + 1, #list do list[i] = nil end
	for i, e in ipairs(list) do
		local col = CatInfo[e.cat][3]
		e.on = true
		local t = e.label .. "\n[" .. math.floor(e.dist) .. "m]"
		if e.hum then t = t .. " " .. math.floor(e.hum.Health) .. "/" .. math.floor(e.hum.MaxHealth) .. "PV" end
		e.tx.Text = t
		if Cfg.Chams and i <= 24 then
			e.hl = e.hl or new("Highlight", { Adornee = e.cat == "Doors" and e.part or e.o, FillColor = col, OutlineColor = col,
				FillTransparency = 0.75, DepthMode = Enum.HighlightDepthMode.AlwaysOnTop }, Hold or e.o)
			e.hl.Enabled = true
		elseif e.hl then
			e.hl.Enabled = false
		end
	end
	for _, e in pairs(Track) do
		local want = e.on and Cfg.Labels
		if e.bb.Enabled ~= want then e.bb.Enabled = want end
		if not e.on and e.hl and e.hl.Enabled then e.hl.Enabled = false end
	end
	Status.Text = " ESP " .. (Cfg.Esp and "ON" or "OFF") .. " | cibles " .. total .. " | dessinees " .. #list .. " | salle " .. (cur or "?")
		.. " | " .. (curFloor or "?")
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
			if protLabel then protLabel.Text = "Protections : " .. protN .. " (" .. r[2] .. ")" end
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
local syncMods
for _, k in ipairs({ "AntiScreech", "AntiA90", "AntiHalt" }) do
	Apply[k] = function(v)
		if syncMods then syncMods() end
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
local Mods = game:GetService("ReplicatedStorage")
-- Vitesse prevue par DOORS : le bonus s'y ajoute (accroupi, modificateurs)
local function baseSpeed(ch, hum)
	if not isDoors() then return defSpeed end
	local lm = Mods:FindFirstChild("LiveModifiers")
	local function m(n) return lm and lm:FindFirstChild(n) ~= nil end
	local s = 15 + (m("PlayerFast") and 3 or 0) + (m("PlayerFaster") and 6 or 0) + (m("PlayerFastest") and 20 or 0) - (m("PlayerSlow") and 3 or 0)
	for _, a in ipairs({ "SpeedBoost", "SpeedBoostBehind", "SpeedBoostExtra" }) do s = s + (tonumber(ch:GetAttribute(a)) or 0) end
	if m("PlayerSlowHealth") then s = s - 0.075 * (hum.MaxHealth - hum.Health) end
	local cp = ch:FindFirstChild("CollisionPart")
	if ch:GetAttribute("Crouching") or (cp and cp.CollisionGroup == "PlayerCrouching") then
		s = s - ((m("PlayerCrouchSlow") or m("PlayerSlow")) and 8 or 5)
	end
	return s
end
on(RS.Heartbeat, function()
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
end)
-- Vitesse : on part de la valeur que le jeu ecrit lui-meme (accroupi, blessures, modificateurs, floors)
-- et on n'ajoute que le bonus. Anti-rollback : chaque recul force par le serveur retire 1 au bonus.
local speedHum, speedConn, gameSpeed, writing = nil, nil, nil, false
local lastPos, rbCut, rbLabel = nil, 0, nil
local function bonus()
	local b = Cfg.SafeSpeed and math.min(Cfg.SpeedV, 6) or Cfg.SpeedV
	return math.max(0, b - (Cfg.AntiRollback and rbCut or 0))
end
local function applySpeed()
	local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
	if not hum or hum.Health <= 0 or not Cfg.Speed then return end
	if hum ~= speedHum then
		if speedConn then speedConn:Disconnect() end
		speedHum, gameSpeed = hum, nil
		speedConn = hum:GetPropertyChangedSignal("WalkSpeed"):Connect(function()
			if not writing then gameSpeed = hum.WalkSpeed end
		end)
	end
	defSpeed = defSpeed or hum.WalkSpeed
	local want = (gameSpeed or baseSpeed(LP.Character, hum) or defSpeed) + bonus()
	if hum.WalkSpeed ~= want then
		writing = true
		hum.WalkSpeed = want
		writing = false
	end
end
table.insert(Cleanups, function() if speedConn then speedConn:Disconnect() end end)
-- Stepped = juste avant la physique : notre valeur est celle utilisee pour la frame
on(RS.Stepped, applySpeed)
on(RS.Heartbeat, function(dt)
	applySpeed()
	local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
	local root = hum and hum.RootPart
	-- cachette / siege : le jeu deplace le personnage lui-meme, ce n'est pas un rollback
	if not root or not Cfg.Speed or not Cfg.AntiRollback or LP.Character:GetAttribute("Hiding") then lastPos = nil return end
	local pos = root.Position
	if lastPos then
		-- saut impossible a cette vitesse en une frame = position corrigee par le serveur
		local limit = math.max(6, hum.WalkSpeed * (tonumber(dt) or 0.016) * 5)
		if (pos - lastPos).Magnitude > limit and not hum.Sit and bonus() > 0 then
			rbCut = rbCut + 1
			notify("Anti-rollback", "Recul detecte : bonus ramene a +" .. bonus() .. ".", NAVY)
			if rbLabel then rbLabel.Text = "Bonus effectif : +" .. bonus() .. " (rollbacks : " .. rbCut .. ")" end
		end
	end
	lastPos = pos
end)
Apply.SpeedV = function()
	rbCut = 0
	if rbLabel then rbLabel.Text = "Bonus effectif : +" .. bonus() end
end
Apply.SafeSpeed, Apply.AntiRollback = Apply.SpeedV, Apply.SpeedV
-- Anti-acceleration : densite 100 = plus de glisse
local physOld = {}
local function slide(ch)
	for p, old in pairs(physOld) do
		if p.Parent then p.CustomPhysicalProperties = old or nil end
		physOld[p] = nil
	end
	local r = Cfg.AntiSlide and Alive and ch and ch:FindFirstChild("HumanoidRootPart")
	if not r then return end
	local c = r.CurrentPhysicalProperties
	local pp = PhysicalProperties.new(100, c.Friction, c.Elasticity, c.FrictionWeight, c.ElasticityWeight)
	for _, p in ipairs(ch:GetDescendants()) do
		if p:IsA("BasePart") then
			physOld[p] = p.CustomPhysicalProperties or false
			p.CustomPhysicalProperties = pp
		end
	end
end
Apply.AntiSlide = function() slide(LP.Character) end
on(LP.CharacterAdded, function(ch)
	physOld = {}
	ch:WaitForChild("HumanoidRootPart", 10)
	slide(ch)
end)
local function lightOff() if not Cfg.Fullbright and not Cfg.NoFog then restore() end end
Apply.Fullbright, Apply.NoFog = lightOff, lightOff
Apply.Speed = function(v)
	local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
	if not v and hum then
		writing = true
		hum.WalkSpeed = gameSpeed or defSpeed or hum.WalkSpeed
		writing = false
	end
	if not v then defSpeed, lastPos = nil, nil end
end
on(LP.CharacterAdded, function() defSpeed, lastPos = nil, nil end)
table.insert(Cleanups, function()
	restore()
	Apply.Speed(false)
	slide(nil)
end)
RS:BindToRenderStep("AbyssPaintFov", Enum.RenderPriority.Camera.Value + 1, function()
	if Alive and Cfg.Fov and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = Cfg.FovV end
end)
Apply.Fov = function(v) if not v and workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView = 70 end end
table.insert(Cleanups, function()
	RS:UnbindFromRenderStep("AbyssPaintFov")
	Apply.Fov(false)
end)

-- ===== Protections : modules clients renommes (methode Abysall) =====
local MODS = {
	AntiScreech = { "Screech", "GlitchScreech" }, AntiA90 = { "A90" }, AntiDread = { "Dread" }, AntiHalt = { "Shade" },
	NoJumpscare = { "SpiderJumpscare", "Jumpscares" },
}
local renamed = {}
syncMods = function()
	-- a l'arret (Alive faux) plus rien n'est demande : tout reprend son nom d'origine
	local want, jumps = { SurgeVignette = Alive and Cfg.AntiSurge }, Alive and Cfg.NoJumpscare
	for key, list in pairs(MODS) do
		if Alive and Cfg[key] then for _, n in ipairs(list) do want[n] = true end end
	end
	for o, orig in pairs(renamed) do
		if not (want[orig] or (jumps and string.find(orig, "Jumpscare", 1, true))) then
			if o.Parent then o.Name = orig end
			renamed[o] = nil
		end
	end
	local mui = PG:FindFirstChild("MainUI")
	local roots = { mui and mui:FindFirstChild("RemoteListener", true), RSt:FindFirstChild("FloorReplicated") }
	for i = 1, 2 do
		for _, d in ipairs(roots[i] and roots[i]:GetDescendants() or {}) do
			local n = d.Name
			local jump = jumps and d.ClassName == "ModuleScript" and string.find(n, "Jumpscare", 1, true)
				and not string.find(n, "_Disabled", 1, true)
			if (want[n] or jump) and not renamed[d] then
				renamed[d] = n
				d.Name = n .. "_Disabled"
			end
		end
	end
	local sv = mui and mui:FindFirstChild("SurgeVignette", true)
	if want.SurgeVignette and sv and not renamed[sv] then
		renamed[sv] = "SurgeVignette"
		sv.Name = "SurgeVignette_Disabled"
	end
end
Apply.AntiDread, Apply.AntiSurge, Apply.NoJumpscare = syncMods, syncMods, syncMods

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
	if not key or not o.Parent or (DUPE[o.Name] and not isDupe(o)) then return end
	local act = Cfg[key] and Alive
	for _, p in ipairs(o:IsA("BasePart") and { o } or o:GetDescendants()) do
		if p:IsA("BasePart") then
			if touchOld[p] == nil then touchOld[p] = p.CanTouch end
			p.CanTouch = (not act) and touchOld[p]
			-- Vacuum : la salle piege devient un mur au lieu d'aspirer
			if key == "AntiVacuum" and p.Name == "Collision" then p.CanCollide = act and true or false end
		elseif p:IsA("ProximityPrompt") and key == "AntiDupe" then
			p.Enabled = not act
		end
	end
	Haz[o] = key
end
for _, key in pairs(HAZ) do
	Apply[key] = function() for o in pairs(Haz) do if o.Parent then hazard(o) end end end
end

-- ===== Suppression locale d'entites (Archives) =====
local KILL = { Alma = "AntiAlma", Ransom = "AntiRansom" }
local function killCheck(c)
	local n, key = c.Name, KILL[c.Name]
	local trash = string.sub(n, 1, 6) == "Binder" or string.sub(n, 1, 4) == "Shoe" or string.sub(n, 1, 5) == "Shelf"
	if (key and Cfg[key]) or (Cfg.AntiTrash and trash) then
		task.defer(function() if Alive and c.Parent then c:Destroy() end end)
	end
end
local function killAll() for _, c in ipairs(workspace:GetChildren()) do killCheck(c) end end
Apply.AntiAlma, Apply.AntiRansom, Apply.AntiTrash = killAll, killAll, killAll
on(workspace.ChildAdded, killCheck)
on(workspace.DescendantAdded, function(d)
	if HAZ[d.Name] then task.defer(hazard, d) end
	if d.Name == "Hidden" and d.Parent and DUPE[d.Parent.Name] then task.defer(hazard, d.Parent) end
	if d:IsA("BasePart") and d.Parent and HAZ[d.Parent.Name] then task.defer(hazard, d.Parent) end
	if Cfg.InstantPrompt and d:IsA("ProximityPrompt") then d.HoldDuration = 0 end
end)
task.spawn(function()
	for n, d in ipairs(workspace:GetDescendants()) do
		if HAZ[d.Name] then hazard(d) end
		if n % 500 == 0 then task.wait() end
	end
end)

-- ===== Auto-interaction : tiroirs, coffres, or et objets, a la portee normale du prompt =====
local CONTAINER = { DrawerContainer = 1, ChestBox = 1, Toolbox = 1, Locker_Small = 1, GoldPile = 1, StardustPickup = 1 }
local PICKUP = { KeyObtain = "Key", ElectricalKeyObtain = "KeyElectrical", LiveHintBook = 1, LiveBreakerPolePickup = 1, FuseObtain = 1,
	LibraryHintPaper = "LibraryHintPaper", LibraryHintPaperHard = "LibraryHintPaper" }
local Prompts = setmetatable({}, { __mode = "k" })
local fired = setmetatable({}, { __mode = "k" })
local function hasItem(n)
	local bp = LP:FindFirstChildOfClass("Backpack")
	return (LP.Character and LP.Character:FindFirstChild(n)) or (bp and bp:FindFirstChild(n))
end
local function promptPos(pr)
	local a = pr.Parent
	if not a then return nil end
	if a:IsA("Attachment") then return a.WorldPosition end
	if a:IsA("BasePart") then return a.Position end
	if a:IsA("Model") then
		local okP, cf = pcall(a.GetPivot, a)
		return okP and cf.Position or nil
	end
	return nil
end
-- Decide si un prompt est du butin : on remonte jusqu'a 4 parents pour trouver le tiroir / l'objet
local function lootTarget(pr)
	if not pr.Enabled or pr.ActionText == "Close" or pr.ActionText == "Fermer" then return false end
	local o = pr.Parent
	for _ = 1, 4 do
		if not o or o == workspace then return false end
		if DUPE[o.Name] or HIDE[o.Name] or o:GetAttribute("Locked") == true then return false end
		if CONTAINER[o.Name] then return true end
		local need = PICKUP[o.Name]
		if need then return Cfg.LootItems and (need == 1 or not hasItem(need)) end
		local d = Names[o.Name]
		if d and d[1] == "Items" and Cfg.LootItems then
			if o.Name == "Bandage" then
				local hum = LP.Character and LP.Character:FindFirstChildOfClass("Humanoid")
				return hum ~= nil and hum.Health < hum.MaxHealth
			end
			return true
		end
		o = o.Parent
	end
	return false
end
local function firePrompt(pr)
	if fireproximityprompt then
		fireproximityprompt(pr)
	else
		pr:InputHoldBegin()
		task.wait(pr.HoldDuration + 0.05)
		pr:InputHoldEnd()
	end
end
on(workspace.DescendantAdded, function(d) if d:IsA("ProximityPrompt") then Prompts[d] = true end end)
task.spawn(function()
	for n, d in ipairs(workspace:GetDescendants()) do
		if d:IsA("ProximityPrompt") then Prompts[d] = true end
		if n % 600 == 0 then task.wait() end
	end
end)
loop(0.15, function()
	if not Cfg.AutoLoot then return end
	local ch = LP.Character
	local root = ch and ch:FindFirstChild("HumanoidRootPart")
	if not root or ch:GetAttribute("Hiding") then return end
	local now = os.clock()
	for pr in pairs(Prompts) do
		if not pr.Parent then
			Prompts[pr] = nil
		elseif not fired[pr] or now - fired[pr] > 0.8 then
			local pos = promptPos(pr)
			-- portee du jeu (MaxActivationDistance) respectee : aucune extension de reach
			if pos and (pos - root.Position).Magnitude <= pr.MaxActivationDistance and lootTarget(pr) then
				fired[pr] = now
				task.spawn(firePrompt, pr)
			end
		end
	end
end)

-- ===== Archives / Honcho : le depot donne les numeros (BoxID), on retrouve les bons colis =====
CatInfo.Honcho = { "Honcho", "Colis Honcho", RGB(0, 255, 120), 1 }
Cfg.E_Honcho = true
local honchoLabel, honchoText = nil, ""
local HonchoTag = new("TextLabel", { AnchorPoint = Vector2.new(0.5, 0), Position = U2(0.5, 0, 0, 120), Size = U2(0, 360, 0, 34),
	BackgroundColor3 = RGB(0, 90, 40), TextColor3 = WHITE, Font = ARC, TextSize = 18, TextStrokeTransparency = 0,
	Text = "", Visible = false }, Gui)
border(HonchoTag, 3)
local function scanHoncho()
	local rooms = workspace:FindFirstChild("CurrentRooms")
	local ids, deposits, boxes = {}, {}, {}
	for _, room in ipairs(rooms and rooms:GetChildren() or {}) do
		if room:FindFirstChild("ArchivesHonchoRoom", true) then
			for _, d in ipairs(room:GetDescendants()) do
				if string.sub(d.Name, 1, 22) == "ArchivesPackageDeposit" and d:GetAttribute("BoxID") ~= nil then
					local id = tostring(d:GetAttribute("BoxID"))
					ids[id] = true
					deposits[id] = d
				elseif d.Name == "ArchivesStorageBox" and d:GetAttribute("Tool_BoxID") ~= nil then
					table.insert(boxes, d)
				end
			end
		end
	end
	local list = {}
	for id in pairs(ids) do table.insert(list, id) end
	table.sort(list, function(a, b) return (tonumber(a) or 0) < (tonumber(b) or 0) end)
	if Cfg.Honcho then
		for id, d in pairs(deposits) do
			if not Track[d] then track(d, "Honcho", "DEPOT #" .. id) end
		end
		for _, b in ipairs(boxes) do
			local id = tostring(b:GetAttribute("Tool_BoxID"))
			local e = Track[b]
			if ids[id] and (not e or e.cat ~= "Honcho") then
				-- re-etiquetage : la meme boite passe de "Boite" a "BON COLIS #id"
				if e then untrack(b) end
				track(b, "Honcho", "BON COLIS #" .. id)
			end
		end
	end
	local txt = #list > 0 and ("Colis a recuperer : #" .. table.concat(list, ", #")) or ""
	if txt ~= honchoText then
		honchoText = txt
		if txt ~= "" and Cfg.Honcho then notify("Honcho", txt, GREEN) end
	end
	HonchoTag.Text = txt
	HonchoTag.Visible = Cfg.Honcho and txt ~= ""
	if honchoLabel then honchoLabel.Text = txt ~= "" and txt or "Aucune salle Honcho en cours." end
	return deposits
end
Apply.Honcho = function() scanHoncho() end
-- Depot auto : colis tenu en main pose sur son depot, a la portee normale du prompt
local function honchoDeposit(deposits)
	local ch = LP.Character
	local root = ch and ch:FindFirstChild("HumanoidRootPart")
	if not root then return end
	for _, t in ipairs(ch:GetChildren()) do
		local id = t:GetAttribute("Tool_BoxID") or t:GetAttribute("BoxID")
		local dep = id ~= nil and deposits[tostring(id)]
		local pr = dep and dep:FindFirstChildWhichIsA("ProximityPrompt", true)
		local pos = pr and promptPos(pr)
		if pos and pr.Enabled and (pos - root.Position).Magnitude <= pr.MaxActivationDistance then firePrompt(pr) end
	end
end
loop(1, function()
	local deposits = scanHoncho()
	if Cfg.HonchoAuto then honchoDeposit(deposits) end
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
	if Alive and Cfg.HideSeeThrough and ch and ch:GetAttribute("Hiding") then
		local rooms = workspace:FindFirstChild("CurrentRooms")
		for _, d in ipairs(rooms and rooms:GetDescendants() or {}) do
			if d.Name == "HiddenPlayer" and d:IsA("ObjectValue") and d.Value == ch then
				local m = d.Parent
				while m and m.Parent and not HIDE[m.Name] do m = m.Parent end
				for _, pt in ipairs((m or d.Parent):GetDescendants()) do
					if pt:IsA("BasePart") then want[pt] = true end
				end
				break
			end
		end
	end
	for pt in pairs(hideParts) do
		if not want[pt] then pt.LocalTransparencyModifier = 0 hideParts[pt] = nil end
	end
	for pt in pairs(want) do pt.LocalTransparencyModifier = 0.6 hideParts[pt] = true end
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
on(LP.CharacterAdded, function()
	jumpOld = nil
	task.wait(1)
	if Cfg.Jump then Apply.Jump(true) end
end)
Apply.InstantPrompt = function(v)
	if not v then return end
	for _, d in ipairs(workspace:GetDescendants()) do if d:IsA("ProximityPrompt") then d.HoldDuration = 0 end end
end
on(PPS.PromptButtonHoldBegan, function(pr) if Cfg.InstantPrompt then pr.HoldDuration = 0 end end)
local vigOld = {}
local function vignette()
	local mui = PG:FindFirstChild("MainUI")
	local v = mui and mui:FindFirstChild("HideVignette", true)
	if not v then return end
	if Alive and Cfg.NoVignette then
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
		local okR, m = pcall(require, mg)
		shakeMod = (okR and type(m) == "table") and m or false
	end
	if shakeMod then shakeMod.csgo = CFrame.new() end
end)

local infoLabel, floorLabel
local floorAuto, lastCode, lastOxy, lastHaste = nil, nil, nil, nil
loop(1, function()
	syncMods()
	vignette()
	seeThrough()
	-- active une seule fois la categorie ESP du floor detecte
	local f = floorOf(rawFloor())
	curFloor = f or rawFloor()
	if f and floorAuto ~= f then
		floorAuto = f
		set("E_F_" .. f, true)
	end
	if floorLabel then floorLabel.Text = "Floor detecte : " .. (f or rawFloor() or "inconnu") end
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
	local code = Cfg.LibCode and libraryCode()
	if code and code ~= lastCode and not string.find(code, "_", 1, true) then notify("Code bibliotheque", code, GREEN) end
	lastCode = code or nil
	if infoLabel then
		infoLabel.Text = "Oxygene : " .. (oxy and math.floor(oxy) or "-") .. " | Haste : " .. (dt and fmt(dt.Value) or "-")
			.. " | Code : " .. (code or "-")
	end
end)
table.insert(Cleanups, function()
	syncMods()
	for o in pairs(Haz) do if o.Parent then pcall(hazard, o) end end
	vignette()
	seeThrough()
	Apply.Jump(false)
	if shakeMod then shakeMod.csgo = CFrame.new() end
end)
-- Crucifix : gel, cercle, chaines, debattement, aspiration, eclair
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
			phase(0.5, function(t)
				place(cf0 * CFrame.new((math.random() - 0.5) * 0.2, 0, (math.random() - 0.5) * 0.2))
				drawChains(t, cf0.Position)
			end)
			phase(0.6, function(t)
				local amp = 0.25 + t * 0.5
				place(cf0 * CFrame.new((math.random() - 0.5) * amp, 0, (math.random() - 0.5) * amp))
				light.Brightness = 8 + math.sin(t * 40) * 4
				drawChains(1, cf0.Position)
			end)
			phase(1.2, function(t)
				local ease = t * t
				local cf = cf0 * CFrame.new(0, -(h + 2) * ease, 0) * CFrame.Angles(0, ease * 6, 0)
				place(cf)
				drawChains(1, cf.Position)
				for _, p in ipairs(parts) do if p.Parent then p.LocalTransparencyModifier = ease end end
			end)
			light.Brightness, light.Range = 25, R * 5
			task.wait(0.08)
			tween(ring, 0.4, { Size = V3(0.15, 0.2, 0.2), Transparency = 1 })
			tween(light, 0.4, { Brightness = 0 })
			for _, c in ipairs(chains) do for _, l in ipairs(c.links) do tween(l, 0.3, { Transparency = 1 }) end end
			task.wait(0.4)
		end)
		if target.Parent then target:Destroy() end
		fx:Destroy()
		busy = false
		if crossLabel then crossLabel.Text = okA and "Cible bannie" or ("Erreur : " .. tostring(e)) end
	end)
end
local function topModel(p)
	local rooms = workspace:FindFirstChild("CurrentRooms")
	while p.Parent and p.Parent ~= workspace and p.Parent:IsA("Model") and not (rooms and p.Parent.Parent == rooms) do p = p.Parent end
	return p
end
local function useCross()
	if busy then return notify("Crucifix", "Occupe...") end
	local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
	if not root then return end
	local target
	local tap = LP:GetMouse().Target
	if Cfg.CrossAny and tap then
		local m = topModel(tap)
		-- seulement un monstre / une entite : viser le sol ou un mur le detruisait localement
		local e = Track[m]
		if m:FindFirstChildOfClass("Humanoid") or (e and (e.cat == "Entities" or e.cat == "Monsters")) then target = m end
	end
	if not target then
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
		local function wood(sz, cf, par)
			return new("Part", { Size = sz, Material = Enum.Material.Wood, Color = RGB(110, 70, 40), CanCollide = false, Massless = true, CFrame = cf }, par)
		end
		held = wood(V3(0.25, 1.6, 0.25), hand.CFrame * CFrame.new(0, -0.9, -0.3))
		local bar = wood(V3(0.9, 0.25, 0.25), held.CFrame * CFrame.new(0, 0.35, 0), held)
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
	notify("Crucifix", "Equipe-le, touche le monstre.")
end
table.insert(Cleanups, function() if crossTool then crossTool:Destroy() end end)

-- ===== Police d'ecriture =====
-- "DOORS" = la police exacte du jeu, lue sur les textes de son interface (MainUI) : police importee
-- par le jeu (famille rbxassetid), donc identique a celle du logo / des captions.
local FONTS = { { "DOORS (police du jeu)" }, { "Paint (Code)" }, { "Arcade", Enum.Font.Arcade }, { "Oswald", Enum.Font.Oswald },
	{ "Gotham", Enum.Font.GothamBold }, { "Cartoon", Enum.Font.Cartoon }, { "Bangers", Enum.Font.Bangers } }
local doorsFace
local function findDoorsFont()
	if doorsFace then return doorsFace end
	local count, best, bestN = {}, nil, 0
	for _, gui in ipairs(PG:GetChildren()) do
		if gui ~= Gui and gui ~= Boot and gui:IsA("ScreenGui") then
			for _, d in ipairs(gui:GetDescendants()) do
				if d:IsA("TextLabel") or d:IsA("TextButton") then
					local okF, face = pcall(function() return d.FontFace end)
					local fam = okF and face and tostring(face.Family) or ""
					-- police importee par le jeu : la plus utilisee dans son interface
					if string.find(fam, "rbxassetid", 1, true) then
						count[fam] = (count[fam] or 0) + 1
						if count[fam] > bestN then best, bestN = face, count[fam] end
					end
				end
			end
		end
	end
	doorsFace = best
	return best
end
local fontBtn
local function applyFont()
	local f = FONTS[Cfg.FontIdx]
	local face
	if Cfg.FontIdx == 1 then
		face = findDoorsFont()
	elseif f[2] then
		face = Font.fromEnum(f[2])
	end
	curFace = face
	for o, orig in pairs(Texts) do
		if o.Parent then
			pcall(function()
				if face then o.FontFace = face else o.Font = orig end
			end)
		end
	end
	if fontBtn then
		fontBtn.Text = "Police : " .. f[1] .. ((Cfg.FontIdx == 1 and not face) and " (en attente du jeu)" or "")
	end
	return face
end
-- la MainUI de DOORS arrive parfois apres le script : on reessaie jusqu'a trouver la police
loop(2, function()
	if Cfg.FontIdx == 1 and not doorsFace and findDoorsFont() then applyFont() end
end)

local P = page("ESP")
section(P, "Affichage")
toggle(P, "ESP actif", "Esp")
toggle(P, "Etiquettes 3D", "Labels")
toggle(P, "Chams (contours)", "Chams")
stepper(P, "Distance max", "MaxDist", 50, 2000, 50)
toggle(P, "Salle actuelle seulement", "RoomOnly")
section(P, "Categories")
for _, c in ipairs(Cats) do toggle(P, c[2], "E_" .. c[1], c[3]) end
button(P, "Tester l'ESP (cible 10s)", function()
	local root = LP.Character and LP.Character:FindFirstChild("HumanoidRootPart")
	if not root then return notify("ESP", "Pas de personnage.") end
	local t = new("Part", { Name = "AbyssEspTest", Anchored = true, CanCollide = false, Size = V3(2, 4, 2), Material = Enum.Material.Neon,
	Color = RED, CFrame = root.CFrame * CFrame.new(0, 0, -10) }, workspace)
	set("E_Monsters", true)
	track(t, "Monsters", "TEST ESP")
	notify("ESP", "Cible TEST ESP devant toi.")
	task.delay(10, function() t:Destroy() end)
end)
label(P, "Joueurs : DOORS seulement.")
P = page("Monde")
section(P, "Lumiere")
toggle(P, "Fullbright", "Fullbright")
toggle(P, "Sans brouillard", "NoFog")
section(P, "Mouvement")
toggle(P, "Speed", "Speed")
stepper(P, "Bonus vitesse", "SpeedV", 1, 60, 1)
toggle(P, "Vitesse sure (bonus max +6)", "SafeSpeed")
toggle(P, "Anti-rollback (bonus auto)", "AntiRollback")
rbLabel = label(P, "Bonus effectif : +5")
label(P, "Anti-rollback : a chaque recul force par le serveur, le bonus baisse de 1 jusqu'a ne plus etre ramene en arriere. Changer le bonus remet le compteur a zero.")
toggle(P, "Anti-acceleration (anti-glisse)", "AntiSlide")
section(P, "Camera")
toggle(P, "FOV", "Fov")
stepper(P, "FOV", "FovV", 70, 120, 5)
P = page("Floors")
section(P, "Floor")
floorLabel = label(P, "Floor detecte : ?")
for _, f in ipairs(FLOORS) do toggle(P, "ESP floor " .. f[1], "E_F_" .. f[1], f[3]) end
label(P, "La categorie du floor detecte s'active toute seule.")
P = page("Entites")
section(P, "Alertes")
toggle(P, "Alertes (+ cachette proche)", "Alerts")
toggle(P, "Bandeau rouge Rush / A-60...", "RushBanner")
section(P, "Supprimer")
toggle(P, "Anti-Screech", "AntiScreech")
toggle(P, "Anti-A90", "AntiA90")
toggle(P, "Anti-Halt", "AntiHalt")
toggle(P, "Anti-Dread", "AntiDread")
toggle(P, "Anti-Surge", "AntiSurge")
toggle(P, "Sans jumpscares", "NoJumpscare")
section(P, "Contact coupe")
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
section(P, "Archives")
toggle(P, "Anti-Alma", "AntiAlma")
toggle(P, "Anti-Ransom", "AntiRansom")
toggle(P, "Anti-dechets placard", "AntiTrash")
label(P, "A-60 / A-120 / Rush : alerte + distance de la cachette la plus proche.")
protLabel = label(P, "Protections : 0")
P = page("Auto")
section(P, "Auto-interaction")
toggle(P, "Auto-interaction (tiroirs, coffres, or)", "AutoLoot")
toggle(P, "Ramasser aussi objets et cles", "LootItems")
label(P, "Approche-toi : tiroirs et coffres s'ouvrent, le contenu est ramasse. Portee normale du jeu, ignore les fausses portes, cachettes et verrous.")
P = page("Archives")
section(P, "Honcho")
toggle(P, "Numeros des colis a recuperer", "Honcho")
toggle(P, "Depot auto du colis tenu", "HonchoAuto")
honchoLabel = label(P, "Aucune salle Honcho en cours.")
label(P, "Les bons colis sont marques BON COLIS #numero (vert), les depots DEPOT #numero. Le numero s'affiche aussi en haut de l'ecran.")
P = page("Infos")
section(P, "Infos")
infoLabel = label(P, "Oxygene : - | Haste : - | Code : -")
toggle(P, "Notif oxygene", "Oxygen")
toggle(P, "Notif minuteur Haste", "Haste")
toggle(P, "Code bibliotheque", "LibCode")
P = page("Perso")
section(P, "Personnage")
toggle(P, "Saut active", "Jump")
toggle(P, "Prompts instantanes", "InstantPrompt")
toggle(P, "Sans tremblement camera", "NoShake")
toggle(P, "Cachette transparente", "HideSeeThrough")
toggle(P, "Sans vignette cachette", "NoVignette")
P = page("Crucifix")
section(P, "Crucifix")
button(P, "Obtenir le crucifix", giveCross)
toggle(P, "Viser ce que je touche", "CrossAny")
stepper(P, "Portee", "CrossRange", 10, 300, 10)
crossLabel = label(P, "Visuel local.")
P = page("Script")
section(P, "Style")
button(P, "Police : DOORS (police du jeu)", function()
	set("FontIdx", Cfg.FontIdx % #FONTS + 1)
	applyFont()
end)
for _, d in ipairs(P:GetDescendants()) do
	if d:IsA("TextButton") and string.sub(d.Text, 1, 8) == "Police :" then fontBtn = d end
end
label(P, "Touche pour changer la police de tout le script. DOORS = exactement la police du jeu.")
section(P, "Script")
label(P, "Abyss Paint - DOORS. Bouton PAINT : deplacable, appui = ouvrir / fermer. Palette en bas : couleur du titre.")
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
applyFont()
notify("ABYSS PAINT", "Charge ! Bouton PAINT.")
end)

if ok then
	Boot:Destroy()
else
	BootTxt.Size, BootTxt.Position = U2(0, 440, 0, 90), U2(0.5, -220, 0, 30)
	BootTxt.BackgroundColor3, BootTxt.TextColor3 = RED, WHITE
	BootTxt.Text = "ABYSS ERREUR (envoie ce texte) :\n" .. tostring(err)
	warn("[Abyss] " .. tostring(err))
end
