-- ABYSS PAINT : partie 2/3. Execute les 3 parties dans l'ordre (1, 2, 3...).
local G = (getgenv and getgenv()) or _G
G.AbyssSrc = G.AbyssSrc or {}
G.AbyssSrc[2] = [==[local banner
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
]==]
pcall(function() game:GetService("StarterGui"):SetCore("SendNotification", { Title = "ABYSS PAINT", Text = "Partie 2/3 OK. Execute la partie 3.", Duration = 8 }) end)
