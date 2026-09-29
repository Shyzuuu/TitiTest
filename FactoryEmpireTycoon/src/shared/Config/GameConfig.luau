--!strict
-- Paramètres globaux du jeu. Toute valeur de gameplay « transverse » vit ici.
local Freeze = require(script.Parent.Parent.Util.Freeze)

return Freeze.deep({
	GameName = "Factory Empire Tycoon",
	StartingCash = 100,
	PlotCount = 6,

	-- Boucle économique serveur (1 Hz suffit : aucune raison d'utiliser Heartbeat).
	IncomeTickSeconds = 1,
	AchievementCheckEveryTicks = 5,
	ReplicationInterval = 0.25,

	-- Sauvegarde
	DataStoreName = "FactoryEmpire_PlayerData_v1",
	DataKeyPrefix = "Player_",
	AutoSaveInterval = 60,
	MinSaveInterval = 7, -- limite DataStore : 1 écriture / 6 s par clé
	SessionLockTimeout = 180, -- verrou considéré orphelin au-delà (serveur crashé)
	LoadLockRetries = 6,
	LoadLockRetryDelay = 5,
	MaxRequestRetries = 5,

	-- Leaderboards globaux
	LeaderboardEarnedStore = "FactoryEmpire_TopEarned_v1",
	LeaderboardRebirthStore = "FactoryEmpire_TopRebirths_v1",
	LeaderboardRefreshInterval = 120,
	LeaderboardSubmitInterval = 180,
	LeaderboardSize = 10,

	-- Interactions
	MaxInteractDistance = 24,
	PromptCooldown = 0.15,
	CollectPadCooldown = 0.75,
	TeleportCooldown = 3,
	FirstSpawnTeleportDelay = 2.5,

	-- Anti-spam des RemoteFunctions (token bucket par joueur)
	RateLimitCapacity = 12,
	RateLimitRefillPerSecond = 6,

	-- Gains hors-ligne (upgrade « Night Shift »)
	OfflineEarningsCapSeconds = 7200,
	OfflineEarningsMinSeconds = 60,

	BaseWalkSpeed = 16,
})
