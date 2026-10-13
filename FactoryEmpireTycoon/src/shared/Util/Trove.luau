-- Conteneur de nettoyage : connexions, instances, fonctions, threads.
-- Garantit qu'aucune connexion ne survit à l'objet qui la possède.
local Trove = {}
Trove.__index = Trove

function Trove.new()
	return setmetatable({ _items = {} }, Trove)
end

function Trove:Add<T>(item: T): T
	if item ~= nil then
		table.insert(self._items, item)
	end
	return item
end

function Trove:Connect(signal: RBXScriptSignal, fn: (...any) -> ()): RBXScriptConnection
	return self:Add(signal:Connect(fn))
end

local function cleanItem(item: any)
	local kind = typeof(item)
	if kind == "RBXScriptConnection" then
		item:Disconnect()
	elseif kind == "Instance" then
		item:Destroy()
	elseif kind == "function" then
		item()
	elseif kind == "thread" then
		if coroutine.status(item) ~= "dead" then
			pcall(task.cancel, item)
		end
	elseif kind == "table" then
		if type(item.Destroy) == "function" then
			item:Destroy()
		elseif type(item.Disconnect) == "function" then
			item:Disconnect()
		elseif type(item.Clean) == "function" then
			item:Clean()
		end
	end
end

function Trove:Clean()
	local items = self._items
	self._items = {}
	-- Ordre inverse : on libère d'abord ce qui dépend des éléments ajoutés plus tôt.
	for i = #items, 1, -1 do
		local ok, err = pcall(cleanItem, items[i])
		if not ok then
			warn("[Trove] cleanup error: " .. tostring(err))
		end
	end
end

Trove.Destroy = Trove.Clean

return Trove
