"""
LAMLA Guide AI - Real-Time Internet Knowledge & Visual Diagram Enrichment Core
"It's Never Too Late To Study."

Provides:
- Fast concurrent internet academic research (Wikipedia Search + REST Summary, DuckDuckGo Instant Answer)
- Verified educational diagram & labeled illustration discovery via Wikimedia Commons & Wikipedia lead visuals
- Automatic background learning & topic enrichment whenever a student uploads slides/PDFs
- Bounded LRU + disk caching (.cache/lamla_data/web_knowledge_cache.json) for zero storage bloat at million-user scale
- Clean deterministic labeled SVG schematic generator for any concept
"""

import os
import re
import html
import json
import time
import hashlib
import threading
import urllib.parse
import urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List, Optional

DATA_DIR = Path(
    os.environ.get(
        "LAMLA_DATA_DIR",
        Path(__file__).resolve().parent.parent / ".cache" / "lamla_data",
    )
)
DATA_DIR.mkdir(parents=True, exist_ok=True)
WEB_CACHE_FILE = DATA_DIR / "web_knowledge_cache.json"
DOC_ENRICH_FILE = DATA_DIR / "doc_enrichment_cache.json"

USER_AGENT = "LAMLAGuideAI/2.0 (Educational Study Platform; mailto:bismarkanadjei@gmail.com)"
MAX_TOPIC_CACHE = 1200
MAX_DOC_CACHE = 600

_LOCK = threading.Lock()
_TOPIC_CACHE: Dict[str, Dict[str, Any]] = {}
_DOC_CACHE: Dict[str, Dict[str, Any]] = {}
_LOADED = False

STOPWORDS = {
    "what", "why", "how", "when", "where", "which", "who", "whom", "whose",
    "does", "do", "did", "is", "are", "was", "were", "be", "been", "being",
    "can", "could", "should", "would", "will", "shall", "may", "might",
    "explain", "describe", "define", "tell", "show", "draw", "sketch",
    "illustrate", "visualize", "diagram", "picture", "image", "photo",
    "give", "make", "create", "generate", "please", "about", "from", "with",
    "into", "onto", "that", "this", "these", "those", "their", "there",
    "your", "mine", "slide", "slides", "page", "pages", "lecture", "notes",
    "simple", "simply", "detail", "detailed", "step", "steps", "example",
    "examples", "concept", "concepts", "between", "difference", "compare",
    "the", "and", "for", "not", "but", "you", "all", "any", "some", "more",
}


def _ensure_loaded():
    global _LOADED, _TOPIC_CACHE, _DOC_CACHE
    if _LOADED:
        return
    with _LOCK:
        if _LOADED:
            return
        if WEB_CACHE_FILE.exists():
            try:
                raw = json.loads(WEB_CACHE_FILE.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    _TOPIC_CACHE = raw
            except Exception:
                _TOPIC_CACHE = {}
        if DOC_ENRICH_FILE.exists():
            try:
                raw_doc = json.loads(DOC_ENRICH_FILE.read_text(encoding="utf-8"))
                if isinstance(raw_doc, dict):
                    _DOC_CACHE = raw_doc
            except Exception:
                _DOC_CACHE = {}
        _LOADED = True


def _persist_caches_Bounded():
    """Atomically saves bounded caches so disk usage never exceeds a few megabytes even for millions of uploads."""
    try:
        with _LOCK:
            if len(_TOPIC_CACHE) > MAX_TOPIC_CACHE:
                sorted_keys = sorted(
                    _TOPIC_CACHE.keys(),
                    key=lambda k: _TOPIC_CACHE[k].get("ts", 0),
                    reverse=True,
                )[:MAX_TOPIC_CACHE]
                trimmed = {k: _TOPIC_CACHE[k] for k in sorted_keys}
                _TOPIC_CACHE.clear()
                _TOPIC_CACHE.update(trimmed)

            if len(_DOC_CACHE) > MAX_DOC_CACHE:
                sorted_dkeys = sorted(
                    _DOC_CACHE.keys(),
                    key=lambda k: _DOC_CACHE[k].get("ts", 0),
                    reverse=True,
                )[:MAX_DOC_CACHE]
                trimmed_d = {k: _DOC_CACHE[k] for k in sorted_dkeys}
                _DOC_CACHE.clear()
                _DOC_CACHE.update(trimmed_d)

            topic_snapshot = dict(_TOPIC_CACHE)
            doc_snapshot = dict(_DOC_CACHE)

        tmp_t = WEB_CACHE_FILE.with_suffix(".tmp")
        tmp_t.write_text(json.dumps(topic_snapshot, ensure_ascii=False), encoding="utf-8")
        tmp_t.replace(WEB_CACHE_FILE)

        tmp_d = DOC_ENRICH_FILE.with_suffix(".tmp")
        tmp_d.write_text(json.dumps(doc_snapshot, ensure_ascii=False), encoding="utf-8")
        tmp_d.replace(DOC_ENRICH_FILE)
    except Exception:
        pass


def extract_core_search_phrase(raw_query: str) -> str:
    """Extracts a clean academic topic phrase from a conversational student question."""
    if not raw_query:
        return ""
    # Strip markdown/quotes
    cleaned = re.sub(r"[`*_\"'?!.,:;()\[\]{}]+", " ", raw_query)
    cleaned = re.sub(r"\b(?:slide|page)\s*\d+\b", " ", cleaned, flags=re.IGNORECASE)
    tokens = [t for t in cleaned.split() if len(t) > 1]
    meaningful = [t for t in tokens if t.lower() not in STOPWORDS]
    if not meaningful:
        meaningful = tokens[:4]
    return " ".join(meaningful[:6]).strip()


def is_visual_or_drawing_request(query: str, action_type: Optional[str] = None) -> bool:
    """Detects when a student asks for an image, diagram, drawing, sketch, or visual explanation."""
    if action_type in ("draw_visualize", "visual_diagram"):
        return True
    q = (query or "").lower()
    visual_patterns = [
        r"\bdraw\b",
        r"\bsketch\b",
        r"\bdiagram\b",
        r"\billustrat",
        r"\bvisuali[sz]",
        r"\bshow\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|diagram|drawing|chart|graph|figure|map)\b",
        r"\bgenerate\s+(?:an?\s+)?(?:image|picture|diagram|drawing)\b",
        r"\bpicture\s+of\b",
        r"\bimage\s+of\b",
        r"\blabel(?:ed|led)?\b",
        r"\bflowchart\b",
        r"\bstructure\s+of\b",
        r"\banatomy\s+of\b",
        r"\bgraph\s+of\b",
        r"\bcycle\s+of\b",
    ]
    return any(re.search(pat, q) for pat in visual_patterns)


def _http_get_json(url: str, timeout: float = 2.4) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if resp.status == 200:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    return None


def _fetch_wikipedia_topic(phrase: str) -> Optional[Dict[str, Any]]:
    if not phrase:
        return None
    try:
        # Step 1: Opensearch to resolve exact canonical article title
        search_url = (
            "https://en.wikipedia.org/w/api.php?action=opensearch"
            f"&search={urllib.parse.quote(phrase)}&limit=2&namespace=0&format=json"
        )
        sdata = _http_get_json(search_url, timeout=2.2)
        canonical_title = phrase
        if isinstance(sdata, list) and len(sdata) >= 2 and sdata[1]:
            canonical_title = sdata[1][0]

        sum_url = (
            "https://en.wikipedia.org/api/rest_v1/page/summary/"
            f"{urllib.parse.quote(canonical_title.replace(' ', '_'))}"
        )
        data = _http_get_json(sum_url, timeout=2.2)
        if not isinstance(data, dict) or not data.get("extract"):
            return None

        thumb = (data.get("thumbnail") or {}).get("source") or (data.get("originalimage") or {}).get("source") or ""
        # Filter out generic disambiguation / non-educational icons
        if any(bad in thumb.lower() for bad in ["disambig", "question_book", "ambox", "commons-logo", "wikidata"]):
            thumb = ""

        return {
            "title": data.get("title", canonical_title),
            "description": data.get("description", ""),
            "extract": data.get("extract", "")[:1100],
            "url": ((data.get("content_urls") or {}).get("desktop") or {}).get("page", ""),
            "image_url": thumb,
        }
    except Exception:
        return None


def _fetch_duckduckgo_instant(phrase: str) -> Optional[str]:
    if not phrase:
        return None
    try:
        url = (
            f"https://api.duckduckgo.com/?q={urllib.parse.quote(phrase)}"
            "&format=json&no_html=1&skip_disambig=1"
        )
        data = _http_get_json(url, timeout=2.0)
        if not isinstance(data, dict):
            return None
        abstract = (data.get("AbstractText") or data.get("Definition") or "").strip()
        if abstract:
            return abstract[:800]
        related = data.get("RelatedTopics") or []
        snippets = []
        for item in related[:3]:
            if isinstance(item, dict) and item.get("Text"):
                snippets.append(str(item["Text"]).strip())
        if snippets:
            return " ".join(snippets)[:650]
    except Exception:
        pass
    return None


def _strip_html_tags(raw: str) -> str:
    if not raw:
        return ""
    no_tags = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", html.unescape(no_tags)).strip()


def _fetch_wikimedia_diagrams(phrase: str, limit: int = 3) -> List[Dict[str, str]]:
    """Finds verified educational diagrams & labeled schematics on Wikimedia Commons."""
    if not phrase:
        return []
    try:
        q = f"{phrase} diagram"
        url = (
            "https://commons.wikimedia.org/w/api.php?action=query"
            f"&generator=search&gsrsearch={urllib.parse.quote(q)}"
            "&gsrnamespace=6&gsrlimit=6&prop=imageinfo"
            "&iiprop=url|extmetadata|mime&iiurlwidth=900&format=json"
        )
        data = _http_get_json(url, timeout=2.4)
        pages = ((data or {}).get("query") or {}).get("pages") or {}
        diagrams: List[Dict[str, str]] = []
        for page in pages.values():
            title = str(page.get("title", "")).replace("File:", "").strip()
            infos = page.get("imageinfo") or []
            if not infos:
                continue
            info = infos[0]
            mime = str(info.get("mime", "")).lower()
            if not any(m in mime for m in ("image/svg", "image/png", "image/jpeg")):
                continue
            img_url = info.get("thumburl") or info.get("url") or ""
            if not img_url or not img_url.startswith("https://"):
                continue
            lower_title = title.lower()
            if any(skip in lower_title for skip in ("logo", "icon", "flag", "portrait", "coat_of_arms", "signature")):
                continue
            ext = info.get("extmetadata") or {}
            desc = _strip_html_tags((ext.get("ImageDescription") or {}).get("value", ""))
            clean_caption = desc[:180] if desc else re.sub(r"\.[a-zA-Z0-9]+$", "", title).replace("_", " ")
            diagrams.append({
                "title": re.sub(r"\.[a-zA-Z0-9]+$", "", title).replace("_", " "),
                "url": img_url,
                "caption": clean_caption,
            })
            if len(diagrams) >= limit:
                break
        return diagrams
    except Exception:
        return []


def research_topic_from_web(raw_query: str, include_images: bool = True) -> Dict[str, Any]:
    """
    Fast parallel academic web lookup with bounded caching.
    Returns:
      {
        "phrase": str,
        "summary_text": str,
        "source_title": str,
        "source_url": str,
        "images": [{"title": str, "url": str, "caption": str}]
      }
    """
    _ensure_loaded()
    phrase = extract_core_search_phrase(raw_query)
    if not phrase:
        return {"phrase": "", "summary_text": "", "source_title": "", "source_url": "", "images": []}

    cache_key = phrase.lower()
    with _LOCK:
        cached = _TOPIC_CACHE.get(cache_key)
    if cached and (time.time() - cached.get("ts", 0) < 7 * 86400):
        if not include_images or "images" in cached:
            return cached

    wiki_res = None
    ddg_res = None
    commons_imgs: List[Dict[str, str]] = []

    with ThreadPoolExecutor(max_workers=3) as pool:
        f_wiki = pool.submit(_fetch_wikipedia_topic, phrase)
        f_ddg = pool.submit(_fetch_duckduckgo_instant, phrase)
        f_img = pool.submit(_fetch_wikimedia_diagrams, phrase, 3) if include_images else None

        try:
            wiki_res = f_wiki.result(timeout=2.6)
        except Exception:
            wiki_res = None
        try:
            ddg_res = f_ddg.result(timeout=2.2)
        except Exception:
            ddg_res = None
        if f_img is not None:
            try:
                commons_imgs = f_img.result(timeout=2.6) or []
            except Exception:
                commons_imgs = []

    parts = []
    source_title = ""
    source_url = ""
    images: List[Dict[str, str]] = []

    if wiki_res:
        source_title = wiki_res.get("title", phrase)
        source_url = wiki_res.get("url", "")
        desc = f" ({wiki_res['description']})" if wiki_res.get("description") else ""
        parts.append(f"{source_title}{desc}: {wiki_res['extract']}")
        if wiki_res.get("image_url"):
            images.append({
                "title": f"{source_title} — Reference Illustration",
                "url": wiki_res["image_url"],
                "caption": wiki_res.get("description") or f"Educational diagram of {source_title}",
            })

    if ddg_res and (not wiki_res or ddg_res[:80].lower() not in wiki_res.get("extract", "").lower()):
        parts.append(f"Additional Reference: {ddg_res}")

    seen_urls = {img["url"] for img in images}
    for d in commons_imgs:
        if d["url"] not in seen_urls:
            seen_urls.add(d["url"])
            images.append(d)

    record = {
        "phrase": phrase,
        "summary_text": "\n".join(parts).strip(),
        "source_title": source_title or phrase.title(),
        "source_url": source_url,
        "images": images[:4],
        "ts": int(time.time()),
    }

    if record["summary_text"] or record["images"]:
        with _LOCK:
            _TOPIC_CACHE[cache_key] = record
        threading.Thread(target=_persist_caches_Bounded, daemon=True).start()

    return record


def extract_document_topics(title: str, full_text: str, key_concepts: Optional[List[str]] = None) -> List[str]:
    """Extracts up to 6 distinct academic topics from slide titles and key concepts."""
    topics: List[str] = []
    seen = set()

    def _add(candidate: str):
        clean = extract_core_search_phrase(candidate)
        if clean and len(clean) >= 3 and clean.lower() not in seen:
            seen.add(clean.lower())
            topics.append(clean)

    if title:
        clean_title = re.sub(r"\.[a-zA-Z0-9]{2,5}$", "", title).replace("_", " ").replace("-", " ")
        _add(clean_title)

    # Pull distinct slide/page headings
    for m in re.finditer(r"---\s*(?:Slide|Page)\s*\d+:\s*([^\n-]+?)---", full_text or ""):
        heading = m.group(1).strip()
        if heading.lower() not in ("untitled", "introduction", "overview", "thank you", "questions", "summary", "references"):
            _add(heading)
        if len(topics) >= 6:
            break

    if key_concepts:
        for kc in key_concepts:
            if len(topics) >= 6:
                break
            _add(kc)

    return topics[:6]


def enrich_uploaded_document(
    full_text: str,
    title: str = "",
    key_concepts: Optional[List[str]] = None,
    doc_hash: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Analyzes an uploaded slide deck/document and learns supplementary academic context
    and verified educational diagrams from the internet. Cached by SHA-256 content hash.
    """
    _ensure_loaded()
    if not full_text:
        return {"doc_hash": "", "topics": [], "knowledge_brief": "", "images": []}

    computed_hash = doc_hash or hashlib.sha256(full_text[:120000].encode("utf-8", errors="ignore")).hexdigest()[:24]
    with _LOCK:
        existing = _DOC_CACHE.get(computed_hash)
    if existing:
        return existing

    topics = extract_document_topics(title, full_text, key_concepts)
    if not topics:
        return {"doc_hash": computed_hash, "topics": [], "knowledge_brief": "", "images": []}

    brief_lines: List[str] = []
    collected_images: List[Dict[str, str]] = []
    seen_img_urls = set()

    with ThreadPoolExecutor(max_workers=4) as pool:
        future_map = {pool.submit(research_topic_from_web, t, True): t for t in topics}
        for fut in as_completed(future_map, timeout=3.8):
            try:
                res = fut.result()
                if res.get("summary_text"):
                    brief_lines.append(f"• {res['summary_text'][:550]}")
                for img in res.get("images", [])[:2]:
                    if img["url"] not in seen_img_urls:
                        seen_img_urls.add(img["url"])
                        collected_images.append(img)
            except Exception:
                continue

    enriched = {
        "doc_hash": computed_hash,
        "topics": topics,
        "knowledge_brief": "\n".join(brief_lines[:6]),
        "images": collected_images[:8],
        "ts": int(time.time()),
    }
    with _LOCK:
        _DOC_CACHE[computed_hash] = enriched
    threading.Thread(target=_persist_caches_Bounded, daemon=True).start()
    return enriched


def schedule_background_enrichment(full_text: str, title: str = "", key_concepts: Optional[List[str]] = None):
    """Non-blocking background worker triggered right after document upload."""
    if not full_text:
        return
    threading.Thread(
        target=enrich_uploaded_document,
        args=(full_text, title, key_concepts, None),
        daemon=True,
    ).start()


def get_cached_document_enrichment(full_text: str, title: str = "") -> Dict[str, Any]:
    """Returns cached internet enrichment for a document (or computes quickly if uncached)."""
    _ensure_loaded()
    if not full_text:
        return {"doc_hash": "", "topics": [], "knowledge_brief": "", "images": []}
    computed_hash = hashlib.sha256(full_text[:120000].encode("utf-8", errors="ignore")).hexdigest()[:24]
    with _LOCK:
        existing = _DOC_CACHE.get(computed_hash)
    if existing:
        return existing
    return enrich_uploaded_document(full_text, title=title, doc_hash=computed_hash)


def build_labeled_concept_svg(
    title: str,
    labels: Optional[List[str]] = None,
    subtitle: str = "Labeled Concept Schematic",
) -> str:
    """
    Generates a clean, predominantly white, publication-grade labeled SVG schematic diagram
    for any academic concept, structure, or multi-stage process.
    """
    safe_title = html.escape((title or "Core Concept")[:54])
    safe_sub = html.escape((subtitle or "Labeled Concept Diagram")[:72])

    clean_labels = [html.escape(str(lb).strip()[:36]) for lb in (labels or []) if str(lb).strip()]
    if len(clean_labels) < 3:
        tokens = [t.title() for t in extract_core_search_phrase(title).split() if len(t) > 2]
        defaults = [
            f"1. Input / {tokens[0] if tokens else 'Foundation'}",
            f"2. Core Mechanism ({tokens[1] if len(tokens) > 1 else 'Process'})",
            "3. Key Regulation & Structure",
            "4. Functional Output & Effect",
        ]
        for d in defaults:
            if len(clean_labels) < 4:
                clean_labels.append(html.escape(d[:36]))
    clean_labels = clean_labels[:6]

    # Position callout nodes cleanly around a central concept hub
    node_coords = [
        (45, 95, 225, 122),
        (490, 95, 490, 122),
        (45, 195, 225, 195),
        (490, 195, 490, 195),
        (45, 275, 250, 240),
        (490, 275, 465, 240),
    ]

    nodes_svg = []
    for idx, label in enumerate(clean_labels):
        bx, by, lx, ly = node_coords[idx]
        cx_target = 315 if bx < 300 else 445
        cy_target = 165 + (idx // 2 - 1) * 26
        nodes_svg.append(
            f'<line x1="{lx}" y1="{by + 20}" x2="{cx_target}" y2="{cy_target}" '
            f'stroke="#2563eb" stroke-width="1.8" stroke-dasharray="4 3" />'
            f'<circle cx="{cx_target}" cy="{cy_target}" r="4" fill="#2563eb" />'
            f'<rect x="{bx}" y="{by}" width="225" height="40" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.4" />'
            f'<text x="{bx + 12}" y="{by + 25}" font-family="system-ui, -apple-system, sans-serif" '
            f'font-size="12.5" font-weight="600" fill="#0f172a">{idx + 1}. {label}</text>'
        )

    joined_nodes = "\n  ".join(nodes_svg)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 340" width="100%" role="img" aria-label="{safe_title}">
  <rect x="1" y="1" width="758" height="338" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
  <rect x="1" y="1" width="758" height="58" rx="14" fill="#f8fafc" />
  <line x1="1" y1="59" x2="759" y2="59" stroke="#e2e8f0" stroke-width="1" />
  <text x="24" y="28" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#0f172a">{safe_title}</text>
  <text x="24" y="46" font-family="system-ui, -apple-system, sans-serif" font-size="11.5" fill="#64748b">{safe_sub}</text>
  <ellipse cx="380" cy="185" rx="76" ry="52" fill="#eff6ff" stroke="#2563eb" stroke-width="2" />
  <text x="380" y="182" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#1d4ed8">{safe_title[:20]}</text>
  <text x="380" y="200" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" font-weight="500" fill="#475569">Core System</text>
  {joined_nodes}
</svg>"""
