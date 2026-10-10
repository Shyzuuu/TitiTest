--!nocheck
-- Tests d'Abyss Paint dans l'environnement simule. Lancer via doors/tests/run_tests.sh
local Mock = require("./roblox_mock")
local src = require("./_paint_src")

local results, failures = {}, 0
local function check(name, cond, detail)
    table.insert(results, { name = name, ok = cond and true or false, detail = detail })
    if not cond then failures = failures + 1 end
end

local W, L, LP, new = Mock.Workspace, Mock.Lighting, Mock.LP, Mock.new
local rooms = new("Folder", { Name = "CurrentRooms" })
local room = new("Model", { Name = "7" })
local door = new("Model", { Name = "Door" })
new("Part", { Name = "Door", CFrame = Mock.CF(0, 3, -20), Size = Mock.V3(4, 8, 1) }).Parent = door
door.Parent = room
room.Parent = rooms
rooms.Parent = W
-- Monstre generique (PNJ avec Humanoid), comme dans n'importe quel jeu
local npc = new("Model", { Name = "Zombie" })
local npcRoot = new("Part", { Name = "HumanoidRootPart", CFrame = Mock.CF(0, 3, -12), Size = Mock.V3(2, 5, 1) })
npcRoot.Parent = npc
npc.PrimaryPart = npcRoot
new("Humanoid", { Health = 40, MaxHealth = 100 }).Parent = npc
npc.Parent = W
local ambient0 = L.Ambient

local function gui() return LP.PlayerGui:FindFirstChild("AbyssPaint") end
local function texts()
    local out = {}
    for _, d in ipairs(gui():GetDescendants()) do
        if d.ClassName == "TextLabel" and d.Text ~= "" then
            -- visible seulement si tous les parents le sont (une boite d'ESP masquee cache ses textes)
            local v, n = true, d
            while n and n ~= gui() do
                if n.Visible == false then v = false end
                n = n.Parent
            end
            if v then table.insert(out, d.Text) end
        end
    end
    return table.concat(out, " || ")
end
local function click(text)
    for _, d in ipairs(gui():GetDescendants()) do
        if d.ClassName == "TextButton" and string.find(d.Text, text, 1, true) then
            d.MouseButton1Click:Fire()
            return
        end
    end
    check("bouton '" .. text .. "' present", false)
end

Mock.exec(src, "AbyssPaint", (Mock.env()))
Mock.run(1)
check("Chargement sans erreur", #Mock.errors == 0, table.concat(Mock.errors, "\n"))
check("Interface creee, bandeau retire", gui() ~= nil and LP.PlayerGui:FindFirstChild("AbyssBoot") == nil)

local all = {}
for _, d in ipairs(gui():GetDescendants()) do
    if d.ClassName == "TextButton" and d.Text ~= "X" and d.Text ~= "_" and not string.find(d.Text, "Fermer", 1, true) then table.insert(all, d) end
end
for _, b in ipairs(all) do b.MouseButton1Click:Fire() Mock.run(0.05) b.MouseButton1Click:Fire() Mock.run(0.05) end
Mock.run(11) -- laisse disparaitre les cibles creees par "Tester l'ESP"
check(#all .. " boutons cliques deux fois sans erreur", #Mock.errors == 0, table.concat(Mock.errors, "\n"))

-- ESP : etiquettes attachees aux cibles (methode confirmee sur Delta)
local function tag(part)
    local bb = part and part:FindFirstChildWhichIsA("BillboardGui")
    if not bb then return false, "" end
    return bb.Enabled, bb:FindFirstChildWhichIsA("TextLabel").Text
end
click("Portes")
Mock.run(0.6)
local on1, t1 = tag(npcRoot)
check("ESP monstre generique : nom + vie", on1 and string.find(t1, "Zombie", 1, true) and string.find(t1, "40/100PV", 1, true), t1)
check("ESP monstre : contour actif", npc:FindFirstChildWhichIsA("Highlight") ~= nil and npc:FindFirstChildWhichIsA("Highlight").Enabled)
local on2, t2 = tag(door.Door)
check("ESP porte : 'Porte 8' et distance", on2 and string.find(t2, "Porte 8", 1, true) and string.find(t2, "m]", 1, true), t2)
local on3, t3 = tag(Mock.Other.Character.HumanoidRootPart)
check("ESP joueur DOORS : @nom et vie", on3 and string.find(t3, "Friend (@Friend)", 1, true) and string.find(t3, "100/100PV", 1, true), t3)
check("Compteur de cibles (barre d'etat)", string.find(texts(), "cibles 3", 1, true) ~= nil, texts())
npc:Destroy()
Mock.run(0.6)
check("Monstre detruit : retire (memoire liberee)", string.find(texts(), "cibles 2", 1, true) ~= nil, texts())

rooms.Parent = nil
Mock.run(0.6)
check("Hors DOORS : etiquette joueur masquee", not (tag(Mock.Other.Character.HumanoidRootPart)))
rooms.Parent = W
Mock.run(0.3)

click("Tester l'ESP")
Mock.run(0.6)
local test = W:FindFirstChild("AbyssEspTest")
local on4, t4 = tag(test)
check("Bouton 'Tester l'ESP' : cible visible", test ~= nil and on4 and string.find(t4, "TEST ESP", 1, true), t4)
Mock.run(10)
check("Cible de test retiree apres 10 s", W:FindFirstChild("AbyssEspTest") == nil)

click("Fullbright")
Mock.run(0.2)
check("Fullbright actif", L.Ambient == Mock.C3(1, 1, 1))
click("Fullbright")
Mock.run(0.2)
check("Fullbright restaure", L.Ambient == ambient0)

-- Vitesse : plafond sur par defaut, libre si desactive
local hum, hrp = LP.Character.Humanoid, LP.Character.HumanoidRootPart
local function plus(prefix)
    for _, d in ipairs(gui():GetDescendants()) do
        if d.ClassName == "TextLabel" and string.sub(d.Text, 1, #prefix) == prefix then
            for _, b in ipairs(d.Parent:GetChildren()) do
                if b.ClassName == "TextButton" and b.Text == "+" then b.MouseButton1Click:Fire() return end
            end
        end
    end
    check("stepper '" .. prefix .. "' present", false)
end
-- le balayage "tous les boutons" laisse la vitesse a 25 (clamp a 15 puis +5 +5) => 35 apres deux "+"
plus("Vitesse : ")
plus("Vitesse : ")
click("Speed")
Mock.run(0.2)
check("Vitesse sure plafonne a 21", hum.WalkSpeed == 21, tostring(hum.WalkSpeed))
click("Vitesse sure")
Mock.run(0.2)
check("Vitesse libre sans plafond", hum.WalkSpeed == 35, tostring(hum.WalkSpeed))
click("Speed")
Mock.run(0.2)
check("Vitesse restauree", hum.WalkSpeed == 16, tostring(hum.WalkSpeed))

-- Anti-glisse : inertie horizontale annulee, Y conserve, direction suivie
click("Anti-glisse")
hrp.AssemblyLinearVelocity = Mock.V3(40, -5, 30)
Mock.run(0.1)
local v = hrp.AssemblyLinearVelocity
check("Anti-glisse : arret net sans input", v.X == 0 and v.Z == 0 and v.Y == -5, tostring(v.X) .. "," .. tostring(v.Z))
hum.MoveDirection = Mock.V3(1, 0, 0)
hrp.AssemblyLinearVelocity = Mock.V3(5, 0, 50)
Mock.run(0.1)
v = hrp.AssemblyLinearVelocity
check("Anti-glisse : vitesse alignee sur l'input", v.X == 16 and v.Z == 0, tostring(v.X) .. "," .. tostring(v.Z))
hum.MoveDirection = Mock.V3(0, 0, 0)
click("Anti-glisse")
hrp.AssemblyLinearVelocity = Mock.V3(40, 0, 0)
Mock.run(0.1)
check("Anti-glisse coupe : physique libre", hrp.AssemblyLinearVelocity.X == 40)

-- Crucifix : sequence complete sur un monstre, puis reutilisation
local function monster(name, z)
    local m = new("Model", { Name = name })
    local r = new("Part", { Name = "HumanoidRootPart", CFrame = Mock.CF(0, 3, z), Size = Mock.V3(2, 5, 1) })
    r.Parent = m
    m.PrimaryPart = r
    new("Humanoid").Parent = m
    m.Parent = W
    return m
end
click("Obtenir le crucifix")
Mock.run(0.3)
local tool = LP.Backpack:FindFirstChild("Crucifix")
check("Crucifix dans le sac", tool ~= nil)
if tool then
    tool.Equipped:Fire()
    local m1 = monster("Ogre", -15)
    Mock.run(0.5)
    Mock.mouse.Target = nil
    tool.Activated:Fire()
    Mock.run(0.4)
    local fx = W:FindFirstChild("AbyssCrossFX")
    local links = 0
    if fx then for _, d in ipairs(fx:GetChildren()) do if d.ClassName == "Part" and d.Size.X == 0.3 and d.Size.Z == 0.75 then links = links + 1 end end end
    check("Animation : cercle et 54 maillons de chaines crees", fx ~= nil and links == 54, tostring(links))
    tool.Activated:Fire()
    Mock.run(0.1)
    check("Double activation refusee pendant l'animation", string.find(texts(), "Animation en cours", 1, true) ~= nil)
    Mock.run(4)
    check("Monstre banni a la fin", m1.Parent == nil)
    check("Effets nettoyes", W:FindFirstChild("AbyssCrossFX") == nil)
    local m2 = monster("Ogre2", -18)
    Mock.run(0.5)
    tool.Activated:Fire()
    Mock.run(4.5)
    check("Crucifix reutilisable apres une utilisation", m2.Parent == nil)
    Mock.mouse.Target = Mock.Other.Character.HumanoidRootPart
    tool.Activated:Fire()
    Mock.run(3)
    check("Crucifix refuse un joueur", Mock.Other.Character.Parent ~= nil)
end

click("Fermer le script")
Mock.run(0.5)
check("Fermeture : interface supprimee", gui() == nil)
check("Fermeture : Heartbeat deconnecte", Mock.RunService.Heartbeat:ConnectedCount() == 0, tostring(Mock.RunService.Heartbeat:ConnectedCount()))
check("Aucune erreur sur tout le parcours", #Mock.errors == 0, table.concat(Mock.errors, "\n"))

for _, r in ipairs(results) do
    print((r.ok and "PASS " or "FAIL ") .. r.name .. ((not r.ok and r.detail) and ("\n      " .. tostring(r.detail)) or ""))
end
print(string.format("\n%d/%d tests reussis", #results - failures, #results))
if failures > 0 then error("ECHEC DES TESTS") end
