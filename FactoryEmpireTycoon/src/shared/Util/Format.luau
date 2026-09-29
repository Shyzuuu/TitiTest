--!strict
-- Formatage des nombres/temps. Tolère NaN/inf pour ne jamais casser l'UI.
local Format = {}

local SUFFIXES = { "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc" }

local function isFinite(n: any): boolean
	return type(n) == "number" and n == n and n ~= math.huge and n ~= -math.huge
end

local function trimZeros(s: string): string
	if string.find(s, "%.") then
		s = string.gsub(s, "0+$", "")
		s = string.gsub(s, "%.$", "")
	end
	return s
end

function Format.number(n: number?): string
	if not isFinite(n) then
		return "0"
	end
	local value = n :: number
	local negative = value < 0
	local abs = math.abs(value)
	local out: string
	if abs < 1000 then
		-- Troncature (et non arrondi) : on n'affiche jamais plus que ce que le joueur possède.
		if abs >= 100 or abs == math.floor(abs) then
			out = tostring(math.floor(abs))
		else
			out = trimZeros(string.format("%.1f", math.floor(abs * 10) / 10))
		end
	else
		local tier = math.floor(math.log10(abs) / 3)
		local scaled = abs / 10 ^ (tier * 3)
		-- Correction des erreurs d'arrondi flottant de log10 aux frontières (ex : 1e6).
		if scaled >= 1000 then
			tier += 1
			scaled /= 1000
		elseif scaled < 1 then
			tier -= 1
			scaled *= 1000
		end
		if tier >= #SUFFIXES then
			out = string.format("%.2e", abs)
		else
			local body: string
			if scaled >= 100 then
				body = tostring(math.floor(scaled))
			elseif scaled >= 10 then
				body = trimZeros(string.format("%.1f", math.floor(scaled * 10) / 10))
			else
				body = trimZeros(string.format("%.2f", math.floor(scaled * 100) / 100))
			end
			out = body .. SUFFIXES[tier + 1]
		end
	end
	return if negative then "-" .. out else out
end

function Format.cash(n: number?): string
	if isFinite(n) and (n :: number) < 0 then
		return "-$" .. Format.number(-(n :: number))
	end
	return "$" .. Format.number(n)
end

function Format.rate(n: number?): string
	return Format.cash(n) .. "/s"
end

function Format.commas(n: number?): string
	if not isFinite(n) then
		return "0"
	end
	local value = math.floor(math.abs(n :: number))
	if value >= 1e15 then
		return Format.number(n)
	end
	local s = string.format("%d", value)
	local formatted = string.reverse((string.gsub(string.reverse(s), "(%d%d%d)", "%1,")))
	formatted = string.gsub(formatted, "^,", "")
	return if (n :: number) < 0 then "-" .. formatted else formatted
end

function Format.multiplier(n: number?): string
	if not isFinite(n) then
		return "x1"
	end
	return "x" .. trimZeros(string.format("%.2f", n :: number))
end

function Format.percent(fraction: number?): string
	if not isFinite(fraction) then
		return "0%"
	end
	return trimZeros(string.format("%.1f", (fraction :: number) * 100)) .. "%"
end

-- "1d 2h", "3h 05m", "4m 09s", "12s"
function Format.duration(seconds: number?): string
	if not isFinite(seconds) or (seconds :: number) <= 0 then
		return "0s"
	end
	local s = math.floor(seconds :: number)
	local d = s // 86400
	local h = (s % 86400) // 3600
	local m = (s % 3600) // 60
	local sec = s % 60
	if d > 0 then
		return string.format("%dd %dh", d, h)
	elseif h > 0 then
		return string.format("%dh %02dm", h, m)
	elseif m > 0 then
		return string.format("%dm %02ds", m, sec)
	end
	return string.format("%ds", sec)
end

function Format.clock(seconds: number?): string
	if not isFinite(seconds) or (seconds :: number) <= 0 then
		return "00:00:00"
	end
	local s = math.floor(seconds :: number)
	return string.format("%02d:%02d:%02d", s // 3600, (s % 3600) // 60, s % 60)
end

Format.isFinite = isFinite

return Format
