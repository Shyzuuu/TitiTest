#!/usr/bin/env python3
"""Decoupe doors/AbyssPaint.lua en parties collables dans Delta Android.

Delta n'execute pas un script colle de plus de ~32 Ko : chaque partie stocke un morceau du
source dans getgenv().AbyssSrc ; la derniere partie recolle le tout et le lance via loadstring.
Usage : python3 doors/build_parts.py [nombre_de_parties]
"""
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "AbyssPaint.lua")
OUT = os.path.join(ROOT, "parts")
LIMIT = 30000  # octets par partie, marge sous la limite constatee de Delta

NOTIFY = (
    'pcall(function() game:GetService("StarterGui"):SetCore("SendNotification", '
    '{ Title = "ABYSS PAINT", Text = %s, Duration = 8 }) end)\n'
)

FINAL = '''local G = (getgenv and getgenv()) or _G
G.AbyssSrc = G.AbyssSrc or {}
G.AbyssSrc[%(i)d] = [==[%(chunk)s]==]
local missing = {}
for k = 1, %(n)d do if not G.AbyssSrc[k] then table.insert(missing, k) end end
if #missing > 0 then
	-- partie oubliee : on le dit a l'ecran au lieu d'echouer en silence
	%(notify_missing)s	return
end
local src = table.concat(G.AbyssSrc)
G.AbyssSrc = nil
local fn, err = loadstring(src, "=AbyssPaint")
if not fn then
	%(notify_err)s	warn("[Abyss] " .. tostring(err))
	return
end
-- meme environnement que la partie collee (indispensable hors executeur, sans effet sur Delta)
if setfenv and getfenv then pcall(setfenv, fn, getfenv(1)) end
fn()
'''


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    src = open(SRC, encoding="utf-8").read()
    if "]==]" in src:
        raise SystemExit("le source contient ]==] : augmenter le niveau des crochets")
    if any(ord(c) > 127 for c in src):
        raise SystemExit("le source doit rester en ASCII pour Delta")
    lines = src.splitlines(keepends=True)
    # decoupe sur des fins de ligne, en morceaux de taille equilibree
    target = len(src) / n
    chunks, cur = [], ""
    for line in lines:
        if len(cur) >= target and len(chunks) < n - 1:
            chunks.append(cur)
            cur = ""
        cur += line
    chunks.append(cur)
    os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):
        if old.startswith("AbyssPaint_") and old.endswith(".lua"):
            os.remove(os.path.join(OUT, old))
    for i, chunk in enumerate(chunks, 1):
        if i < n:
            body = ("-- ABYSS PAINT : partie %d/%d. Execute les %d parties dans l'ordre (1, 2, 3...).\n" % (i, n, n)
                    + "local G = (getgenv and getgenv()) or _G\n"
                    + ("G.AbyssSrc = {}\n" if i == 1 else "G.AbyssSrc = G.AbyssSrc or {}\n")
                    + "G.AbyssSrc[%d] = [==[%s]==]\n" % (i, chunk)
                    + NOTIFY % ('"Partie %d/%d OK. Execute la partie %d."' % (i, n, i + 1)))
        else:
            body = ("-- ABYSS PAINT : partie %d/%d (derniere). Lance le script complet.\n" % (i, n)
                    + FINAL % {
                        "i": i, "n": n, "chunk": chunk,
                        "notify_missing": NOTIFY % '"Il manque la partie " .. table.concat(missing, ", ") .. ". Recommence a la partie 1."',
                        "notify_err": NOTIFY % '"Erreur : " .. tostring(err)',
                    })
        path = os.path.join(OUT, "AbyssPaint_%d.lua" % i)
        open(path, "w", encoding="utf-8").write(body)
        size = len(body.encode("utf-8"))
        if size > LIMIT:
            raise SystemExit("%s fait %d octets (> %d) : augmenter le nombre de parties" % (path, size, LIMIT))
        print("%s : %d octets" % (os.path.relpath(path), size))


if __name__ == "__main__":
    main()
