#!/usr/bin/env python3
"""
Academic Hub - 每月抓取入口
执行时间：每月1日 08:00
数据源：专题数据库、会议网站、政策公告
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scripts.fetchers import fetch_rss
from scripts.utils import read_json, write_json, deduplicate_papers, generate_id, auto_discipline
from datetime import datetime


MONTHLY_SOURCES = [
    {"name": "IPCC News", "url": "https://www.ipcc.ch/news.rss", "discipline": "geo"},
    {"name": "WHO News", "url": "https://www.who.int/rss-feeds/news-english.xml", "discipline": "clinical"},
    {"name": "FDA News", "url": "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss.xml", "discipline": "clinical"},
]


def main():
    print('=' * 60)
    print(f'Academic Hub Monthly Crawl - {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    print('=' * 60)
    
    all_papers = []
    
    # 1. 政策/机构 RSS
    for source in MONTHLY_SOURCES:
        try:
            papers = fetch_rss(source, max_items=10)
            all_papers.extend(papers)
        except Exception as e:
            print(f'Error fetching {source["name"]}: {e}')
    
    # 2. 生成本月综述标记
    now = datetime.now()
    month_label = now.strftime('%Y年%m月')
    
    review_paper = {
        'id': generate_id('monthly-review'),
        'title': f'{month_label} 学术热点月度综述',
        'authors': 'Academic Hub Auto-Generated',
        'abstract': f'本月综述自动标记，涵盖 {now.strftime("%Y-%m")} 期间各学科重要论文与资讯聚合。',
        'discipline': 'cs',
        'type': 'news',
        'journal': 'Academic Hub',
        'date': now.strftime('%Y-%m-%d'),
        'year': now.year,
        'url': '',
        'keywords': ['月度综述', '热点聚合'],
        'readTime': '5 min',
        'source': 'Academic Hub',
    }
    all_papers.append(review_paper)
    
    print(f'\nTotal fetched: {len(all_papers)} items')
    
    # 3. 去重合并
    all_papers = deduplicate_papers(all_papers)
    
    existing = read_json('data/papers.json')
    existing_papers = existing.get('papers', existing if isinstance(existing, list) else [])
    existing_ids = {p.get('id', '') for p in existing_papers}
    new_papers = [p for p in all_papers if p.get('id') not in existing_ids]
    
    merged = new_papers + existing_papers
    merged.sort(key=lambda x: x.get('date', ''), reverse=True)
    
    write_json('data/papers.json', {'papers': merged, 'lastUpdated': datetime.now().isoformat()})
    
    # 4. 生成本月数据快照
    snapshot_path = f'data/snapshots/snapshot-{now.strftime("%Y%m")}.json'
    os.makedirs(os.path.dirname(snapshot_path), exist_ok=True)
    write_json(snapshot_path, {'papers': merged, 'generatedAt': datetime.now().isoformat()})
    
    print(f'New: {len(new_papers)}, Total: {len(merged)}')
    print(f'Monthly snapshot saved to {snapshot_path}')
    print('=' * 60)


if __name__ == '__main__':
    main()
