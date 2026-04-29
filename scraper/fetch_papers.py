#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Academic Hub - 学术数据抓取脚本
支持从多个学术源抓取前沿论文和资讯

数据源：
- PubMed (生物/医学)
- arXiv (计算机/物理/数学)
- bioRxiv (生物学预印本)
- Nature News
- Science Daily

用法：
    python fetch_papers.py
    python fetch_papers.py --discipline bio
    python fetch_papers.py --days 7
    python fetch_papers.py --output ../data/papers.json
    python fetch_papers.py --mock    # 生成模拟数据
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import feedparser
import requests
from bs4 import BeautifulSoup


class PaperFetcher:
    """学术数据抓取器"""

    def __init__(self, output_path: str = "../data/papers.json"):
        self.output_path = os.path.join(os.path.dirname(__file__), output_path)
        self.data_dir = os.path.dirname(self.output_path)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.papers: List[Dict] = []

    def ensure_data_dir(self):
        """确保数据目录存在"""
        os.makedirs(self.data_dir, exist_ok=True)

    def load_existing(self) -> List[Dict]:
        """加载已有数据"""
        if os.path.exists(self.output_path):
            try:
                with open(self.output_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get('papers', [])
            except Exception as e:
                print(f"⚠️ 读取已有数据失败: {e}")
        return []

    def save(self):
        """保存数据到 JSON"""
        self.ensure_data_dir()
        data = {
            'lastUpdated': datetime.now().isoformat(),
            'total': len(self.papers),
            'papers': self.papers
        }
        with open(self.output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ 已保存 {len(self.papers)} 篇论文到 {self.output_path}")

    def generate_id(self, title: str, discipline: str) -> str:
        """生成唯一ID"""
        clean = re.sub(r'[^\w]', '', title)[:20].lower()
        timestamp = datetime.now().strftime('%m%d')
        return f"{discipline}-{clean}-{timestamp}"

    def deduplicate(self):
        """去重"""
        seen = set()
        unique = []
        for p in self.papers:
            key = p.get('doi') or p.get('title', '')
            if key and key not in seen:
                seen.add(key)
                unique.append(p)
        self.papers = unique
        print(f"🔄 去重后: {len(unique)} 篇")

    # ==================== PubMed ====================
    def fetch_pubmed(self, query: str = "", days: int = 7, max_results: int = 20) -> List[Dict]:
        """从 PubMed 抓取生物/医学论文"""
        print(f"🔬 正在抓取 PubMed: {query or 'recent'}")
        papers = []
        base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"

        search_query = query if query else "(bioinformatics[Title/Abstract] OR genomics[Title/Abstract])"

        try:
            search_params = {
                'db': 'pubmed',
                'term': search_query,
                'retmax': max_results,
                'retmode': 'json',
                'sort': 'date'
            }
            search_resp = self.session.get(f"{base_url}esearch.fcgi", params=search_params, timeout=30)
            search_data = search_resp.json()
            id_list = search_data.get('esearchresult', {}).get('idlist', [])

            if not id_list:
                print("⚠️ PubMed 未找到结果")
                return papers

            fetch_params = {
                'db': 'pubmed',
                'id': ','.join(id_list),
                'retmode': 'xml'
            }
            fetch_resp = self.session.get(f"{base_url}efetch.fcgi", params=fetch_params, timeout=30)
            soup = BeautifulSoup(fetch_resp.content, 'xml')

            for article in soup.find_all('PubmedArticle'):
                try:
                    title_tag = article.find('ArticleTitle')
                    title = title_tag.text if title_tag else 'Unknown Title'

                    authors = []
                    for author in article.find_all('Author'):
                        last = author.find('LastName')
                        first = author.find('ForeName')
                        if last:
                            name = f"{last.text} {first.text[:1]}." if first else last.text
                            authors.append(name)

                    abstract_tag = article.find('AbstractText')
                    abstract = abstract_tag.text if abstract_tag else ''

                    journal_tag = article.find('Title')
                    journal = journal_tag.text if journal_tag else ''

                    date_tag = article.find('PubDate')
                    date_str = ''
                    if date_tag:
                        year = date_tag.find('Year')
                        month = date_tag.find('Month')
                        day = date_tag.find('Day')
                        date_str = f"{year.text}-{month.text.zfill(2) if month else '01'}-{day.text.zfill(2) if day else '01'}"

                    doi_tag = article.find('ArticleId', IdType='doi')
                    doi = doi_tag.text if doi_tag else ''

                    pmid_tag = article.find('PMID')
                    pmid = pmid_tag.text if pmid_tag else ''

                    paper = {
                        'id': self.generate_id(title, 'bio'),
                        'title': title,
                        'authors': ', '.join(authors[:5]) + (' et al.' if len(authors) > 5 else ''),
                        'abstract': abstract[:300] + '...' if len(abstract) > 300 else abstract,
                        'discipline': 'bio',
                        'journal': journal,
                        'date': date_str or datetime.now().strftime('%Y-%m-%d'),
                        'year': int(date_str[:4]) if date_str else datetime.now().year,
                        'doi': doi,
                        'url': f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else '',
                        'keywords': [],
                        'readTime': f"{max(5, len(abstract) // 200)} min",
                        'source': 'PubMed'
                    }
                    papers.append(paper)

                except Exception as e:
                    print(f"⚠️ 解析 PubMed 文章出错: {e}")
                    continue

            print(f"✅ PubMed: 获取 {len(papers)} 篇")

        except Exception as e:
            print(f"❌ PubMed 抓取失败: {e}")

        return papers

    # ==================== arXiv ====================
    def fetch_arxiv(self, category: str = "cs", days: int = 7, max_results: int = 20) -> List[Dict]:
        """从 arXiv 抓取论文"""
        print(f"💻 正在抓取 arXiv: {category}")
        papers = []

        categories = {
            'cs': 'cs.AI OR cs.CL OR cs.CV OR cs.LG OR cs.SE',
            'physics': 'physics.data-an OR physics.comp-ph',
            'math': 'math.ST OR math.NA',
            'q-bio': 'q-bio.BM OR q-bio.GN OR q-bio.MN'
        }

        cat_query = categories.get(category, category)

        try:
            query = f"cat:({cat_query})"
            url = f"http://export.arxiv.org/api/query?search_query={query}&sortBy=submittedDate&sortOrder=descending&max_results={max_results}"

            feed = feedparser.parse(url)

            for entry in feed.entries:
                try:
                    title = entry.get('title', '').replace('\n', ' ')
                    authors = ', '.join([a.get('name', '') for a in entry.get('authors', [])[:5]])
                    if len(entry.get('authors', [])) > 5:
                        authors += ' et al.'

                    abstract = entry.get('summary', '')
                    abstract = abstract[:300] + '...' if len(abstract) > 300 else abstract

                    published = entry.get('published', '')
                    date_str = published[:10] if published else datetime.now().strftime('%Y-%m-%d')

                    tags = [t.get('term', '') for t in entry.get('tags', [])]
                    discipline = 'cs'
                    if any('q-bio' in t for t in tags):
                        discipline = 'bio'
                    elif any('physics' in t for t in tags):
                        discipline = 'geo'

                    paper = {
                        'id': self.generate_id(title, discipline),
                        'title': title,
                        'authors': authors,
                        'abstract': abstract,
                        'discipline': discipline,
                        'journal': 'arXiv',
                        'date': date_str,
                        'year': int(date_str[:4]) if date_str else datetime.now().year,
                        'doi': '',
                        'url': entry.get('link', ''),
                        'keywords': tags[:5],
                        'readTime': f"{max(5, len(abstract) // 200)} min",
                        'source': 'arXiv'
                    }
                    papers.append(paper)

                except Exception as e:
                    print(f"⚠️ 解析 arXiv 文章出错: {e}")
                    continue

            print(f"✅ arXiv: 获取 {len(papers)} 篇")

        except Exception as e:
            print(f"❌ arXiv 抓取失败: {e}")

        return papers

    # ==================== bioRxiv ====================
    def fetch_biorxiv(self, days: int = 7, max_results: int = 20) -> List[Dict]:
        """从 bioRxiv 抓取生物学预印本"""
        print("🧬 正在抓取 bioRxiv")
        papers = []

        try:
            url = f"https://api.biorxiv.org/covid19/{max_results}"
            resp = self.session.get(url, timeout=30)
            data = resp.json()

            for item in data.get('collection', [])[:max_results]:
                try:
                    paper = {
                        'id': self.generate_id(item.get('title', ''), 'bio'),
                        'title': item.get('title', ''),
                        'authors': item.get('authors', ''),
                        'abstract': item.get('abstract', '')[:300] + '...' if len(item.get('abstract', '')) > 300 else item.get('abstract', ''),
                        'discipline': 'bio',
                        'journal': 'bioRxiv',
                        'date': item.get('date', datetime.now().strftime('%Y-%m-%d')),
                        'year': int(item.get('date', datetime.now().strftime('%Y-%m-%d'))[:4]),
                        'doi': item.get('doi', ''),
                        'url': item.get('url', ''),
                        'keywords': [],
                        'readTime': '10 min',
                        'source': 'bioRxiv'
                    }
                    papers.append(paper)

                except Exception as e:
                    print(f"⚠️ 解析 bioRxiv 文章出错: {e}")
                    continue

            print(f"✅ bioRxiv: 获取 {len(papers)} 篇")

        except Exception as e:
            print(f"❌ bioRxiv 抓取失败: {e}")

        return papers

    # ==================== Nature News ====================
    def fetch_nature_news(self, max_results: int = 10) -> List[Dict]:
        """从 Nature 抓取新闻"""
        print("📰 正在抓取 Nature News")
        papers = []

        try:
            url = "https://www.nature.com/nature.rss"
            feed = feedparser.parse(url)

            for entry in feed.entries[:max_results]:
                try:
                    paper = {
                        'id': self.generate_id(entry.get('title', ''), 'bio'),
                        'title': entry.get('title', ''),
                        'authors': entry.get('author', 'Nature News'),
                        'abstract': entry.get('summary', '')[:300] + '...' if len(entry.get('summary', '')) > 300 else entry.get('summary', ''),
                        'discipline': 'bio',
                        'journal': 'Nature',
                        'date': entry.get('published', datetime.now().strftime('%Y-%m-%d'))[:10],
                        'year': datetime.now().year,
                        'doi': '',
                        'url': entry.get('link', ''),
                        'keywords': [],
                        'readTime': '5 min',
                        'source': 'Nature News'
                    }
                    papers.append(paper)

                except Exception as e:
                    print(f"⚠️ 解析 Nature 文章出错: {e}")
                    continue

            print(f"✅ Nature News: 获取 {len(papers)} 篇")

        except Exception as e:
            print(f"❌ Nature News 抓取失败: {e}")

        return papers

    # ==================== 模拟数据 ====================
    def get_mock_data(self) -> List[Dict]:
        """生成模拟数据"""
        return [
            {
                'id': 'bio-001',
                'title': 'Single-cell RNA sequencing reveals novel cell populations in human brain tissue',
                'authors': 'Zhang L, Wang X, Chen Y, et al.',
                'abstract': 'We present a comprehensive single-cell atlas of the human brain using advanced sequencing techniques...',
                'discipline': 'bio',
                'journal': 'Nature Biotechnology',
                'date': '2026-04-25',
                'year': 2026,
                'doi': '10.1038/s41587-026-001',
                'url': 'https://doi.org/10.1038/s41587-026-001',
                'keywords': ['single-cell', 'RNA-seq', 'brain'],
                'readTime': '15 min',
                'source': 'Mock'
            },
            {
                'id': 'clinical-001',
                'title': 'Machine learning models for early prediction of sepsis in ICU patients',
                'authors': 'Anderson P, Kim S, Patel R, et al.',
                'abstract': 'We developed and validated a machine learning algorithm that predicts sepsis onset 6 hours before clinical manifestation...',
                'discipline': 'clinical',
                'journal': 'JAMA Internal Medicine',
                'date': '2026-04-22',
                'year': 2026,
                'doi': '10.1001/jamainternmed.2026.123',
                'url': 'https://doi.org/10.1001/jamainternmed.2026.123',
                'keywords': ['machine learning', 'sepsis', 'ICU'],
                'readTime': '10 min',
                'source': 'Mock'
            },
            {
                'id': 'cs-001',
                'title': 'Large language models demonstrate emergent reasoning capabilities in scientific domains',
                'authors': 'Chen X, Rodriguez A, Park J, et al.',
                'abstract': 'Our study evaluates the reasoning capabilities of large language models across multiple scientific disciplines...',
                'discipline': 'cs',
                'journal': 'Science',
                'date': '2026-04-24',
                'year': 2026,
                'doi': '10.1126/science.abc1234',
                'url': 'https://doi.org/10.1126/science.abc1234',
                'keywords': ['LLM', 'AI', 'reasoning'],
                'readTime': '14 min',
                'source': 'Mock'
            },
            {
                'id': 'geo-001',
                'title': 'Climate change accelerates Arctic permafrost thaw: new satellite observations',
                'authors': 'Petrov S, Anderson K, Li M, et al.',
                'abstract': 'Satellite data from the past decade reveals accelerating permafrost thaw rates in the Arctic region...',
                'discipline': 'geo',
                'journal': 'Nature Climate Change',
                'date': '2026-04-21',
                'year': 2026,
                'doi': '10.1038/s41558-026-003',
                'url': 'https://doi.org/10.1038/s41558-026-003',
                'keywords': ['climate change', 'permafrost', 'Arctic'],
                'readTime': '11 min',
                'source': 'Mock'
            }
        ]

    # ==================== 主流程 ====================
    def run(self, discipline: Optional[str] = None, days: int = 7, use_mock: bool = False):
        """执行抓取流程"""
        print("=" * 50)
        print("🎓 Academic Hub - 学术数据抓取")
        print(f"📅 时间范围: 最近 {days} 天")
        print(f"🎯 学科筛选: {discipline or '全部'}")
        print("=" * 50)

        if use_mock:
            print("📝 使用模拟数据模式")
            self.papers = self.get_mock_data()
            self.save()
            return len(self.papers)

        # 加载已有数据
        existing = self.load_existing()
        print(f"📚 已有数据: {len(existing)} 篇")

        new_papers = []

        # 根据学科抓取
        if discipline in (None, 'bio', 'clinical'):
            new_papers.extend(self.fetch_pubmed(days=days, max_results=15))
            new_papers.extend(self.fetch_biorxiv(days=days, max_results=10))
            new_papers.extend(self.fetch_nature_news(max_results=5))

        if discipline in (None, 'cs'):
            new_papers.extend(self.fetch_arxiv(category='cs', days=days, max_results=15))

        if discipline in (None, 'geo'):
            new_papers.extend(self.fetch_arxiv(category='physics', days=days, max_results=10))

        # 合并数据
        self.papers = existing + new_papers

        # 去重
        self.deduplicate()

        # 保存
        self.save()

        print("=" * 50)
        print(f"✅ 抓取完成！共 {len(self.papers)} 篇论文")
        print("=" * 50)

        return len(new_papers)


def main():
    parser = argparse.ArgumentParser(description='Academic Hub - 学术数据抓取脚本')
    parser.add_argument('--discipline', '-d', choices=['bio', 'clinical', 'cs', 'geo'],
                        help='指定学科 (bio/clinical/cs/geo)')
    parser.add_argument('--days', '-n', type=int, default=7,
                        help='抓取最近 N 天的数据 (默认: 7)')
    parser.add_argument('--output', '-o', default='../data/papers.json',
                        help='输出文件路径')
    parser.add_argument('--mock', action='store_true',
                        help='使用模拟数据（无需网络）')

    args = parser.parse_args()

    fetcher = PaperFetcher(args.output)
    fetcher.run(discipline=args.discipline, days=args.days, use_mock=args.mock)


if __name__ == '__main__':
    main()
