"""Small curated knowledge catalog: cited text is served verbatim by the API.

These are product methodology notes, not a web search or investment recommendations.
Replace this repository with Bedrock KB retrieval without changing the citation contract.
"""
SOURCES = {
    'profile-method': {
        'id': 'profile-method', 'title': 'Méthode InvestorOS : construire le profil',
        'text': 'Un profil investisseur distingue objectif, horizon, tolérance aux fluctuations, capacité financière à absorber une perte, besoins de liquidité, contraintes, préférences et connaissances. Une information inconnue reste à préciser. La tolérance émotionnelle au risque et la capacité financière à subir une perte sont distinctes. Aucune capacité financière ne peut être déduite de l’âge. Les réponses de l’utilisateur alimentent un brouillon révisable; leur confirmation lui appartient.',
    },
    'demo-boundaries': {
        'id': 'demo-boundaries', 'title': 'InvestorOS : données et limites de la démonstration',
        'text': 'Les comptes Amira, Mateo et Robert sont fictifs. Aucun compte bancaire ni courtier n’est connecté. Bedrock produit des explications et peut proposer des modifications à la fiche; ses sorties ne constituent pas une recommandation d’achat. Les résultats calculés, données observées, hypothèses et simulations doivent être distingués. Les sources affichées correspondent aux documents effectivement lus pendant la réponse. Un appel spécialiste est une invocation distincte de modèle, pas une personne ni un agent autonome de navigation.',
    },
}

def citations(source_ids: list[str]) -> list[dict]:
    return [{'id': key, 'index': i + 1, 'title': SOURCES[key]['title'],
             'url': f'/api/v1/profiles/sources/{key}', 'snippet': SOURCES[key]['text']}
            for i, key in enumerate(source_ids)]
