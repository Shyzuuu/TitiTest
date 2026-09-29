--!strict
local Freeze = require(script.Parent.Parent.Util.Freeze)

return Freeze.deep({
	-- Cash requis pour le Rebirth n°(n+1) = BaseCost * CostGrowth^n
	BaseCost = 5_000_000,
	CostGrowth = 6,
	-- Multiplicateur permanent par nombre de Rebirths (index 1 = 0 Rebirth).
	Multipliers = { 1, 1.5, 2, 3, 4.5, 6.5, 9, 12, 16, 21, 27 },
	-- Au-delà de la table : +ExtraPerRebirth par Rebirth supplémentaire.
	ExtraPerRebirth = 7,
	Cooldown = 3,
	-- Documentation affichée dans l'UI.
	Resets = { "Cash", "Machines & levels", "Zones", "Income Boost & Collector upgrades" },
	Keeps = { "Rebirths & multiplier", "Permanent upgrades", "Statistics & achievements", "Daily streak & codes" },
})
