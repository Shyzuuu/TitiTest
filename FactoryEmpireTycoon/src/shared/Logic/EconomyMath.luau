--!strict
-- Calculs économiques purs (aucune API Roblox) : partagés client/serveur, testés hors Studio.
-- Le serveur reste l'unique autorité ; le client ne s'en sert que pour l'affichage.
local Config = script.Parent.Parent.Config
local GameConfig = require(Config.GameConfig)
local EconomyConfig = require(Config.EconomyConfig)
local MachineConfig = require(Config.MachineConfig)
local UpgradeConfig = require(Config.UpgradeConfig)
local RebirthConfig = require(Config.RebirthConfig)
local DailyRewardConfig = require(Config.DailyRewardConfig)

local EconomyMath = {}

function EconomyMath.isValidAmount(n: any): boolean
	return type(n) == "number" and n == n and n >= 0 and n < math.huge
end

local function wholeNonNegative(n: any): number
	if type(n) ~= "number" or n ~= n or n == math.huge then
		return 0
	end
	return math.max(0, math.floor(n))
end

-- Rebirth ---------------------------------------------------------------------------------------

function EconomyMath.getRebirthMultiplier(rebirths: number?): number
	local n = wholeNonNegative(rebirths)
	local list = RebirthConfig.Multipliers
	if n + 1 <= #list then
		return list[n + 1]
	end
	return list[#list] + (n - (#list - 1)) * RebirthConfig.ExtraPerRebirth
end

function EconomyMath.getRebirthCost(rebirths: number?): number
	local n = wholeNonNegative(rebirths)
	return math.floor(RebirthConfig.BaseCost * RebirthConfig.CostGrowth ^ n)
end

-- Upgrades globaux -------------------------------------------------------------------------------

function EconomyMath.getUpgradeLevel(data: any, upgradeId: string): number
	local upgrade = UpgradeConfig.ById[upgradeId]
	if not upgrade or type(data) ~= "table" or type(data.Upgrades) ~= "table" then
		return 0
	end
	return math.clamp(wholeNonNegative(data.Upgrades[upgradeId]), 0, upgrade.MaxLevel)
end

-- Retourne nil si le niveau maximum est atteint.
function EconomyMath.getUpgradeCost(upgradeId: string, currentLevel: number): number?
	local upgrade = UpgradeConfig.ById[upgradeId]
	if not upgrade then
		return nil
	end
	local level = wholeNonNegative(currentLevel)
	if level >= upgrade.MaxLevel then
		return nil
	end
	return math.floor(upgrade.BaseCost * upgrade.CostGrowth ^ level)
end

function EconomyMath.getUpgradeEffect(upgradeId: string, level: number): number
	local upgrade = UpgradeConfig.ById[upgradeId]
	if not upgrade then
		return 0
	end
	return upgrade.EffectPerLevel * math.clamp(wholeNonNegative(level), 0, upgrade.MaxLevel)
end

-- Machines ---------------------------------------------------------------------------------------

function EconomyMath.getMachineLevel(data: any, itemId: string): number
	if type(data) ~= "table" or type(data.Owned) ~= "table" or data.Owned[itemId] ~= true then
		return 0
	end
	local raw = if type(data.Levels) == "table" then data.Levels[itemId] else nil
	return math.clamp(if raw == nil then 1 else wholeNonNegative(raw), 1, EconomyConfig.MachineMaxLevel)
end

function EconomyMath.getMachineIncome(item: MachineConfig.Machine, level: number): number
	local lvl = math.clamp(wholeNonNegative(level), 1, EconomyConfig.MachineMaxLevel)
	return item.Income * (1 + EconomyConfig.LevelIncomeStep * (lvl - 1))
end

function EconomyMath.getMachineUpgradeCost(item: MachineConfig.Machine, level: number): number?
	local lvl = wholeNonNegative(level)
	if lvl < 1 or lvl >= EconomyConfig.MachineMaxLevel then
		return nil
	end
	return math.floor(item.Cost * EconomyConfig.LevelCostFactor * EconomyConfig.LevelCostGrowth ^ (lvl - 1))
end

-- Multiplicateurs ---------------------------------------------------------------------------------

function EconomyMath.getBoostMultiplier(data: any, now: number): number
	local boost = if type(data) == "table" then data.Boost else nil
	if type(boost) == "table" and type(boost.Expires) == "number" and boost.Expires > now then
		local mult = tonumber(boost.Multiplier) or 1
		return if mult >= 1 then mult else 1
	end
	return 1
end

function EconomyMath.getGlobalMultiplier(data: any, now: number): number
	local rebirth = EconomyMath.getRebirthMultiplier(data.Rebirths)
	local incomeBoost = 1 + EconomyMath.getUpgradeEffect("IncomeBoost", EconomyMath.getUpgradeLevel(data, "IncomeBoost"))
	return rebirth * incomeBoost * EconomyMath.getBoostMultiplier(data, now)
end

-- Production brute (avant multiplicateurs globaux) : somme par zone × (1 + boosts de zone).
function EconomyMath.getBaseIncome(data: any): number
	if type(data) ~= "table" or type(data.Owned) ~= "table" then
		return 0
	end
	local zoneIncome: { [number]: number } = {}
	local zoneBoost: { [number]: number } = {}
	for itemId, owned in data.Owned do
		local item = MachineConfig.ById[itemId]
		if owned == true and item then
			local level = EconomyMath.getMachineLevel(data, itemId)
			zoneIncome[item.Zone] = (zoneIncome[item.Zone] or 0) + EconomyMath.getMachineIncome(item, level)
			zoneBoost[item.Zone] = (zoneBoost[item.Zone] or 0) + item.ZoneBoost
		end
	end
	local total = 0
	for zoneId, income in zoneIncome do
		total += income * (1 + (zoneBoost[zoneId] or 0))
	end
	return total
end

function EconomyMath.getIncomePerSecond(data: any, now: number): number
	return EconomyMath.getBaseIncome(data) * EconomyMath.getGlobalMultiplier(data, now)
end

function EconomyMath.getCollectMultiplier(data: any): number
	return 1 + EconomyMath.getUpgradeEffect("CollectorEfficiency", EconomyMath.getUpgradeLevel(data, "CollectorEfficiency"))
end

function EconomyMath.hasAutoCollector(data: any): boolean
	return EconomyMath.getUpgradeLevel(data, "AutoCollector") >= 1
end

function EconomyMath.getWalkSpeed(data: any): number
	return GameConfig.BaseWalkSpeed + EconomyMath.getUpgradeEffect("SprintBoots", EconomyMath.getUpgradeLevel(data, "SprintBoots"))
end

function EconomyMath.getOfflineRate(data: any): number
	return EconomyMath.getUpgradeEffect("NightShift", EconomyMath.getUpgradeLevel(data, "NightShift"))
end

function EconomyMath.getStartingCash(data: any): number
	return GameConfig.StartingCash + EconomyMath.getUpgradeEffect("InvestorFund", EconomyMath.getUpgradeLevel(data, "InvestorFund"))
end

-- Daily rewards -----------------------------------------------------------------------------------

function EconomyMath.getDailyReward(day: number): DailyRewardConfig.DailyReward
	local days = DailyRewardConfig.Days
	local index = ((wholeNonNegative(day) - 1) % #days) + 1
	return days[index]
end

function EconomyMath.getDailyRewardCash(day: number, rebirths: number?): number
	local reward = EconomyMath.getDailyReward(day)
	local scale = if DailyRewardConfig.ScaleWithRebirth then EconomyMath.getRebirthMultiplier(rebirths) else 1
	return math.floor(reward.Cash * scale)
end

return EconomyMath
