--!strict
-- Formules économiques partagées (niveaux de machines, collecteur).
local Freeze = require(script.Parent.Parent.Util.Freeze)

return Freeze.deep({
	-- Chaque machine peut être améliorée jusqu'à ce niveau.
	MachineMaxLevel = 5,
	-- Coût du niveau N→N+1 = Cost * LevelCostFactor * LevelCostGrowth^(N-1)
	LevelCostFactor = 0.75,
	LevelCostGrowth = 1.6,
	-- Revenu = Income * (1 + LevelIncomeStep * (niveau - 1))
	LevelIncomeStep = 0.35,

	-- Plafond de sécurité : aucune valeur de Cash ne peut dépasser ceci (protège les DataStores).
	MaxCash = 1e300,
})
