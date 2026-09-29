--!strict
-- Zones du tycoon. RequiredEarned porte sur les gains de la run en cours (remis à 0 au Rebirth),
-- sinon un Rebirth ne réinitialiserait pas réellement la progression des zones.
local Freeze = require(script.Parent.Parent.Util.Freeze)

export type Zone = {
	Id: number,
	Name: string,
	Icon: string,
	RequiredEarned: number,
	UnlockCost: number,
	Theme: {
		Floor: { number },
		FloorMaterial: string,
		Body: { number },
		BodyMaterial: string,
		Trim: { number },
		TrimMaterial: string,
		Accent: { number },
		Light: { number },
	},
}

local Zones: { Zone } = {
	{
		Id = 1,
		Name = "Starter Factory",
		Icon = "🏭",
		RequiredEarned = 0,
		UnlockCost = 0,
		Theme = {
			Floor = { 120, 120, 118 },
			FloorMaterial = "Concrete",
			Body = { 150, 154, 160 },
			BodyMaterial = "Metal",
			Trim = { 70, 72, 78 },
			TrimMaterial = "DiamondPlate",
			Accent = { 255, 150, 40 },
			Light = { 255, 190, 120 },
		},
	},
	{
		Id = 2,
		Name = "Industrial Area",
		Icon = "⚙️",
		RequiredEarned = 10_000,
		UnlockCost = 5_000,
		Theme = {
			Floor = { 88, 90, 96 },
			FloorMaterial = "DiamondPlate",
			Body = { 96, 104, 116 },
			BodyMaterial = "Metal",
			Trim = { 230, 180, 30 },
			TrimMaterial = "Metal",
			Accent = { 255, 210, 40 },
			Light = { 255, 225, 150 },
		},
	},
	{
		Id = 3,
		Name = "Advanced Labs",
		Icon = "🧪",
		RequiredEarned = 1_000_000,
		UnlockCost = 250_000,
		Theme = {
			Floor = { 215, 222, 230 },
			FloorMaterial = "SmoothPlastic",
			Body = { 235, 240, 245 },
			BodyMaterial = "SmoothPlastic",
			Trim = { 60, 70, 90 },
			TrimMaterial = "Metal",
			Accent = { 40, 220, 255 },
			Light = { 150, 235, 255 },
		},
	},
	{
		Id = 4,
		Name = "Quantum Facility",
		Icon = "🚀",
		RequiredEarned = 100_000_000,
		UnlockCost = 25_000_000,
		Theme = {
			Floor = { 30, 22, 48 },
			FloorMaterial = "Slate",
			Body = { 45, 35, 70 },
			BodyMaterial = "Metal",
			Trim = { 20, 16, 30 },
			TrimMaterial = "Metal",
			Accent = { 190, 80, 255 },
			Light = { 210, 150, 255 },
		},
	},
	{
		Id = 5,
		Name = "Mega Factory",
		Icon = "👑",
		RequiredEarned = 10_000_000_000,
		UnlockCost = 2_500_000_000,
		Theme = {
			Floor = { 24, 24, 26 },
			FloorMaterial = "Marble",
			Body = { 30, 30, 34 },
			BodyMaterial = "Metal",
			Trim = { 212, 170, 60 },
			TrimMaterial = "Foil",
			Accent = { 255, 200, 50 },
			Light = { 255, 220, 140 },
		},
	},
}

local ById: { [number]: Zone } = {}
for _, zone in Zones do
	ById[zone.Id] = zone
end

return Freeze.deep({
	Zones = Zones,
	ById = ById,
	Count = #Zones,
})
