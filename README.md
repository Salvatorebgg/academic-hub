# Academic Hub - 学术前沿资讯聚合平台

## 项目概述
一个精美的多学科前沿学术资讯聚合网站，涵盖生物信息学、临床研究/临床统计学、计算机科学、气象地质学等领域。

## 技术架构
- **前端**: 纯 HTML5 + CSS3 + JavaScript (单页应用)
- **样式**: 自定义 CSS 实现磨砂玻璃质感、渐变、动画
- **音效**: Web Audio API + Tone.js
- **数据**: 本地 JSON 存储 + Python 抓取脚本
- **定时任务**: Windows 任务计划程序 / automation 工具
- **收藏/下载**: LocalStorage + 文件系统 API

## 核心功能
1. 每日 10:00 自动抓取前沿资讯与论文
2. 多学科分类展示（生物信息学、临床研究、计算机、气象地质）
3. 历史重要资料推送
4. 收藏与下载（本地 + 云端）
5. 磨砂玻璃质感 UI + 动态交互 + 音效

## 目录结构
```
academic-hub/
├── index.html              # 主页面
├── css/
│   └── style.css           # 主样式（磨砂玻璃、渐变、动画）
├── js/
│   ├── app.js              # 主应用逻辑
│   ├── audio.js            # 音效系统
│   ├── data.js             # 数据管理
│   └── fetcher.js          # 前端数据获取
├── data/
│   └── papers.json         # 本地论文数据
├── scraper/
│   ├── fetch_papers.py     # Python 抓取脚本
│   └── requirements.txt    # Python 依赖
└── README.md
```

## 运行方式
1. 直接用浏览器打开 `index.html`
2. Python 抓取脚本可独立运行或配置定时任务
