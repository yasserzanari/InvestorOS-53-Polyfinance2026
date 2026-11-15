---
name: evidence-review
description: "Vérifier les preuves d’une analyse : attribution, fraîcheur, contradictions et limites des conclusions."
---

# evidence-review

Consulte les résultats et evidence d’un analysis_id réel. Vérifie dates, unité, devise et périmètre de chaque affirmation. Distingue une source primaire, une déclaration attribuée, une interprétation et une hypothèse. Plusieurs reprises d’un communiqué ne sont pas des preuves indépendantes. Une préférence ESG ne prouve pas une conformité ESG. read_sources fournit des notes de méthode internes, pas une recherche Web ni une donnée d’entreprise. Si la preuve manque, indique la lacune; ne crée pas de citation ni score.


## Retrouver le passage effectivement collecté

Pour une analyse déjà créée, si `retrieve_analysis_evidence` est disponible, cherche la sous-question dans ses preuves enregistrées. Utilise son UUID confirmé, la requête et éventuellement les identités exactes. Cite l’identifiant de preuve, le lien et le passage exact avec sa date et ses limites. Le classement lexical aide à retrouver un texte : il ne prouve ni véracité, ni indépendance, ni soutien sémantique. Une référence existante sans passage pertinent reste insuffisante. Cet outil ne lance aucune collecte et n’interroge pas une base vectorielle. Les preuves `bedrock-knowledge-base` identifient séparément les passages provenant du RAG AWS. Si la recherche renvoie zéro passage, indique «non trouvé dans les preuves collectées», jamais «le fait est faux». Pour un critère ESG, conserve le critère explicite; aucun label global n’est déduit du nom du fonds ou d’une déclaration isolée.


## Affiner une lecture documentaire et vérifier une conclusion

Quand la question demande de consulter les documents d’une entreprise et que `retrieve_company_documents` est disponible, utilise l’UUID existant, une requête précise et le domaine pertinent. Le serveur fixe l’identité et le compte; ne contourne pas un résultat vide en choisissant une autre entreprise ou un autre compte. La lecture RAG garde les passages exacts, dates, licences et liens. Elle ne réécrit pas les preuves du workflow; présente ces extraits supplémentaires comme consultés dans la conversation. Plusieurs passages d’un même rapport restent une source unique.

Pour évaluer si les citations soutiennent la synthèse, utilise `review_analysis_conclusions` si disponible. L’outil relit les seuls contenus cités et mobilise un vérificateur Bedrock borné. Le contrôle d’une citation exacte garantit son attribution, pas son soutien sémantique ni sa vérité. Distingue soutien trouvé, soutien partiel, non étayé par ces preuves et contenu insuffisant. Préserve le statut du workflow original : une collecte terminée et une conclusion étayée sont deux états distincts. Un fait non étayé par un passage hors sujet n’est pas automatiquement faux.
