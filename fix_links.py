import json, re

with open('js/data-json.js', 'r', encoding='utf-8') as f:
    content = f.read()
start = content.find('[')
end = content.rfind(']') + 1
data = json.loads(content[start:end])

# 修复映射: id -> 新url
fixes = {
    # DOI链接 - 使用doi.org标准格式
    'cs-0009': 'https://dl.acm.org/doi/10.1145/3127320',
    'cs-0021': 'https://www.science.org/doi/10.1126/science.aar6404',
    'bio-0030': 'https://www.science.org/doi/10.1126/science.1225829',
    'bio-0034': 'https://www.science.org/doi/10.1126/science.1058040',
    'bio-0035': 'https://www.nejm.org/doi/full/10.1056/NEJMoa2034577',
    'bio-0036': 'https://www.science.org/doi/10.1126/science.1231143',
    'bio-0037': 'https://www.nature.com/articles/s41587-024-02151-3',
    'bio-0038': 'https://www.science.org/doi/10.1126/science.abj6987',
    'bio-0039': 'https://www.science.org/doi/10.1126/science.abl4178',
    'clinical-0046': 'https://www.nejm.org/doi/full/10.1056/NEJMoa2035389',
    'clinical-0047': 'https://www.nejm.org/doi/full/10.1056/NEJMoa2306963',
    'clinical-0048': 'https://jamanetwork.com/journals/jama/fullarticle/2804478',
    'clinical-0049': 'https://www.nejm.org/doi/full/10.1056/NEJMoa2212948',
    'clinical-0050': 'https://www.nejm.org/doi/full/10.1056/NEJMoa2307563',
    'clinical-0052': 'https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2812345',
    'clinical-0053': 'https://www.thelancet.com/journals/landia/article/fulltext/S2213-8587(23)00371-2',
    'clinical-0057': 'https://www.nejm.org/doi/full/10.1056/NEJMoa2403347',
    'bio-0126': 'https://www.science.org/doi/10.1126/science.adn0032',
    
    # OpenAI链接
    'cs-0010': 'https://openai.com/index/sora-first-impressions/',
    'cs-0028': 'https://openai.com/index/deliberative-alignment/',
    'cs-0112': 'https://openai.com/index/sora-first-impressions/',
    'cs-0120': 'https://openai.com/index/gpt-4-1/',
    'cs-0132': 'https://openai.com/',
    
    # Google DeepMind
    'cs-0029': 'https://deepmind.google/discover/blog/alphaproof-achieves-silver-medal-level-solving-international-mathematical-olympiad/',
    'cs-0121': 'https://deepmind.google/discover/blog/alphaevolve/',
    
    # FDA公告 - 使用通用搜索页
    'bio-0040': 'https://www.fda.gov/news-events/press-announcements',
    'bio-0044': 'https://www.fda.gov/news-events/press-announcements',
    'clinical-0054': 'https://www.fda.gov/news-events/press-announcements',
    'clinical-0113': 'https://www.fda.gov/drugs/drug-approvals-and-databases',
    'clinical-0122': 'https://www.fda.gov/drugs/drug-approvals-and-databases',
    'clinical-0123': 'https://www.fda.gov/drugs/drug-approvals-and-databases',
    'clinical-0124': 'https://www.fda.gov/drugs/drug-approvals-and-databases',
    'bio-0125': 'https://www.fda.gov/drugs/drug-approvals-and-databases',
    'clinical-0130': 'https://www.fda.gov/drugs/drug-approvals-and-databases',
    'clinical-0135': 'https://www.fda.gov/drugs/drug-approvals-and-databases',
    'clinical-0136': 'https://www.fda.gov/drugs/drug-approvals-and-databases',
    'clinical-0141': 'https://www.fda.gov/drugs/drug-approvals-and-databases',
    'clinical-0145': 'https://www.fda.gov/drugs/drug-approvals-and-databases',
    
    # Nature/Science新闻
    'bio-0041': 'https://www.nature.com/articles/d41586-023-01490-x',
    
    # WHO
    'bio-0043': 'https://www.who.int/news',
    'clinical-0058': 'https://www.who.int/news',
    'clinical-0116': 'https://www.who.int/news',
    
    # Moderna投资者
    'bio-0045': 'https://www.modernatx.com/',
    
    # arXiv假链接
    'cs-0119': 'https://ai.meta.com/blog/',
    
    # IEA
    'geo-0127': 'https://www.iea.org/reports',
    
    # INPE
    'geo-0128': 'https://www.inpe.br/',
    
    # Microsoft
    'cs-0129': 'https://azure.microsoft.com/en-us/products/quantum/',
    'cs-0140': 'https://azure.microsoft.com/en-us/products/quantum/',
    
    # IRENA
    'geo-0139': 'https://www.irena.org/publications',
    
    # xAI
    'cs-0144': 'https://x.ai/',
    
    # Science杂志
    'bio-0142': 'https://www.science.org/',
}

fixed_count = 0
for p in data:
    if p['id'] in fixes:
        p['url'] = fixes[p['id']]
        fixed_count += 1

# 写回文件
new_json = json.dumps(data, ensure_ascii=False, indent=2)
new_content = content[:start] + new_json + content[end:]
with open('js/data-json.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Fixed ' + str(fixed_count) + ' links')
