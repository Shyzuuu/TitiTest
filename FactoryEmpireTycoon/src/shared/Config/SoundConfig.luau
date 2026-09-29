--!strict
-- Registre unique des sons. Les chemins rbxasset:// sont embarqués dans le client Roblox :
-- aucun problème de permission d'asset. Remplacer Id par vos propres rbxassetid:// si besoin.
local Freeze = require(script.Parent.Parent.Util.Freeze)

export type SoundDef = { Id: string, Volume: number, PlaybackSpeed: number }

return Freeze.deep({
	Purchase = { Id = "rbxasset://sounds/electronicpingshort.wav", Volume = 0.55, PlaybackSpeed = 1 },
	Error = { Id = "rbxasset://sounds/clickfast.wav", Volume = 0.7, PlaybackSpeed = 0.5 },
	Collect = { Id = "rbxasset://sounds/electronicpingshort.wav", Volume = 0.4, PlaybackSpeed = 1.6 },
	Upgrade = { Id = "rbxasset://sounds/swoosh.wav", Volume = 0.5, PlaybackSpeed = 1.3 },
	Rebirth = { Id = "rbxasset://sounds/impact_explosion_03.mp3", Volume = 0.45, PlaybackSpeed = 0.8 },
	Achievement = { Id = "rbxasset://sounds/victory.wav", Volume = 0.5, PlaybackSpeed = 1 },
	MenuOpen = { Id = "rbxasset://sounds/swoosh.wav", Volume = 0.3, PlaybackSpeed = 1.7 },
	Click = { Id = "rbxasset://sounds/clickfast.wav", Volume = 0.35, PlaybackSpeed = 1.2 },
	ZoneUnlock = { Id = "rbxasset://sounds/swoosh.wav", Volume = 0.6, PlaybackSpeed = 0.6 },
	Reward = { Id = "rbxasset://sounds/victory.wav", Volume = 0.45, PlaybackSpeed = 1.15 },
} :: { [string]: SoundDef })
