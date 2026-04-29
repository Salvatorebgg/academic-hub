#!/usr/bin/env python3
"""
Academic Hub - 每周抓取入口
执行时间：每周一 09:00
数据源：PubMed + 期刊 RSS
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scripts.fetchers import fetch_pubmed, fetch_rss
from scripts.utils import read_json, write_json, deduplicate_papers
from datetime import datetime


WEEKLY_SOURCES = [
    {"name": "Nature", "url": "https://www.nature.com/nature.rss", "discipline": "bio"},
    {"name": "NEJM", "url": "https://www.nejm.org/rss.xml", "discipline": "clinical"},
    {"name": "JAMA", "url": "https://jamanetwork.com/rss.xml", "discipline": "clinical"},
    {"name": "Science", "url": "https://www.science.org/rss/news_current.xml", "discipline": "bio"},
]


def main():
    print('=' * 60)
    print(f'Academic Hub Weekly Crawl - {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    print('=' * 60)
    
    all_papers = []
    
    # 1. PubMed 抓取
    queries = [
        'science[journal]+OR+nature[journal]',
        'new+england+journal+of+medicine[journal]',
        'jama[journal]+OR+lancet[journal]',
    ]
    for q in queries:
        try:
            papers = fetch_pubmed(query=q, retmax=10)
            all_papers.extend(papers)
        except Exception as e:
            print(f'Error PubMed query {q}: {e}')
    
    # 2. 期刊 RSS
    for source in WEEKLY_SOURCES:
        try:
            papers = fetch_rss(source, max_items=8)
            all_papers.extend(papers)
        except Exception as e:
            print(f'Error fetching {source["name"]}: {e}')
    
    print(f'\nTotal fetched: {len(all_papers)} items')
    
    # 3. 去重
    all_papers = deduplicate_papers(all_papers)
    print(f'After deduplication: {len(all_papers)} items')
    
    # 4. 合并保存
    existing = read_json('data/papers.json')
    existing_papers = existing.get('papers', existing if isinstance(existing, list) else [])
    existing_ids = {p.get('id', '') for p in existing_papers}
    new_papers = [p for p in all_papers if p.get('id') not in existing_ids]
    
    merged = new_papers + existing_papers
    merged.sort(key=lambda x: x.get('date', ''), reverse=True)
    
    write_json('data/papers.json', {'papers': merged, 'lastUpdated': datetime.now().isoformat()})
    
    print(f'New: {len(new_papers)}, Total: {len(merged)}')
    print('=' * 60)


if __name__ == '__main__':
    main()
