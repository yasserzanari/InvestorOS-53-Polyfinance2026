from pathlib import Path

def integrate(path):
    s=path.read_text()
    if 'from investoros_api.profiles.skill_agent import run_skill_agent' in s:return
    s='from investoros_api.profiles.skill_agent import run_skill_agent\n'+s
    s=s.replace('max_tokens: int = 1400) -> dict:', 'max_tokens: int = 1400, skill_id: str = "research-planning") -> dict:',1)
    a=s.index('    response = _bedrock_client().converse(',s.index('def _bedrock_json'))
    b=s.index('    text = re.sub',a)
    s=s[:a]+'''    response = run_skill_agent(_bedrock_client(), model_id=model_id, system=system,
        prompt=prompt, required_skills=(skill_id,), max_tokens=max_tokens, role=skill_id)
    text = response['text']
'''+s[b:]
    s=s.replace('    return result\n\n\ndef plan(', "    result['_skills'] = response['skills']\n    result['_skill_trace'] = response['skill_trace']\n    return result\n\n\ndef plan(",1)
    s=s.replace('    tasks = []\n    scheduled_sources:', '''    emit(analysis_id, "skills_loaded", "Procédures du planificateur chargées", "Skills réellement recherchés et lus par Bedrock.", room_id="plan", agent_id="coordinator", status="done", data={"skills": result.get("_skills", []), "trace": result.get("_skill_trace", [])})
    tasks = []
    scheduled_sources:''',1)
    s=s.replace('return _bedrock_json(*args)','return _bedrock_json(*args, skill_id="research-synthesis")',1)
    s=s.replace('    valid_ids = {item["evidence_id"] for item in evidence}', '''    emit(analysis_id, "skills_loaded", "Procédures du vérificateur chargées", "Skills réellement recherchés et lus par Bedrock.", room_id="synthesis", agent_id="verifier", status="done", data={"skills": answer.get("_skills", []), "trace": answer.get("_skill_trace", [])})
    valid_ids = {item["evidence_id"] for item in evidence}''',1)
    s=s.replace('"claims": claims, "cautions": cautions,','"claims": claims, "cautions": cautions, "skills": answer.get("_skills", []),',1)
    compile(s,str(path),'exec')
    path.write_text(s)

if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser(description='Add reviewed skill tool loops to the existing DEV2 runtime, without replacing its business logic.')
    parser.add_argument('runtime',type=Path)
    args=parser.parse_args()
    integrate(args.runtime)
