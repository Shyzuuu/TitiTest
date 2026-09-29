--!strict
-- Géométrie d'une parcelle en coordonnées locales (X = largeur, Z = profondeur, -Z = entrée côté lobby).
-- Partagé : le serveur construit, le client en déduit le tracé des convoyeurs cosmétiques.
local PlotLayout = {}

PlotLayout.Width = 180
PlotLayout.Depth = 260
PlotLayout.HalfWidth = 90
PlotLayout.HalfDepth = 130
PlotLayout.FloorTop = 1 -- hauteur du dessus du sol de la parcelle
PlotLayout.WallHeight = 16
PlotLayout.DoorHalfWidth = 24
PlotLayout.EntranceHalfWidth = 22

-- Bandes de profondeur [début, fin] par zone.
PlotLayout.ZoneBands = {
	[1] = { -130, -66 },
	[2] = { -66, -17 },
	[3] = { -17, 32 },
	[4] = { 32, 81 },
	[5] = { 81, 130 },
}

local COLUMNS = { -44, 44, -70, 70 }

PlotLayout.Spawn = { x = 0, z = -121 }
PlotLayout.CollectPad = { x = -16, z = -124 }
PlotLayout.Collector = { x = -16, z = -113 }
PlotLayout.RebirthAltar = { x = 22, z = -116 }
PlotLayout.UpgradeTerminal = { x = 44, z = -122 }
PlotLayout.ArchZ = -129
PlotLayout.MainBeltX = -16
PlotLayout.CollectorIntakeZ = -108

function PlotLayout.getRowZ(zoneId: number, row: number): number
	if zoneId == 1 then
		return if row == 1 then -100 else -80
	end
	local band = PlotLayout.ZoneBands[zoneId]
	return band[1] + (if row == 1 then 14 else 35)
end

function PlotLayout.getSlotPosition(zoneId: number, slot: number): (number, number)
	local column = COLUMNS[((slot - 1) % 4) + 1]
	local row = if slot <= 4 then 1 else 2
	return column, PlotLayout.getRowZ(zoneId, row)
end

-- Segment du convoyeur principal traversant une zone (du fond de la zone vers le collecteur).
function PlotLayout.getBeltSegment(zoneId: number): (number, number)
	local band = PlotLayout.ZoneBands[zoneId]
	if zoneId == 1 then
		return PlotLayout.CollectorIntakeZ, band[2]
	end
	return band[1], band[2]
end

-- Mur séparant la zone (zoneId - 1) de zoneId.
function PlotLayout.getGateZ(zoneId: number): number
	return PlotLayout.ZoneBands[zoneId][1]
end

return PlotLayout
