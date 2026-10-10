--!nocheck
-- Tests des floors et protections fusionnes dans Abyss Paint. Lancer via doors/tests/run_tests.sh
local Mock = require("./roblox_mock")
local paint = require("./_paint_src")

local results, failures = {}, 0
local function check(name, cond, detail)
    table.insert(results, { name = name, ok = cond and true or false, detail = detail })
    if not cond then failures = failures + 1 end
end

local W, LP, new, RSt = Mock.Workspace, Mock.LP, Mock.new, Mock.ReplicatedStorage
-- Monde DOORS minimal : floor Mines, salle 12, ancre et cachette
local gd = new("Folder", { Name = "GameData" })
new("StringValue", { Name = "Floor", Value = "Mines" }).Parent = gd
gd.Parent = RSt
local rooms = new("Folder", { Name = "CurrentRooms" })
local room = new("Model", { Name = "12" })
local anchor = new("Model", { Name = "MinesAnchor" })
new("Part", { Name = "Base", CFrame = Mock.CF(0, 2, -15) }).Parent = anchor
anchor.Parent = room
local locker = new("Model", { Name = "Locker_Large" })
new("Part", { Name = "Body", CFrame = Mock.CF(0, 3, -8) }).Parent = locker
locker.Parent = room
room.Parent = rooms
rooms.Parent = W
-- Interface du jeu : modules clients a renommer
local mui = new("ScreenGui", { Name = "MainUI" })
local init = new("Folder", { Name = "Initiator" })
local mg = new("Folder", { Name = "Main_Game" })
local rl = new("Folder", { Name = "RemoteListener" })
local mods = new("Folder", { Name = "Modules" })
for _, n in ipairs({ "Screech", "A90", "Dread", "SpiderJumpscare" }) do new("ModuleScript", { Name = n }).Parent = mods end
mods.Parent = rl
rl.Parent = mg
mg.Parent = init
init.Parent = mui
-- texte du jeu avec sa police importee (celle du logo DOORS)
new("TextLabel", { Name = "Caption", Text = "ROOM 001", FontFace = { Family = "rbxassetid://doorsfont" } }).Parent = mui
new("TextLabel", { Name = "Other", Text = "x", FontFace = { Family = "rbxasset://fonts/families/GothamSSm.json" } }).Parent = mui
mui.Parent = LP.PlayerGui

Mock.exec(paint, "AbyssPaint", (Mock.env()))
Mock.run(1.5)
check("Script unique charge sans erreur", #Mock.errors == 0, table.concat(Mock.errors, "\n"))
local gui = LP.PlayerGui:FindFirstChild("AbyssPaint")
check("Interface creee, bandeau retire", gui ~= nil and LP.PlayerGui:FindFirstChild("AbyssBoot") == nil)
local tabs = 0
for _, d in ipairs(gui:GetDescendants()) do if d.ClassName == "ScrollingFrame" then tabs = tabs + 1 end end
check("10 onglets + barre laterale defilante", tabs == 11, tostring(tabs))

local function texts()
    local out = {}
    for _, d in ipairs(gui:GetDescendants()) do
        if d.ClassName == "TextLabel" and d.Text ~= "" then table.insert(out, d.Text) end
    end
    return table.concat(out, " || ")
end
local function click(text)
    for _, d in ipairs(gui:GetDescendants()) do
        if d.ClassName == "TextButton" and string.find(d.Text, text, 1, true) then
            d.MouseButton1Click:Fire()
            return
        end
    end
    check("bouton '" .. text .. "' present", false)
end
local function tag(part)
    local hold = Mock.CoreGui:FindFirstChild("AbyssEsp")
    for _, d in ipairs(hold and hold:GetChildren() or {}) do
        if d.ClassName == "BillboardGui" and d.Adornee == part then return d.Enabled, d:FindFirstChildWhichIsA("TextLabel").Text end
    end
    return false, ""
end

local function titleFont()
    for _, d in ipairs(gui:GetDescendants()) do
        if d.ClassName == "TextLabel" and string.find(d.Text, "ABYSS PAINT.EXE", 1, true) then return d end
    end
end
local tl = titleFont()
check("Police DOORS du jeu appliquee au script", tl and tl.FontFace and tl.FontFace.Family == "rbxassetid://doorsfont",
    tl and tl.FontFace and tl.FontFace.Family)
local fbtn
for _, d in ipairs(gui:GetDescendants()) do
    if d.ClassName == "TextButton" and string.find(d.Text, "Police :", 1, true) then fbtn = d end
end
check("Bouton police affiche DOORS", fbtn and fbtn.Text == "Police : DOORS (police du jeu)", fbtn and fbtn.Text)
click("Police :")
Mock.run(0.1)
check("Police Paint : police d'origine rendue", tl.Font == Mock.Enum.Font.Arcade, tostring(tl.Font))
click("Police :")
Mock.run(0.1)
check("Police Arcade : FontFace changee", tl.FontFace.Family == "enum:" .. tostring(Mock.Enum.Font.Arcade), tostring(tl.FontFace.Family))
for _ = 1, 5 do click("Police :") end
Mock.run(0.1)
check("Retour a la police DOORS apres un tour complet", tl.FontFace.Family == "rbxassetid://doorsfont", tostring(tl.FontFace.Family))
check("Floor detecte : Mines", string.find(texts(), "Floor detecte : Mines", 1, true) ~= nil, texts())
check("Barre d'etat : floor affiche", string.find(texts(), "| Mines", 1, true) ~= nil, texts())
Mock.run(0.6)
local on1, t1 = tag(anchor.Base)
check("ESP floor Mines actif d'office : Ancre", on1 and string.find(t1, "Ancre", 1, true) ~= nil, t1)
click("ESP floor Mines")
Mock.run(0.4)
check("ESP floor Mines desactivable", not tag(anchor.Base))
click("ESP floor Mines")

-- Balayage : chaque bouton deux fois sans erreur
local all = {}
for _, d in ipairs(gui:GetDescendants()) do
    if d.ClassName == "TextButton" and d.Text ~= "X" and not string.find(d.Text, "Fermer", 1, true) then table.insert(all, d) end
end
for _, b in ipairs(all) do b.MouseButton1Click:Fire() Mock.run(0.05) b.MouseButton1Click:Fire() Mock.run(0.05) end
Mock.run(11)
check(#all .. " boutons cliques deux fois sans erreur", #Mock.errors == 0, table.concat(Mock.errors, "\n"))

-- Modules renommes puis restaures
click("Anti-Screech")
click("Sans jumpscares")
Mock.run(1.2)
check("Anti-Screech : module renomme", mods:FindFirstChild("Screech_Disabled") ~= nil and mods:FindFirstChild("Screech") == nil)
check("Sans jumpscares : SpiderJumpscare renomme", mods:FindFirstChild("SpiderJumpscare_Disabled") ~= nil)
Mock.run(2.2)
check("Pas d'aller-retour de nom", mods:FindFirstChild("SpiderJumpscare_Disabled") ~= nil and mods:FindFirstChild("Screech_Disabled") ~= nil)
check("A90 non touche si inactif", mods:FindFirstChild("A90") ~= nil)
click("Anti-Screech")
Mock.run(1.2)
check("Anti-Screech coupe : nom restaure", mods:FindFirstChild("Screech") ~= nil)

-- Contact coupe : Giggle
click("Anti-Giggle")
local giggle = new("Model", { Name = "GiggleCeiling" })
local hit = new("Part", { Name = "Hitbox", CanTouch = true })
hit.Parent = giggle
giggle.Parent = room
Mock.run(0.3)
check("Anti-Giggle : hitbox sans contact", hit.CanTouch == false)
click("Anti-Giggle")
Mock.run(0.1)
check("Anti-Giggle coupe : contact restaure", hit.CanTouch == true)

-- Archives : Alma supprimee localement
click("Anti-Alma")
local alma = new("Model", { Name = "Alma" })
alma.Parent = W
Mock.run(0.2)
check("Anti-Alma : supprimee", alma.Parent == nil)

-- Alerte A-60 avec cachette la plus proche (casier a 8 m)
local a60 = new("Model", { Name = "A60" })
a60.Parent = W
Mock.run(0.2)
check("Alerte A-60 + distance cachette", string.find(texts(), "Cachette a 8 m", 1, true) ~= nil, texts())
a60:Destroy()

-- Saut : attribut CanJump active puis restaure
click("Saut active")
Mock.run(0.1)
check("Saut active", LP.Character:GetAttribute("CanJump") == true)
click("Saut active")
Mock.run(0.1)
check("Saut restaure", LP.Character:GetAttribute("CanJump") == false)

-- Code bibliotheque : symboles du papier compares aux indices
local paper = new("Tool", { Name = "LibraryHintPaper" })
local ui = new("Folder", { Name = "UI" })
local perm = new("ScreenGui", { Name = "PermUI" })
local hints = new("Folder", { Name = "Hints" })
local digits = { "4", "1", "7", "0", "9" }
for i = 1, 5 do
    new("ImageLabel", { Name = tostring(i), ImageRectOffset = Mock.V3(i * 10, 0, 0) }).Parent = ui
    local h = new("ImageLabel", { Name = "H" .. i, ImageRectOffset = Mock.V3(i * 10, 0, 0) })
    new("TextLabel", { Text = digits[i] }).Parent = h
    h.Parent = hints
end
ui.Parent = paper
paper.Parent = LP.Backpack
hints.Parent = perm
perm.Parent = LP.PlayerGui
click("Code bibliotheque")
Mock.run(1.2)
check("Code bibliotheque resolu : 41709", string.find(texts(), "41709", 1, true) ~= nil, texts())

-- Auto-interaction : tiroir ouvert puis or ramasse, a la portee normale uniquement
local drawer = new("Model", { Name = "DrawerContainer" })
local knob = new("Part", { Name = "Knobs", CFrame = Mock.CF(2, 2, -4) })
knob.Parent = drawer
local dprompt = new("ProximityPrompt", { Name = "ActivateEventPrompt", ActionText = "Open" })
dprompt.Parent = knob
drawer.Parent = room
local far = new("Model", { Name = "DrawerContainer" })
local farKnob = new("Part", { Name = "Knobs", CFrame = Mock.CF(0, 2, -60) })
farKnob.Parent = far
local fprompt = new("ProximityPrompt", { Name = "ActivateEventPrompt", ActionText = "Open" })
fprompt.Parent = farKnob
far.Parent = room
local gold = new("Model", { Name = "GoldPile" })
local coin = new("Part", { Name = "Hitbox", CFrame = Mock.CF(1, 1, -3) })
coin.Parent = gold
local gprompt = new("ProximityPrompt", { Name = "LootPrompt" })
gprompt.Parent = coin
gold.Parent = drawer
local wardrobe = new("Model", { Name = "Wardrobe" })
local wpart = new("Part", { Name = "Main", CFrame = Mock.CF(0, 2, -2) })
wpart.Parent = wardrobe
local hprompt = new("ProximityPrompt", { Name = "HidePrompt" })
hprompt.Parent = wpart
wardrobe.Parent = room
local fakeD = new("Model", { Name = "DoorFake" })
new("Part", { Name = "Hidden", CFrame = Mock.CF(0, 3, -5) }).Parent = fakeD
local fdp = new("Part", { Name = "Lock", CFrame = Mock.CF(0, 3, -5) })
fdp.Parent = fakeD
local dupePrompt = new("ProximityPrompt", { Name = "UnlockPrompt" })
dupePrompt.Parent = fdp
fakeD.Parent = room
Mock.run(0.3)
click("Auto-interaction (tiroirs")
Mock.run(1)
check("Auto : tiroir proche ouvert", (Mock.fired[dprompt] or 0) >= 1)
check("Auto : or du tiroir ramasse", (Mock.fired[gprompt] or 0) >= 1)
check("Auto : tiroir hors portee ignore", Mock.fired[fprompt] == nil)
check("Auto : cachette jamais declenchee", Mock.fired[hprompt] == nil)
check("Auto : fausse porte (Dupe) jamais declenchee", Mock.fired[dupePrompt] == nil)
click("Auto-interaction (tiroirs")

-- Dupe : une vraie porte nommee FakeDoor sans piece Hidden n'est pas marquee DUPE
local notDupe = new("Model", { Name = "FakeDoor" })
local nd = new("Part", { Name = "Frame", CFrame = Mock.CF(4, 3, -6) })
nd.Parent = notDupe
notDupe.Parent = room
Mock.run(0.6)
check("Pas de faux DUPE sans piece Hidden", not tag(nd))
local late = new("Model", { Name = "DoorFake" })
local lp = new("Part", { Name = "Body", CFrame = Mock.CF(-4, 3, -6) })
lp.Parent = late
late.Parent = room
Mock.run(0.3)
new("Part", { Name = "Hidden", CFrame = Mock.CF(-4, 3, -6) }).Parent = late
Mock.run(0.6)
local lon, ltxt = tag(lp)
check("Vraie Dupe detectee meme si Hidden arrive en retard", lon and string.find(ltxt, "DUPE", 1, true) ~= nil, ltxt)

-- Rush : bandeau rouge en haut de l'ecran
local rush = new("Model", { Name = "RushMoving" })
new("Part", { Name = "RushNew", CFrame = Mock.CF(0, 3, -40) }).Parent = rush
rush.Parent = W
Mock.run(0.3)
local bannerOn = false
for _, d in ipairs(gui:GetDescendants()) do
    if d.ClassName == "TextLabel" and d.Visible and string.find(d.Text, "!! RUSH !!", 1, true) then bannerOn = true end
end
check("Bandeau rouge RUSH affiche", bannerOn, texts())
Mock.run(7)
local bannerOff = true
for _, d in ipairs(gui:GetDescendants()) do
    if d.ClassName == "TextLabel" and d.Visible and string.find(d.Text, "!! RUSH !!", 1, true) then bannerOff = false end
end
check("Bandeau RUSH retire apres le passage", bannerOff)
rush:Destroy()

-- Vitesse : valeur ecrite par le jeu + bonus ; anti-rollback baisse le bonus a chaque recul
local hum, hrp = LP.Character.Humanoid, LP.Character.HumanoidRootPart
click("     Speed")
Mock.run(0.3)
local base = hum.WalkSpeed
check("Speed actif : 15 + bonus 5", base == 20, tostring(base))
hum.WalkSpeed = 10 -- le jeu passe en accroupi
Mock.run(0.2)
check("Vitesse du jeu captee : 10 + 5", hum.WalkSpeed == 15, tostring(hum.WalkSpeed))
hrp.CFrame = Mock.CF(0, 3, 0)
Mock.run(0.2)
hrp.CFrame = Mock.CF(0, 3, 30) -- recul de 30 studs en une frame : rollback serveur
Mock.run(0.2)
check("Anti-rollback : bonus ramene a +4", hum.WalkSpeed == 14, tostring(hum.WalkSpeed))
check("Anti-rollback : compteur affiche", string.find(texts(), "rollbacks : 1", 1, true) ~= nil, texts())
click("     Speed")
Mock.run(0.2)
check("Speed coupe : vitesse du jeu remise", hum.WalkSpeed == 10, tostring(hum.WalkSpeed))

-- Honcho (Archives) : numero du bon colis
local hroom = new("Model", { Name = "40" })
local honcho = new("Model", { Name = "ArchivesHonchoRoom" })
honcho.Parent = hroom
local dep = new("Model", { Name = "ArchivesPackageDeposit" })
dep:SetAttribute("BoxID", 7)
new("Part", { Name = "Slot", CFrame = Mock.CF(5, 2, -6) }).Parent = dep
dep.Parent = hroom
local good = new("Model", { Name = "ArchivesStorageBox" })
good:SetAttribute("Tool_BoxID", 7)
local gp = new("Part", { Name = "Box", CFrame = Mock.CF(6, 2, -9) })
gp.Parent = good
good.Parent = honcho
local bad = new("Model", { Name = "ArchivesStorageBox" })
bad:SetAttribute("Tool_BoxID", 3)
local bp = new("Part", { Name = "Box", CFrame = Mock.CF(7, 2, -9) })
bp.Parent = bad
bad.Parent = honcho
hroom.Parent = rooms
Mock.run(1.5)
check("Honcho : numero du colis affiche", string.find(texts(), "Colis a recuperer : #7", 1, true) ~= nil, texts())
local gon, gtxt = tag(gp)
check("Honcho : bon colis marque BON COLIS #7", gon and string.find(gtxt, "BON COLIS #7", 1, true) ~= nil, gtxt)
local _, btxt = tag(bp)
check("Honcho : mauvais colis non marque", not string.find(btxt, "BON COLIS", 1, true), btxt)
hroom:Destroy()
Mock.run(5) -- la notification dure 4 s
check("Honcho : bandeau retire apres la salle", string.find(texts(), "Colis a recuperer", 1, true) == nil)

-- FOV retabli
click("     FOV")
Mock.run(0.1)
Mock.RunService.RenderStepped:Fire(0.016)
check("FOV applique", Mock.Camera.FieldOfView == 90, tostring(Mock.Camera.FieldOfView))

-- Fermeture : tout restaure
check("Sans jumpscares actif avant fermeture", mods:FindFirstChild("SpiderJumpscare_Disabled") ~= nil)
click("Fermer le script")
Mock.run(0.5)
check("Fermeture : interface supprimee", LP.PlayerGui:FindFirstChild("AbyssPaint") == nil)
check("Fermeture : modules restaures", mods:FindFirstChild("SpiderJumpscare") ~= nil and mods:FindFirstChild("Screech") ~= nil)
check("Fermeture : FOV restaure", Mock.Camera.FieldOfView == 70)
check("Aucune erreur sur tout le parcours", #Mock.errors == 0, table.concat(Mock.errors, "\n"))

for _, r in ipairs(results) do
    print((r.ok and "PASS " or "FAIL ") .. r.name .. ((not r.ok and r.detail) and ("\n      " .. tostring(r.detail)) or ""))
end
print(string.format("\n%d/%d tests reussis", #results - failures, #results))
if failures > 0 then error("ECHEC DES TESTS") end
