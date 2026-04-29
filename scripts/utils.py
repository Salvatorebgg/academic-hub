"""
Academic Hub - 工具模块
HTTP请求、JSON读写、日期解析、学科自动分类、阅读时间估算
"""

import json
import os
import re
import time
from datetime import datetime, timedelta
from urllib.parse import quote
import requests


def http_get(url, timeout=15, retries=2):
    """带重试的 HTTP GET 请求"""
    headers = {
        'User-Agent': 'AcademicHub/1.0 (Research Data Aggregator)'
    }
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=timeout)
            resp.raise_for_status()
            return resp
        except Exception as e:
            if attempt < retries:
                time.sleep(2 ** attempt)
                continue
            print(f'HTTP GET failed for {url}: {e}')
            return None


def read_json(path):
    """读取 JSON 文件"""
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f'Read JSON failed: {e}')
        return {}


def write_json(path, data):
    """写入 JSON 文件（自动创建目录）"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def append_jsonl(path, records):
    """追加写入 JSONL 文件"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'a', encoding='utf-8') as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')


def parse_date(date_str):
    """解析多种日期格式，返回 datetime 对象"""
    if not date_str:
        return datetime.now()
    formats = [
        '%Y-%m-%d',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%dT%H:%M:%SZ',
        '%d %b %Y',
        '%B %d, %Y',
        '%Y/%m/%d',
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    # 尝试从字符串中提取日期
    m = re.search(r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})', date_str)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return datetime.now()


def auto_discipline(text):
    """根据文本内容自动判断学科"""
    text_lower = (text or '').lower()
    scores = {
        'bio': 0,
        'clinical': 0,
        'cs': 0,
        'geo': 0,
    }
    bio_terms = ['protein', 'gene', 'genome', 'dna', 'rna', 'cell', 'biolog', 'molecular', 'genetic', 'crispr', 'alphafold', 'enzyme', 'microbiome', 'sequencing', 'bioinform']
    clinical_terms = ['clinical', 'trial', 'patient', 'disease', 'therapy', 'treatment', 'hospital', 'medicine', 'surgery', 'diagnosis', 'drug', 'vaccine', 'cancer', 'alzheimer', 'diabetes', 'fda', 'who']
    cs_terms = ['artificial intelligence', 'machine learning', 'deep learning', 'neural', 'llm', 'language model', 'algorithm', 'computer vision', 'nlp', 'robotics', 'gpt', 'transformer', 'reinforcement']
    geo_terms = ['climate', 'global warming', 'carbon', 'emission', 'temperature', 'ice sheet', 'glacier', 'sea level', 'weather', 'atmosphere', 'ocean', 'geology', 'earthquake', 'copernicus', 'ipcc']
    
    for term in bio_terms:
        scores['bio'] += text_lower.count(term)
    for term in clinical_terms:
        scores['clinical'] += text_lower.count(term)
    for term in cs_terms:
        scores['cs'] += text_lower.count(term)
    for term in geo_terms:
        scores['geo'] += text_lower.count(term)
    
    if max(scores.values()) == 0:
        return 'cs'  # 默认计算机科学
    return max(scores, key=scores.get)


def estimate_read_time(text):
    """估算阅读时间（中文字符 + 英文单词）"""
    if not text:
        return '3 min'
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    english_words = len(re.findall(r'[a-zA-Z]+', text))
    total_words = chinese_chars + english_words
    minutes = max(1, round(total_words / 200))
    if minutes < 60:
        return f'{minutes} min'
    else:
        return f'{minutes // 60}h {minutes % 60}m'


def generate_id(prefix='paper'):
    """生成唯一 ID"""
    ts = datetime.now().strftime('%Y%m%d%H%M%S')
    rand = os.urandom(4).hex()[:6]
    return f'{prefix}-{ts}-{rand}'


def sanitize_filename(name, max_len=80):
    """清理文件名"""
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    name = re.sub(r'\s+', '_', name)
    return name[:max_len].strip('_')


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
