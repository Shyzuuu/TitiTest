--!strict
-- Succès déclaratifs : Metric est résolu par Progression.getMetric (pas de fonctions arbitraires
-- en config, ce qui permet à l'UI d'afficher la progression).
local Freeze = require(script.Parent.Parent.Util.Freeze)

export type Achievement = {
	Id: string,
	Name: string,
	Icon: string,
	Description: string,
	Metric: string,
	Target: number,
	RewardCash: number,
}

local Achievements: { Achievement } = {
	{ Id = "FirstMachine", Name = "First Machine", Icon = "🏭", Description = "Buy your first machine.", Metric = "MachinesPurchased", Target = 1, RewardCash = 100 },
	{ Id = "First10K", Name = "First $10K", Icon = "💰", Description = "Earn $10K in total.", Metric = "TotalEarned", Target = 10_000, RewardCash = 1_000 },
	{ Id = "Millionaire", Name = "Millionaire", Icon = "💰", Description = "Earn $1M in total.", Metric = "TotalEarned", Target = 1_000_000, RewardCash = 50_000 },
	{ Id = "FactoryBuilder", Name = "Factory Builder", Icon = "🏗️", Description = "Own 16 machines at once.", Metric = "MachinesOwned", Target = 16, RewardCash = 100_000 },
	{ Id = "FirstRebirth", Name = "First Rebirth", Icon = "⭐", Description = "Perform your first Rebirth.", Metric = "Rebirths", Target = 1, RewardCash = 0 },
	{ Id = "QuantumFactory", Name = "Quantum Factory", Icon = "🚀", Description = "Unlock the Quantum Facility.", Metric = "HighestZone", Target = 4, RewardCash = 10_000_000 },
	{ Id = "FactoryEmpire", Name = "Factory Empire", Icon = "👑", Description = "Unlock the Mega Factory.", Metric = "HighestZone", Target = 5, RewardCash = 1_000_000_000 },
	{ Id = "Billionaire", Name = "Billionaire", Icon = "💎", Description = "Earn $1B in total.", Metric = "TotalEarned", Target = 1_000_000_000, RewardCash = 25_000_000 },
	{ Id = "Dedicated", Name = "Dedicated Worker", Icon = "⏱️", Description = "Play for 1 hour.", Metric = "PlayTime", Target = 3600, RewardCash = 25_000 },
	{ Id = "CodeHunter", Name = "Code Hunter", Icon = "🎟️", Description = "Redeem 3 codes.", Metric = "CodesRedeemed", Target = 3, RewardCash = 5_000 },
	{ Id = "LoyalWorker", Name = "Loyal Worker", Icon = "📅", Description = "Claim 7 daily rewards.", Metric = "DailyClaims", Target = 7, RewardCash = 1_000_000 },
	{ Id = "RebirthLegend", Name = "Rebirth Legend", Icon = "🌌", Description = "Reach 10 Rebirths.", Metric = "Rebirths", Target = 10, RewardCash = 0 },
}

local ById: { [string]: Achievement } = {}
for _, achievement in Achievements do
	assert(ById[achievement.Id] == nil, "Succès dupliqué : " .. achievement.Id)
	ById[achievement.Id] = achievement
end

return Freeze.deep({
	Achievements = Achievements,
	ById = ById,
})
