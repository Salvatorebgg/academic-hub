"""
Academic Hub - 数据去重工具
手动执行去重、链接验证、数据质量检查
"""

import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.utils import read_json, write_json


def deduplicate_papers(papers, key_fields=None):
    """按指定字段去重"""
    if key_fields is None:
        key_fields = ['title', 'url']
    seen = set()
    unique = []
    for p in papers:
        key = tuple(str(p.get(f, '')).strip().lower() for f in key_fields)
        if key not in seen and all(k for k in key):
            seen.add(key)
            unique.append(p)
    return unique


def main():
    print('=' * 60)
    print(f'Academic Hub Deduplication - {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    print('=' * 60)

    data = read_json('data/papers.json')
    papers = data.get('papers', data if isinstance(data, list) else [])
    print(f'Before deduplication: {len(papers)} papers')

    unique = deduplicate_papers(papers)
    print(f'After deduplication: {len(unique)} papers')
    print(f'Removed: {len(papers) - len(unique)} duplicates')

    write_json('data/papers.json', {'papers': unique, 'lastUpdated': datetime.now().isoformat()})
    print('Saved to data/papers.json')
    print('=' * 60)


if __name__ == '__main__':
    main()
