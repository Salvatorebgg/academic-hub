"""
Academic Hub - 链接有效性检查
批量检查论文 URL 是否可访问
"""

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.utils import read_json, http_get


def check_url(paper):
    """检查单个 URL"""
    url = paper.get('url', '')
    if not url or not url.startswith('http'):
        return paper['id'], 'no_url', None
    try:
        resp = http_get(url, timeout=10, retries=1)
        if resp and resp.status_code < 400:
            return paper['id'], 'ok', resp.status_code
        elif resp:
            return paper['id'], 'error', resp.status_code
        else:
            return paper['id'], 'failed', None
    except Exception as e:
        return paper['id'], 'exception', str(e)


def main():
    print('=' * 60)
    print(f'Academic Hub Link Validation - {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    print('=' * 60)

    data = read_json('data/papers.json')
    papers = data.get('papers', data if isinstance(data, list) else [])

    # 抽样检查（最多检查 50 条）
    sample = papers[:50]
    print(f'Checking {len(sample)} URLs...\n')

    ok_count = 0
    error_count = 0

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(check_url, p): p for p in sample}
        for future in as_completed(futures):
            pid, status, code = future.result()
            if status == 'ok':
                ok_count += 1
                print(f'  ✅ {pid} - {code}')
            elif status == 'no_url':
                error_count += 1
                print(f'  ⚠️  {pid} - No URL')
            else:
                error_count += 1
                print(f'  ❌ {pid} - {status} ({code})')

    print(f'\nResults: {ok_count} OK, {error_count} issues out of {len(sample)}')
    print('=' * 60)


if __name__ == '__main__':
    main()
