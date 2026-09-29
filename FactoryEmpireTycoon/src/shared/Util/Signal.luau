--!strict
-- Signal léger en pur Luau (pas de BindableEvent : pas de copie des arguments, testable hors Roblox).
-- Chaque handler est isolé par xpcall : un listener défaillant ne casse pas les autres.
local Signal = {}
Signal.__index = Signal

export type Connection = { Connected: boolean, Disconnect: (self: Connection) -> () }

type Listener = { fn: (...any) -> (), connected: boolean }

function Signal.new()
	return setmetatable({ _listeners = {} :: { Listener } }, Signal)
end

function Signal:Connect(fn: (...any) -> ()): Connection
	assert(type(fn) == "function", "Signal:Connect attend une fonction")
	local listener: Listener = { fn = fn, connected = true }
	table.insert(self._listeners, listener)
	local listeners = self._listeners
	local connection = { Connected = true }
	function connection.Disconnect(conn: any)
		if not listener.connected then
			return
		end
		listener.connected = false
		conn.Connected = false
		local index = table.find(listeners, listener)
		if index then
			table.remove(listeners, index)
		end
	end
	return connection :: any
end

function Signal:Fire(...: any)
	-- Copie : un handler peut se déconnecter pendant l'itération.
	local snapshot = table.clone(self._listeners)
	for _, listener in snapshot do
		if listener.connected then
			local ok, err = xpcall(listener.fn, debug.traceback, ...)
			if not ok then
				warn("[Signal] handler error: " .. tostring(err))
			end
		end
	end
end

function Signal:DisconnectAll()
	for _, listener in self._listeners do
		listener.connected = false
	end
	table.clear(self._listeners)
end

return Signal
