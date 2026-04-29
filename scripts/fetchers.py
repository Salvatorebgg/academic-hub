"""
Academic Hub - 数据抓取器
DAILY_RSS_SOURCES、arXiv/bioRxiv/PubMed 抓取器
"""

import xml.etree.ElementTree as ET
from scripts.utils import http_get, parse_date, auto_discipline, estimate_read_time, generate_id


DAILY_RSS_SOURCES = [
    {"name": "Nature News", "url": "https://www.nature.com/nature.rss", "discipline": "bio"},
    {"name": "Science Magazine", "url": "https://www.science.org/rss/news_current.xml", "discipline": "bio"},
    {"name": "Medical Xpress", "url": "https://medicalxpress.com/rss-feed/", "discipline": "clinical"},
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "discipline": "cs"},
    {"name": "arXiv CS.AI", "url": "https://rss.arxiv.org/rss/cs.AI", "discipline": "cs"},
    {"name": "arXiv CS.CV", "url": "https://rss.arxiv.org/rss/cs.CV", "discipline": "cs"},
    {"name": "arXiv q-bio", "url": "https://rss.arxiv.org/rss/q-bio", "discipline": "bio"},
    {"name": "Copernicus Climate", "url": "https://climate.copernicus.eu/rss.xml", "discipline": "geo"},
]


def fetch_rss(source, max_items=10):
    """抓取 RSS 源"""
    print(f'Fetching RSS: {source["name"]} ...')
    resp = http_get(source['url'])
    if not resp:
        return []
    
    try:
        root = ET.fromstring(resp.content)
    except Exception as e:
        print(f'Parse RSS failed for {source["name"]}: {e}')
        return []
    
    papers = []
    items = root.findall('.//item')
    
    for item in items[:max_items]:
        title = item.findtext('title', '')
        link = item.findtext('link', '')
        desc = item.findtext('description', '')
        pub_date = item.findtext('pubDate', '')
        
        if not title:
            continue
        
        date_obj = parse_date(pub_date)
        date_str = date_obj.strftime('%Y-%m-%d')
        
        paper = {
            'id': generate_id('rss'),
            'title': title.strip(),
            'authors': source['name'],
            'abstract': desc.strip()[:500],
            'discipline': source.get('discipline', auto_discipline(title + ' ' + desc)),
            'type': 'news',
            'journal': source['name'],
            'date': date_str,
            'year': date_obj.year,
            'url': link.strip(),
            'keywords': [],
            'readTime': estimate_read_time(desc),
            'source': source['name'],
        }
        papers.append(paper)
    
    print(f'  -> Got {len(papers)} items from {source["name"]}')
    return papers


def fetch_arxiv_api(search_query='cat:cs.AI+OR+cat:cs.CV+OR+cat:cs.LG', max_results=20):
    """通过 arXiv API 抓取论文"""
    print(f'Fetching arXiv API: {search_query} ...')
    url = f'http://export.arxiv.org/api/query?search_query={search_query}&sortBy=submittedDate&sortOrder=descending&max_results={max_results}'
    resp = http_get(url)
    if not resp:
        return []
    
    try:
        root = ET.fromstring(resp.content)
    except Exception as e:
        print(f'Parse arXiv failed: {e}')
        return []
    
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    papers = []
    
    for entry in root.findall('atom:entry', ns):
        title = entry.findtext('atom:title', '', ns).replace('\n', ' ').strip()
        summary = entry.findtext('atom:summary', '', ns).replace('\n', ' ').strip()
        published = entry.findtext('atom:published', '', ns)
        id_url = entry.findtext('atom:id', '', ns)
        
        authors_elems = entry.findall('atom:author', ns)
        authors = ', '.join(a.findtext('atom:name', '', ns) for a in authors_elems[:5])
        
        cat_elems = entry.findall('atom:category', ns)
        categories = [c.get('term', '') for c in cat_elems if c.get('term')]
        
        # Determine discipline from categories
        discipline = 'cs'
        if any('q-bio' in c or 'bio' in c for c in categories):
            discipline = 'bio'
        elif any('physics.ao' in c or 'physics.geo' in c for c in categories):
            discipline = 'geo'
        
        date_obj = parse_date(published)
        date_str = date_obj.strftime('%Y-%m-%d')
        
        # Build arXiv PDF URL
        arxiv_id = id_url.split('/abs/')[-1] if '/abs/' in id_url else ''
        pdf_url = f'https://arxiv.org/pdf/{arxiv_id}.pdf' if arxiv_id else ''
        
        paper = {
            'id': generate_id('arxiv'),
            'title': title,
            'authors': authors,
            'abstract': summary[:800],
            'discipline': discipline,
            'type': 'paper',
            'journal': 'arXiv',
            'date': date_str,
            'year': date_obj.year,
            'url': id_url,
            'pdfUrl': pdf_url,
            'keywords': categories[:5],
            'readTime': estimate_read_time(summary),
            'source': 'arXiv',
        }
        papers.append(paper)
    
    print(f'  -> Got {len(papers)} papers from arXiv')
    return papers


def fetch_pubmed(query='science[journal]+OR+nature[journal]', retmax=20):
    """通过 PubMed E-utilities 抓取论文"""
    print(f'Fetching PubMed: {query} ...')
    
    # Step 1: Search
    search_url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={query}&retmax={retmax}&retmode=json'
    resp = http_get(search_url)
    if not resp:
        return []
    
    try:
        data = resp.json()
        id_list = data.get('esearchresult', {}).get('idlist', [])
    except Exception as e:
        print(f'PubMed search failed: {e}')
        return []
    
    if not id_list:
        return []
    
    # Step 2: Fetch summaries
    ids = ','.join(id_list)
    summary_url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={ids}&retmode=json'
    resp = http_get(summary_url)
    if not resp:
        return []
    
    try:
        data = resp.json()
        results = data.get('result', {})
    except Exception as e:
        print(f'PubMed summary failed: {e}')
        return []
    
    papers = []
    for pmid in id_list:
        item = results.get(pmid, {})
        title = item.get('title', '')
        authors = ', '.join(a.get('name', '') for a in item.get('authors', [])[:5])
        source = item.get('source', '')
        pubdate = item.get('sortpubdate', '')
        
        if not title:
            continue
        
        date_obj = parse_date(pubdate)
        date_str = date_obj.strftime('%Y-%m-%d')
        
        paper = {
            'id': f'pubmed-{pmid}',
            'title': title,
            'authors': authors,
            'abstract': '',
            'discipline': 'clinical' if any(k in source.lower() for k in ['med', 'lancet', 'jama']) else 'bio',
            'type': 'paper',
            'journal': source,
            'date': date_str,
            'year': date_obj.year,
            'url': f'https://pubmed.ncbi.nlm.nih.gov/{pmid}/',
            'keywords': [],
            'readTime': estimate_read_time(title),
            'source': 'PubMed',
        }
        papers.append(paper)
    
    print(f'  -> Got {len(papers)} papers from PubMed')
    return papers
