--!strict
-- Règles de progression pures : disponibilité des machines, état des zones, métriques de succès.
local Config = script.Parent.Parent.Config
local ZoneConfig = require(Config.ZoneConfig)
local MachineConfig = require(Config.MachineConfig)

local Progression = {}

export type ZoneState = "Unlocked" | "Ready" | "Locked"

function Progression.isZoneUnlocked(data: any, zoneId: number): boolean
	if zoneId == 1 then
		return true
	end
	return type(data) == "table" and type(data.Zones) == "table" and data.Zones[tostring(zoneId)] == true
end

function Progression.isOwned(data: any, itemId: string): boolean
	return type(data) == "table" and type(data.Owned) == "table" and data.Owned[itemId] == true
end

function Progression.getHighestZone(data: any): number
	local highest = 1
	for _, zone in ZoneConfig.Zones do
		if Progression.isZoneUnlocked(data, zone.Id) then
			highest = math.max(highest, zone.Id)
		end
	end
	return highest
end

function Progression.countUnlockedZones(data: any): number
	local count = 0
	for _, zone in ZoneConfig.Zones do
		if Progression.isZoneUnlocked(data, zone.Id) then
			count += 1
		end
	end
	return count
end

function Progression.countOwned(data: any): number
	local count = 0
	if type(data) == "table" and type(data.Owned) == "table" then
		for itemId, owned in data.Owned do
			if owned == true and MachineConfig.ById[itemId] then
				count += 1
			end
		end
	end
	return count
end

-- Une machine est achetable si sa zone est ouverte, ses prérequis possédés et elle-même non possédée.
function Progression.isItemAvailable(data: any, item: MachineConfig.Machine): boolean
	if Progression.isOwned(data, item.Id) or not Progression.isZoneUnlocked(data, item.Zone) then
		return false
	end
	for _, requiredId in item.Requires do
		if not Progression.isOwned(data, requiredId) then
			return false
		end
	end
	return true
end

function Progression.getAvailableItems(data: any): { MachineConfig.Machine }
	local list = {}
	for _, item in MachineConfig.Items do
		if Progression.isItemAvailable(data, item) then
			table.insert(list, item)
		end
	end
	return list
end

-- Les zones se débloquent séquentiellement : la zone précédente doit être ouverte.
function Progression.meetsZoneRequirement(data: any, zoneId: number): boolean
	local zone = ZoneConfig.ById[zoneId]
	if not zone then
		return false
	end
	if zoneId > 1 and not Progression.isZoneUnlocked(data, zoneId - 1) then
		return false
	end
	local earned = if type(data) == "table" and type(data.RunEarned) == "number" then data.RunEarned else 0
	return earned >= zone.RequiredEarned
end

function Progression.getZoneState(data: any, zoneId: number): ZoneState
	if Progression.isZoneUnlocked(data, zoneId) then
		return "Unlocked"
	end
	return if Progression.meetsZoneRequirement(data, zoneId) then "Ready" else "Locked"
end

function Progression.getNextZone(data: any): ZoneConfig.Zone?
	for _, zone in ZoneConfig.Zones do
		if not Progression.isZoneUnlocked(data, zone.Id) then
			return zone
		end
	end
	return nil
end

local function countKeys(t: any): number
	local count = 0
	if type(t) == "table" then
		for _ in t do
			count += 1
		end
	end
	return count
end

-- Métriques utilisées par les succès (et l'écran de statistiques).
function Progression.getMetric(data: any, metric: string): number
	local stats = if type(data) == "table" and type(data.Stats) == "table" then data.Stats else {}
	if metric == "TotalEarned" then
		return tonumber(data.TotalEarned) or 0
	elseif metric == "Rebirths" then
		return tonumber(data.Rebirths) or 0
	elseif metric == "MachinesOwned" then
		return Progression.countOwned(data)
	elseif metric == "HighestZone" then
		return Progression.getHighestZone(data)
	elseif metric == "CodesRedeemed" then
		return countKeys(data.Codes)
	elseif metric == "DailyClaims" then
		return if type(data.Daily) == "table" then tonumber(data.Daily.Claims) or 0 else 0
	end
	return tonumber(stats[metric]) or 0
end

return Progression
