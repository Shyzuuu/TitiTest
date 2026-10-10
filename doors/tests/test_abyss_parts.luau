--!nocheck
-- Les 3 parties collees l'une apres l'autre doivent donner exactement le script complet.
local Mock = require("./roblox_mock")
local p1, p2, p3 = require("./_part1_src"), require("./_part2_src"), require("./_part3_src")

local results, failures = {}, 0
local function check(name, cond, detail)
    table.insert(results, { name = name, ok = cond and true or false, detail = detail })
    if not cond then failures = failures + 1 end
end
local LP = Mock.LP
local function gui() return LP.PlayerGui:FindFirstChild("AbyssPaint") end

for i, p in ipairs({ p1, p2, p3 }) do
    check("Partie " .. i .. " sous 30 Ko (collable dans Delta)", #p <= 30000, tostring(#p))
    local ascii = true
    for k = 1, #p do if string.byte(p, k) > 127 then ascii = false break end end
    check("Partie " .. i .. " en ASCII", ascii)
end

-- partie 3 seule : rien ne doit planter, rien ne s'affiche
local env, G = Mock.env()
Mock.exec(p3, "Partie3Seule", env)
Mock.run(0.5)
check("Partie 3 seule : pas d'erreur", #Mock.errors == 0, table.concat(Mock.errors, "\n"))
check("Partie 3 seule : script non lance", gui() == nil)

-- ordre normal 1, 2, 3 dans le meme executeur
Mock.exec(p1, "Partie1", env)
Mock.run(0.1)
check("Partie 1 seule : script pas encore lance", gui() == nil)
Mock.exec(p2, "Partie2", env)
Mock.exec(p3, "Partie3", env)
Mock.run(1.5)
check("3 parties : script lance sans erreur", #Mock.errors == 0, table.concat(Mock.errors, "\n"))
check("3 parties : interface affichee, bandeau de chargement retire",
    gui() ~= nil and LP.PlayerGui:FindFirstChild("AbyssBoot") == nil)
check("3 parties : source temporaire liberee", G.AbyssSrc == nil)
check("3 parties : fonction d'arret installee", type(G.AbyssStop) == "function")
G.AbyssStop()
Mock.run(0.5)
check("Fermeture propre", gui() == nil and #Mock.errors == 0, table.concat(Mock.errors, "\n"))

for _, r in ipairs(results) do
    print((r.ok and "PASS " or "FAIL ") .. r.name .. ((not r.ok and r.detail) and ("\n      " .. tostring(r.detail)) or ""))
end
print(string.format("\n%d/%d tests reussis", #results - failures, #results))
if failures > 0 then error("ECHEC DES TESTS") end
