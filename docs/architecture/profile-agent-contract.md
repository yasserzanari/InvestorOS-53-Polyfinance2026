# Contrat agent du profil investisseur

## Sources et limites

La démonstration AlphaForge utilise les personas fictifs Amira, Mateo et Robert. Elle ne traite pas de données financières privées réelles et n’exécute pas de transactions. Les calculs financiers restent déterministes et traçables. Un outil qui retourne un résultat n’est pas une certification de convenance ni une garantie de conformité juridique.

Cadre consulté le 16 novembre 2026 : [AMF — Profil d’investisseur](https://lautorite.qc.ca/grand-public/outils-et-calculateurs/calculateurs/votre-profil-dinvestisseur), [OCRI — Connaissance du client et convenance](https://www.ocri.ca/salle-de-presse/publications/la-connaissance-du-client-et-levaluation-de-la-convenance-pour-la-clientele-de-detail), [Québec — P-39.1](https://www.legisquebec.gouv.qc.ca/fr/pdf/lc/P-39.1.pdf).

La collecte est limitée à la finalité du prototype; la situation peut être passée. Ce caractère facultatif ne supprime pas les obligations applicables à une personne inscrite dans un service financier réglementé. Le questionnaire seul ne suffit pas à établir la convenance. L’agent ne doit pas orienter les réponses de risque pour justifier un produit et doit distinguer tolérance émotionnelle, capacité financière, données manquantes et hypothèses.

## Contrat de lecture et d’écriture

| Outil | Données | Règles |
|---|---|---|
| get_profile_details | Profil général, situation, projets, contrôles | Lecture de l’état courant; priorité sur l’historique de discussion. |
| update_profile | Huit déclarations générales | Patch des faits explicites, jamais confirmation au nom de l’utilisateur. L’objectif/horizon du principal est synchronisé. |
| update_profile_goals | Projets structurés | Maximum huit, identifiants uniques, au plus un principal, horizons entiers 1–50 ans ou qualitatifs non quantifiés, montant facultatif, date précise facultative. Préserver les projets non concernés. |
| update_profile_situation | Revenu, réserve, actifs, dettes, contexte | Patch partiel, facultatif, borné à 500 caractères par champ. Pas de secrets ou justificatifs. |
| update_profile_controls | Expérience, ancienneté, secteurs, ESG, complexité, apprentissage, contraintes de liquidité | Clés et valeurs validées. Approche ESG distincte du texte des préférences. |

Les documents `profile-objectives` et `profile-controls` restent le format de stockage des sections déjà déployées. Leur modification par `upsert_tab` est interdite; les nouveaux outils sont l’API métier validée. Les écritures sont préparées sur une copie et publiées seulement après validation. La mémoire valide aussi les documents reçus directement du navigateur. Les clés générales demeurent compatibles avec les anciens clients.

Les alias `horizon`, `withdrawals`, `income` et `debt` des anciens contrôles redirigent respectivement vers le profil général ou la situation. Les nouveaux contrôles du navigateur utilisent directement ces propriétaires. Un choix ESG ne remplace jamais les précisions. Une capacité qualitative et une tolérance mixte restent affichées telles quelles.

La fiche envoie sa situation facultative au contexte agent, accepte les événements de modification de cette situation et persiste avec contrôle de révision. Les origines des modifications manuelles et agent sont conservées. L’agent confirme l’actualisation de la fiche, pas une sauvegarde serveur qu’il n’a pas vérifiée. Le statut de mémoire est affiché au navigateur.

## Réponses

Les skills investor-profile et profile-workspace décrivent les paramètres exacts et les limites. La procédure investor-profile est chargée automatiquement en mode Profil. Le catalogue et son snapshot embarqué doivent partager la même version et les mêmes hashes.

Un contrôle final borné en mode Profil bloque des formulations positives de rendement garanti ou certification juridique globale, les fausses annonces d’enregistrement après un échec d’outil, et les contradictions déjà couvertes par validate_profile_claims. Il demande une correction au modèle avec un nombre limité de tentatives. Ce filtre ne remplace pas une revue juridique et ne garantit pas de détecter toutes les formulations possibles.

## Validation et déploiement

Le code est vérifié par des tests de schémas, outils avec runtime simulé, mémoire et interface navigateur interceptée. Ces tests couvrent validité des valeurs, conservation des autres paramètres, synchronisation, rejet des documents libres et refus des promesses détectables. Les tests réels du modèle sont une preuve séparée; ne pas présenter un runtime simulé comme Bedrock réel.

Après fusion sur main, les workflows distincts reconstruisent le frontend et le package Lambda. Une réussite du workflow web seule ne prouve pas la publication du backend ou du snapshot. Vérifier le statut du backend et la version de skills après le déploiement, puis exercer les outils réels sur une fixture fictive sans réécrire la mémoire des personas.

### Publication limitée au runtime

Le workflow assistant-simulation propose un mode manuel `runtime_only`. Il reconstruit le package contrôlé, vérifie le compte AWS, sauvegarde les deux codes existants avec contrôle SHA-256, publie uniquement le code de l’API et du worker déjà présents et vérifie leurs empreintes. En cas d’échec, il restaure les codes modifiés. Les variables, permissions et ressources d’infrastructure restent celles du déploiement existant. Ce mode sert notamment lorsque le plan global est bloqué par une autre intégration; il ne corrige pas ses permissions SSM ni ne prouve le déploiement de ces ressources. Le prochain apply Terraform réussi réconciliera les empreintes du code.

Noms compatibles Bedrock : Fonds (OPC) utilise `experience-fonds-opc` / `years-fonds-opc`; ETF utilise `experience-etf` / `years-etf`. Les noms avec espaces/parenthèses restent réservés au stockage historique de l’interface, pas aux schémas d’outils.
