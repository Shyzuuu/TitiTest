-- ABYSS PAINT : partie 3/3 (derniere). Lance le script complet.
local G = (getgenv and getgenv()) or _G
G.AbyssSrc = G.AbyssSrc or {}
G.AbyssSrc[3] = [==[					table.insert(boxes, d)
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
]==]
local missing = {}
for k = 1, 3 do if not G.AbyssSrc[k] then table.insert(missing, k) end end
if #missing > 0 then
	-- partie oubliee : on le dit a l'ecran au lieu d'echouer en silence
	pcall(function() game:GetService("StarterGui"):SetCore("SendNotification", { Title = "ABYSS PAINT", Text = "Il manque la partie " .. table.concat(missing, ", ") .. ". Recommence a la partie 1.", Duration = 8 }) end)
	return
end
local src = table.concat(G.AbyssSrc)
G.AbyssSrc = nil
local fn, err = loadstring(src, "=AbyssPaint")
if not fn then
	pcall(function() game:GetService("StarterGui"):SetCore("SendNotification", { Title = "ABYSS PAINT", Text = "Erreur : " .. tostring(err), Duration = 8 }) end)
	warn("[Abyss] " .. tostring(err))
	return
end
-- meme environnement que la partie collee (indispensable hors executeur, sans effet sur Delta)
if setfenv and getfenv then pcall(setfenv, fn, getfenv(1)) end
fn()
