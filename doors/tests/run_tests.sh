#!/usr/bin/env bash
# Lance les tests headless d'Abyss V5. Usage : doors/tests/run_tests.sh [chemin/vers/luau]
set -euo pipefail
cd "$(dirname "$0")/../.."
LUAU="${1:-luau}"
python3 - <<'PY'
src = open("doors/AbyssV5.lua", encoding="utf-8").read()
level = 0
while ("]" + "=" * level + "]") in src:
    level += 1
eq = "=" * level
open("doors/tests/_abyss_src.luau", "w", encoding="utf-8").write("return [" + eq + "[" + src + "]" + eq + "]\n")
PY
"$LUAU" doors/tests/test_abyss_v5.luau
