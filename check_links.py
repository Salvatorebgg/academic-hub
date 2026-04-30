import json, re, urllib.request, urllib.error, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

with open('js/data-json.js', 'r', encoding='utf-8') as f:
    content = f.read()
start = content.find('[')
end = content.rfind(']') + 1
data = json.loads(content[start:end])

print('=== 链接可访问性检查 ===')
broken = []
for p in data:
    url = p.get('url', '')
    if not url or url.startswith('javascript'):
        continue
    try:
        req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=8, context=ctx)
        status = resp.getcode()
        if status >= 400:
            broken.append((p['id'], status, url, p['title']))
            print('  FAIL ' + p['id'] + ' | HTTP ' + str(status) + ' | ' + url[:60])
    except Exception as e:
        broken.append((p['id'], str(e)[:40], url, p['title']))
        print('  FAIL ' + p['id'] + ' | ' + str(e)[:40] + ' | ' + url[:60])

print('\n=== 检查结果 ===')
print('总检查: ' + str(len(data)) + ' 条')
print('失效链接: ' + str(len(broken)) + ' 条')
if broken:
    print('\n失效链接列表:')
    for b in broken:
        print('  ' + b[0] + ' | ' + str(b[1]) + ' | ' + b[3][:50])
