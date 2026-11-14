import { ArrowUpRight, BookOpen, Check, ChevronDown, CircleHelp, Compass, Droplets, Flag, Heart, Scale, Shield, SlidersHorizontal, Target, TriangleAlert } from 'lucide-react';
import { fieldLabels, type FieldKey, type Profile } from './profile-model';
import { assessProfile } from './profile-consistency';
import './profile-inspector.css';

const sections: {title:string;description:string;fields:FieldKey[]}[] = [
  {title:'Vos projets',description:'Ce que vous souhaitez accomplir et à quel moment.',fields:['objective','horizon']},
  {title:'Votre rapport au risque',description:'Distinguer les fluctuations acceptées des pertes supportables.',fields:['riskTolerance','lossCapacity']},
  {title:'Vos besoins et vos choix',description:'Les limites à respecter pour construire votre profil.',fields:['liquidity','constraints','preferences','knowledge']},
];
const icons = {objective:Target,horizon:Compass,riskTolerance:Scale,lossCapacity:Shield,liquidity:Droplets,constraints:SlidersHorizontal,preferences:Heart,knowledge:BookOpen};
function focusField(key:FieldKey) {const el=document.getElementById(`investor-field-${key}`);el?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});el?.focus({preventScroll:true});}
export function ProfileInspector({profile,onChange,onDiscuss}:{profile:Profile;onChange:(key:FieldKey,value:string)=>void;onDiscuss:(prompt:string)=>void}) {
  const assessment=assessProfile(profile);
  const warnings=assessment.issues.filter(i=>i.severity==='warning');
  const missing=assessment.issues.filter(i=>i.severity==='missing');
  return <div className="pi-inspector">
    <section className={`pi-review${warnings.length?' has-warnings':''}`} aria-label="Cohérence du profil">
      <div className="pi-review-summary"><span className="pi-review-icon">{warnings.length?<TriangleAlert size={18}/>:<Shield size={18}/>}</span><div><h3>{warnings.length?`${warnings.length} point${warnings.length>1?'s':''} à vérifier`:'Cohérence du profil'}</h3><p>{warnings.length?'Certaines réponses méritent d’être rapprochées.':missing.length?'Complétez les informations pour affiner la vérification.':'Aucune contradiction repérée par les règles actuelles.'}</p></div><span className="pi-completed">{assessment.completed}<small>/ 8</small></span></div>
      <details className="pi-review-details" open={warnings.length>0}><summary>{warnings.length?'Examiner les points signalés':`${missing.length} information${missing.length>1?'s':''} à préciser`}<ChevronDown size={14}/></summary><div className="pi-review-issues">{assessment.issues.length?assessment.issues.map(issue=><div className={`pi-issue is-${issue.severity}`} key={issue.id}><span>{issue.severity==='warning'?<TriangleAlert size={14}/>:<CircleHelp size={14}/>}</span><div><strong>{issue.title}</strong><p>{issue.description}</p><div className="pi-issue-actions">{issue.fields.map(key=><button type="button" key={key} onClick={()=>focusField(key)}>{fieldLabels[key]}<ArrowUpRight size={12}/></button>)}{issue.severity==='warning'&&<button type="button" onClick={()=>onDiscuss(`Aide-moi à clarifier ce point dans mon profil : ${issue.title}. ${issue.description}`)}>Clarifier avec l’assistant<ArrowUpRight size={12}/></button>}</div></div></div>):<p className="pi-no-issue"><Check size={14}/>Les huit rubriques sont renseignées.</p>}</div></details>
      <p className="pi-method">Vérification indicative par règles explicites, mise à jour à chaque modification.</p>
    </section>
    {sections.map((section,index)=><section className="pi-section" key={section.title} aria-labelledby={`pi-section-${index}`}><header><span className="pi-section-number">0{index+1}</span><div><h3 id={`pi-section-${index}`}>{section.title}</h3><p>{section.description}</p></div></header><div className="pi-fields">{section.fields.map(key=>{const Icon=icons[key];const issues=assessment.issues.filter(i=>i.fields.includes(key));const warning=issues.some(i=>i.severity==='warning');const incomplete=issues.some(i=>i.severity==='missing');return <div className={`pi-field${warning?' has-warning':''}${incomplete?' is-incomplete':''}`} key={key}><label htmlFor={`investor-field-${key}`}><span className={`pi-field-icon pi-icon-${key}`}><Icon size={17} strokeWidth={1.7}/></span><span>{fieldLabels[key]}</span>{warning?<TriangleAlert className="pi-field-status" size={14} aria-label="Point à vérifier"/>:incomplete?<span className="pi-missing">À préciser</span>:<Check className="pi-field-status" size={14} aria-label="Renseigné"/>}</label><textarea id={`investor-field-${key}`} value={profile[key]} onChange={e=>onChange(key,e.target.value)} rows={key==='objective'||key==='constraints'||key==='preferences'?3:2} aria-invalid={warning||undefined} aria-describedby={warning?`pi-warning-${key}`:undefined}/>{warning&&<p id={`pi-warning-${key}`} className="pi-field-warning">{issues.find(i=>i.severity==='warning')?.title}</p>}</div>;})}</div></section>)}
    <footer className="pi-end"><Flag size={14}/><span>Vous pouvez corriger chaque réponse ici ou la préciser dans la conversation.</span></footer>
  </div>;
}
