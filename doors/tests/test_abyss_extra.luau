--!nocheck
-- Tests d'Abyss Extra (avec Abyss Paint charge dans le meme executeur). Lancer via doors/tests/run_tests.sh
local Mock = require("./roblox_mock")
local paint = require("./_paint_src")
local extra = require("./_extra_src")

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
mui.Parent = LP.PlayerGui

local env = Mock.env()
Mock.exec(paint, "AbyssPaint", env)
Mock.run(0.5)
Mock.exec(extra, "AbyssExtra", env)
Mock.run(1.5)
check("Paint + Extra charges sans erreur", #Mock.errors == 0, table.concat(Mock.errors, "\n"))
local gui = LP.PlayerGui:FindFirstChild("AbyssExtra")
check("Interface Extra creee, bandeau retire", gui ~= nil and LP.PlayerGui:FindFirstChild("AbyssExtraBoot") == nil)

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

check("Floor detecte : Mines", string.find(texts(), "Floor detecte : Mines", 1, true) ~= nil, texts())
check("Barre d'etat : ESP floor relie", string.find(texts(), "relie", 1, true) ~= nil, texts())
Mock.run(0.6)
local on1, t1 = tag(anchor.Base)
check("ESP floor Mines actif d'office : Ancre", on1 and string.find(t1, "Ancre", 1, true) ~= nil, t1)
click("ESP Mines")
Mock.run(0.4)
check("ESP floor Mines desactivable", not tag(anchor.Base))
click("ESP Mines")

-- Balayage : chaque bouton deux fois sans erreur
local all = {}
for _, d in ipairs(gui:GetDescendants()) do
    if d.ClassName == "TextButton" and d.Text ~= "X" and not string.find(d.Text, "Fermer", 1, true) then table.insert(all, d) end
end
for _, b in ipairs(all) do b.MouseButton1Click:Fire() Mock.run(0.05) b.MouseButton1Click:Fire() Mock.run(0.05) end
Mock.run(1.2)
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

-- Fermeture : tout restaure, Paint intact
click("Fermer Abyss Extra")
Mock.run(0.5)
check("Fermeture : interface Extra supprimee", LP.PlayerGui:FindFirstChild("AbyssExtra") == nil)
check("Fermeture : modules restaures", mods:FindFirstChild("SpiderJumpscare") ~= nil)
check("Abyss Paint toujours actif", LP.PlayerGui:FindFirstChild("AbyssPaint") ~= nil)
check("Aucune erreur sur tout le parcours", #Mock.errors == 0, table.concat(Mock.errors, "\n"))

for _, r in ipairs(results) do
    print((r.ok and "PASS " or "FAIL ") .. r.name .. ((not r.ok and r.detail) and ("\n      " .. tostring(r.detail)) or ""))
end
print(string.format("\n%d/%d tests reussis", #results - failures, #results))
if failures > 0 then error("ECHEC DES TESTS") end
