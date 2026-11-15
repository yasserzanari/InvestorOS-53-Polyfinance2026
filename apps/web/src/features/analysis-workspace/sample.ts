import type { AnalysisResult, Scenario } from './types';

const series = (end: number): Scenario['series'] => [0,30,60,90].map(day => {
  const value = Math.round((1058 + (end - 1058) * day / 90) * 100) / 100;
  const spread = Math.round(value * 0.025 * day / 90 * 100) / 100;
  return {day,value,lower:value-spread,upper:value+spread};
});
/** Opt-in visual fixture. Never substitute this object for an unavailable analysis. */
export const sampleAnalysis: AnalysisResult = {
  schemaVersion:'1.0', analysisId:'illustrative-northstar-v1', resultVersion:1, accountId:'mateo',
  title:'Chaîne d’approvisionnement — Northstar', company:'Northstar Industrial Controls',
  question:'Quels risques affecteraient les servomoteurs et quelles alternatives envisager ?',
  asOf:'2026-11-14T15:00:00Z', horizonDays:90, currency:'USD', costUnit:'USD / servomoteur',
  provenance:'illustrative', status:'completed',
  summary:'L’exemple relie une hypothèse tarifaire aux terres rares, aux fournisseurs d’aimants et à l’assemblage au Mexique. Une route alternative limite la perturbation logistique au prix d’un coût supplémentaire.',
  limitations:['Toutes les entreprises, relations, événements et valeurs sont illustratifs.','Les fourchettes sont des hypothèses de maquette, sans probabilité statistique.','Le modèle linéaire mesure une sensibilité conditionnelle; il ne prédit pas une fermeture de port.'],
  evidence:[
    {id:'example-network',title:'Dossier de démonstration — réseau et composants',url:'https://example.org/illustrative/network',publisher:'Exemple de maquette',publishedAt:'2026-11-14',excerpt:'Jeu fictif conçu pour montrer les relations entre fournisseurs, sites et produits.'},
    {id:'example-tariff',title:'Hypothèse illustrative — tarif additionnel',url:'https://example.org/illustrative/tariff',publisher:'Exemple de maquette',publishedAt:'2026-11-14',excerpt:'Un tarif hypothétique de 25 % touche une part déclarée de composants. Il ne s’agit pas d’une annonce officielle.'},
    {id:'example-port',title:'Hypothèse illustrative — perturbation portuaire',url:'https://example.org/illustrative/port',publisher:'Exemple de maquette',publishedAt:'2026-11-14',excerpt:'Fermeture conditionnelle de 30 jours de Manzanillo. Une alternative par Laredo est étudiée.'},
    {id:'example-model',title:'Méthode de simulation — sensibilités déclarées',url:'https://example.org/illustrative/method',publisher:'Exemple de maquette',publishedAt:'2026-11-14',excerpt:'Coût = coût de base + jours de fermeture × sensibilité coût + coût de base × tarif × exposition. Les alternatives ajoutent un coût et un délai déclarés.'},
  ],
  entities:[
    {id:'tariff',label:'Tarif US hypothétique',kind:'policy',country:'États-Unis',longitude:-77.04,latitude:38.90,risk:'high',detail:'Hypothèse de hausse tarifaire sur les composants concernés; aucune mesure officielle n’est annoncée dans cet exemple.',evidenceIds:['example-tariff']},
    {id:'rare-earth',label:'Northstar Rare Earths',kind:'supplier',country:'Chine',longitude:113.26,latitude:23.13,tier:2,risk:'high',share:78,detail:'Fournisseur fictif de terres rares. Sa part illustrative de 78 % crée une concentration à examiner.',evidenceIds:['example-network']},
    {id:'alternative',label:'Southern Minerals',kind:'supplier',country:'Australie',longitude:115.86,latitude:-31.95,tier:2,risk:'low',share:22,detail:'Alternative fictive; la capacité et les délais doivent être qualifiés avant tout engagement.',evidenceIds:['example-network']},
    {id:'magnets',label:'Nippon Magnetics',kind:'supplier',country:'Japon',longitude:139.69,latitude:35.68,tier:1,risk:'medium',share:62,detail:'Fournisseur fictif d’aimants utilisés dans les servomoteurs.',evidenceIds:['example-network']},
    {id:'component',label:'Aimants terres rares',kind:'component',risk:'high',share:34,detail:'Composant critique; 34 % du coût matière dans cette hypothèse illustrative.',evidenceIds:['example-network']},
    {id:'manzanillo',label:'Port de Manzanillo',kind:'port',country:'Mexique',longitude:-104.32,latitude:19.05,risk:'high',detail:'Nœud géographique réel utilisé dans un scénario fictif de fermeture.',evidenceIds:['example-port']},
    {id:'laredo',label:'Laredo',kind:'port',country:'États-Unis',longitude:-99.50,latitude:27.51,risk:'medium',detail:'Point de passage alternatif; la capacité affichée dans le scénario est illustrative.',evidenceIds:['example-port']},
    {id:'monterrey',label:'Assemblage Monterrey',kind:'site',country:'Mexique',longitude:-100.32,latitude:25.69,risk:'medium',share:92,detail:'Site d’assemblage fictif. Les relations et pondérations ne décrivent aucune entreprise réelle.',evidenceIds:['example-network']},
    {id:'rotterdam',label:'Port de Rotterdam',kind:'port',country:'Pays-Bas',longitude:4.48,latitude:51.92,risk:'medium',detail:'Destination européenne illustrative des produits assemblés.',evidenceIds:['example-port']},
    {id:'chicago',label:'Chicago — siège',kind:'site',country:'États-Unis',longitude:-87.63,latitude:41.88,risk:'low',detail:'Siège fictif de Northstar et destination américaine de démonstration.',evidenceIds:['example-network']},
    {id:'servo',label:'Servomoteurs S800',kind:'product',risk:'high',share:60,detail:'Produit fictif dont le coût rendu de référence est de 1 058 USD par unité.',evidenceIds:['example-network','example-model']},
    {id:'cost',label:'Coût produit rendu',kind:'product',risk:'high',detail:'Sortie du scénario conditionnel à horizon 90 jours, exprimée en USD par servomoteur.',evidenceIds:['example-model']},
  ],
  relations:[
    {id:'policy-supplier',source:'tariff',target:'rare-earth',kind:'impact',label:'Exposition tarifaire',risk:'high',evidenceIds:['example-tariff']},
    {id:'rare-magnets',source:'rare-earth',target:'magnets',kind:'supply',label:'Terres rares',risk:'high',share:78,evidenceIds:['example-network']},
    {id:'alt-magnets',source:'alternative',target:'magnets',kind:'alternative',label:'Approvisionnement alternatif',risk:'low',share:22,delayDays:7,evidenceIds:['example-network']},
    {id:'magnets-component',source:'magnets',target:'component',kind:'supply',label:'Aimants',risk:'medium',share:62,evidenceIds:['example-network']},
    {id:'magnets-port',source:'magnets',target:'manzanillo',kind:'transport',label:'Transport maritime',risk:'high',delayDays:14,evidenceIds:['example-port']},
    {id:'port-site',source:'manzanillo',target:'monterrey',kind:'transport',label:'Acheminement usine',risk:'high',delayDays:3,evidenceIds:['example-port']},
    {id:'alt-route',source:'magnets',target:'laredo',kind:'alternative',label:'Route alternative',risk:'low',delayDays:7,evidenceIds:['example-port']},
    {id:'laredo-site',source:'laredo',target:'monterrey',kind:'transport',label:'Transport terrestre',risk:'medium',delayDays:2,evidenceIds:['example-port']},
    {id:'component-site',source:'component',target:'monterrey',kind:'impact',label:'Intégration composant',risk:'high',share:34,evidenceIds:['example-network']},
    {id:'site-servo',source:'monterrey',target:'servo',kind:'supply',label:'Assemblage',risk:'medium',share:60,evidenceIds:['example-network']},
    {id:'servo-cost',source:'servo',target:'cost',kind:'impact',label:'Impact coût rendu',risk:'high',evidenceIds:['example-model']},
    {id:'site-europe',source:'monterrey',target:'rotterdam',kind:'transport',label:'Exportation UE',risk:'medium',share:28,delayDays:18,evidenceIds:['example-network']},
    {id:'site-us',source:'monterrey',target:'chicago',kind:'transport',label:'Exportation US',risk:'low',share:52,delayDays:4,evidenceIds:['example-network']},
  ],
  events:[
    {id:'event-1',title:'Annonce tarifaire hypothétique',date:'2026-11-14',entityIds:['tariff','rare-earth'],severity:'high',detail:'Point de départ du scénario, fixé par l’utilisateur pour la démonstration.',evidenceIds:['example-tariff']},
    {id:'event-2',title:'Fermeture conditionnelle de Manzanillo',date:'2026-11-24',endDate:'2026-12-24',entityIds:['manzanillo'],severity:'high',detail:'Hypothèse de fermeture de 30 jours; ce n’est pas un événement observé.',evidenceIds:['example-port']},
    {id:'event-3',title:'Activation d’une route alternative',date:'2026-12-14',entityIds:['laredo','monterrey'],severity:'medium',detail:'Mitigation étudiée: dérouter une partie des flux sous réserve de capacité.',evidenceIds:['example-port']},
    {id:'event-4',title:'Qualification d’un fournisseur alternatif',date:'2027-01-13',entityIds:['alternative','magnets'],severity:'low',detail:'Jalon fictif de qualification; aucune commande n’est passée.',evidenceIds:['example-network']},
    {id:'event-5',title:'Revue du scénario à 90 jours',date:'2027-02-12',entityIds:['monterrey','chicago','rotterdam'],severity:'low',detail:'Comparaison des hypothèses de coût, de délai et de service.',evidenceIds:['example-model']},
  ],
  scenarios:[
    {id:'base',label:'Base',kind:'base',description:'Réseau actuel sans perturbation additionnelle.',cost:1058,delayDays:21.3,servicePct:96,evidenceIds:['example-model'],assumptions:['Aucune hausse tarifaire additionnelle.','Capacité logistique disponible.'],series:series(1058),edgeIds:['rare-magnets','magnets-port','port-site','site-us']},
    {id:'adverse',label:'Perturbation sévère',kind:'adverse',description:'Tarif additionnel et perturbation de la route de Manzanillo.',cost:1122,delayDays:28.7,servicePct:88,evidenceIds:['example-model','example-port','example-tariff'],assumptions:['Tarif hypothétique de 25 % sur la part exposée.','Perturbation logistique sans substitution immédiate.'],series:series(1122),edgeIds:['policy-supplier','rare-magnets','magnets-port','port-site','servo-cost']},
    {id:'mitigation',label:'Fournisseur alternatif',kind:'mitigation',description:'Diversification partielle et réacheminement via Laredo.',cost:1088,delayDays:22.6,servicePct:95,evidenceIds:['example-model','example-network','example-port'],assumptions:['Capacité alternative à qualifier.','Route Laredo disponible au délai indiqué.'],series:series(1088),edgeIds:['alt-magnets','alt-route','laredo-site','site-us']},
  ],
  simulation:{method:'linear-sensitivity-v1',baselineCost:1058,baselineDelayDays:21.3,baselineServicePct:96,closureCostPerDay:1.2,closureDelayPerDay:0.4,tariffExposurePct:20,alternateCostPct:2.8,alternateDelayDays:1.3,serviceLossPerDelayDay:0.65,maxClosureDays:90,maxTariffPct:50,assumptions:['Coefficients illustratifs constants sur l’horizon; aucune calibration sur des données réelles.','Le tarif ne touche que 20 % du coût unitaire de référence.','Une alternative remplace le retard lié à la fermeture par son délai déclaré, avec un surcoût fixe en pourcentage.'],evidenceIds:['example-model']},
};
