#!/usr/bin/env python3
"""
Academic Hub - 每日抓取入口
执行时间：每天 10:00
数据源：arXiv API + RSS 聚合源
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scripts.fetchers import fetch_rss, fetch_arxiv_api, DAILY_RSS_SOURCES
from scripts.utils import read_json, write_json, deduplicate_papers
from datetime import datetime


def main():
    print('=' * 60)
    print(f'Academic Hub Daily Crawl - {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    print('=' * 60)
    
    all_papers = []
    
    # 1. 抓取 arXiv API
    arxiv_papers = fetch_arxiv_api(max_results=30)
    all_papers.extend(arxiv_papers)
    
    # 2. 抓取 RSS 源
    for source in DAILY_RSS_SOURCES:
        try:
            papers = fetch_rss(source, max_items=5)
            all_papers.extend(papers)
        except Exception as e:
            print(f'Error fetching {source["name"]}: {e}')
    
    print(f'\nTotal fetched: {len(all_papers)} items')
    
    # 3. 去重
    all_papers = deduplicate_papers(all_papers)
    print(f'After deduplication: {len(all_papers)} items')
    
    # 4. 加载已有数据并合并
    existing = read_json('data/papers.json')
    existing_papers = existing.get('papers', existing if isinstance(existing, list) else [])
    
    existing_ids = {p.get('id', '') for p in existing_papers}
    new_papers = [p for p in all_papers if p.get('id') not in existing_ids]
    
    print(f'New items: {len(new_papers)}')
    
    # 5. 合并并保存
    merged = new_papers + existing_papers
    merged.sort(key=lambda x: x.get('date', ''), reverse=True)
    
    write_json('data/papers.json', {'papers': merged, 'lastUpdated': datetime.now().isoformat()})
    
    # 6. 保存今日抓取日志
    log_entry = {
        'date': datetime.now().isoformat(),
        'fetched': len(all_papers),
        'new': len(new_papers),
        'total': len(merged),
    }
    
    logs = read_json('data/crawl-logs.json')
    if not isinstance(logs, list):
        logs = []
    logs.append(log_entry)
    write_json('data/crawl-logs.json', logs[-100:])  # 保留最近100条
    
    print(f'\nSaved {len(merged)} total papers to data/papers.json')
    print('=' * 60)


if __name__ == '__main__':
    main()
