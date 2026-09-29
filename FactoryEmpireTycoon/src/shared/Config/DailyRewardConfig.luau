--!strict
local Freeze = require(script.Parent.Parent.Util.Freeze)

export type DailyReward = {
	Day: number,
	Cash: number,
	Boost: { Multiplier: number, Duration: number }?,
	Label: string,
}

return Freeze.deep({
	Cooldown = 24 * 3600,
	-- Au-delà de ce délai sans réclamer, la série repart au jour 1.
	StreakResetAfter = 48 * 3600,
	-- Les récompenses en Cash sont multipliées par le multiplicateur de Rebirth pour rester utiles.
	ScaleWithRebirth = true,
	Days = {
		{ Day = 1, Cash = 500, Label = "$500" },
		{ Day = 2, Cash = 2_000, Label = "$2K" },
		{ Day = 3, Cash = 10_000, Label = "$10K" },
		{ Day = 4, Cash = 50_000, Label = "$50K" },
		{ Day = 5, Cash = 250_000, Label = "$250K" },
		{ Day = 6, Cash = 1_000_000, Label = "$1M" },
		{ Day = 7, Cash = 10_000_000, Boost = { Multiplier = 2, Duration = 3600 }, Label = "$10M + 2x Income (1h)" },
	} :: { DailyReward },
})
