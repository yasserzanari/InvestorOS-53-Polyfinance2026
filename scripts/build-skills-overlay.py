#!/usr/bin/env python3
"""Preserve the deployed Lambda dependencies and research/RAG; overlay reviewed skills."""
import argparse
import base64
import hashlib
import json
import runpy
import tempfile
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser()
p.add_argument('baseline',type=Path)
p.add_argument('output',type=Path)
p.add_argument('--expected-sha',required=True)
args=p.parse_args()
baseline_sha=base64.b64encode(hashlib.sha256(args.baseline.read_bytes()).digest()).decode()
if baseline_sha!=args.expected_sha:raise SystemExit('Baseline SHA does not match AWS CodeSha256')
patch_runtime=runpy.run_path(str(root/'scripts/integrate-research-skills.py'))['integrate']
overlay={}
source=root/'apps/api/src/investoros_api'
for path in (source/'profiles').glob('*'):
    if path.suffix in {'.py','.json','.md'}:overlay[str(path.relative_to(source.parent))]=path.read_bytes()
overlay['investoros_api/simulation.py']=(source/'simulation.py').read_bytes()
for name in ('assets_universe.csv','prices_daily.csv','corporate_actions.csv'):
    overlay['investoros_api/data/'+name]=(root/'docs/prep/sources/Datathon2026/alphaforge_starter'/name).read_bytes()
with ZipFile(args.baseline) as old, tempfile.TemporaryDirectory() as tmp:
    runtime=Path(tmp)/'runtime.py';runtime.write_bytes(old.read('investoros_api/research/runtime.py'));patch_runtime(runtime)
    overlay['investoros_api/research/runtime.py']=runtime.read_bytes()
    main=old.read('investoros_api/main.py').decode()
    if 'from investoros_api.simulation import router as simulation_router' not in main:
        main=main.replace('app.include_router(profiles_router)','from investoros_api.simulation import router as simulation_router\napp.include_router(simulation_router)\napp.include_router(profiles_router)')
    overlay['investoros_api/main.py']=main.encode()
    manifest={'baseline_sha256':baseline_sha,'skills_version':json.loads(overlay['investoros_api/profiles/skills_snapshot.json'])['version'],
              'files':{name:hashlib.sha256(data).hexdigest() for name,data in overlay.items()}}
    overlay['investoros_api/skills_release.json']=json.dumps(manifest,indent=2).encode()
    with ZipFile(args.output,'w',ZIP_DEFLATED) as target:
        for info in old.infolist():
            if info.filename not in overlay and '__pycache__' not in info.filename and not info.filename.endswith('.pyc'):
                target.writestr(info,old.read(info.filename))
        for name,data in overlay.items():target.writestr(name,data)
print(json.dumps({'path':str(args.output),'sha256':base64.b64encode(hashlib.sha256(args.output.read_bytes()).digest()).decode(),'skills_version':manifest['skills_version'],'overlaid_files':len(overlay)}))
