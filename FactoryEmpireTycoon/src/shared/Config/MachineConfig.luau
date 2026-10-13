--!strict
-- Catalogue central des machines. Pour équilibrer le jeu, seul ce fichier (et EconomyConfig) est à modifier.
-- Les Id sont persistés dans les sauvegardes : ne jamais renommer un Id existant.
local Freeze = require(script.Parent.Parent.Util.Freeze)

export type MachineType =
	"Generator"
	| "Conveyor"
	| "Miner"
	| "Processor"
	| "Furnace"
	| "FactoryMachine"
	| "AdvancedGenerator"
	| "QuantumMachine"

export type Machine = {
	Id: string,
	Name: string,
	Type: MachineType,
	Zone: number,
	Slot: number,
	Cost: number,
	Income: number,
	ZoneBoost: number, -- bonus multiplicatif appliqué à toute la production de la zone
	Requires: { string },
	Order: number,
}

local Types = {
	Generator = { Label = "Generator", Icon = "⚡", Role = "Steady cash production." },
	Conveyor = { Label = "Conveyor", Icon = "➡️", Role = "Low output, boosts every machine in its zone." },
	Miner = { Label = "Miner", Icon = "⛏️", Role = "Extracts raw ore for solid income." },
	Processor = { Label = "Processor", Icon = "🔧", Role = "Refines ore: big zone-wide boost." },
	Furnace = { Label = "Furnace", Icon = "🔥", Role = "Smelts ore into valuable ingots." },
	FactoryMachine = { Label = "Factory Machine", Icon = "🏗️", Role = "Assembles products: high output." },
	AdvancedGenerator = { Label = "Advanced Generator", Icon = "🔋", Role = "High-efficiency power source." },
	QuantumMachine = { Label = "Quantum Machine", Icon = "🌀", Role = "Bends physics for massive output." },
}

-- { Id, Name, Type, Cost, Income, ZoneBoost } — l'ordre dans chaque zone définit le slot.
type Row = { any }
local ZoneRows: { [number]: { Row } } = {
	[1] = {
		{ "z1_basic_generator", "Basic Generator", "Generator", 100, 5, 0 },
		{ "z1_starter_conveyor", "Starter Conveyor", "Conveyor", 250, 3, 0.10 },
		{ "z1_coal_miner", "Coal Miner", "Miner", 450, 15, 0 },
		{ "z1_advanced_generator", "Advanced Generator", "AdvancedGenerator", 1_000, 40, 0 },
		{ "z1_small_furnace", "Small Furnace", "Furnace", 2_000, 60, 0 },
		{ "z1_ore_processor", "Ore Processor", "Processor", 3_500, 80, 0.15 },
		{ "z1_factory_press", "Factory Press", "FactoryMachine", 6_000, 150, 0 },
		{ "z1_twin_generator", "Twin Generator", "Generator", 9_000, 220, 0 },
	},
	[2] = {
		{ "z2_industrial_generator", "Industrial Generator", "Generator", 10_000, 500, 0 },
		{ "z2_heavy_conveyor", "Heavy Conveyor", "Conveyor", 18_000, 250, 0.15 },
		{ "z2_deep_miner", "Deep Miner", "Miner", 30_000, 800, 0 },
		{ "z2_steel_furnace", "Steel Furnace", "Furnace", 50_000, 1_200, 0 },
		{ "z2_industrial_processor", "Industrial Processor", "Processor", 80_000, 1_500, 0.15 },
		{ "z2_assembly_line", "Assembly Line", "FactoryMachine", 130_000, 3_000, 0 },
		{ "z2_turbine_generator", "Turbine Generator", "AdvancedGenerator", 200_000, 4_500, 0 },
		{ "z2_mega_press", "Mega Press", "FactoryMachine", 320_000, 7_000, 0 },
	},
	[3] = {
		{ "z3_quantum_generator", "Quantum Generator", "QuantumMachine", 1_000_000, 50_000, 0 },
		{ "z3_plasma_conveyor", "Plasma Conveyor", "Conveyor", 1_600_000, 20_000, 0.15 },
		{ "z3_crystal_miner", "Crystal Miner", "Miner", 2_500_000, 60_000, 0 },
		{ "z3_laser_furnace", "Laser Furnace", "Furnace", 4_000_000, 90_000, 0 },
		{ "z3_nano_processor", "Nano Processor", "Processor", 6_500_000, 100_000, 0.20 },
		{ "z3_robotic_assembler", "Robotic Assembler", "FactoryMachine", 10_000_000, 200_000, 0 },
		{ "z3_fusion_generator", "Fusion Generator", "AdvancedGenerator", 16_000_000, 300_000, 0 },
		{ "z3_ai_core", "AI Factory Core", "QuantumMachine", 25_000_000, 450_000, 0 },
	},
	[4] = {
		{ "z4_quantum_conveyor", "Quantum Conveyor", "Conveyor", 60_000_000, 400_000, 0.15 },
		{ "z4_quantum_miner", "Quantum Miner", "Miner", 100_000_000, 1_200_000, 0 },
		{ "z4_quantum_processor", "Quantum Processor", "Processor", 160_000_000, 1_000_000, 0.20 },
		{ "z4_quantum_furnace", "Quantum Furnace", "Furnace", 250_000_000, 2_500_000, 0 },
		{ "z4_quantum_reactor", "Quantum Reactor", "QuantumMachine", 400_000_000, 3_600_000, 0 },
		{ "z4_quantum_assembler", "Quantum Assembler", "FactoryMachine", 650_000_000, 5_500_000, 0 },
		{ "z4_quantum_core", "Quantum Core", "QuantumMachine", 1_000_000_000, 8_000_000, 0 },
		{ "z4_singularity_generator", "Singularity Generator", "AdvancedGenerator", 1_600_000_000, 12_000_000, 0 },
	},
	[5] = {
		{ "z5_mega_conveyor", "Mega Conveyor", "Conveyor", 5_000_000_000, 20_000_000, 0.20 },
		{ "z5_mega_miner", "Mega Miner", "Miner", 8_000_000_000, 50_000_000, 0 },
		{ "z5_mega_furnace", "Mega Furnace", "Furnace", 13_000_000_000, 75_000_000, 0 },
		{ "z5_mega_processor", "Mega Processor", "Processor", 20_000_000_000, 60_000_000, 0.25 },
		{ "z5_mega_assembly", "Mega Assembly", "FactoryMachine", 32_000_000_000, 170_000_000, 0 },
		{ "z5_mega_generator", "Mega Generator", "AdvancedGenerator", 50_000_000_000, 250_000_000, 0 },
		{ "z5_quantum_array", "Quantum Array", "QuantumMachine", 80_000_000_000, 380_000_000, 0 },
		{ "z5_empire_core", "Empire Core", "QuantumMachine", 150_000_000_000, 650_000_000, 0 },
	},
}

-- Arbre de déblocage intra-zone : deux branches parallèles qui se rejoignent au slot 8.
local SLOT_REQUIREMENTS: { [number]: { number } } = {
	[1] = {},
	[2] = { 1 },
	[3] = { 1 },
	[4] = { 2 },
	[5] = { 3 },
	[6] = { 4 },
	[7] = { 5 },
	[8] = { 6, 7 },
}

local Items: { Machine } = {}
local ById: { [string]: Machine } = {}
local ByZone: { [number]: { Machine } } = {}

local order = 0
for zoneId = 1, #ZoneRows do
	local rows = ZoneRows[zoneId]
	ByZone[zoneId] = {}
	for slot, row in rows do
		order += 1
		local requires = {}
		for _, requiredSlot in SLOT_REQUIREMENTS[slot] or {} do
			table.insert(requires, rows[requiredSlot][1])
		end
		local item: Machine = {
			Id = row[1],
			Name = row[2],
			Type = row[3],
			Zone = zoneId,
			Slot = slot,
			Cost = row[4],
			Income = row[5],
			ZoneBoost = row[6],
			Requires = requires,
			Order = order,
		}
		assert(Types[item.Type], "Type de machine inconnu : " .. tostring(item.Type))
		assert(ById[item.Id] == nil, "Id de machine dupliqué : " .. item.Id)
		assert(item.Cost > 0 and item.Income >= 0, "Valeurs invalides pour " .. item.Id)
		table.insert(Items, item)
		table.insert(ByZone[zoneId], item)
		ById[item.Id] = item
	end
end

return Freeze.deep({
	Types = Types,
	Items = Items,
	ById = ById,
	ByZone = ByZone,
	Count = #Items,
	SlotsPerZone = 8,
})
