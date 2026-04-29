# Academic Hub - 全年资料抓取战略规划

> **基准日期：2026年4月29日（周三）**  
> **规划版本：v2.0 全面增强版**  
> **核心原则：四层频率 × 四大学科 × 关键节点 × 自动化闭环**

---

## 一、四层频率抓取体系

| 层级 | 执行时间 | 触发脚本 | 数据源数量 | 核心目标 |
|------|----------|----------|-----------|----------|
| **每日** | 每天 14:00 | `crawl_daily.py` | 12+ 源 | 当日最新论文、热点资讯、政策公告 |
| **每周** | 每周一、四 09:00 | `crawl_weekly.py` | 8+ 源 | 周度综述、期刊更新、预印本回顾 |
| **每月** | 每月 1日、15日 08:00 | `crawl_monthly.py` | 10+ 源 | 月度专题、会议跟踪、基金资助公告 |
| **季度/年度** | 每季度首月1日 + 关键事件日 | `crawl_quarterly.py` | 6+ 源 | 学术会议、诺贝尔奖、COP气候大会 |

### 1.1 每日层（Daily）—— 12个数据源

```python
DAILY_SOURCES = [
    # === 学术论文预印本 ===
    {"name": "arXiv CS.AI", "url": "https://rss.arxiv.org/rss/cs.AI", "type": "rss", "discipline": "cs"},
    {"name": "arXiv CS.CV", "url": "https://rss.arxiv.org/rss/cs.CV", "type": "rss", "discipline": "cs"},
    {"name": "arXiv CS.LG", "url": "https://rss.arxiv.org/rss/cs.LG", "type": "rss", "discipline": "cs"},
    {"name": "arXiv q-bio", "url": "https://rss.arxiv.org/rss/q-bio", "type": "rss", "discipline": "bio"},
    {"name": "bioRxiv", "url": "https://www.biorxiv.org/rss/recent.xml", "type": "rss", "discipline": "bio"},
    
    # === 顶级期刊新闻 ===
    {"name": "Nature News", "url": "https://www.nature.com/nature.rss", "type": "rss", "discipline": "bio"},
    {"name": "Science Magazine", "url": "https://www.science.org/rss/news_current.xml", "type": "rss", "discipline": "bio"},
    
    # === 临床/医学资讯 ===
    {"name": "Medical Xpress", "url": "https://medicalxpress.com/rss-feed/", "type": "rss", "discipline": "clinical"},
    {"name": "WHO News", "url": "https://www.who.int/rss-feeds/news-english.xml", "type": "rss", "discipline": "clinical"},
    {"name": "FDA Press", "url": "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss.xml", "type": "rss", "discipline": "clinical"},
    
    # === 计算机/AI 资讯 ===
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "type": "rss", "discipline": "cs"},
    {"name": "MIT Tech Review", "url": "https://www.technologyreview.com/feed/", "type": "rss", "discipline": "cs"},
    
    # === 气象地质 ===
    {"name": "Copernicus Climate", "url": "https://climate.copernicus.eu/rss.xml", "type": "rss", "discipline": "geo"},
    {"name": "NASA Earth", "url": "https://earthobservatory.nasa.gov/feeds/imageoftheday.rss", "type": "rss", "discipline": "geo"},
]
```

**每日执行逻辑：**
1. 拉取全部 RSS 源，取最近 5 条/源
2. arXiv API 批量查询 cs.AI + cs.CV + cs.LG + q-bio，取最近 30 条
3. 自动学科分类、去重、写入 `data/papers.json`
4. 触发关键词云更新

### 1.2 每周层（Weekly）—— 周一 + 周四双波次

```python
WEEKLY_SOURCES = [
    # === 周一波：综述与期刊 ===
    {"name": "PubMed", "api": "E-utilities", "query": "science[journal]+OR+nature[journal]+OR+cell[journal]", "day": "monday"},
    {"name": "NEJM", "url": "https://www.nejm.org/rss.xml", "day": "monday"},
    {"name": "JAMA", "url": "https://jamanetwork.com/rss.xml", "day": "monday"},
    {"name": "The Lancet", "url": "https://www.thelancet.com/rss", "day": "monday"},
    
    # === 周四波：预印本回顾与政策 ===
    {"name": "arXiv CS 上周热门", "api": "arxiv", "sort": "lastWeek", "day": "thursday"},
    {"name": "bioRxiv 上周热门", "api": "biorxiv", "sort": "lastWeek", "day": "thursday"},
    {"name": "CDC Weekly", "url": "https://www.cdc.gov/rss/weekly.rss", "day": "thursday"},
    {"name": "UNEP News", "url": "https://www.unep.org/news-and-stories/rss.xml", "day": "thursday"},
]
```

### 1.3 每月层（Monthly）—— 1日 + 15日双波次

```python
MONTHLY_SOURCES = [
    # === 每月1日：综述与会议 ===
    {"name": "Nature Reviews", "url": "https://www.nature.com/natreviews/rss", "day": 1},
    {"name": "Science Reviews", "url": "https://www.science.org/rss/reviews.xml", "day": 1},
    {"name": "IPCC Reports", "url": "https://www.ipcc.ch/reports/", "day": 1},
    {"name": "WHO Guidelines", "url": "https://www.who.int/publications/i", "day": 1},
    {"name": "NSF Grants", "url": "https://www.nsf.gov/rss/news.xml", "day": 1},
    
    # === 每月15日：数据与基金 ===
    {"name": "NASA Climate Data", "url": "https://climate.nasa.gov/evidence/", "day": 15},
    {"name": "NOAA Monthly", "url": "https://www.noaa.gov/news/rss.xml", "day": 15},
    {"name": "NIH Funding", "url": "https://www.nih.gov/news-events/news-releases/rss.xml", "day": 15},
    {"name": "EU Horizon", "url": "https://ec.europa.eu/info/news/rss", "day": 15},
]
```

### 1.4 季度/年度层（Quarterly/Annual）

| 时间节点 | 事件 | 抓取策略 |
|----------|------|----------|
| **4月** | 地球日 (4.22)、ASGCT 年会 | 环境专题 + 基因治疗专题 |
| **5月** | 世界高血压日 (5.17)、ASCO 预览 | 心血管专题 + 肿瘤预告 |
| **6月** | CVPR 论文集、BIO 大会 | 计算机视觉集中抓取 + 生物技术 |
| **7月** | ICML / ACL 出结果 | AI/ML/NLP 论文爆发期 |
| **9月** | ESC 大会、NeurIPS 截稿 | 心血管指南 + AI 预印本 |
| **10月** | 诺贝尔奖 (5-12日)、诺奖化学/医学 | 实时跟踪 + 深度解读 |
| **11月** | NeurIPS 结果、COP31、AHA 年会 | AI 论文 + 气候政策 + 心血管 |
| **12月** | Nature/Science 年度十大、年终盘点 | 年度回顾 + 来年预测 |

---

## 二、学科专属节点日历（2026-2027）

### 2.1 生物信息学（Bio）

| 月份 | 事件 | 抓取重点 |
|------|------|----------|
| **4月** | ASGCT 2026（美国基因与细胞治疗学会） | 基因治疗、CAR-T、AAV 载体 |
| **5月** | 世界基因组日 (4.25 延续) | 基因组学、测序技术 |
| **6月** | BIO International Convention | 生物技术投资、药物研发 |
| **7月** | CRISPR 专利更新期 | 基因编辑技术进展 |
| **9月** | 国际生物信息学会议 (ISMB 延续) | 算法、工具更新 |
| **10月** | 诺贝尔奖化学/医学奖 (5-12日) | 获奖研究深度解读 |
| **11月** | ASHG 年会（美国人类遗传学） | 遗传病、GWAS、群体遗传 |
| **12月** | 年度基因组学突破回顾 | Cell/Nature 年度盘点 |

**Bio 专属数据源：**
- bioRxiv / medRxiv RSS
- Nature Genetics / Nature Biotechnology RSS
- Cell Press 子刊 RSS
- PubMed `gene therapy[Title/Abstract]` 定时查询
- ClinicalTrials.gov 新增试验 API

### 2.2 临床研究（Clinical）

| 月份 | 事件 | 抓取重点 |
|------|------|----------|
| **4月** | 世界帕金森日 (4.11)、世界疟疾日 (4.25) | 神经退行、传染病 |
| **5月** | **世界高血压日 (5.17)**、**ASCO 2026** | 心血管、肿瘤学 |
| **6月** | 世界卒中日 (待确认)、父亲节健康专题 | 脑血管、男性健康 |
| **7月** | 世界肝炎日 (7.28) | 肝病、抗病毒 |
| **8月** | 国际临床试验日 (8.20 附近) | 临床试验方法学 |
| **9月** | **ESC 2026（欧洲心脏病学会）** | 心血管指南更新 |
| **10月** | 诺贝尔奖医学奖 | 转化医学、生理学 |
| **11月** | **AHA 2026（美国心脏协会）**、世界糖尿病日 | 心血管、内分泌 |
| **12月** | NEJM/JAMA 年度综述 | 循证医学年度总结 |

**Clinical 专属数据源：**
- PubMed E-utilities 定时查询（NEJM/Lancet/JAMA/The BMJ）
- WHO Guideline 页面监控
- FDA Approval 列表 RSS
- CDC Morbidity and Mortality Weekly Report
- Cochrane Library 新综述

### 2.3 计算机科学（CS / AI）

| 月份 | 事件 | 抓取重点 |
|------|------|----------|
| **4月** | ICLR 2026 后续讨论 | 表征学习、图神经网络 |
| **5月** | ICML 2026 截稿倒计时 | ML 理论、优化算法 |
| **6月** | **CVPR 2026 论文集** | 计算机视觉全部方向 |
| **7月** | **ICML + ACL 2026 出结果** | ML + NLP 论文爆发 |
| **8月** | KDD 2026、IJCAI 2026 | 数据挖掘、知识图谱 |
| **9月** | **NeurIPS 2026 截稿** | 深度学习理论爆发 |
| **10月** | ECCV 2026、ACM Turing Award | 视觉、图灵奖解读 |
| **11月** | **NeurIPS 2026 结果公布** | 顶会论文集中入库 |
| **12月** | AAAI 2027 截稿 | AI 综合方向 |

**CS 专属数据源：**
- arXiv API：cs.AI, cs.CV, cs.LG, cs.CL, cs.RO
- OpenAI / DeepMind / Meta AI Blog
- Papers With Code Trending
- Hugging Face Papers
- ACM Digital Library 新上架

### 2.4 气象地质（Geo）

| 月份 | 事件 | 抓取重点 |
|------|------|----------|
| **3月** | **WMO 年报发布**、世界气象日 (3.23) | 全球气候状态 |
| **4月** | **地球日 (4.22)** | 环境保护、可持续发展 |
| **5月** | 国际生物多样性日 (5.22) | 生态保护 |
| **6月** | 世界环境日 (6.5)、世界海洋日 (6.8) | 海洋科学、环境政策 |
| **7月** | 世界人口日 (7.11) | 人口与资源 |
| **8月** | IPCC 报告更新窗口 | 气候评估 |
| **9月** | 国际臭氧层保护日 (9.16) | 大气科学 |
| **10月** | 国际减灾日 (10.13) | 灾害预警、地震 |
| **11月** | **COP31 气候大会** | 气候政策、碳中和 |
| **12月** | 南极条约纪念日 | 极地科学 |

**Geo 专属数据源：**
- Copernicus Climate Data Store API
- NASA GISS 温度数据
- NOAA 月度气候报告
- IPCC 报告页面监控
- Nature Climate Change / Nature Geoscience RSS
- 中国气象局公告

---

## 三、从 2026.4.29 起的全年执行清单

### Q2 2026（4-6月）

| 日期 | 行动项 | 触发脚本 | 输出 |
|------|--------|----------|------|
| **4.29** | 基准启动，初始化数据池，补抓 Q1 遗漏热点 | `crawl_daily.py` + 手动补录 | 140+ 条基础数据 |
| **4.30** | **补抓地球日环境内容**（4.22 漏抓补充） | `crawl_monthly.py` --retroactive 4.22 | 环境专题 10+ 条 |
| **5.1** | **启动每日自动化**（Windows 任务计划程序部署） | `crawl_daily.py` | 日常自动运行 |
| **5.4** | 五一假期后补抓（堆积资讯） | `crawl_daily.py` --catchup | 补抓 5.1-5.3 |
| **5.17** | **世界高血压日临床专题** | `crawl_weekly.py` --special hypertension | 心血管专题 15+ 条 |
| **5.20** | ASCO 2026 预览启动 | `crawl_monthly.py` --event asco | 肿瘤预告 |
| **5.26** | 国际生物多样性日前置抓 | `crawl_daily.py` --focus biodiversity | 生态专题 |
| **6.1** | **CVPR 2026 论文集集中抓取** | `crawl_monthly.py` --event cvpr | CV 论文 50+ 条 |
| **6.5** | 世界环境日专题 | `crawl_daily.py` --focus environment | 环境专题 |
| **6.15** | BIO 大会跟踪 | `crawl_weekly.py` --event bio | 生物技术 |
| **6.20** | 年中盘点：上半年各学科 Top10 | `crawl_monthly.py` --review h1 | 半年回顾 |

### Q3 2026（7-9月）

| 日期 | 行动项 | 触发脚本 | 输出 |
|------|--------|----------|------|
| **7.1** | ICML + ACL 结果集中抓取 | `crawl_monthly.py` --event icml-acl | AI 论文 80+ 条 |
| **7.15** | 月度综述：上半年气候数据 | `crawl_monthly.py` --focus climate-h1 | 气候报告 |
| **7.28** | 世界肝炎日专题 | `crawl_weekly.py` --special hepatitis | 肝病专题 |
| **8.1** | KDD + IJCAI 论文跟踪 | `crawl_monthly.py` --event kdd-ijcai | 数据挖掘 |
| **8.15** | 暑期学术淡季维持运行 | `crawl_daily.py` | 日常维持 |
| **9.1** | **ESC 2026 心血管指南抓取** | `crawl_monthly.py` --event esc | 心血管指南 |
| **9.10** | **NeurIPS 2026 截稿前预印本激增** | `crawl_daily.py` --focus neurips | AI 预印本 |
| **9.16** | 国际臭氧层保护日 | `crawl_daily.py` --focus ozone | 大气专题 |
| **9.23** | 世界秋分/气象数据更新 | `crawl_weekly.py` --focus autumn-equinox | 季节数据 |

### Q4 2026（10-12月）

| 日期 | 行动项 | 触发脚本 | 输出 |
|------|--------|----------|------|
| **10.1** | 月度综述 + 诺贝尔预热 | `crawl_monthly.py` --nobel-warmup | 诺奖预测 |
| **10.5** | **诺贝尔奖实时跟踪启动** | `crawl_daily.py` --nobel-track | 化学/医学/物理 |
| **10.12** | 诺贝尔奖公布完成，深度解读入库 | `crawl_monthly.py` --nobel-deep-dive` | 获奖研究 |
| **10.20** | ECCV 2026 论文集 | `crawl_monthly.py` --event eccv | 视觉论文 |
| **11.1** | **NeurIPS 2026 接收论文集中入库** | `crawl_monthly.py` --event neurips | AI 论文 100+ 条 |
| **11.5** | **COP31 气候大会实时跟踪** | `crawl_daily.py` --cop31-track | 气候政策 |
| **11.11** | **AHA 2026 心血管年会** | `crawl_monthly.py` --event aha | 心血管 |
| **11.14** | 世界糖尿病日 | `crawl_daily.py` --special diabetes | 内分泌 |
| **12.1** | Nature / Science 年度十大启动 | `crawl_daily.py` --year-end-warmup | 年度盘点 |
| **12.15** | 全年数据归档 + 来年预测 | `crawl_monthly.py` --year-end-review` | 年度报告 |
| **12.31** | 数据快照归档 + 清理过期日志 | `crawl_monthly.py` --archive` | 全年快照 |

### Q1 2027（1-3月）

| 日期 | 行动项 | 触发脚本 | 输出 |
|------|--------|----------|------|
| **1.1** | 新年规划启动、JPM 医疗大会 | `crawl_monthly.py` --event jpm` | 生物医药投资 |
| **1.15** | 2026 全年数据回顾 | `crawl_monthly.py` --review 2026` | 年度总结 |
| **2.1** | AAAI 2027 截稿前高峰 | `crawl_daily.py` --focus aaai` | AI 综合 |
| **2.15** | 春节后补抓（堆积资讯） | `crawl_daily.py` --catchup` | 补录 |
| **3.1** | ICLR 2027 出结果 | `crawl_monthly.py` --event iclr` | 表征学习 |
| **3.15** | 世界气象日 + WMO 年报 | `crawl_monthly.py` --event wmo` | 气候年报 |
| **3.23** | 世界气象日专题 | `crawl_daily.py` --special weather` | 气象专题 |

---

## 四、数据源技术配置

### 4.1 RSS/Atom 源（已验证可用）

| 源名称 | URL | 更新频率 | 学科 | 备注 |
|--------|-----|----------|------|------|
| arXiv CS.AI | https://rss.arxiv.org/rss/cs.AI | 实时 | CS | 主源 |
| arXiv CS.CV | https://rss.arxiv.org/rss/cs.CV | 实时 | CS | CV 专用 |
| arXiv CS.LG | https://rss.arxiv.org/rss/cs.LG | 实时 | CS | ML 专用 |
| arXiv q-bio | https://rss.arxiv.org/rss/q-bio | 实时 | Bio | 生物 |
| bioRxiv | https://www.biorxiv.org/rss/recent.xml | 实时 | Bio | 预印本 |
| medRxiv | https://www.medrxiv.org/rss/recent.xml | 实时 | Clinical | 医学预印本 |
| Nature | https://www.nature.com/nature.rss | 日更 | Bio | 顶级综合 |
| Science | https://www.science.org/rss/news_current.xml | 日更 | Bio | 顶级综合 |
| NEJM | https://www.nejm.org/rss.xml | 周更 | Clinical | 临床医学顶刊 |
| JAMA | https://jamanetwork.com/rss.xml | 周更 | Clinical | 临床医学顶刊 |
| The Lancet | https://www.thelancet.com/rss | 周更 | Clinical | 临床医学顶刊 |
| Medical Xpress | https://medicalxpress.com/rss-feed/ | 日更 | Clinical | 医学新闻 |
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ | 日更 | CS | AI 资讯 |
| MIT Tech Review | https://www.technologyreview.com/feed/ | 日更 | CS | 科技评论 |
| Copernicus | https://climate.copernicus.eu/rss.xml | 日更 | Geo | 气候数据 |
| NASA Earth | https://earthobservatory.nasa.gov/feeds/imageoftheday.rss | 日更 | Geo | 地球观测 |
| WHO News | https://www.who.int/rss-feeds/news-english.xml | 日更 | Clinical | 世卫新闻 |
| FDA Press | https://www.fda.gov/about-fda/contact-fda/stay-informed/rss.xml | 日更 | Clinical | FDA 公告 |
| CDC Weekly | https://www.cdc.gov/rss/weekly.rss | 周更 | Clinical | CDC 周报 |

### 4.2 API 源

| API | Endpoint | 限流 | 用途 |
|-----|----------|------|------|
| arXiv API | http://export.arxiv.org/api/query | 无明确限流 | 批量论文查询 |
| PubMed E-utilities | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/ | 3次/秒 | 医学文献检索 |
| bioRxiv API | https://api.biorxiv.org/covid19/ | 无明确限流 | 生物预印本 |
| NASA GISS | https://data.giss.nasa.gov/gistemp/ | 无 | 温度数据 |
| Copernicus CDS | https://cds.climate.copernicus.eu/ | 需注册 | 气候数据集 |

### 4.3 网页监控（需 Selenium/Playwright）

| 网站 | 监控内容 | 频率 |
|------|----------|------|
| NeurIPS.cc | 接收论文列表 | 结果公布日 |
| CVPR / ICCV / ECCV | 论文集页面 | 会议后 |
| IPCC.ch | 新报告发布 | 月度检查 |
| NobelPrize.org | 诺奖公布 | 10月5-12日 |
| COP 官网 | 会议成果文件 | 11月会议期间 |
| ClinicalTrials.gov | 新增试验 | 每周 |

---

## 五、自动化部署指南

### 5.1 Windows 任务计划程序配置

```powershell
# 每日 14:00
schtasks /create /tn "AcademicHub-Daily" /tr "python.exe crawl_daily.py" /sc daily /st 14:00 /sd 2026/05/01 /rp "" /rl lowest

# 每周一 09:00
schtasks /create /tn "AcademicHub-Weekly-Mon" /tr "python.exe crawl_weekly.py" /sc weekly /d MON /st 09:00 /sd 2026/05/04

# 每周四 09:00
schtasks /create /tn "AcademicHub-Weekly-Thu" /tr "python.exe crawl_weekly.py" /sc weekly /d THU /st 09:00 /sd 2026/05/07

# 每月1日 08:00
schtasks /create /tn "AcademicHub-Monthly-1" /tr "python.exe crawl_monthly.py" /sc monthly /d 1 /st 08:00

# 每月15日 08:00
schtasks /create /tn "AcademicHub-Monthly-15" /tr "python.exe crawl_monthly.py" /sc monthly /d 15 /st 08:00
```

### 5.2 Python 环境要求

```bash
# 推荐虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# 依赖包
pip install requests feedparser beautifulsoup4 lxml python-dateutil
```

### 5.3 数据存储结构

```
data/
├── papers.json          # 主数据文件（去重后）
├── crawl-logs.json      # 抓取日志
├── favorites.json       # 收藏数据
├── snapshots/           # 月度快照
│   ├── snapshot-202604.json
│   ├── snapshot-202605.json
│   └── ...
└── raw/                 # 原始抓取数据（保留90天）
    ├── daily-20260429.json
    └── ...
```

---

## 六、数据质量与去重策略

### 6.1 去重规则

1. **主键去重**：同一 `url` 或同一 `title`（忽略大小写和空格）只保留一条
2. **时间优先**：重复时保留日期最新的版本
3. **内容合并**：如果摘要不同，保留更长的版本

### 6.2 质量过滤

- 标题长度 < 10 字符 → 丢弃
- 摘要长度 < 20 字符 → 标记为低质量
- URL 不可达（404）→ 标记并尝试 DOI 替换
- 非目标语言（非英文/中文）→ 丢弃

### 6.3 学科分类校验

- 使用 `scripts/utils.py` 的 `auto_discipline()` 函数
- arXiv 分类标签直接映射
- PubMed MeSH 词条映射
- 人工校验每月抽查 5%

---

## 七、应急响应机制

| 场景 | 应对措施 |
|------|----------|
| 数据源 404 | 自动切换备用源，记录日志 |
| API 限流 | 指数退避重试（1s, 2s, 4s, 8s） |
| 网络中断 | 本地缓存数据继续服务，重试标记 |
| 重大突发事件 | 触发手动紧急抓取，跳过定时队列 |
| 数据异常增长 | 暂停入库，人工审核后批量确认 |

---

## 八、执行命令速查表

```bash
# === 日常操作 ===
cd academic-hub
python crawl_daily.py                          # 每日抓取
python crawl_weekly.py                         # 每周抓取
python crawl_monthly.py                        # 每月抓取

# === 专项抓取 ===
python crawl_daily.py --focus environment      # 环境专题
python crawl_daily.py --special hypertension   # 高血压日专题
python crawl_monthly.py --event cvpr           # CVPR 会议
python crawl_monthly.py --event neurips        # NeurIPS 会议
python crawl_monthly.py --nobel-track          # 诺奖实时跟踪
python crawl_monthly.py --cop31-track          # COP31 跟踪

# === 数据维护 ===
python scripts/deduplicate.py                  # 手动去重
python scripts/validate.py                     # 链接有效性检查
python scripts/archive.py --month 202604       # 手动归档

# === 查看统计 ===
python scripts/stats.py                        # 数据质量报告
```

---

> **维护者：** Academic Hub Automation Team  
> **最后更新：** 2026-04-29  
> **下次修订：** 2026-07-01（Q2 执行回顾后）
