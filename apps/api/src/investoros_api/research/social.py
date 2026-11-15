"""Validate public X oEmbed attribution without treating a post as corroboration."""

import json
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import quote, urlsplit


_X_HOSTS = {"x.com", "www.x.com", "twitter.com", "www.twitter.com"}
_POST_PATH = re.compile(r"/([A-Za-z0-9_]{1,15})/status/([0-9]{1,25})/?")
_PROFILE_PATH = re.compile(r"/([A-Za-z0-9_]{1,15})/?")


def _https_parts(value: str):
    if not isinstance(value, str) or not value or len(value) > 2000 or any(char.isspace() or ord(char) < 32 for char in value):
        raise ValueError("URL publique HTTPS invalide.")
    try:
        parts = urlsplit(value)
        valid = parts.scheme == "https" and parts.hostname and not parts.username and not parts.password and parts.port in {None, 443}
    except ValueError as error:
        raise ValueError("URL publique HTTPS invalide.") from error
    if not valid:
        raise ValueError("URL publique HTTPS invalide.")
    return parts


def canonical_post_url(value: str) -> str:
    parts = _https_parts(value)
    match = _POST_PATH.fullmatch(parts.path)
    if parts.hostname not in _X_HOSTS or not match:
        raise ValueError("Ajoutez un lien HTTPS vers un post X précis.")
    return f"https://x.com/{match[1]}/status/{match[2]}"


def oembed_url(value: str) -> str:
    post = quote(canonical_post_url(value), safe="")
    return f"https://publish.x.com/oembed?url={post}&omit_script=true&dnt=true"


def _profile_url(value: str) -> str:
    parts = _https_parts(value)
    match = _PROFILE_PATH.fullmatch(parts.path)
    if parts.hostname not in _X_HOSTS or not match:
        raise ValueError("L'auteur oEmbed ne possède pas une URL de profil X valide.")
    return f"https://x.com/{match[1]}"


class _PostMarkup(HTMLParser):
    """Keep oEmbed fallback markup, omitting executable elements and attributes."""

    _allowed = {"blockquote", "p", "br", "a"}
    _suppressed = {"script", "style", "iframe", "object", "template", "svg", "math"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.markup: list[str] = []
        self.post_text: list[str] = []
        self.open_tags: list[str] = []
        self.suppressed: list[str] = []
        self.paragraph_depth = 0

    def handle_starttag(self, tag, attrs):
        if self.suppressed:
            if tag in self._suppressed:
                self.suppressed.append(tag)
            return
        if tag in self._suppressed:
            self.suppressed.append(tag)
            return
        if tag not in self._allowed:
            return
        rendered = ""
        if tag == "a":
            href = dict(attrs).get("href")
            try:
                _https_parts(href)
            except ValueError:
                pass
            else:
                rendered = f' href="{escape(href, quote=True)}" target="_blank" rel="noopener noreferrer"'
        elif tag == "blockquote":
            rendered = ' class="twitter-tweet"'
        self.markup.append(f"<{tag}{rendered}>")
        if tag == "br":
            if self.paragraph_depth:
                self.post_text.append("\n")
        else:
            self.open_tags.append(tag)
            if tag == "p":
                self.paragraph_depth += 1

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag != "br":
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.suppressed:
            if tag == self.suppressed[-1]:
                self.suppressed.pop()
            return
        if tag not in self.open_tags:
            return
        while self.open_tags:
            closed = self.open_tags.pop()
            self.markup.append(f"</{closed}>")
            if closed == "p":
                self.paragraph_depth -= 1
                self.post_text.append("\n")
            if closed == tag:
                break

    def handle_data(self, data):
        if self.suppressed:
            return
        self.markup.append(escape(data))
        if self.paragraph_depth:
            self.post_text.append(data)

    def finish(self) -> tuple[str, str]:
        self.close()
        while self.open_tags:
            self.markup.append(f"</{self.open_tags.pop()}>")
        text = re.sub(r"[\t\r ]+", " ", "".join(self.post_text))
        text = re.sub(r"\n[ \n]+", "\n", text).strip()
        return "".join(self.markup).strip(), text


def normalize_oembed(payload: dict, requested_url: str) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Réponse oEmbed invalide.")
    normalized = payload.get("kind") == "x_oembed"
    if not normalized and payload.get("type") != "rich":
        raise ValueError("La réponse oEmbed n'est pas un post public intégrable.")
    requested = canonical_post_url(requested_url)
    post = canonical_post_url(payload.get("post_url") if normalized else payload.get("url"))
    if post.casefold() != requested.casefold():
        raise ValueError("La réponse oEmbed ne correspond pas au post demandé.")
    author_url = _profile_url(payload.get("author_url"))
    if author_url.rsplit("/", 1)[-1].casefold() != requested.split("/")[3].casefold():
        raise ValueError("L'auteur oEmbed ne correspond pas au compte du post.")
    author_name = payload.get("author_name")
    if not isinstance(author_name, str) or not author_name.strip() or len(author_name) > 240 or any(ord(char) < 32 for char in author_name):
        raise ValueError("Nom d'auteur oEmbed invalide.")
    html = payload.get("html")
    if not isinstance(html, str) or not html or len(html) > 30000:
        raise ValueError("Le contenu oEmbed est absent ou trop volumineux.")
    parser = _PostMarkup()
    parser.feed(html)
    markup, text = parser.finish()
    if not text:
        raise ValueError("Le post oEmbed ne contient aucun texte attribuable.")
    cache_age = payload.get("cache_age_seconds" if normalized else "cache_age", 0)
    try:
        cache_age = max(0, min(86400, int(cache_age)))
    except (ValueError, TypeError, OverflowError):
        cache_age = 0
    result = {"kind": "x_oembed", "post_url": requested, "author_name": author_name.strip(),
              "author_url": author_url, "html": markup, "text": text,
              "identity_verified": False, "cache_age_seconds": cache_age}
    if len(json.dumps(result, ensure_ascii=False)) > 8000:
        raise ValueError("Le post dépasse le budget de preuve; utilisez le lien original.")
    return result


def oembed_claims(evidence: dict) -> list[dict]:
    content = evidence.get("content")
    for _ in range(5):
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except ValueError:
                return []
        elif isinstance(content, dict) and content.get("kind") != "x_oembed" and "text" in content:
            content = content["text"]
        else:
            break
    if not isinstance(content, dict) or content.get("kind") != "x_oembed" or not isinstance(evidence.get("evidence_id"), str):
        return []
    try:
        post = normalize_oembed(content, content.get("post_url"))
    except ValueError:
        return []
    handle = post["author_url"].rsplit("/", 1)[-1]
    excerpt = post["text"]
    if len(excerpt) > 500:
        excerpt = excerpt[:497].rstrip() + "…"
    return [{"text": f"Propos attribué à {post['author_name']} (@{handle}) : « {excerpt} ». Cette attribution ne vérifie pas la véracité du contenu.",
             "claim_type": "attributed_statement", "evidence_ids": [evidence["evidence_id"]],
             "confidence": "partial", "url": post["post_url"]}]
