-- Contrat réseau unique. Volontairement minimal : 1 RemoteFunction pour les actions client,
-- 3 RemoteEvents serveur→client. Moins de remotes = surface d'attaque et de spam réduite.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Net = {}

Net.FolderName = "Remotes"

Net.Functions = {
	Action = "Action", -- client → serveur : { action, payload } → { ok, message, data }
}

Net.Events = {
	State = "State", -- serveur → client : snapshot complet ou delta « chaud »
	Notify = "Notify", -- serveur → client : toast / erreur / succès
	Effect = "Effect", -- serveur → client : effet visuel ou sonore localisé
}

Net.Actions = {
	GetState = "GetState",
	BuyUpgrade = "BuyUpgrade",
	Rebirth = "Rebirth",
	ClaimDaily = "ClaimDaily",
	RedeemCode = "RedeemCode",
	SetSetting = "SetSetting",
	TeleportHome = "TeleportHome",
}

function Net.createServer(): Folder
	assert(RunService:IsServer(), "Net.createServer est réservé au serveur")
	local existing = ReplicatedStorage:FindFirstChild(Net.FolderName)
	if existing then
		existing:Destroy()
	end
	local folder = Instance.new("Folder")
	folder.Name = Net.FolderName
	for _, name in Net.Functions do
		local remote = Instance.new("RemoteFunction")
		remote.Name = name
		remote.Parent = folder
	end
	for _, name in Net.Events do
		local remote = Instance.new("RemoteEvent")
		remote.Name = name
		remote.Parent = folder
	end
	folder.Parent = ReplicatedStorage
	return folder
end

function Net.getFolder(timeout: number?): Folder
	local folder = ReplicatedStorage:WaitForChild(Net.FolderName, timeout or 30)
	assert(folder, "Remotes introuvables : le serveur n'a pas démarré correctement")
	return folder :: Folder
end

function Net.getEvent(name: string): RemoteEvent
	local remote = Net.getFolder():WaitForChild(name, 30)
	assert(remote and remote:IsA("RemoteEvent"), "RemoteEvent manquant : " .. name)
	return remote
end

function Net.getFunction(name: string): RemoteFunction
	local remote = Net.getFolder():WaitForChild(name, 30)
	assert(remote and remote:IsA("RemoteFunction"), "RemoteFunction manquante : " .. name)
	return remote
end

return Net
