import type { AgentEvent, ToolEvent, WorkspaceTab } from './profile-api';

export type SkillUse = { id: string; version?: string; sha256?: string; actor: string; role: string };
export type ResearchEvent = { event_id: string; type: string; at: string; agent_id?: string; room_id?: string; source_id?: string; status?: string; title: string; detail?: string; data?: { url?: string; evidence_id?: string; skills?: Omit<SkillUse,'actor'|'role'>[]; trace?: {actor?: string;tool?: string;input?: {skill_id?: string}}[] } };
export type ResearchEvidence = {evidence_id:string;source_id:string;source_name?:string;url?:string;method?:string;collected_at?:string;content?:unknown;limits?:string};
export type ResearchRun = { created_at?:string;completed_at?:string; analysis_id: string; status: string; question?: string; events?: ResearchEvent[]; evidence?:ResearchEvidence[]; error?: string; trackingError?: string; events_truncated?: boolean; result?: {
  summary?: string;answer?: string;execution_status?:string;
  coverage?:{status:string;window?:{start:string;end:string;timezone:string};checks?:{id:string;label:string;status:string;evidence_ids:string[]}[];missing?:string[]};
  sections?:{title:string;text:string;evidence_ids:string[]}[];
  claims?: {text: string;claim_type?: string;evidence_ids?: string[];confidence?: string}[];cautions?: string[];evidence_count?: number
} };
export const terminalResearch = (status: string) => ['complete','completed','partial','failed','cancelled'].includes(status);
export function researchTabs(tabs: WorkspaceTab[]) {
  const next=[...tabs];
  for(const tab of [
    {id:'agents',title:'Agents',kind:'agents',content:''},
    {id:'research-skills',title:'Skills utilisés',kind:'note',content:'Procédures effectivement chargées, avec leur provenance.'},
    {id:'research-results',title:'Résultats de recherche',kind:'note',content:'Suivi des analyses réellement lancées et résultats sourcés.'},
  ] as WorkspaceTab[]) if(!next.some(item=>item.id===tab.id)&&next.length<12)next.push(tab);
  return next;
}
export function researchAgents(runs: ResearchRun[]): AgentEvent[] {
  return runs.flatMap(run=>{
    const agents=new Map<string,AgentEvent>();
    for(const event of run.events??[]) {
      if(!event.agent_id||event.type==='skills_loaded')continue;
      const key=`${run.analysis_id}-${event.agent_id}`;
      const previous=agents.get(key);
      const status=event.status==='failed'||event.type==='source_unavailable'?'failed':event.status==='done'||['evidence_saved','calculation_completed','room_finished'].includes(event.type)?'done':previous?.status??'running';
      agents.set(key,{id:key,name:event.agent_id==='coordinator'?'Planificateur de recherche':event.agent_id==='verifier'?'Vérificateur et synthétiseur':event.agent_id,task:previous?.task??event.detail??event.title,status,summary:event.detail||event.title,startedAt:previous?.startedAt??Date.parse(event.at),kind:['coordinator','verifier'].includes(event.agent_id)?'bedrock':'collector'});
    }
    return [...agents.values()].map(agent=>terminalResearch(run.status)&&agent.status==='running'?{...agent,status:'failed' as const,summary:'Exécution terminée sans résultat confirmé pour cet intervenant.'}:agent);
  });
}
export function usedSkills(tools: ToolEvent[], specialists: AgentEvent[], runs: ResearchRun[]): SkillUse[] {
  const skills:SkillUse[]=[];
  for(const tool of tools) if(tool.name==='load_skill'&&tool.status==='done'&&tool.output&&typeof tool.output==='object') {
    const value=tool.output as {id?:string;version?:string;sha256?:string};
    if(value.id)skills.push({...value,id:value.id,actor:tool.actor==='runtime-bootstrap'?'Chargement du runtime':'Modèle',role:'Assistant'});
  }
  for(const agent of specialists)for(const skill of agent.skills??[])skills.push({...skill,role:agent.name,actor:agent.skill_trace?.find(t=>t.tool==='load_skill'&&t.input?.skill_id===skill.id)?.actor==='runtime-bootstrap'?'Chargement du runtime':'Modèle'});
  for(const run of runs)for(const event of run.events??[])if(event.type==='skills_loaded')for(const skill of event.data?.skills??[]) {
    const trace=event.data?.trace?.find(item=>item.tool==='load_skill'&&item.input?.skill_id===skill.id);
    skills.push({...skill,role:event.agent_id==='coordinator'?'Planificateur':event.agent_id==='verifier'?'Vérificateur':event.agent_id??'Recherche',actor:trace?.actor==='runtime-bootstrap'?'Chargement du runtime':'Modèle'});
  }
  return skills.filter((skill,index,list)=>list.findIndex(other=>other.id===skill.id&&other.role===skill.role&&other.sha256===skill.sha256)===index);
}
