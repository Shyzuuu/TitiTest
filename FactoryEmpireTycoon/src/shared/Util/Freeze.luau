--!strict
-- Gel profond des tables de configuration : toute écriture accidentelle lève une erreur.
local Freeze = {}

function Freeze.deep<T>(value: T): T
	if type(value) == "table" and not table.isfrozen(value :: any) then
		for _, child in value :: any do
			Freeze.deep(child)
		end
		table.freeze(value :: any)
	end
	return value
end

return Freeze
