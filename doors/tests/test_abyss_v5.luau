--!nocheck
-- Tests de regression d'Abyss V5 dans l'environnement simule.
-- Usage : luau doors/tests/test_abyss_v5.luau   (depuis la racine du depot)

local Mock = require("./roblox_mock")

local results, failures = {}, 0
local function check(name, cond, detail)
    table.insert(results, { name = name, ok = cond and true or false, detail = detail })
    if not cond then failures = failures + 1 end
end

-- Le CLI Luau n'a pas de bibliotheque io : run_tests.sh genere _abyss_src.luau qui renvoie le source
local src = require("./_abyss_src")
assert(type(src) == "string" and #src > 0, "Source introuvable : lancer doors/tests/run_tests.sh")

--================ MONDE DE TEST ================--
local W, L, LP = Mock.Workspace, Mock.Lighting, Mock.LP
local new = Mock.new

local rooms = new("Folder", { Name = "CurrentRooms" })
local room = new("Model", { Name = "5" })
local door = new("Model", { Name = "Door" })
new("Part", { Name = "Door", CFrame = Mock.CF(0, 3, -20) }).Parent = door
door.Parent = room
local assets = new("Folder", { Name = "Assets" })
local function prop(name, pos, withPrompt)
    local m = new("Model", { Name = name })
    local p = new("Part", { Name = "Main", CFrame = pos })
    p.Parent = m
    m.PrimaryPart = p
    if withPrompt then new("ProximityPrompt", { HoldDuration = 1, MaxActivationDistance = 10 }).Parent = m end
    m.Parent = assets
    return m
end
local key = prop("KeyObtain", Mock.CF(5, 3, 0), true)
local gold = prop("GoldPile", Mock.CF(3, 3, 0), true)
local drawer = prop("DrawerContainer", Mock.CF(2, 3, 2), true)
local wardrobe = prop("Wardrobe", Mock.CF(6, 3, 6), false)
assets.Parent = room
room.Parent = rooms
rooms.Parent = W

local atmo = new("Atmosphere", { Density = 0.35 })
atmo.Parent = L
local blur = new("BlurEffect", { Enabled = true })
blur.Parent = L

local gd = new("Folder", { Name = "GameData" })
new("IntValue", { Name = "LatestRoom", Value = 5 }).Parent = gd
gd.Parent = Mock.ReplicatedStorage

local origAmbient = L.Ambient
local origFog = L.FogEnd

--================ HELPERS UI ================--
local function gui()
    return LP.PlayerGui:FindFirstChild("AbyssV5")
end
local function guiCount()
    local n = 0
    for _, g in ipairs(LP.PlayerGui:GetChildren()) do if g.Name == "AbyssV5" then n = n + 1 end end
    return n
end
local function find(name)
    local g = gui()
    return g and g:FindFirstChild(name, true)
end
local function click(name)
    local b = find(name)
    if not b then
        check("bouton present : " .. name, false)
        return false
    end
    b.MouseButton1Click:Fire()
    return true
end
local function clickIn(parentName, childName)
    local p = find(parentName)
    local b = p and p:FindFirstChild(childName)
    if not b then check("bouton present : " .. parentName .. "/" .. childName, false) return end
    b.MouseButton1Click:Fire()
end
local function consoleHas(pattern, from)
    for i = from or 1, #Mock.console do
        if string.find(Mock.console[i], pattern, 1, true) then return true, i end
    end
    return false
end
local function hl(obj)
    return obj:FindFirstChild("AbyssHL")
end
local function hum() return LP.Character:FindFirstChildOfClass("Humanoid") end
local function errorsSince(n)
    local out = {}
    for i = n + 1, #Mock.errors do table.insert(out, Mock.errors[i]) end
    return out
end

--================ 1. CHARGEMENT ================--
local env1 = Mock.env()
local errBefore = #Mock.errors
Mock.exec(src, "AbyssV5", env1)
Mock.run(1)
check("Chargement sans erreur", #Mock.errors == errBefore, table.concat(errorsSince(errBefore), "\n"))
check("Une seule interface", guiCount() == 1, tostring(guiCount()))
check("Message de chargement", consoleHas("charge (9 pages)"))
check("Aucune erreur journalisee au chargement", not consoleHas("[ERROR]"))

--================ 2. NAVIGATION ================--
local navOk = true
for _, id in ipairs({ "Dashboard", "ESP", "Fullbright", "Joueur", "Entites", "Crucifix", "Auto", "Debug", "Settings" }) do
    click("Nav_" .. id)
    Mock.run(0.6)
    local page = find("Page_" .. id)
    if not (page and page.Visible) then navOk = false end
    for _, other in ipairs({ "Dashboard", "ESP", "Fullbright", "Joueur", "Entites", "Crucifix", "Auto", "Debug", "Settings" }) do
        if other ~= id and find("Page_" .. other).Visible then navOk = false end
    end
end
check("Navigation : une seule page visible a la fois", navOk)

--================ 3. ESP ================--
click("Toggle_Esp_Doors")
Mock.run(0.6)
check("ESP porte : contour cree", hl(door) ~= nil)
check("ESP porte : contour visible", hl(door) and hl(door).Enabled == true)
local doorPart = door:FindFirstChild("Door")
local bb = doorPart:FindFirstChild("AbyssBB")
check("ESP porte : etiquette visible", bb and bb.Enabled == true)
check("ESP porte : texte 'Porte 6'", bb and string.find(bb:FindFirstChildWhichIsA("TextLabel").Text, "Porte 6", 1, true) ~= nil)

local beforeColor = hl(door).FillColor
click("Cycle_Col_Doors")
Mock.run(0.4)
check("ESP couleur : changement applique", hl(door).FillColor ~= beforeColor)

click("Toggle_EspEnabled")
Mock.run(0.4)
check("ESP general off : contour masque", hl(door).Enabled == false)
click("Toggle_EspEnabled")
Mock.run(0.4)
check("ESP general on : contour revenu", hl(door).Enabled == true)

click("Toggle_Esp_Keys")
Mock.run(0.5)
check("ESP cle : contour", hl(key) and hl(key).Enabled == true)
key:Destroy()
Mock.run(0.4)
check("ESP cle detruite : retiree sans erreur", #Mock.errors == errBefore, table.concat(errorsSince(errBefore), "\n"))

-- Nettoyage puis nouvelle analyse
click("Btn_EspClear")
Mock.run(0.4)
check("Nettoyer : contours supprimes", hl(door) == nil)
click("Btn_EspRescan")
Mock.run(0.6)
check("Actualiser : contours recrees", hl(door) ~= nil and hl(door).Enabled == true)

--================ 4. FULLBRIGHT ================--
click("Toggle_Fullbright")
Mock.run(0.3)
check("Fullbright on : ambient blanc", L.Ambient == Mock.C3(1, 1, 1))
check("Fullbright on : ombres coupees", L.GlobalShadows == false)
click("Toggle_Fullbright")
Mock.run(0.3)
check("Fullbright off : ambient restaure", L.Ambient == origAmbient)
check("Fullbright off : ombres restaurees", L.GlobalShadows == true)

click("Toggle_NoFog")
Mock.run(0.5)
check("NoFog on : FogEnd eleve", L.FogEnd >= 100000)
check("NoFog on : atmosphere a 0", atmo.Density == 0)
click("Toggle_NoFog")
Mock.run(0.3)
check("NoFog off : FogEnd restaure", L.FogEnd == origFog)
check("NoFog off : atmosphere restauree", math.abs(atmo.Density - 0.35) < 1e-6)

click("Toggle_AntiBlur")
Mock.run(0.6)
check("Anti-flou on : flou coupe", blur.Enabled == false)
click("Toggle_AntiBlur")
Mock.run(0.3)
check("Anti-flou off : flou restaure", blur.Enabled == true)

click("Toggle_Fullbright")
Mock.run(0.2)
click("Btn_FbRestore")
Mock.run(0.5)
check("Restaurer : fullbright coupe et ambient d'origine", L.Ambient == origAmbient)

--================ 5. JOUEUR ================--
click("Toggle_Speed")
Mock.run(0.2)
check("Speed on : WalkSpeed 20", hum().WalkSpeed == 20)
clickIn("Stepper_SpeedValue", "Plus")
Mock.run(0.2)
check("Stepper + : WalkSpeed 21", hum().WalkSpeed == 21)
for _ = 1, 20 do clickIn("Stepper_SpeedValue", "Plus") end
Mock.run(0.2)
check("Stepper borne a 30", hum().WalkSpeed == 30)
click("Toggle_Speed")
Mock.run(0.2)
check("Speed off : WalkSpeed d'origine", hum().WalkSpeed == 16)

click("Toggle_Fov")
Mock.run(0.2)
check("FOV on : 90", Mock.Camera.FieldOfView == 90)
click("Toggle_Fov")
Mock.run(0.2)
check("FOV off : 70", Mock.Camera.FieldOfView == 70)

--================ 6. AUTO ================--
local prompt = gold:FindFirstChildWhichIsA("ProximityPrompt")
click("Toggle_InstantPrompt")
Mock.run(0.2)
check("Interaction instantanee : HoldDuration 0", prompt.HoldDuration == 0)
click("Toggle_InstantPrompt")
Mock.run(0.2)
check("Interaction instantanee off : HoldDuration 1", prompt.HoldDuration == 1)

local drawerPrompt = drawer:FindFirstChildWhichIsA("ProximityPrompt")
click("Toggle_AutoDrawers")
Mock.run(3)
check("Tiroir ouvert une seule fois", Mock.fired[drawerPrompt] == 1, tostring(Mock.fired[drawerPrompt]))
click("Toggle_AutoDrawers")
click("Toggle_AutoGold")
Mock.run(1)
check("Or ramasse automatiquement", (Mock.fired[prompt] or 0) >= 1)
click("Toggle_AutoGold")

--================ 7. ENTITES ================--
click("Toggle_Esp_Entities")
local rush = new("Model", { Name = "RushMoving" })
local rp = new("Part", { Name = "Body", CFrame = Mock.CF(0, 3, -30) })
rp.Parent = rush
rush.PrimaryPart = rp
rush.Parent = W
click("Nav_Entites")
Mock.run(1)
check("Entite detectee (contour)", hl(rush) ~= nil and hl(rush).Enabled == true)
local rowSeen = false
for _, d in ipairs(find("Page_Entites"):GetDescendants()) do
    if d.Name == "EntRow" and d.Visible then
        for _, t in ipairs(d:GetChildren()) do
            if t.ClassName == "TextLabel" and string.find(t.Text, "RUSH", 1, true) then rowSeen = true end
        end
    end
end
check("Entite listee dans la page Entites", rowSeen)
check("Alerte entite journalisee", consoleHas("Entite detectee : RUSH"))
rush:Destroy()
Mock.run(1)
local rowStill = false
for _, d in ipairs(find("Page_Entites"):GetDescendants()) do
    if d.Name == "EntRow" and d.Visible then rowStill = true end
end
check("Entite detruite : retiree de la liste", not rowStill)

--================ 7b. PROTECTIONS ================--
local mainUI = new("ScreenGui", { Name = "MainUI" })
mainUI.Parent = LP.PlayerGui
local a90off = new("Frame", { Name = "A90" })
a90off.Parent = mainUI
Mock.run(0.3)
check("Anti-A90 inactif : objet conserve", a90off.Parent == mainUI)
check("A-90 signale dans le journal", consoleHas("Entite detectee : A-90"))
click("Toggle_AntiA90")
Mock.run(0.3)
check("Anti-A90 active : objet deja present supprime", a90off.Parent == nil)
local a90 = new("Frame", { Name = "A90" })
a90.Parent = mainUI
Mock.run(0.3)
check("Anti-A90 : nouvel objet supprime", a90.Parent == nil)
click("Toggle_AntiA90")

local shade = new("Model", { Name = "Shade" })
click("Toggle_AntiHalt")
shade.Parent = Mock.Camera
Mock.run(0.3)
check("Anti-Halt : Shade supprime de la camera", shade.Parent == nil)
click("Toggle_AntiHalt")
local shade2 = new("Model", { Name = "Shade" })
shade2.Parent = Mock.Camera
Mock.run(0.3)
check("Anti-Halt inactif : Shade conserve", shade2.Parent == Mock.Camera)
shade2:Destroy()

click("Toggle_AntiScreech")
local screech = new("Model", { Name = "Screech" })
screech.Parent = Mock.Camera
Mock.run(0.3)
check("Anti-Screech : Screech supprime", screech.Parent == nil)
click("Toggle_AntiScreech")
mainUI:Destroy()

--================ 8. CRUCIFIX ================--
local mark = #Mock.console
click("Btn_CrossScenario")
click("Btn_CrossScenario") -- double clic : ne doit lancer qu'un scenario
Mock.run(5)
local launches = 0
for i = mark + 1, #Mock.console do
    if string.find(Mock.console[i], "Scenario lance", 1, true) then launches = launches + 1 end
end
check("Scenario : un seul lancement malgre le double clic", launches == 1, tostring(launches))
check("Scenario : resultat REUSSI", consoleHas("Resultat : REUSSI", mark + 1))

click("Btn_CrossGive")
Mock.run(0.3)
local tool = LP.Backpack:FindFirstChild("Crucifix")
check("Crucifix ajoute au sac", tool ~= nil)
if tool then
    tool.Parent = LP.Character
    tool.Equipped:Fire()
    Mock.run(0.1)
    check("Crucifix tenu en main", LP.Character:FindFirstChild("AbyssCross") ~= nil)
    Mock.mouse.Target = wardrobe:FindFirstChild("Main")
    tool.Activated:Fire()
    Mock.run(3)
    check("Crucifix sur un objet (armoire) : objet retire", wardrobe.Parent == nil)
    Mock.mouse.Target = Mock.Other.Character:FindFirstChild("HumanoidRootPart")
    local m2 = #Mock.console
    tool.Activated:Fire()
    Mock.run(0.5)
    check("Crucifix sur un joueur : refuse", consoleHas("Cible protegee", m2 + 1) and Mock.Other.Character.Parent ~= nil)
    tool.Unequipped:Fire()
    Mock.run(0.1)
    check("Crucifix range : modele retire de la main", LP.Character:FindFirstChild("AbyssCross") == nil)
end

-- Charges limitees
click("Toggle_CrossInfinite")
for _ = 1, 20 do clickIn("Stepper_CrossUses", "Minus") end
click("Btn_CrossReset")
Mock.run(0.2)
local mark2 = #Mock.console
click("Btn_CrossScenario")
Mock.run(5)
check("Charge unique : scenario reussi", consoleHas("Resultat : REUSSI", mark2 + 1))
local mark3 = #Mock.console
click("Btn_CrossScenario")
Mock.run(2)
check("Plus de charge : utilisation refusee", consoleHas("Plus de charges", mark3 + 1))
click("Toggle_CrossInfinite")

--================ 9. DEBUG ================--
click("Nav_Debug")
Mock.run(0.6)
local view = find("LogView")
check("Journal affiche", view and #view.Text > 0 and view.Text ~= "Aucune entree.")
click("Btn_LogFilter")
click("Btn_LogFilter") -- WARN
Mock.run(0.6)
check("Filtre WARN applique", find("Btn_LogFilter").Text == "Filtre : WARN")
for _ = 1, 3 do click("Btn_LogFilter") end -- retour a TOUT
find("LogSearch").Text = "Scenario"
Mock.run(0.6)
check("Recherche : seules les lignes correspondantes", string.find(view.Text, "Scenario", 1, true) ~= nil
    and string.find(view.Text, "Salles surveillees", 1, true) == nil)
find("LogSearch").Text = ""
click("Btn_LogCopy")
Mock.run(0.2)
check("Copie du journal", Mock.clipboard ~= nil and #Mock.clipboard > 0)
local mark4 = #Mock.console
click("Btn_AutoTest")
Mock.run(2)
local _, idx = consoleHas("Bilan : ", mark4 + 1)
local bilan = idx and Mock.console[idx] or "absent"
check("Auto-test : toutes les verifications reussies", idx ~= nil and string.find(bilan, "verifications reussies", 1, true)
    and not consoleHas("ECHEC", mark4 + 1), bilan)

--================ 10. REGLAGES ================--
local logo = gui():FindFirstChild("Header", true):FindFirstChildWhichIsA("TextLabel")
local c1 = logo.BackgroundColor3
click("Cycle_Accent")
Mock.run(0.2)
check("Couleur d'accent appliquee", logo.BackgroundColor3 ~= c1)
local row = find("Toggle_Speed")
local h1 = row.Size.Y.Offset
click("Toggle_Compact")
Mock.run(0.2)
check("Affichage compact : lignes reduites", row.Size.Y.Offset < h1)
click("Toggle_Compact")
local scale = gui():FindFirstChild("Main"):FindFirstChildWhichIsA("UIScale")
local s1 = scale.Scale
clickIn("Stepper_UiScale", "Plus")
Mock.run(0.2)
check("Echelle de l'interface", scale.Scale > s1)

-- Notifications : jamais plus de 4
local maxNotif = 0
for i = 1, 6 do
    click("Btn_QuickEsp")
    Mock.run(0.05)
    local n = 0
    for _, c in ipairs(find("Notifications"):GetChildren()) do if c.Name == "Notif" then n = n + 1 end end
    maxNotif = math.max(maxNotif, n)
end
check("Notifications limitees a 4", maxNotif <= 4, tostring(maxNotif))
Mock.run(5)

click("Btn_ResetAll")
Mock.run(0.5)
check("Reinitialisation : ESP portes desactive", hl(door) == nil or hl(door).Enabled == false)

-- Sauvegarde reelle
check("Configuration ecrite", Mock.files["AbyssV5_Doors.json"] ~= nil)

--================ 11. REAPPARITION ================--
local oldChar = LP.Character
local newChar = Mock.makeCharacter("Tester")
LP.Character = newChar
newChar.Parent = W
oldChar:Destroy()
LP.CharacterAdded:Fire(newChar)
Mock.run(0.5)
check("Reapparition : toujours une seule interface", guiCount() == 1)

--================ 12. RE-EXECUTION ================--
local hbBefore = Mock.RunService.Heartbeat:ConnectedCount()
local env2 = Mock.env()
-- getgenv partage entre executions, comme sur un vrai executeur
env2.getgenv = env1.getgenv
env2._G = env1._G
Mock.exec(src, "AbyssV5", env2)
Mock.run(1)
check("Re-execution : une seule interface", guiCount() == 1, tostring(guiCount()))
check("Re-execution : pas de connexions en double", Mock.RunService.Heartbeat:ConnectedCount() == hbBefore,
    hbBefore .. " -> " .. Mock.RunService.Heartbeat:ConnectedCount())

--================ 13. FERMETURE ================--
click("Toggle_Esp_Doors")
click("Toggle_Fullbright")
Mock.run(0.5)
click("Btn_Close")
Mock.run(0.2)
check("Fermeture : confirmation demandee (interface encore la)", guiCount() == 1)
click("Btn_Close")
Mock.run(0.5)
check("Fermeture : interface supprimee", guiCount() == 0)
check("Fermeture : eclairage restaure", L.Ambient == origAmbient)
check("Fermeture : contours supprimes", hl(door) == nil)
check("Fermeture : Heartbeat deconnecte", Mock.RunService.Heartbeat:ConnectedCount() == 0,
    tostring(Mock.RunService.Heartbeat:ConnectedCount()))
local boundLeft = 0
for _ in pairs(Mock.bound) do boundLeft = boundLeft + 1 end
check("Fermeture : RenderStep libere", boundLeft == 0, tostring(boundLeft))

check("Aucune erreur d'execution sur tout le parcours", #Mock.errors == 0, table.concat(Mock.errors, "\n----\n"))
check("Aucune erreur de module journalisee", not consoleHas("[ERROR]"))

--================ RAPPORT ================--
for _, r in ipairs(results) do
    print((r.ok and "PASS " or "FAIL ") .. r.name .. ((not r.ok and r.detail) and ("\n      " .. tostring(r.detail)) or ""))
end
print(string.format("\n%d/%d tests reussis", #results - failures, #results))
if failures > 0 then
    print("\n--- console du script (fin) ---")
    for i = math.max(1, #Mock.console - 40), #Mock.console do print(Mock.console[i]) end
    error("ECHEC DES TESTS")
end
