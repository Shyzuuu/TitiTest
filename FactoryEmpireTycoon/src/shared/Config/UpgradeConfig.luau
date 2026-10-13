--!strict
-- Améliorations globales achetées depuis le menu Upgrades.
-- KeepOnRebirth = améliorations permanentes conservées lors d'un Rebirth.
local Freeze = require(script.Parent.Parent.Util.Freeze)

export type Upgrade = {
	Id: string,
	Name: string,
	Icon: string,
	Description: string,
	MaxLevel: number,
	BaseCost: number,
	CostGrowth: number,
	EffectPerLevel: number,
	EffectKind: "Percent" | "Flat" | "Toggle" | "Cash",
	KeepOnRebirth: boolean,
	Order: number,
}

local Upgrades: { Upgrade } = {
	{
		Id = "IncomeBoost",
		Name = "Income Boost",
		Icon = "📈",
		Description = "+10% income from every machine.",
		MaxLevel = 25,
		BaseCost = 2_000,
		CostGrowth = 2.2,
		EffectPerLevel = 0.10,
		EffectKind = "Percent",
		KeepOnRebirth = false,
		Order = 1,
	},
	{
		Id = "CollectorEfficiency",
		Name = "Collector Efficiency",
		Icon = "💵",
		Description = "+5% bonus cash on every collection.",
		MaxLevel = 10,
		BaseCost = 1_500,
		CostGrowth = 2.5,
		EffectPerLevel = 0.05,
		EffectKind = "Percent",
		KeepOnRebirth = false,
		Order = 2,
	},
	{
		Id = "AutoCollector",
		Name = "Auto Collector",
		Icon = "🤖",
		Description = "Cash goes straight to your wallet. Kept on Rebirth.",
		MaxLevel = 1,
		BaseCost = 50_000,
		CostGrowth = 1,
		EffectPerLevel = 1,
		EffectKind = "Toggle",
		KeepOnRebirth = true,
		Order = 3,
	},
	{
		Id = "SprintBoots",
		Name = "Sprint Boots",
		Icon = "👟",
		Description = "+3 walk speed per level. Kept on Rebirth.",
		MaxLevel = 4,
		BaseCost = 2_500,
		CostGrowth = 4,
		EffectPerLevel = 3,
		EffectKind = "Flat",
		KeepOnRebirth = true,
		Order = 4,
	},
	{
		Id = "NightShift",
		Name = "Night Shift",
		Icon = "🌙",
		Description = "Earn 10% of your income per level while offline (max 2h). Kept on Rebirth.",
		MaxLevel = 5,
		BaseCost = 100_000,
		CostGrowth = 5,
		EffectPerLevel = 0.10,
		EffectKind = "Percent",
		KeepOnRebirth = true,
		Order = 5,
	},
	{
		Id = "InvestorFund",
		Name = "Investor Fund",
		Icon = "🏦",
		Description = "Start every Rebirth with +$5K per level. Kept on Rebirth.",
		MaxLevel = 5,
		BaseCost = 1_000_000,
		CostGrowth = 4,
		EffectPerLevel = 5_000,
		EffectKind = "Cash",
		KeepOnRebirth = true,
		Order = 6,
	},
}

local ById: { [string]: Upgrade } = {}
for _, upgrade in Upgrades do
	assert(ById[upgrade.Id] == nil, "Upgrade dupliqué : " .. upgrade.Id)
	ById[upgrade.Id] = upgrade
end

return Freeze.deep({
	Upgrades = Upgrades,
	ById = ById,
})
