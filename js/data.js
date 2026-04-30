/**
 * Academic Hub v2.0 - 数据管理模块
 * 增强功能：批量导出、Markdown/CSV 导出、阅读历史
 */

class DataManager {
  constructor() {
    this.papers = [];
    this.currentFilter = 'all';
    this.typeFilter = 'all';
    this.currentView = 'grid';
    this.searchQuery = '';
    this.currentUser = null;
    this.favorites = this.loadFavorites();
    this.lastUpdated = null;
    this.liveMeta = { total: 0, sources: [] };
    this.liveCount = 0;
    this.latestBatchSize = 48;
    this.rotationSeed = this.createRotationSeed();
  }

  setCurrentUser(username) {
    this.currentUser = username;
    this.favorites = this.loadFavorites();
  }

  clearCurrentUser() {
    this.currentUser = null;
    this.favorites = this.loadFavorites();
  }

  async loadPapers() {
    try {
      if (typeof PAPERS_JSON_DATA !== 'undefined' && Array.isArray(PAPERS_JSON_DATA) && PAPERS_JSON_DATA.length > 0) {
        this.papers = PAPERS_JSON_DATA;
        console.log('Loaded ' + this.papers.length + ' papers from inline data');
      } else {
        const response = await fetch('data/papers.json');
        if (response.ok) {
          const data = await response.json();
          this.papers = data.papers || [];
        } else {
          this.papers = this.getMockData();
        }
      }
      await this.loadMoreData();
      await this.loadLiveData();
    } catch (error) {
      console.warn('Failed to load papers, using mock data:', error);
      this.papers = this.getMockData();
      await this.loadLiveData();
    }
    return this.papers;
  }

  createRotationSeed() {
    return Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100000);
  }

  rotateSeed() {
    this.rotationSeed = this.createRotationSeed();
  }

  normalizePaper(paper) {
    if (!paper || !paper.title) return null;
    const date = paper.date || new Date().toISOString().slice(0, 10);
    const year = Number(paper.year || String(date).slice(0, 4)) || new Date().getFullYear();
    const url = paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : '');
    return {
      ...paper,
      id: paper.id || `item-${Math.random().toString(36).slice(2)}`,
      title: String(paper.title || '').trim(),
      authors: String(paper.authors || paper.source || 'Source').trim(),
      abstract: String(paper.abstract || paper.title || '').trim(),
      discipline: paper.discipline || 'cs',
      type: paper.type || 'paper',
      journal: paper.journal || paper.source || paper.sourceApi || 'Academic source',
      source: paper.source || paper.journal || paper.sourceApi || 'Academic source',
      url,
      date,
      year,
      keywords: Array.isArray(paper.keywords) ? paper.keywords : [],
      readTime: paper.readTime || '3 min',
      qualityScore: Number(paper.qualityScore || (paper._live ? 72 : 50)),
      verified: paper.verified === true || paper._live === true || /^https?:\/\//i.test(url)
    };
  }

  mergePapers(incoming = []) {
    const merged = [];
    const seen = new Set();
    const add = (paper) => {
      const item = this.normalizePaper(paper);
      if (!item) return;
      const key = (item.doi || item.url || item.title).toLowerCase().replace(/\/$/, '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    };
    incoming.forEach(add);
    this.papers.forEach(add);
    this.papers = merged;
  }

  async loadLiveData(options = {}) {
    if (!window.AcademicLiveFeed || typeof window.AcademicLiveFeed.load !== 'function') return 0;
    try {
      const data = await window.AcademicLiveFeed.load({
        seed: options.force ? this.createRotationSeed() : this.rotationSeed,
        network: options.force === true
      });
      const livePapers = (data.papers || []).map(p => ({ ...p, _live: true, verified: p.verified !== false }));
      if (livePapers.length) {
        this.mergePapers(livePapers);
        this.liveCount = this.papers.filter(p => p._live).length;
        this.liveMeta = {
          total: livePapers.length,
          sources: data.sources || [],
          generatedAt: data.generatedAt
        };
        this.lastUpdated = data.generatedAt || new Date().toISOString();
        localStorage.setItem('academic-hub-last-updated', this.lastUpdated);
        if (options.force) this.rotateSeed();
      }
      return livePapers.length;
    } catch (error) {
      console.warn('Live feed load failed:', error);
      return 0;
    }
  }

  applyActiveFilters(papers) {
    let filtered = papers;
    if (this.typeFilter !== 'all') {
      filtered = filtered.filter(p => p.type === this.typeFilter);
    }
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(p => p.discipline === this.currentFilter);
    }
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        (p.title || '').toLowerCase().includes(query) ||
        (p.authors || '').toLowerCase().includes(query) ||
        (p.abstract || '').toLowerCase().includes(query) ||
        p.keywords?.some(k => String(k).toLowerCase().includes(query))
      );
    }
    return filtered;
  }

  seededShuffle(items, seed = this.rotationSeed) {
    const shuffled = [...items];
    let value = seed || 1;
    const random = () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getFilteredPapers() {
    let filtered = this.applyActiveFilters(this.papers);
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    return filtered;
  }

  getNewsPapers() { return this.papers.filter(p => p.type === 'news'); }
  getAcademicPapers() { return this.papers.filter(p => p.type === 'paper'); }

  /* ========== 年份筛选：最新资讯 (2026年及以后) ========== */
  getLatestPapers() {
    const currentYear = new Date().getFullYear();
    const livePool = this.papers.filter(p => p._live && p.verified !== false);
    const recentPool = this.papers.filter(p => p.year >= currentYear || p.year >= 2026);
    const basePool = livePool.length >= 12 ? livePool : recentPool;
    let filtered = this.applyActiveFilters(basePool);
    if (!this.searchQuery && filtered.length > this.latestBatchSize) {
      filtered = this.seededShuffle(filtered).slice(0, this.latestBatchSize);
    }
    filtered.sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      return (b.qualityScore || 0) - (a.qualityScore || 0);
    });
    return filtered;
  }

  /* ========== 年份筛选：历史推送 (2026年以前) ========== */
  getHistoryPapers() {
    let filtered = this.papers.filter(p => p.year < 2026);
    if (this.typeFilter !== 'all') {
      filtered = filtered.filter(p => p.type === this.typeFilter);
    }
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(p => p.discipline === this.currentFilter);
    }
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.authors.toLowerCase().includes(query) ||
        p.abstract.toLowerCase().includes(query) ||
        p.keywords?.some(k => k.toLowerCase().includes(query))
      );
    }
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const grouped = {};
    filtered.forEach(paper => {
      const date = new Date(paper.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(paper);
    });
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([month, papers]) => ({ month, papers }));
  }

  getHistoricalPapers() {
    return this.getHistoryPapers();
  }

  toggleFavorite(paperId) {
    const index = this.favorites.indexOf(paperId);
    if (index > -1) {
      this.favorites.splice(index, 1);
      this.saveFavorites();
      return false;
    } else {
      this.favorites.push(paperId);
      this.saveFavorites();
      return true;
    }
  }

  isFavorited(paperId) { return this.favorites.includes(paperId); }
  getFavoritePapers() { return this.papers.filter(p => this.favorites.includes(p.id)); }

  getFavoritesKey() {
    return this.currentUser
      ? `academic-hub-favorites-user-${this.currentUser}`
      : 'academic-hub-favorites';
  }

  loadFavorites() {
    try {
      const stored = localStorage.getItem(this.getFavoritesKey());
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }

  saveFavorites() {
    localStorage.setItem(this.getFavoritesKey(), JSON.stringify(this.favorites));
  }

  getBestUrl(paper) {
    if (paper.url && paper.url.startsWith('http')) return paper.url;
    if (paper.doi) return `https://doi.org/${paper.doi}`;
    const query = encodeURIComponent(paper.title);
    return `https://scholar.google.com/scholar?q=${query}`;
  }

  getPdfUrl(paper) {
    if (paper.pdfUrl) return paper.pdfUrl;
    const arxivMatch = paper.url?.match(/arxiv\.org\/abs\/(\d+\.\d+)/);
    if (arxivMatch) return `https://arxiv.org/pdf/${arxivMatch[1]}.pdf`;
    if (paper.doi) {
      if (paper.doi.startsWith('10.1038/')) return `https://www.nature.com/articles/${paper.doi.replace('10.1038/', '')}.pdf`;
      if (paper.doi.startsWith('10.1126/')) return `https://www.science.org/doi/pdf/${paper.doi}`;
      if (paper.doi.startsWith('10.1056/')) return `https://www.nejm.org/doi/pdf/${paper.doi}`;
    }
    return null;
  }

  downloadPaper(paper, format = 'json') {
    if (format === 'pdf') {
      const pdfUrl = this.getPdfUrl(paper);
      if (pdfUrl) {
        window.open(pdfUrl, '_blank');
        return { success: true, method: 'direct', url: pdfUrl };
      } else {
        return { success: false, method: 'print' };
      }
    } else if (format === 'json') {
      const dataStr = JSON.stringify(paper, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      this.downloadBlob(blob, `${paper.title.slice(0, 50)}.json`);
    } else if (format === 'bibtex') {
      const bibtex = this.toBibTeX(paper);
      const blob = new Blob([bibtex], { type: 'text/plain' });
      this.downloadBlob(blob, `${paper.title.slice(0, 50)}.bib`);
    } else if (format === 'markdown') {
      const md = this.toMarkdown(paper);
      const blob = new Blob([md], { type: 'text/markdown' });
      this.downloadBlob(blob, `${paper.title.slice(0, 50)}.md`);
    } else if (format === 'csv') {
      const csv = this.toCSV([paper]);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      this.downloadBlob(blob, `${paper.title.slice(0, 50)}.csv`);
    }
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  toBibTeX(paper) {
    const key = paper.id.replace(/[^a-zA-Z0-9]/g, '');
    const authors = paper.authors.split(',').map(a => a.trim()).join(' and ');
    return `@article{${key},
  title = {${paper.title}},
  author = {${authors}},
  journal = {${paper.journal || 'Unknown'}},
  year = {${paper.year || new Date(paper.date).getFullYear()}},
  doi = {${paper.doi || ''}},
  url = {${paper.url || ''}}
}`;
  }

  toMarkdown(paper) {
    return `# ${paper.title}\n\n**作者：** ${paper.authors}\n\n**来源：** ${paper.journal || paper.source} · ${paper.date}\n\n**链接：** [${this.getBestUrl(paper)}](${this.getBestUrl(paper)})\n\n## 摘要\n\n${paper.abstract}\n\n${paper.keywords?.length ? `**关键词：** ${paper.keywords.join(', ')}\n\n` : ''}---\n*由 Academic Hub 导出 · ${new Date().toLocaleDateString('zh-CN')}*\n`;
  }

  toCSV(papers) {
    const headers = ['标题', '作者', '学科', '类型', '期刊', '日期', '链接', '关键词'];
    const rows = papers.map(p => [
      `"${p.title.replace(/"/g, '""')}"`,
      `"${p.authors.replace(/"/g, '""')}"`,
      p.discipline,
      p.type,
      p.journal || '',
      p.date,
      this.getBestUrl(p),
      `"${(p.keywords || []).join('; ')}"`
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  exportFavorites() {
    const favorites = this.getFavoritePapers();
    const data = {
      exportDate: new Date().toISOString(),
      total: favorites.length,
      papers: favorites
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, `academic-hub-favorites-${new Date().toISOString().split('T')[0]}.json`);
  }

  exportBatch(papers, format = 'json') {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(papers, null, 2)], { type: 'application/json' });
      this.downloadBlob(blob, `academic-hub-batch-${new Date().toISOString().split('T')[0]}.json`);
    } else if (format === 'csv') {
      const csv = this.toCSV(papers);
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      this.downloadBlob(blob, `academic-hub-batch-${new Date().toISOString().split('T')[0]}.csv`);
    } else if (format === 'markdown') {
      const md = papers.map(p => this.toMarkdown(p)).join('\n\n---\n\n');
      const blob = new Blob([md], { type: 'text/markdown' });
      this.downloadBlob(blob, `academic-hub-batch-${new Date().toISOString().split('T')[0]}.md`);
    }
  }

  async loadMoreData() {
    const sources = ['data/papers.json', 'data/bio.json', 'data/clinical.json', 'data/cs.json', 'data/geo.json'];
    for (const source of sources) {
      try {
        const response = await fetch(source);
        if (response.ok) {
          const data = await response.json();
          const papers = data.papers || data;
          if (Array.isArray(papers)) {
            const existingIds = new Set(this.papers.map(p => p.id));
            const newPapers = papers.filter(p => !existingIds.has(p.id));
            this.papers.push(...newPapers);
          }
        }
      } catch (e) {}
    }
  }

  getMockData() {
    if (typeof PAPERS_JSON_DATA !== 'undefined' && Array.isArray(PAPERS_JSON_DATA) && PAPERS_JSON_DATA.length > 0) {
      return PAPERS_JSON_DATA;
    }
    return [];
  }
}

window.dataManager = new DataManager();
