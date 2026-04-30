import json

with open('js/data-json.js', 'r', encoding='utf-8') as f:
    content = f.read()
start = content.find('[')
end = content.rfind(']') + 1
data = json.loads(content[start:end])

# 要删除的ID列表
remove_ids = {
    # 虚构arXiv
    'cs-0119',
    # 通用FDA页面无具体内容
    'bio-0040', 'bio-0044', 'clinical-0054', 'clinical-0104',
    'clinical-0113', 'clinical-0122', 'clinical-0123', 'clinical-0124',
    'bio-0125', 'clinical-0130', 'clinical-0135', 'clinical-0136',
    'clinical-0141', 'clinical-0145',
    # 公司首页无具体内容
    'cs-0114', 'geo-0118', 'geo-0128',
    # 2026年无法验证的AI发布
    'cs-0131', 'cs-0132', 'cs-0133', 'cs-0134', 'cs-0144',
    # 2026年无法验证的生物
    'bio-0142',
    # 2026年无法验证的气候
    'geo-0139',
    # Moderna投资者页面
    'bio-0045',
}

# 过滤
new_data = [p for p in data if p['id'] not in remove_ids]

print('Before: ' + str(len(data)) + ' items')
print('After: ' + str(len(new_data)) + ' items')
print('Removed: ' + str(len(data) - len(new_data)) + ' items')

# 写回
new_json = json.dumps(new_data, ensure_ascii=False, indent=2)
new_content = content[:start] + new_json + content[end:]
with open('js/data-json.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Done!')
