import type { AnalysisResult, AnalysisView } from './types';
import { getAvailableViews } from './schema';
// Match Python's make_visualization_tab_id; keep full identity/version in the hash.
export function makeAnalysisTabId(analysisId:string,version:number):string {
 let hash=14695981039346656037n;
 for(const character of `${analysisId}:${version}`){hash^=BigInt(character.charCodeAt(0));hash=BigInt.asUintN(64,hash*1099511628211n);}
 return `analysis-${hash.toString(16).padStart(16,'0')}`;
}
export function selectedAnalysisView(result:AnalysisResult,output:unknown):AnalysisView|undefined {
 const available=getAvailableViews(result);
 const tab=output&&typeof output==='object'?(output as {tab?:{view?:unknown}}).tab:undefined;
 return available.find(view=>view===tab?.view)??available[0];
}
