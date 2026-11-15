#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
api_dir="$repo_root/apps/api"
build_dir="$api_dir/build/package"
zip_path="$api_dir/build/investoros-api.zip"
tmp_zip="$api_dir/build/investoros-api.zip.tmp"
python_bin="${PYTHON312:-$(uv python find 3.12)}"

rm -rf "$build_dir"
mkdir -p "$build_dir"
uv pip install --python "$python_bin" --target "$build_dir" -r "$api_dir/requirements.txt"
cp -R "$api_dir/src/investoros_api" "$build_dir/"
mkdir -p "$build_dir/infrastructure/terraform"
while IFS= read -r -d '' terraform_file; do
  relative_path="${terraform_file#"$repo_root/infrastructure/terraform/"}"
  mkdir -p "$build_dir/infrastructure/terraform/$(dirname "$relative_path")"
  cp "$terraform_file" "$build_dir/infrastructure/terraform/$relative_path"
done < <(find "$repo_root/infrastructure/terraform" -type f -name '*.tf' ! -path '*/.terraform/*' -print0)
data_dir="$repo_root/docs/prep/sources/Datathon2026/alphaforge_starter"
package_data="$build_dir/investoros_api/data"
mkdir -p "$package_data"
for name in assets_universe.csv prices_daily.csv corporate_actions.csv; do
  if [[ ! -f "$data_dir/$name" ]]; then
    echo "Required Simulation dataset file missing: $data_dir/$name" >&2
    exit 1
  fi
  cp "$data_dir/$name" "$package_data/$name"
done
rm -f "$tmp_zip"
"$python_bin" - "$build_dir" "$tmp_zip" <<'PY'
from pathlib import Path
from sys import argv
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(argv[1])
target = Path(argv[2])
required = [
    'investoros_api/research/runtime.py',
    'investoros_api/research/router.py',
    'investoros_api/research/iam_handler.py',
    'investoros_api/research/report.py',
    'investoros_api/research/validation.py',
    'investoros_api/knowledge/service.py',
    'investoros_api/profiles/skills_snapshot.json',
]
missing = [name for name in required if not (root / name).is_file()]
if missing:
    raise SystemExit('Incomplete API package: ' + ', '.join(missing))
with ZipFile(target, "w", compression=ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(root))
PY
mv "$tmp_zip" "$zip_path"
printf 'Lambda package ready: %s\n' "$zip_path"
