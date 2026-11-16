"""Read account-scoped public X evidence; never accept an account or author from the browser."""
import json
import re
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from ..source_store import read_workspace


def authorized_profiles(persona):
    state = read_workspace(persona)
    unique = {}
    for profile in state.get('authorized', []):
        username = profile.get('username', '')
        if re.fullmatch(r'[A-Za-z0-9_]{1,15}', username):
            unique[username.lower()] = {'username':username, 'name':profile.get('name',username)}
    return list(unique.values())


def read_public_posts(username):
    """Read a public X timeline through the VPC API Anything proxy in AWS."""
    results, failures = read_public_posts_batch([username])
    posts = results.get(username.lower())
    if not isinstance(posts, list):
        raise ValueError(failures.get(username.lower(), 'Lecture publique X indisponible.'))
    return posts


def read_public_posts_batch(usernames):
    function = os.getenv('API_ANYTHING_PROXY_FUNCTION_NAME', '').strip()
    if function:
        import boto3
        from botocore.config import Config
        from botocore.exceptions import BotoCoreError, ClientError

        try:
            response = boto3.client('lambda', region_name=os.getenv('AWS_REGION', 'us-east-1'),
                config=Config(connect_timeout=3, read_timeout=90, retries={'total_max_attempts': 1})).invoke(
                    FunctionName=function, InvocationType='RequestResponse',
                    Payload=json.dumps({'action': 'read_public_x_posts', 'usernames': usernames}).encode())
            raw = response['Payload'].read(1048577)
            if response.get('FunctionError') or len(raw) > 1048576:
                raise ValueError('Le proxy API Anything a renvoyé une réponse invalide.')
            payload = json.loads(raw)
            if not isinstance(payload, dict) or payload.get('ok') is not True:
                raise ValueError('Le proxy API Anything ne peut pas lire ce fil X.')
            results = payload.get('results')
            failures = payload.get('failures', {})
            if not isinstance(results, dict) or not isinstance(failures, dict):
                raise ValueError('Réponse de fil X invalide.')
            for username in usernames:
                if not isinstance(results.get(username.lower()), list) and username.lower() not in failures:
                    raise ValueError('Réponse de fil X invalide.')
            return results, failures
        except (BotoCoreError, ClientError) as error:
            raise ValueError('Le proxy API Anything est temporairement indisponible.') from error

    # Development fallback for environments without the private proxy. Lambda
    # always receives API_ANYTHING_PROXY_FUNCTION_NAME from Terraform.
    return ({name.lower(): _read_public_posts_direct(name) for name in usernames}, {})


def _read_public_posts_direct(username):
    """Development-only HTTP fallback, parsed with the versioned API Anything recipe."""
    recipe = json.loads((Path(__file__).parents[1]/'source_specs/x-public-timeline.json').read_text())
    request = Request(f'https://x.com/{username}', headers={'Accept':'text/html','User-Agent':'Mozilla/5.0'})
    with urlopen(request, timeout=8) as response:
        raw = response.read(3000001)
    if len(raw)>3000000:
        raise ValueError('Réponse X trop volumineuse.')
    html = raw.decode('utf-8')
    match = re.search(recipe['operations'][0]['response']['embedded']['regex'], html)
    if not match:
        raise ValueError('Les publications publiques ne sont pas lisibles sur ce profil.')
    embedded, _ = json.JSONDecoder().raw_decode(html[match.start(1):])
    data = json.loads(embedded) if isinstance(embedded,str) else embedded
    return parse_public_timeline(data, username)


def parse_public_timeline(data, username):
    """Normalize API Anything's extracted public X timeline into attributed posts."""
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except ValueError:
            recipe = json.loads((Path(__file__).parents[1]/'source_specs/x-public-timeline.json').read_text())
            match = re.search(recipe['operations'][0]['response']['embedded']['regex'], data)
            if not match:
                raise ValueError('Les publications publiques ne sont pas lisibles dans la réponse API Anything.')
            embedded, _ = json.JSONDecoder().raw_decode(data[match.start(1):])
            data = json.loads(embedded) if isinstance(embedded, str) else embedded
    if not isinstance(data, dict):
        raise ValueError('Réponse API Anything du fil X invalide.')
    user = data.get('data',{}).get('user_result_by_screen_name',{}).get('result',{})
    instructions = user.get('profile_user_originals_timeline',{}).get('timeline',{}).get('instructions')
    if not isinstance(instructions,list):
        raise ValueError('Liste de publications absente de la réponse publique.')
    posts = {}
    def walk(value):
        if isinstance(value,list):
            for child in value: walk(child)
        elif isinstance(value,dict):
            result=value.get('tweet_results',{}).get('result',{})
            tweet=result.get('tweet',result)
            author=tweet.get('core',{}).get('user_results',{}).get('result',{})
            handle=author.get('core',{}).get('screen_name') or author.get('legacy',{}).get('screen_name','')
            identifier=tweet.get('rest_id','')
            if identifier.isdigit() and handle.lower()==username.lower():
                details=tweet.get('details') or tweet.get('legacy',{})
                text=tweet.get('note_tweet',{}).get('note_tweet_results',{}).get('result',{}).get('text') or details.get('full_text','')
                stamp=details.get('created_at_ms')
                if isinstance(stamp,(int,float)):
                    published=datetime.fromtimestamp(stamp/1000,tz=timezone.utc).isoformat()
                else:
                    try: published=datetime.strptime(details['created_at'],'%a %b %d %H:%M:%S %z %Y').isoformat()
                    except (ValueError,KeyError):return
                if text:
                    verification=author.get('verification',{})
                    badge_type=verification.get('verified_type')
                    profile={'id':author.get('rest_id',username),'username':username,
                        'name':author.get('core',{}).get('name') or author.get('legacy',{}).get('name') or username,
                        'image':author.get('avatar',{}).get('image_url') or author.get('legacy',{}).get('profile_image_url_https'),
                        'verified':bool(verification.get('is_blue_verified') or badge_type in ('Government','Business')),
                        'verifiedType':badge_type,'source':'X · profil associé au tweet','latestPost':None}
                    counts=tweet.get('counts') or tweet.get('legacy',{})
                    metrics={key:counts.get(field) for key,field in [('replies','reply_count'),('reposts','retweet_count'),('likes','favorite_count'),('bookmarks','bookmark_count')] if isinstance(counts.get(field),(int,float))}
                    views=tweet.get('views',{}).get('count')
                    if isinstance(views,(int,float)) or isinstance(views,str) and views.isdigit():metrics['views']=int(views)
                    media=tweet.get('legacy',{}).get('extended_entities',{}).get('media',[])
                    images=[item['media_url_https'] for item in media if item.get('type')=='photo' and str(item.get('media_url_https','')).startswith('https://')]
                    posts[identifier]={'id':identifier,'author':username,'text':text[:10000], 'publishedAt':published,'url':f'https://x.com/{username}/status/{identifier}', 'profile':profile,'metrics':metrics,'images':images}

                return  # Do not count quoted/nested posts as the author's own publication.
            for child in value.values():
                if isinstance(child,(dict,list)):walk(child)
    walk(instructions)
    return sorted(posts.values(),key=lambda item:item['publishedAt'],reverse=True)[:8]


def collect_authorized_posts(persona, query, usernames=None):
    if not isinstance(query,str) or not 2<=len(query.strip())<=500:
        raise ValueError('Sujet de recherche X requis (2 à 500 caractères).')
    profiles=authorized_profiles(persona)  # Read again: removing permission takes effect on every call.
    allowed={p['username'].lower():p['username'] for p in profiles}
    if usernames is not None and (not isinstance(usernames,list) or not 1<=len(usernames)<=8 or any(not isinstance(name,str) or name.lower().removeprefix('@') not in allowed for name in usernames)):
        raise ValueError('Seuls les profils X autorisés du compte actif peuvent être consultés (huit par appel).')
    selected=list(dict.fromkeys(allowed[name.lower().removeprefix('@')] for name in usernames)) if usernames else [p['username'] for p in profiles[:8]]
    failures=[]
    def fetch(name):
        try:return name,read_public_posts(name),None
        except Exception:return name,[],f'Lecture publique de @{name} indisponible.'
    rows=[]
    if os.getenv('API_ANYTHING_PROXY_FUNCTION_NAME', '').strip():
        try:
            proxied, proxy_failures = read_public_posts_batch(selected)
            for name in selected:
                posts = proxied.get(name.lower(), [])
                rows.extend(posts)
                if name.lower() in proxy_failures:
                    failures.append({'username': name, 'reason': proxy_failures[name.lower()]})
        except Exception:
            failures.extend({'username': name, 'reason': f'Lecture publique de @{name} indisponible via API Anything.'} for name in selected)
    else:
        with ThreadPoolExecutor(max_workers=3) as pool:
            for name,posts,error in pool.map(fetch,selected):
                rows.extend(posts)
                if error:failures.append({'username':name,'reason':error})
    # Deterministic multilingual topic matching. The model assesses the returned context further.
    stop={'les','des','une','dans','pour','avec','sur','the','and','from','what','that','this','quels','quelles','analyse','analyser','tweets','publications','autorisés','comptes'}
    terms=set(re.findall(r'[\w$-]{3,}',query.lower()))-stop
    synonyms={'stabilité':['stability','financial'],'réglementation':['regulation','regulatory'],'taux':['rate','rates','interest','monetary'],'inflation':['cpi','prices','price','inflation'],'emploi':['employment','jobs','labor','unemployment'],'tarifs':['tariff','tariffs'],'énergie':['oil','energy','gas']}
    for word,expanded in synonyms.items():
        if word in terms:terms.update(expanded)
    ranked=[]
    for post in rows:
        text=(post['text']+' '+post['author']).lower()
        score=sum(bool(re.search(r'(?<!\w)'+re.escape(term)+r'(?!\w)',text)) for term in terms)
        if score:ranked.append({**post,'matchedTerms':[term for term in sorted(terms) if re.search(r'(?<!\w)'+re.escape(term)+r'(?!\w)',text)],'relevanceScore':score})
    ranked.sort(key=lambda item:(item['relevanceScore'],item['publishedAt']),reverse=True)
    return {'persona':persona,'query':query,'profilesConsulted':selected,'authorizedCount':len(profiles),
        'remainingProfiles':[p['username'] for p in profiles if p['username'] not in selected],
        'posts':ranked[:12],'failures':failures,'observedAt':datetime.now(timezone.utc).isoformat(),
        'limitations':['Publications visibles publiquement seulement; couverture possiblement partielle.',
                        'La pertinence lexicale ne prouve pas un lien économique. Ne citer que les posts utiles à la question.',
                        'Un tweet est une déclaration attribuée, jamais une confirmation indépendante ni une preuve de causalité.']}
