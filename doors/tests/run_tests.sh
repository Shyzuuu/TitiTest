#!/usr/bin/env bash
# Lance les tests headless d'Abyss. Usage : doors/tests/run_tests.sh [chemin/vers/luau]
set -euo pipefail
cd "$(dirname "$0")/../.."
LUAU="${1:-luau}"
# Le CLI Luau n'a pas de bibliotheque io : chaque script est embarque dans un module qui renvoie son source
python3 - <<'PY'
for src_path, mod in (("doors/AbyssV5.lua", "_abyss_src"), ("doors/AbyssMini.lua", "_mini_src")):
    src = open(src_path, encoding="utf-8").read()
    level = 0
    while ("]" + "=" * level + "]") in src:
        level += 1
    eq = "=" * level
    open("doors/tests/" + mod + ".luau", "w", encoding="utf-8").write("return [" + eq + "[" + src + "]" + eq + "]\n")
PY
echo "=== AbyssV5 ==="
"$LUAU" doors/tests/test_abyss_v5.luau
echo "=== AbyssMini ==="
"$LUAU" doors/tests/test_abyss_mini.luau
