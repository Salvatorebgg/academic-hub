#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build a static live-feed snapshot for Academic Hub.

The script avoids API keys and third-party Python dependencies so it can run in
GitHub Actions on a schedule. It writes both data/live-feed.json and
js/live-feed-data.js; the JS copy keeps the site useful when opened directly
from disk where fetch("data/*.json") is unavailable.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "live-feed.json"
OUT_JS = ROOT / "js" / "live-feed-data.js"

USER_AGENT = "AcademicHub/4.0 (+https://github.com/Salvatorebgg/academic-hub)"
RECENT_DAYS = 120
MONTHS = {
    "jan": "01",
    "feb": "02",
    "mar": "03",
    "apr": "04",
    "may": "05",
    "jun": "06",
    "jul": "07",
    "aug": "08",
    "sep": "09",
    "oct": "10",
    "nov": "11",
    "dec": "12",
}


TOPICS = [
    {
        "discipline": "cs",
        "openalex": "artificial intelligence machine learning large language models",
        "arxiv": "cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.CV+OR+cat:cs.LG",
        "pubmed": None,
        "rss_terms": ["artificial intelligence", "machine learning", "large language model"],
    },
    {
        "discipline": "bio",
        "openalex": "bioinformatics genomics single cell CRISPR",
        "arxiv": "cat:q-bio.GN+OR+cat:q-bio.BM+OR+cat:q-bio.QM",
        "pubmed": "bioinformatics[Title/Abstract] OR genomics[Title/Abstract] OR CRISPR[Title/Abstract]",
        "rss_terms": ["bioinformatics", "genomics", "CRISPR", "single-cell"],
    },
    {
        "discipline": "clinical",
        "openalex": "clinical trial oncology medicine therapy",
        "arxiv": None,
        "pubmed": "clinical trial[Title/Abstract] OR oncology[Title/Abstract] OR vaccine[Title/Abstract] OR therapy[Title/Abstract]",
        "rss_terms": ["clinical trial", "medicine", "FDA", "therapy", "oncology"],
    },
    {
        "discipline": "geo",
        "openalex": "climate change earth science geoscience remote sensing",
        "arxiv": "cat:physics.ao-ph+OR+cat:physics.geo-ph+OR+cat:astro-ph.EP",
        "pubmed": None,
        "rss_terms": ["climate", "earth science", "geology", "remote sensing"],
    },
]


RSS_SOURCES = [
    {"name": "Nature News", "url": "https://www.nature.com/nature.rss", "discipline": "bio"},
    {"name": "Science News", "url": "https://www.science.org/rss/news_current.xml", "discipline": "bio"},
    {"name": "Medical Xpress", "url": "https://medicalxpress.com/rss-feed/", "discipline": "clinical"},
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "discipline": "cs"},
    {"name": "MIT News AI", "url": "https://news.mit.edu/rss/topic/artificial-intelligence2", "discipline": "cs"},
    {"name": "NOAA News", "url": "https://www.noaa.gov/rss.xml", "discipline": "geo"},
    {"name": "NASA Climate", "url": "https://climate.nasa.gov/news/rss.xml", "discipline": "geo"},
]


def log(message: str) -> None:
    print(message, flush=True)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def http_get(url: str, timeout: int = 12, retries: int = 1) -> Optional[bytes]:
    for attempt in range(retries + 1):
        last_exc: Exception | None = None
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json, application/xml, text/xml, */*",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read()
        except urllib.error.URLError as exc:
            if "CERTIFICATE_VERIFY_FAILED" in str(exc):
                try:
                    context = ssl._create_unverified_context()
                    with urllib.request.urlopen(req, timeout=timeout, context=context) as response:
                        return response.read()
                except Exception as fallback_exc:
                    last_exc = fallback_exc
            else:
                last_exc = exc
        except Exception as exc:
            last_exc = exc
        if attempt < retries:
            time.sleep(1.5 * (attempt + 1))
            continue
        log(f"  ! fetch failed: {url} ({last_exc})")
    return None


def http_json(url: str) -> Dict[str, Any]:
    raw = http_get(url)
    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8", errors="replace"))
    except json.JSONDecodeError as exc:
        log(f"  ! json parse failed: {url} ({exc})")
        return {}


def clean_text(value: Any, limit: Optional[int] = None) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    if limit and len(text) > limit:
        return text[: limit - 3].rstrip() + "..."
    return text


def element_text(node: Optional[ET.Element]) -> str:
    if node is None:
        return ""
    return clean_text("".join(node.itertext()))


def parse_date(value: Any) -> datetime:
    text = clean_text(value)
    if not text:
        return now_utc()
    for fmt in (
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%a, %d %b %Y %H:%M:%S %z",
        "%d %b %Y",
        "%B %d, %Y",
        "%Y%m%d%H%M%S",
    ):
        try:
            parsed = datetime.strptime(text, fmt)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            pass
    match = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", text)
    if match:
        return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)), tzinfo=timezone.utc)
    match = re.search(r"(\d{4})(\d{2})(\d{2})", text)
    if match:
        return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)), tzinfo=timezone.utc)
    return now_utc()


def iso_date(value: Any) -> str:
    return parse_date(value).date().isoformat()


def stable_id(prefix: str, *parts: str) -> str:
    raw = "||".join(parts).encode("utf-8", errors="ignore")
    return f"{prefix}-{hashlib.sha1(raw).hexdigest()[:12]}"


def estimate_read_time(text: str) -> str:
    chinese = len(re.findall(r"[\u4e00-\u9fff]", text or ""))
    english = len(re.findall(r"[a-zA-Z]+", text or ""))
    return f"{max(1, round((chinese + english) / 220))} min"


def extract_keywords(text: str, fallback: Iterable[str] = ()) -> List[str]:
    stop = {
        "using",
        "based",
        "study",
        "analysis",
        "research",
        "science",
        "model",
        "models",
        "data",
        "with",
        "from",
        "into",
        "between",
        "through",
    }
    words = re.findall(r"[A-Za-z][A-Za-z-]{3,}", (text or "").lower())
    counts: Dict[str, int] = {}
    for word in words:
        if word not in stop:
            counts[word] = counts.get(word, 0) + 1
    ranked = [word for word, _ in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:8]]
    return list(dict.fromkeys([clean_text(k) for k in fallback if clean_text(k)] + ranked))[:8]


def normalize(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    title = clean_text(item.get("title"))
    url = clean_text(item.get("url") or item.get("doi") or item.get("pdfUrl"))
    if not title or not re.match(r"^https?://", url):
        return None

    date = iso_date(item.get("date") or now_utc().isoformat())
    if datetime.fromisoformat(date).date() > (now_utc().date() + timedelta(days=1)):
        return None
    abstract = clean_text(item.get("abstract") or title, 900)
    source = clean_text(item.get("source") or item.get("sourceApi") or item.get("journal") or "Live source")
    journal = clean_text(item.get("journal") or source)
    keywords = extract_keywords(f"{title} {abstract}", item.get("keywords") or [])

    return {
        "id": item.get("id") or stable_id(item.get("sourceApi", "live").lower(), url, title),
        "discipline": item.get("discipline") or "cs",
        "type": item.get("type") or "paper",
        "title": title,
        "authors": clean_text(item.get("authors") or source or "Source"),
        "abstract": abstract,
        "date": date,
        "year": int(date[:4]),
        "journal": journal,
        "source": source,
        "sourceApi": item.get("sourceApi") or source,
        "url": url,
        "doi": clean_text(item.get("doi")),
        "pdfUrl": clean_text(item.get("pdfUrl")),
        "keywords": keywords,
        "readTime": item.get("readTime") or estimate_read_time(f"{title} {abstract}"),
        "citedBy": int(item.get("citedBy") or 0),
        "qualityScore": round(float(item.get("qualityScore") or 70), 2),
        "verified": item.get("verified", True),
        "_live": True,
        "_retrievedAt": now_utc().isoformat(),
    }


def reconstruct_openalex_abstract(index: Dict[str, List[int]]) -> str:
    pairs = []
    for word, positions in (index or {}).items():
        for position in positions or []:
            pairs.append((position, word))
    return " ".join(word for _, word in sorted(pairs))


def fetch_openalex(per_topic: int = 16) -> List[Dict[str, Any]]:
    log("Fetching OpenAlex works...")
    since = (now_utc() - timedelta(days=RECENT_DAYS)).date().isoformat()
    items: List[Dict[str, Any]] = []
    fields = ",".join(
        [
            "id",
            "doi",
            "display_name",
            "publication_date",
            "publication_year",
            "authorships",
            "primary_location",
            "open_access",
            "cited_by_count",
            "abstract_inverted_index",
            "concepts",
            "topics",
            "type",
        ]
    )
    for topic in TOPICS:
        params = urllib.parse.urlencode(
            {
                "search": topic["openalex"],
                "filter": f"from_publication_date:{since},has_abstract:true,is_retracted:false",
                "per-page": per_topic,
                "sort": "cited_by_count:desc",
                "select": fields,
            }
        )
        data = http_json(f"https://api.openalex.org/works?{params}")
        for work in data.get("results", []):
            location = work.get("primary_location") or {}
            source = location.get("source") or {}
            doi_url = clean_text(work.get("doi"))
            abstract = reconstruct_openalex_abstract(work.get("abstract_inverted_index") or {})
            authors = ", ".join(
                clean_text((authorship.get("author") or {}).get("display_name"))
                for authorship in (work.get("authorships") or [])[:6]
                if (authorship.get("author") or {}).get("display_name")
            )
            concepts = [clean_text(c.get("display_name")) for c in (work.get("concepts") or [])[:5]]
            topics = [clean_text(t.get("display_name")) for t in (work.get("topics") or [])[:3]]
            cited = int(work.get("cited_by_count") or 0)
            items.append(
                normalize(
                    {
                        "id": stable_id("openalex", clean_text(work.get("id") or doi_url or work.get("display_name"))),
                        "discipline": topic["discipline"],
                        "type": "paper",
                        "title": work.get("display_name"),
                        "authors": authors or "OpenAlex indexed authors",
                        "abstract": abstract,
                        "date": work.get("publication_date"),
                        "year": work.get("publication_year"),
                        "journal": source.get("display_name") or "OpenAlex",
                        "source": source.get("display_name") or "OpenAlex",
                        "sourceApi": "OpenAlex",
                        "url": location.get("landing_page_url") or doi_url or work.get("id"),
                        "doi": doi_url.replace("https://doi.org/", ""),
                        "pdfUrl": location.get("pdf_url") or (work.get("open_access") or {}).get("oa_url") or "",
                        "keywords": concepts + topics,
                        "readTime": estimate_read_time(abstract),
                        "citedBy": cited,
                        "qualityScore": min(100, 72 + (len(str(cited)) * 4)),
                        "verified": True,
                    }
                )
            )
    return [item for item in items if item]


def fetch_arxiv(per_topic: int = 16) -> List[Dict[str, Any]]:
    log("Fetching arXiv...")
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    items: List[Dict[str, Any]] = []
    for topic in TOPICS:
        if not topic.get("arxiv"):
            continue
        params = urllib.parse.urlencode(
            {
                "search_query": topic["arxiv"],
                "sortBy": "submittedDate",
                "sortOrder": "descending",
                "max_results": str(per_topic),
            }
        )
        raw = http_get(f"http://export.arxiv.org/api/query?{params}")
        if not raw:
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError as exc:
            log(f"  ! arXiv parse failed ({exc})")
            continue
        for entry in root.findall("atom:entry", ns):
            title = clean_text(entry.findtext("atom:title", default="", namespaces=ns))
            abstract = clean_text(entry.findtext("atom:summary", default="", namespaces=ns), 900)
            url = clean_text(entry.findtext("atom:id", default="", namespaces=ns))
            authors = ", ".join(
                clean_text(author.findtext("atom:name", default="", namespaces=ns))
                for author in entry.findall("atom:author", ns)[:6]
            )
            categories = [clean_text(cat.get("term")) for cat in entry.findall("atom:category", ns)]
            arxiv_id = url.rsplit("/abs/", 1)[-1] if "/abs/" in url else ""
            items.append(
                normalize(
                    {
                        "id": stable_id("arxiv", url, title),
                        "discipline": topic["discipline"],
                        "type": "paper",
                        "title": title,
                        "authors": authors or "arXiv authors",
                        "abstract": abstract,
                        "date": entry.findtext("atom:published", default="", namespaces=ns),
                        "journal": "arXiv",
                        "source": "arXiv",
                        "sourceApi": "arXiv",
                        "url": url,
                        "pdfUrl": f"https://arxiv.org/pdf/{arxiv_id}.pdf" if arxiv_id else "",
                        "keywords": categories,
                        "readTime": estimate_read_time(abstract),
                        "qualityScore": 82,
                        "verified": True,
                    }
                )
            )
    return [item for item in items if item]


def fetch_pubmed(per_topic: int = 12) -> List[Dict[str, Any]]:
    log("Fetching PubMed...")
    items: List[Dict[str, Any]] = []
    for topic in TOPICS:
        query = topic.get("pubmed")
        if not query:
            continue
        search_params = urllib.parse.urlencode(
            {
                "db": "pubmed",
                "term": query,
                "retmax": str(per_topic),
                "sort": "pub_date",
                "retmode": "json",
            }
        )
        data = http_json(f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?{search_params}")
        ids = data.get("esearchresult", {}).get("idlist", [])
        if not ids:
            continue
        fetch_params = urllib.parse.urlencode(
            {
                "db": "pubmed",
                "id": ",".join(ids),
                "retmode": "xml",
            }
        )
        raw = http_get(f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?{fetch_params}")
        if not raw:
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError as exc:
            log(f"  ! PubMed parse failed ({exc})")
            continue
        for article in root.findall(".//PubmedArticle"):
            pmid = clean_text(article.findtext(".//PMID"))
            title = element_text(article.find(".//ArticleTitle"))
            abstract = " ".join(element_text(a) for a in article.findall(".//AbstractText") if element_text(a))
            journal = clean_text(article.findtext(".//Journal/Title") or article.findtext(".//MedlineTA") or "PubMed")
            authors = []
            for author in article.findall(".//Author")[:6]:
                last = clean_text(author.findtext("LastName"))
                fore = clean_text(author.findtext("ForeName"))
                if last:
                    authors.append(f"{last} {fore[:1]}.".strip())
            pub_date = article.find(".//PubDate")
            year = pub_date.findtext("Year") if pub_date is not None else ""
            month = clean_text(pub_date.findtext("Month")) if pub_date is not None else ""
            day = clean_text(pub_date.findtext("Day")) if pub_date is not None else ""
            month = MONTHS.get(month[:3].lower(), month.zfill(2) if month.isdigit() else "01")
            day = day.zfill(2) if day.isdigit() else "01"
            date_text = f"{year}-{month}-{day}" if year else now_utc().date().isoformat()
            doi = clean_text(next((node.text for node in article.findall(".//ArticleId") if node.get("IdType") == "doi"), ""))
            items.append(
                normalize(
                    {
                        "id": f"pubmed-{pmid}" if pmid else stable_id("pubmed", title),
                        "discipline": topic["discipline"],
                        "type": "paper",
                        "title": title,
                        "authors": ", ".join(authors) or "PubMed indexed authors",
                        "abstract": abstract or title,
                        "date": date_text,
                        "journal": journal,
                        "source": "PubMed",
                        "sourceApi": "PubMed",
                        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else (f"https://doi.org/{doi}" if doi else ""),
                        "doi": doi,
                        "keywords": extract_keywords(title + " " + abstract),
                        "readTime": estimate_read_time(title + " " + abstract),
                        "qualityScore": 84,
                        "verified": True,
                    }
                )
            )
    return [item for item in items if item]


def fetch_rss(per_source: int = 14) -> List[Dict[str, Any]]:
    log("Fetching curated RSS news...")
    items: List[Dict[str, Any]] = []
    for source in RSS_SOURCES:
        raw = http_get(source["url"])
        if not raw:
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError as exc:
            log(f"  ! RSS parse failed for {source['name']} ({exc})")
            continue
        for item in root.findall(".//item")[:per_source]:
            title = clean_text(item.findtext("title"))
            link = clean_text(item.findtext("link"))
            desc = clean_text(item.findtext("description"), 900)
            pub_date = clean_text(item.findtext("pubDate") or item.findtext("date"))
            items.append(
                normalize(
                    {
                        "id": stable_id("rss", source["name"], link, title),
                        "discipline": source["discipline"],
                        "type": "news",
                        "title": title,
                        "authors": source["name"],
                        "abstract": desc or f"来自 {source['name']} 的最新资讯，点击原文查看完整报道。",
                        "date": pub_date or now_utc().isoformat(),
                        "journal": source["name"],
                        "source": source["name"],
                        "sourceApi": "RSS",
                        "url": link,
                        "keywords": extract_keywords(title + " " + desc),
                        "readTime": estimate_read_time(title + " " + desc),
                        "qualityScore": 78,
                        "verified": True,
                    }
                )
            )
    return [item for item in items if item]


def deduplicate(items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    unique = []
    for item in items:
        key = (item.get("doi") or item.get("url") or item.get("title") or "").lower().rstrip("/")
        if key and key not in seen:
            seen.add(key)
            unique.append(item)
    unique.sort(key=lambda p: (p.get("date", ""), p.get("qualityScore", 0)), reverse=True)
    return unique


def write_payload(items: List[Dict[str, Any]], limit: int) -> None:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    selected = items[:limit]
    sources = list(
        dict.fromkeys(
            clean_text(item.get("sourceApi") or item.get("source"))
            for item in selected
            if clean_text(item.get("sourceApi") or item.get("source"))
        )
    )
    payload = {
        "generatedAt": now_utc().isoformat(),
        "total": len(selected),
        "sources": sources,
        "papers": selected,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_JS.write_text(
        "window.LIVE_FEED_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    log(f"Wrote {payload['total']} live items to {OUT_JSON} and {OUT_JS}")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Build Academic Hub live feed")
    parser.add_argument("--limit", type=int, default=180, help="Maximum items to write")
    parser.add_argument("--skip-openalex", action="store_true")
    parser.add_argument("--skip-arxiv", action="store_true")
    parser.add_argument("--skip-pubmed", action="store_true")
    parser.add_argument("--skip-rss", action="store_true")
    args = parser.parse_args(argv)

    all_items: List[Dict[str, Any]] = []
    if not args.skip_openalex:
        all_items.extend(fetch_openalex())
    if not args.skip_arxiv:
        all_items.extend(fetch_arxiv())
    if not args.skip_pubmed:
        all_items.extend(fetch_pubmed())
    if not args.skip_rss:
        all_items.extend(fetch_rss())

    items = deduplicate(item for item in all_items if item)
    if not items:
        log("No live items were fetched; keeping the current feed files unchanged.")
        return 1
    write_payload(items, args.limit)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
