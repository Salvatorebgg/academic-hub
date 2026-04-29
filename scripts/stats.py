"""
Academic Hub - 数据统计报告
生成数据质量报告和学科分布统计
"""

import json
import os
import sys
from collections import Counter
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.utils import read_json


def main():
    print('=' * 60)
    print(f'Academic Hub Data Report - {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    print('=' * 60)

    data = read_json('data/papers.json')
    papers = data.get('papers', data if isinstance(data, list) else [])

    print(f'\n📊 总体统计')
    print(f'  总论文数: {len(papers)}')
    print(f'  学术论文: {len([p for p in papers if p.get("type") == "paper"])}')
    print(f'  资讯新闻: {len([p for p in papers if p.get("type") == "news"])}')

    discipline_dist = Counter(p.get('discipline', 'unknown') for p in papers)
    print(f'\n🧬 学科分布')
    for disc, count in discipline_dist.most_common():
        names = {'bio': '生物信息学', 'clinical': '临床研究', 'cs': '计算机科学', 'geo': '气象地质'}
        print(f'  {names.get(disc, disc)}: {count}')

    # 年份分布
    year_dist = Counter()
    for p in papers:
        try:
            year = int(p.get('year', p.get('date', '2024')[:4]))
            year_dist[year] += 1
        except:
            pass
    print(f'\n📅 年份分布')
    for year, count in sorted(year_dist.items(), reverse=True)[:5]:
        print(f'  {year}: {count}')

    # 来源分布
    source_dist = Counter(p.get('source', 'unknown') for p in papers)
    print(f'\n📰 来源 TOP 10')
    for source, count in source_dist.most_common(10):
        print(f'  {source}: {count}')

    # 关键词 TOP 10
    keyword_dist = Counter()
    for p in papers:
        for k in p.get('keywords', []):
            keyword_dist[k] += 1
    print(f'\n🏷️ 关键词 TOP 10')
    for keyword, count in keyword_dist.most_common(10):
        print(f'  {keyword}: {count}')

    # 质量检查
    no_abstract = sum(1 for p in papers if not p.get('abstract'))
    no_url = sum(1 for p in papers if not p.get('url'))
    print(f'\n⚠️ 质量检查')
    print(f'  缺少摘要: {no_abstract}')
    print(f'  缺少链接: {no_url}')

    print('\n' + '=' * 60)


if __name__ == '__main__':
    main()
