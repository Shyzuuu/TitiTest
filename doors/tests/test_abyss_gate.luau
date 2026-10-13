--!nocheck
-- Verrou par code et choix du jeu. Lancer via doors/tests/run_tests.sh
local Mock = require("./roblox_mock")
local src = require("./_paint_src")

local results, failures = {}, 0
local function check(name, cond, detail)
    table.insert(results, { name = name, ok = cond and true or false, detail = detail })
    if not cond then failures = failures + 1 end
end
local LP = Mock.LP
local function gate() return LP.PlayerGui:FindFirstChild("AbyssGate") end
local function gateText()
    local out = {}
    for _, d in ipairs(gate() and gate():GetDescendants() or {}) do
        if d.ClassName == "TextLabel" then table.insert(out, d.Text) end
    end
    return table.concat(out, " || ")
end

check("Le code n'est ecrit nulle part dans le script", not string.find(src, "3719", 1, true))

local env, G = Mock.env()
Mock.exec(src, "AbyssHub", env)
Mock.run(0.5)
check("Ecran de verrou affiche au lancement", gate() ~= nil)
check("Rien d'autre ne s'affiche avant le code", LP.PlayerGui:FindFirstChild("AbyssPaint") == nil)

Mock.unlock("1234")
check("Code faux refuse", string.find(gateText(), "Code faux (1)", 1, true) ~= nil, gateText())
check("Code faux : toujours verrouille", G.AbyssUnlocked == nil)
Mock.unlock("0000")
Mock.unlock("9999")
Mock.unlock("3719")
check("Apres 3 erreurs : bouton bloque quelques secondes", string.find(gateText(), "Code faux (3)", 1, true) ~= nil, gateText())
Mock.run(8)
Mock.unlock("3719")
check("Bon code : deverrouille", G.AbyssUnlocked == true)
check("Bon code : choix du jeu affiche", string.find(gateText(), "Choisis le jeu", 1, true) ~= nil, gateText())

assert(Mock.unlock("3719", "Universel"))
Mock.run(0.5)
check("Universel : fenetre affichee, pas l'interface DOORS",
    LP.PlayerGui:FindFirstChild("AbyssUniversal") ~= nil and LP.PlayerGui:FindFirstChild("AbyssPaint") == nil)
LP.Idled:Fire(120)
Mock.run(0.1)
check("Anti-AFK : clic virtuel envoye sur inactivite", (Mock.vuClicks or 0) == 1 and (Mock.vuCaptured or 0) == 1)
G.AbyssStop()
Mock.run(0.2)
LP.Idled:Fire(120)
check("Fermeture Universel : interface retiree, anti-AFK coupe",
    LP.PlayerGui:FindFirstChild("AbyssUniversal") == nil and (Mock.vuClicks or 0) == 1)

-- deuxieme lancement dans la meme session : plus de code, choix direct
Mock.exec(src, "AbyssHub2", env)
Mock.run(0.5)
check("Relance : choix du jeu sans redemander le code", string.find(gateText(), "Choisis le jeu", 1, true) ~= nil, gateText())
for _, d in ipairs(gate():GetDescendants()) do
    if d.ClassName == "TextButton" and d.Text == "Fermer" and d.Visible ~= false and d.Parent.ClassName == "Frame" and d.Parent.Visible then
        d.MouseButton1Click:Fire()
    end
end
Mock.run(0.5)
check("Fermer sans choisir : rien ne se lance", gate() == nil and LP.PlayerGui:FindFirstChild("AbyssPaint") == nil
    and LP.PlayerGui:FindFirstChild("AbyssUniversal") == nil)
check("Aucune erreur", #Mock.errors == 0, table.concat(Mock.errors, "\n"))

for _, r in ipairs(results) do
    print((r.ok and "PASS " or "FAIL ") .. r.name .. ((not r.ok and r.detail) and ("\n      " .. tostring(r.detail)) or ""))
end
print(string.format("\n%d/%d tests reussis", #results - failures, #results))
if failures > 0 then error("ECHEC DES TESTS") end
