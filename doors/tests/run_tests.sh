#!/usr/bin/env bash
# Lance les tests headless d'Abyss. Usage : doors/tests/run_tests.sh [chemin/vers/luau]
set -euo pipefail
cd "$(dirname "$0")/../.."
LUAU="${1:-luau}"
# Le CLI Luau n'a pas de bibliotheque io : chaque script est embarque dans un module qui renvoie son source
# les parties collables doivent toujours correspondre au script complet
python3 doors/build_parts.py 3 > /dev/null
python3 - <<'PY'
for src_path, mod in (("doors/AbyssV5.lua", "_abyss_src"), ("doors/AbyssMini.lua", "_mini_src"), ("doors/AbyssPaint.lua", "_paint_src")):
    src = open(src_path, encoding="utf-8").read()
    level = 0
    while ("]" + "=" * level + "]") in src:
        level += 1
    eq = "=" * level
    open("doors/tests/" + mod + ".luau", "w", encoding="utf-8").write("return [" + eq + "[" + src + "]" + eq + "]\n")
for i in (1, 2, 3):
    src = open("doors/parts/AbyssPaint_%d.lua" % i, encoding="utf-8").read()
    level = 0
    while ("]" + "=" * level + "]") in src:
        level += 1
    eq = "=" * level
    open("doors/tests/_part%d_src.luau" % i, "w", encoding="utf-8").write("return [" + eq + "[" + src + "]" + eq + "]\n")
PY
echo "=== AbyssV5 ==="
"$LUAU" doors/tests/test_abyss_v5.luau
echo "=== AbyssMini ==="
"$LUAU" doors/tests/test_abyss_mini.luau
echo "=== AbyssPaint ==="
"$LUAU" doors/tests/test_abyss_paint.luau
echo "=== AbyssPaint (floors + protections) ==="
"$LUAU" doors/tests/test_abyss_fusion.luau
echo "=== AbyssPaint en 3 parties (Delta) ==="
"$LUAU" doors/tests/test_abyss_parts.luau
