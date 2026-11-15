"""Bounded official-site supplier disclosures, including PDF lists; no open URL tool."""
import http.client
import io
import ipaddress
import json
from itertools import islice
import re
import socket
import ssl
from html.parser import HTMLParser
from urllib.parse import quote, urlencode, urljoin, urlsplit

from investoros_api.research.documents import page_text


def public_download(url, host, redirects=0):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname != host or parsed.port or parsed.username or parsed.password:
        raise ValueError('Lien hors du site officiel retenu.')
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    ips = [row[4][0] for row in addresses]
    if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
        raise ValueError('Adresse non publique refusée.')
    # Pin the already validated address, while HTTPSConnection preserves the host for TLS/SNI.
    connection = http.client.HTTPSConnection(host, timeout=7, context=ssl.create_default_context())
    selected_ip=next((ip for ip in ips if ipaddress.ip_address(ip).version==4),ips[0])
    connection._create_connection = lambda address, timeout=7, source_address=None: socket.create_connection((selected_ip,443), timeout, source_address)
    try:
        connection.request('GET',(parsed.path or '/')+('?' + parsed.query if parsed.query else ''),headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36','Accept':'text/html,application/pdf','Accept-Language':'en-US,en;q=0.9','Referer':'https://'+host+'/'})
        response=connection.getresponse()
        if response.status in {301,302,303,307,308} and redirects<4:
            target=urljoin(url,response.getheader('Location','')); destination=urlsplit(target)
            if destination.hostname and (destination.hostname.removeprefix('www.')==host.removeprefix('www.') or destination.path.lower().endswith('.pdf')):
                return public_download(target,destination.hostname,redirects+1)
        if response.status != 200:
            raise ValueError('Document officiel inaccessible (redirections non suivies).')
        raw=response.read(12_000_001)
        if len(raw)>12_000_000:
            raise ValueError('Document officiel trop volumineux.')
        return raw,response.getheader('Content-Type','')
    finally:
        connection.close()


class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':
            href=dict(attrs).get('href')
            if href:self.links.append(href)


def discover_official_site(name, reader, identity):
    search=json.loads(reader('https://www.wikidata.org/w/api.php?'+urlencode({'action':'wbsearchentities','search':name,'language':'en','format':'json','limit':3})))
    hit=next((r for r in search.get('search',[]) if identity(r.get('label',''))==identity(name) or identity(r.get('match',{}).get('text',''))==identity(name)),None)
    if not hit:return None
    entity=json.loads(reader('https://www.wikidata.org/wiki/Special:EntityData/'+hit['id']+'.json')).get('entities',{}).get(hit['id'],{})
    for claim in entity.get('claims',{}).get('P856',[]):
        url=claim.get('mainsnak',{}).get('datavalue',{}).get('value')
        if claim.get('rank')=='deprecated' or not isinstance(url,str):continue
        p=urlsplit(url)
        if p.scheme=='https' and p.hostname and not p.port and not p.username and not p.password:
            return {'url':urljoin(url,'/'),'host':p.hostname,'attribution':'https://www.wikidata.org/wiki/'+hit['id']}
    return None


def official_supplier_documents(name,reader,identity):
    site=discover_official_site(name,reader,identity)
    if not site:return []
    queue=[(10,site['url'],0)];visited=set();documents=[]
    # Root -> supplier responsibility -> supplier-list PDF; maximum six bounded reads.
    while queue and len(visited)<8:
        _,url,depth=queue.pop(0)
        if url in visited:continue
        visited.add(url)
        try:raw,mime=public_download(url,urlsplit(url).hostname)
        except (OSError,ValueError,http.client.HTTPException):continue
        if 'pdf' in mime or raw.startswith(b'%PDF'):
            from pypdf import PdfReader
            try:
                pdf=PdfReader(io.BytesIO(raw))
                text='\n'.join((p.extract_text() or '') for p in islice(pdf.pages,35))
            except Exception:continue
            if re.search(r'supplier|approvisionnement|fournisseur',text[:5000],re.I):
                is_list=bool(re.search(r'supplier.?list|list of suppliers|liste.?fournisseur',url+' '+text[:3000],re.I))
                period=re.search(r'(?:fiscal year|FY|exercice)\s*(20[0-9]{2})',text[:5000],re.I)
                period_label=(' · FY'+period.group(1)) if period else ''
                documents.append({'id':'official-'+str(len(documents)),'title':name+(' · liste fournisseurs officielle' if is_list else ' · rapport fournisseurs officiel')+period_label,'url':url,'publishedAt':None,'text':text[:30000], 'discoveredFrom':site['url'],'siteAttribution':site['attribution']})
            continue
        if 'html' not in mime:
            continue
        html=raw.decode('utf-8',errors='replace');text=page_text(html)
        if depth and re.search(r'supplier|approvisionnement|fournisseur',text,re.I):
            documents.append({'id':'official-'+str(len(documents)),'title':name+' · divulgation fournisseurs','url':url,'publishedAt':None,'text':text[:10000],'discoveredFrom':site['url'],'siteAttribution':site['attribution']})
        if depth>=4:continue
        parser=Links();parser.feed(html)
        candidates=[]
        for href in parser.links:
            linked=urljoin(url,href);parts=urlsplit(linked)
            if parts.scheme!='https' or not parts.hostname or parts.username or parts.password or parts.port:continue
            # External disclosures must be explicitly linked by a page already reached from the issuer site.
            if not re.search(r'suppli|supply.?chain|fournisseur|approvisionnement',parts.hostname+parts.path,re.I):continue
            extension=parts.path.rsplit('/',1)[-1].rsplit('.',1)
            if len(extension)>1 and extension[-1].lower() not in {'pdf','html','htm','aspx','php'}:continue
            score=5 if re.search(r'supplier.?list|suppliers.?list|liste.?fournisseur',parts.path,re.I) else 4 if re.search(r'suppli|supply.?chain',parts.hostname,re.I) else 3 if parts.path.lower().endswith('.pdf') else 2
            if re.search(r'code.of.conduct|standards|policy|code-of-conduct',parts.path,re.I):score=1
            candidates.append((score,linked.split('#')[0]))
        for score,link in sorted(set(candidates),reverse=True):
            if link not in visited and all(p[1]!=link for p in queue):queue.append((score,link,depth+1))
        queue.sort(key=lambda item:(-item[0],item[2],item[1]))
    documents.sort(key=lambda doc:not doc['url'].lower().split('?')[0].endswith('.pdf'))
    return documents[:3]
