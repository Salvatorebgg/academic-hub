#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
链接验证脚本 - 批量检查所有URL是否可访问
"""

import json
import sys
import requests
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

# 读取数据文件
with open('../data/papers.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

papers = data['papers']

print(f"总共 {len(papers)} 个链接需要验证\n")
print("=" * 70)

def check_url(paper):
    url = paper.get('url', '')
    if not url or not url.startswith('http'):
        return {
            'id': paper['id'],
            'title': paper['title'][:60],
            'url': url,
            'status': 'NO_URL',
            'accessible': False
        }
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        resp = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        
        # 检查是否是404页面
        if resp.status_code == 404:
            return {
                'id': paper['id'],
                'title': paper['title'][:60],
                'url': url,
                'status': f'HTTP_{resp.status_code}',
                'accessible': False
            }
        
        # 检查页面内容是否包含"not found"等关键词
        content = resp.text.lower()
        not_found_indicators = [
            'page not found',
            '404',
            'not available',
            'no longer exist',
            'broken link',
            'doi not found',
            'article not found'
        ]
        
        # 对于Nature等网站，检查特定内容
        if 'nature.com' in url:
            if 'page not found' in content or 'sorry, the page' in content:
                return {
                    'id': paper['id'],
                    'title': paper['title'][:60],
                    'url': url,
                    'status': 'PAGE_NOT_FOUND',
                    'accessible': False
                }
        
        if resp.status_code >= 200 and resp.status_code < 400:
            return {
                'id': paper['id'],
                'title': paper['title'][:60],
                'url': url,
                'status': f'OK_{resp.status_code}',
                'accessible': True
            }
        else:
            return {
                'id': paper['id'],
                'title': paper['title'][:60],
                'url': url,
                'status': f'HTTP_{resp.status_code}',
                'accessible': False
            }
            
    except requests.exceptions.Timeout:
        return {
            'id': paper['id'],
            'title': paper['title'][:60],
            'url': url,
            'status': 'TIMEOUT',
            'accessible': False
        }
    except Exception as e:
        return {
            'id': paper['id'],
            'title': paper['title'][:60],
            'url': url,
            'status': f'ERROR: {str(e)[:30]}',
            'accessible': False
        }

# 并发验证
results = []
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = {executor.submit(check_url, paper): paper for paper in papers}
    for future in as_completed(futures):
        result = future.result()
        results.append(result)
        status_icon = "✅" if result['accessible'] else "❌"
        print(f"{status_icon} [{result['status']}] {result['title']}")

print("\n" + "=" * 70)

# 统计
accessible = [r for r in results if r['accessible']]
broken = [r for r in results if not r['accessible']]

print(f"\n📊 验证结果:")
print(f"   ✅ 可访问: {len(accessible)}/{len(results)}")
print(f"   ❌ 失效: {len(broken)}/{len(results)}")

if broken:
    print(f"\n❌ 失效链接列表:")
    for r in broken:
        print(f"   - {r['id']}: {r['title']}")
        print(f"     URL: {r['url']}")
        print(f"     状态: {r['status']}")
        print()
