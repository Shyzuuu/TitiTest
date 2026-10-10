--!nocheck
-- Tests d'Abyss Mini dans l'environnement simule. Lancer via doors/tests/run_tests.sh
local Mock = require("./roblox_mock")
local src = require("./_mini_src")

local results, failures = {}, 0
local function check(name, cond, detail)
    table.insert(results, { name = name, ok = cond and true or false, detail = detail })
    if not cond then failures = failures + 1 end
end

local W, L, LP, new = Mock.Workspace, Mock.Lighting, Mock.LP, Mock.new
local rooms = new("Folder", { Name = "CurrentRooms" })
local room = new("Model", { Name = "12" })
local door = new("Model", { Name = "Door" })
new("Part", { Name = "Door", CFrame = Mock.CF(0, 3, -20) }).Parent = door
door.Parent = room
local function prop(name, pos, prompt)
    local m = new("Model", { Name = name })
    local p = new("Part", { Name = "Main", CFrame = pos })
    p.Parent = m
    m.PrimaryPart = p
    if prompt then new("ProximityPrompt", { HoldDuration = 1, MaxActivationDistance = 10 }).Parent = m end
    m.Parent = room
    return m
end
local gold = prop("GoldPile", Mock.CF(3, 3, 0), true)
local drawer = prop("DrawerContainer", Mock.CF(2, 3, 2), true)
local wardrobe = prop("Wardrobe", Mock.CF(6, 3, 6), false)
room.Parent = rooms
rooms.Parent = W
local atmo = new("Atmosphere", { Density = 0.4 })
atmo.Parent = L
local ambient0, fog0 = L.Ambient, L.FogEnd

local function gui() return LP.PlayerGui:FindFirstChild("AbyssMini") end
local function buttonByText(text)
    for _, d in ipairs(gui():GetDescendants()) do
        if d.ClassName == "TextButton" and string.find(d.Text, text, 1, true) then return d end
    end
end
local function click(text)
    local b = buttonByText(text)
    if not b then check("bouton '" .. text .. "' present", false) return end
    b.MouseButton1Click:Fire()
end

Mock.exec(src, "AbyssMini", (Mock.env()))
Mock.run(1)
check("Chargement sans erreur", #Mock.errors == 0, table.concat(Mock.errors, "\n"))
check("Interface creee", gui() ~= nil)
check("Bandeau de demarrage retire apres succes", LP.PlayerGui:FindFirstChild("AbyssBoot") == nil)

-- Chaque bouton (sauf fermeture) clique deux fois : aucune erreur ne doit apparaitre
local all = {}
for _, d in ipairs(gui():GetDescendants()) do
    if d.ClassName == "TextButton" and not string.find(d.Text, "Fermer", 1, true) then table.insert(all, d) end
end
for _, b in ipairs(all) do b.MouseButton1Click:Fire() Mock.run(0.05) b.MouseButton1Click:Fire() Mock.run(0.05) end
Mock.run(1)
check(#all .. " boutons cliques deux fois sans erreur", #Mock.errors == 0, table.concat(Mock.errors, "\n"))
check("Aucune notification d'erreur", not (function()
    for _, d in ipairs(gui():GetDescendants()) do
        if d.ClassName == "TextLabel" and string.find(d.Text, "Erreur", 1, true) then return true end
    end
end)())

click("Portes")
Mock.run(0.5)
local hl = door:FindFirstChildWhichIsA("Highlight")
check("ESP porte visible", hl ~= nil and hl.Enabled == true)
check("Libelle 'Porte 13'", string.find(door.Door:FindFirstChildWhichIsA("BillboardGui"):FindFirstChildWhichIsA("TextLabel").Text, "Porte 13", 1, true) ~= nil)

click("Fullbright")
click("Sans brouillard")
Mock.run(0.3)
check("Fullbright + brouillard actifs", L.Ambient == Mock.C3(1, 1, 1) and L.FogEnd >= 100000 and atmo.Density == 0)
click("Fullbright")
click("Sans brouillard")
Mock.run(0.3)
check("Eclairage, brouillard et atmosphere restaures", L.Ambient == ambient0 and L.FogEnd == fog0 and math.abs(atmo.Density - 0.4) < 1e-6)

click("Speed")
Mock.run(0.2)
check("Speed 20", LP.Character.Humanoid.WalkSpeed == 20)
click("Speed")
Mock.run(0.2)
check("Speed restaure", LP.Character.Humanoid.WalkSpeed == 16)

click("Ouvrir les tiroirs")
Mock.run(2)
check("Tiroir ouvert une seule fois", Mock.fired[drawer:FindFirstChildWhichIsA("ProximityPrompt")] == 1)
click("Ouvrir les tiroirs")

click("Anti-A90")
local ui = new("ScreenGui", { Name = "MainUI" })
ui.Parent = LP.PlayerGui
local a90 = new("Frame", { Name = "A90" })
a90.Parent = ui
Mock.run(0.3)
check("Anti-A90 supprime A90", a90.Parent == nil)
click("Anti-Halt")
local shade = new("Model", { Name = "Shade" })
shade.Parent = Mock.Camera
Mock.run(0.3)
check("Anti-Halt supprime Shade", shade.Parent == nil)

click("Obtenir le crucifix")
Mock.run(0.2)
local tool = LP.Backpack:FindFirstChild("Crucifix")
check("Crucifix dans le sac", tool ~= nil)
if tool then
    tool.Equipped:Fire()
    Mock.mouse.Target = wardrobe.Main
    tool.Activated:Fire()
    Mock.run(3)
    check("Crucifix retire l'armoire", wardrobe.Parent == nil)
    Mock.mouse.Target = Mock.Other.Character.HumanoidRootPart
    tool.Activated:Fire()
    Mock.run(3)
    check("Crucifix refuse un joueur", Mock.Other.Character.Parent ~= nil)
end

click("Fermer le script")
Mock.run(0.5)
check("Fermeture : interface supprimee", gui() == nil)
check("Fermeture : Heartbeat deconnecte", Mock.RunService.Heartbeat:ConnectedCount() == 0, tostring(Mock.RunService.Heartbeat:ConnectedCount()))
check("Fermeture : contour retire", door:FindFirstChildWhichIsA("Highlight") == nil)
check("Aucune erreur sur tout le parcours", #Mock.errors == 0, table.concat(Mock.errors, "\n"))

-- Erreur au demarrage : le bandeau doit l'afficher au lieu de rester muet
local broken = string.gsub(src, 'local Pal = {', 'error("panne simulee")\nlocal Pal = {', 1)
Mock.exec(broken, "AbyssMiniBroken", (Mock.env()))
Mock.run(0.5)
local boot = LP.PlayerGui:FindFirstChild("AbyssBoot")
local label = boot and boot:FindFirstChildWhichIsA("TextLabel")
check("Erreur de demarrage affichee a l'ecran", label ~= nil and string.find(label.Text, "panne simulee", 1, true) ~= nil)

for _, r in ipairs(results) do
    print((r.ok and "PASS " or "FAIL ") .. r.name .. ((not r.ok and r.detail) and ("\n      " .. tostring(r.detail)) or ""))
end
print(string.format("\n%d/%d tests reussis", #results - failures, #results))
if failures > 0 then error("ECHEC DES TESTS") end
