"""Reviewed issuer disclosures. Country anchors are schematic, never factory locations."""
from fastapi import HTTPException

SOURCE = "https://s201.q4cdn.com/141608511/files/doc_financials/2026/ar/2026-annual-report-web-Hyperlinks.pdf#page=96"

def network_for(ticker: str):
    if ticker.upper() != "NVDA":
        raise HTTPException(404, "Aucune relation vérifiée disponible pour ce titre.")
    rows = [
        ("tsmc", "TSMC", "Taïwan", 121.0, 23.7, "Fabrication de wafers"),
        ("samsung", "Samsung Electronics", "Corée du Sud", 127.8, 36.0, "Fabrication de wafers et mémoire"),
        ("skhynix", "SK Hynix", "Corée du Sud", 127.8, 36.0, "Mémoire"),
        ("micron", "Micron Technology", "États-Unis", -98.6, 39.8, "Mémoire"),
        ("honhai", "Hon Hai / Foxconn", "Taïwan", 121.0, 23.7, "Assemblage, test et conditionnement"),
        ("wistron", "Wistron", "Taïwan", 121.0, 23.7, "Assemblage, test et conditionnement"),
        ("fabrinet", "Fabrinet", None, None, None, "Assemblage, test et conditionnement"),
    ]
    evidence = [{"id":"nvda-ar26", "title":"NVIDIA · rapport annuel FY2026 · fabrication (p. 8, page PDF 96)", "url":SOURCE, "publisher":"NVIDIA", "publishedAt":"2026", "excerpt":"NVIDIA déclare recourir à des fondeurs, fournisseurs de mémoire et sous-traitants d’assemblage nommés dans cette section."}]
    entities = [{"id":"nvda", "label":"NVIDIA", "kind":"product", "country":"États-Unis", "longitude":-98.6, "latitude":39.8, "risk":"unknown", "detail":"Entreprise étudiée. Position schématique au niveau du pays; ce point ne représente pas un site industriel.", "evidenceIds":["nvda-ar26"]}]
    relations = []
    for key, label, country, lon, lat, role in rows:
        entity = {"id":key,"label":label,"kind":"supplier","risk":"unknown","detail":role + ". Relation déclarée dans le rapport annuel FY2026; aucune part de volume ni localisation d’usine déduite.","evidenceIds":["nvda-ar26"]}
        if country: entity.update(country=country, longitude=lon, latitude=lat)
        entities.append(entity)
        relations.append({"id":"supply-"+key,"source":key,"target":"nvda","kind":"supply","label":role,"risk":"unknown","evidenceIds":["nvda-ar26"]})
    return {"ticker":"NVDA","entities":entities,"relations":relations,"evidence":evidence,"reviewedAt":"2026-11-15","limitations":["Relations revues à partir du rapport annuel FY2026; absence de surveillance automatique de leurs changements.","Les positions sont des repères de pays schématiques, pas des usines ni des routes de transport. Fabrinet reste dans le graphe sans point géographique.","Le rapport confirme les relations; les pays des organisations sont des repères de contexte. Aucune part d’approvisionnement, probabilité ou intensité de risque n’est estimée."]}
