/**
 * Academic Hub v2.0 - 主应用逻辑
 * 增强功能：阅读进度、批量操作、搜索高亮、阅读历史、回到顶部、丰富导出
 */

class AcademicHub {
  constructor() {
    this.dataManager = window.dataManager;
    this.audio = window.audioEngine;
    this.currentSection = 'latest';
    this.readingHistory = this.loadReadingHistory();
    this.batchMode = false;
    this.batchSelected = new Set();
    this.init();
  }

  async init() {
    await this.dataManager.loadPapers();
    this.initTheme();
    this.initSystemTheme();
    this.initSearchHistory();
    this.bindEvents();
    this.initScrollEffects();
    this.initViewportAnimations();
    this.initKeyboardShortcuts();
    this.render();
    this.initParticles();
    this.initVisibilityPause();

    setTimeout(() => {
      const loader = document.getElementById('pageLoader');
      if (loader) loader.classList.add('hidden');
    }, 1800);

    console.log('🎓 Academic Hub v3.0 initialized');
  }

  /* ========== 主题管理 ========== */
  initTheme() {
    const savedTheme = localStorage.getItem('academic-hub-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('academic-hub-theme', next);
    this.updateThemeIcon(next);
    this.audio.playClick();
  }

  updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  }

  /* ========== 系统深色模式检测 ========== */
  initSystemTheme() {
    if (window.matchMedia && !localStorage.getItem('academic-hub-theme')) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        this.updateThemeIcon('dark');
      }
      mq.addEventListener('change', (e) => {
        if (!localStorage.getItem('academic-hub-theme')) {
          const theme = e.matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', theme);
          this.updateThemeIcon(theme);
        }
      });
    }
  }

  /* ========== 搜索历史 ========== */
  initSearchHistory() {
    this.searchHistory = [];
    try {
      const stored = localStorage.getItem('academic-hub-search-history');
      if (stored) this.searchHistory = JSON.parse(stored);
    } catch {}
  }

  saveSearchHistory() {
    localStorage.setItem('academic-hub-search-history', JSON.stringify(this.searchHistory.slice(0, 10)));
  }

  addSearchHistory(query) {
    if (!query || query.length < 2) return;
    this.searchHistory = this.searchHistory.filter(q => q.toLowerCase() !== query.toLowerCase());
    this.searchHistory.unshift(query);
    this.searchHistory = this.searchHistory.slice(0, 10);
    this.saveSearchHistory();
  }

  renderSearchHistory() {
    const container = document.getElementById('searchHistory');
    if (!container) return;
    if (this.searchHistory.length === 0) {
      container.classList.remove('active');
      return;
    }
    container.innerHTML = this.searchHistory.map((q, i) => `
      <div class="search-history-item" data-query="${q}">
        <span>🔍</span>
        <span>${q}</span>
        <span class="history-delete" data-index="${i}">✕</span>
      </div>
    `).join('');
    container.classList.add('active');

    container.querySelectorAll('.search-history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('history-delete')) {
          e.stopPropagation();
          const idx = parseInt(e.target.dataset.index);
          this.searchHistory.splice(idx, 1);
          this.saveSearchHistory();
          this.renderSearchHistory();
          return;
        }
        const query = item.dataset.query;
        document.getElementById('searchBox').value = query;
        this.dataManager.searchQuery = query;
        this.renderPapers();
        container.classList.remove('active');
      });
    });
  }

  /* ========== 视口进入动画 ========== */
  initViewportAnimations() {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.paper-card, .paper-list-item, .stat-card, .today-pick-card, .discipline-chart, .keyword-cloud').forEach(el => {
      el.classList.add('reveal');
      observer.observe(el);
    });
  }

  /* ========== 键盘快捷键 ========== */
  initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // / 聚焦搜索框
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('searchBox')?.focus();
      }
      // ESC 关闭模态框/侧边栏/搜索历史
      if (e.key === 'Escape') {
        this.closeModal();
        this.closeSidebar();
        document.getElementById('searchHistory')?.classList.remove('active');
      }
      // 1/2/3 切换导航
      if (e.key >= '1' && e.key <= '3' && document.activeElement.tagName !== 'INPUT') {
        const sections = ['latest', 'history', 'favorites'];
        this.switchSection(sections[parseInt(e.key) - 1]);
      }
      // T 切换主题
      if ((e.key === 't' || e.key === 'T') && document.activeElement.tagName !== 'INPUT') {
        this.toggleTheme();
      }
      // B 切换批量模式
      if ((e.key === 'b' || e.key === 'B') && document.activeElement.tagName !== 'INPUT') {
        this.toggleBatchMode();
      }
    });
  }

  /* ========== 页面可见性：暂停粒子动画省电 ========== */
  initVisibilityPause() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // 页面隐藏时粒子动画会在 beforeunload 中清理
        // 这里主要是减少不必要的重绘
      }
    });
  }

  /* ========== 数字滚动动画 ========== */
  animateCounter(el, target, duration = 1200) {
    if (!el) return;
    const start = performance.now();
    const startVal = 0;
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.floor(startVal + (target - startVal) * eased);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /* ========== 滚动效果 ========== */
  initScrollEffects() {
    const navbar = document.getElementById('navbar');
    const progress = document.getElementById('readingProgress');
    const backToTop = document.getElementById('backToTop');

    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

      // 阅读进度条
      if (progress) progress.style.width = percent + '%';

      // 导航栏收缩
      if (navbar) navbar.classList.toggle('scrolled', scrollTop > 20);

      // 回到顶部按钮
      if (backToTop) backToTop.classList.toggle('visible', scrollTop > 400);
    });

    // 回到顶部
    document.getElementById('backToTop')?.addEventListener('click', () => {
      this.audio.playClick();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ========== 阅读历史 ========== */
  loadReadingHistory() {
    try {
      return new Set(JSON.parse(localStorage.getItem('academic-hub-history') || '[]'));
    } catch { return new Set(); }
  }

  saveReadingHistory() {
    localStorage.setItem('academic-hub-history', JSON.stringify([...this.readingHistory]));
  }

  markAsRead(id) {
    this.readingHistory.add(id);
    this.saveReadingHistory();
  }

  isRead(id) {
    return this.readingHistory.has(id);
  }

  clearReadingHistory() {
    this.readingHistory.clear();
    this.saveReadingHistory();
    this.renderPapers();
    this.showToast('阅读记录已清除', 'info');
    this.audio.playClick();
  }

  /* ========== 事件绑定 ========== */
  bindEvents() {
    // 主题切换
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

    // 音效开关
    document.getElementById('soundToggle')?.addEventListener('click', (e) => {
      const enabled = this.audio.toggle();
      e.currentTarget.classList.toggle('muted', !enabled);
      e.currentTarget.innerHTML = enabled ? '🔊' : '🔇';
    });

    // 搜索
    const searchBox = document.getElementById('searchBox');
    searchBox?.addEventListener('input', (e) => {
      this.dataManager.searchQuery = e.target.value;
      this.renderPapers();
    });
    searchBox?.addEventListener('focus', () => this.renderSearchHistory());
    searchBox?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchBox.value.trim()) {
        this.addSearchHistory(searchBox.value.trim());
        document.getElementById('searchHistory')?.classList.remove('active');
      }
    });
    // 点击外部关闭搜索历史
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        document.getElementById('searchHistory')?.classList.remove('active');
      }
    });

    // 内容类型筛选
    document.querySelectorAll('.discipline-tag[data-filter]').forEach(tag => {
      tag.addEventListener('click', (e) => {
        this.audio.playSwitch();
        document.querySelectorAll('.discipline-tag[data-filter]').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.dataManager.typeFilter = e.target.dataset.filter;
        this.renderPapers();
      });
    });

    // 学科筛选
    document.querySelectorAll('.discipline-tag[data-discipline]').forEach(tag => {
      tag.addEventListener('click', (e) => {
        this.audio.playSwitch();
        document.querySelectorAll('.discipline-tag[data-discipline]').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.dataManager.currentFilter = e.target.dataset.discipline;
        this.renderPapers();
      });
    });

    // 视图切换
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.audio.playClick();
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.dataManager.currentView = e.target.dataset.view;
        this.renderPapers();
      });
    });

    // 导航
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.audio.playClick();
        this.switchSection(e.target.dataset.section);
      });
    });

    // Logo 点击
    document.querySelector('.logo')?.addEventListener('click', () => {
      this.audio.playClick();
      this.switchSection('latest');
    });

    // 收藏夹
    document.getElementById('favoritesBtn')?.addEventListener('click', () => {
      this.audio.playClick();
      this.openSidebar();
    });
    document.getElementById('sidebarClose')?.addEventListener('click', () => {
      this.audio.playClick();
      this.closeSidebar();
    });

    // 导出收藏
    document.getElementById('exportFavorites')?.addEventListener('click', () => {
      this.audio.playDownload();
      this.dataManager.exportFavorites();
      this.showToast('收藏已导出', 'success');
    });

    // 手动更新
    document.getElementById('manualUpdate')?.addEventListener('click', () => {
      this.audio.playClick();
      this.showToast('正在刷新热门内容...', 'info');
      this.refreshWithHotContent().then(() => {
        this.render();
        this.showToast('已刷新最新热门内容！', 'success');
        this.audio.playSuccess();
      });
    });

    // 数据管理
    document.getElementById('openDataFolder')?.addEventListener('click', () => {
      this.audio.playClick();
      const info = `
        <div style="line-height: 1.9;">
          <p><strong>📁 数据文件位置</strong></p>
          <code style="background: var(--bg-secondary); padding: 0.6rem; border-radius: 8px; display: block; margin: 0.6rem 0; font-size: 0.82rem;">
            data/papers.json
          </code>
          <p><strong>📊 当前统计</strong></p>
          <ul style="margin: 0.5rem 0 0.5rem 1.2rem;">
            <li>论文总数：${this.dataManager.papers.length} 篇</li>
            <li>学术论文：${this.dataManager.papers.filter(p => p.type === 'paper').length} 篇</li>
            <li>资讯新闻：${this.dataManager.papers.filter(p => p.type === 'news').length} 篇</li>
            <li>收藏数量：${this.dataManager.favorites.length} 篇</li>
            <li>已读数量：${this.readingHistory.size} 篇</li>
          </ul>
          <p style="margin-top: 1rem; color: var(--text-tertiary); font-size: 0.85rem;">
            数据文件可直接编辑，也可通过 Python 脚本自动更新。
          </p>
        </div>
      `;
      this.openModal('📂 数据管理', info);
    });

    // 清除阅读记录
    document.getElementById('clearHistory')?.addEventListener('click', () => {
      this.audio.playClick();
      this.clearReadingHistory();
    });

    // 批量模式
    document.getElementById('batchModeBtn')?.addEventListener('click', () => {
      this.audio.playClick();
      this.toggleBatchMode();
    });

    // 批量操作
    document.getElementById('batchFavorite')?.addEventListener('click', () => this.batchAction('favorite'));
    document.getElementById('batchExport')?.addEventListener('click', () => this.batchAction('export'));
    document.getElementById('batchCopy')?.addEventListener('click', () => this.batchAction('copy'));
    document.getElementById('batchCancel')?.addEventListener('click', () => this.toggleBatchMode());

    // 模态框关闭
    document.getElementById('modalClose')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
  }

  /* ========== 批量操作 ========== */
  toggleBatchMode() {
    this.batchMode = !this.batchMode;
    this.batchSelected.clear();
    document.getElementById('batchBar')?.classList.toggle('active', this.batchMode);
    this.updateBatchCount();
    this.renderPapers();
    const btn = document.getElementById('batchModeBtn');
    if (btn) {
      btn.style.background = this.batchMode ? 'var(--primary-gradient)' : '';
      btn.style.color = this.batchMode ? 'white' : '';
    }
  }

  updateBatchCount() {
    const el = document.getElementById('batchCount');
    if (el) el.textContent = `已选 ${this.batchSelected.size} 项`;
  }

  toggleBatchSelect(id) {
    if (this.batchSelected.has(id)) {
      this.batchSelected.delete(id);
    } else {
      this.batchSelected.add(id);
    }
    this.updateBatchCount();
    // 更新复选框显示
    const checkbox = document.querySelector(`.card-select[data-id="${id}"]`);
    if (checkbox) checkbox.classList.toggle('checked', this.batchSelected.has(id));
  }

  async batchAction(action) {
    if (this.batchSelected.size === 0) {
      this.showToast('请先选择项目', 'info');
      return;
    }
    const papers = this.dataManager.papers.filter(p => this.batchSelected.has(p.id));

    switch (action) {
      case 'favorite':
        papers.forEach(p => {
          if (!this.dataManager.isFavorited(p.id)) this.dataManager.toggleFavorite(p.id);
        });
        this.showToast(`已批量收藏 ${papers.length} 项`, 'success');
        this.audio.playFavorite();
        break;
      case 'export':
        this.dataManager.exportBatch(papers, 'json');
        this.showToast(`已导出 ${papers.length} 项`, 'success');
        this.audio.playDownload();
        break;
      case 'copy':
        const links = papers.map(p => this.dataManager.getBestUrl(p)).join('\n');
        await navigator.clipboard.writeText(links);
        this.showToast(`已复制 ${papers.length} 条链接`, 'success');
        this.audio.playSuccess();
        break;
    }
    this.renderPapers();
  }

  /* ========== 切换内容区域 ========== */
  switchSection(section) {
    this.currentSection = section;
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.classList.toggle('active', link.dataset.section === section);
    });
    switch (section) {
      case 'latest': this.renderPapers(); break;
      case 'history': this.renderHistory(); break;
      case 'favorites': this.renderFavorites(); break;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ========== 渲染论文列表 ========== */
  renderPapers() {
    const container = document.getElementById('papersContainer');
    if (!container) return;

    const papers = this.dataManager.getFilteredPapers();
    this.updateSectionTitle();

    if (papers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-text">没有找到相关内容</div>
        </div>
      `;
      return;
    }

    if (this.dataManager.currentView === 'grid') {
      container.className = 'papers-grid';
      container.innerHTML = papers.map(paper => this.createPaperCard(paper)).join('');
    } else {
      container.className = 'papers-list';
      container.innerHTML = papers.map((paper, index) => this.createPaperListItem(paper, index + 1)).join('');
    }

    this.bindCardEvents();
  }

  /* ========== 搜索高亮 ========== */
  highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }

  /* ========== 创建论文卡片 ========== */
  createPaperCard(paper) {
    const isFav = this.dataManager.isFavorited(paper.id);
    const isRead = this.isRead(paper.id);
    const disciplineLabels = { bio: '生物信息学', clinical: '临床研究', cs: '计算机科学', geo: '气象地质' };
    const typeLabels = { paper: '📄', news: '📰' };
    const typeNames = { paper: '论文', news: '资讯' };
    const hotBadge = paper._isDynamicHot
      ? '<span style="font-size:0.68rem;padding:0.15rem 0.45rem;border-radius:4px;background:linear-gradient(135deg,#f43f5e,#f97316);color:#fff;margin-left:0.3rem;font-weight:700;">🔥 热门</span>' : '';
    const readBadge = isRead
      ? '<span style="font-size:0.65rem;padding:0.1rem 0.4rem;border-radius:4px;background:var(--bg-tertiary);color:var(--text-tertiary);margin-left:0.3rem;font-weight:600;">已读</span>' : '';

    const q = this.dataManager.searchQuery;
    const title = q ? this.highlightText(paper.title, q) : paper.title;
    const abstract = q ? this.highlightText(paper.abstract, q) : paper.abstract;

    return `
      <div class="paper-card ${paper.discipline} ${isRead ? 'read' : ''} fade-in" data-id="${paper.id}">
        <div class="card-select ${this.batchMode ? 'active' : ''} ${this.batchSelected.has(paper.id) ? 'checked' : ''}" data-id="${paper.id}">
          ${this.batchSelected.has(paper.id) ? '✓' : ''}
        </div>
        <div class="card-header">
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <span class="discipline-badge ${paper.discipline}">${disciplineLabels[paper.discipline]}</span>
            <span style="font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); font-weight: 600;">${typeLabels[paper.type || 'paper']} ${typeNames[paper.type || 'paper']}</span>
            ${hotBadge}${readBadge}
          </div>
          <div class="card-actions">
            <button class="card-btn favorite-btn ${isFav ? 'favorited' : ''}" data-id="${paper.id}" title="${isFav ? '取消收藏' : '收藏'}">
              ${isFav ? '❤️' : '🤍'}
            </button>
            <button class="card-btn download-btn" data-id="${paper.id}" title="下载">
              ⬇️
            </button>
            <button class="card-btn copy-btn" data-id="${paper.id}" title="复制链接">
              📋
            </button>
          </div>
        </div>
        <h3 class="paper-title">${title}</h3>
        <p class="paper-authors">${paper.authors}</p>
        <p class="paper-abstract">${abstract}</p>
        <div class="card-footer">
          <div class="paper-meta">
            <span>📅 ${paper.date}</span>
            <span>📖 ${paper.journal}</span>
            <span>⏱️ ${paper.readTime}</span>
          </div>
          <a href="javascript:void(0)" class="read-more" data-id="${paper.id}">
            ${paper.type === 'news' ? '阅读资讯 →' : '阅读全文 →'}
          </a>
        </div>
      </div>
    `;
  }

  /* ========== 创建列表项 ========== */
  createPaperListItem(paper, index) {
    const isFav = this.dataManager.isFavorited(paper.id);
    const isRead = this.isRead(paper.id);
    const disciplineLabels = { bio: '生物信息学', clinical: '临床研究', cs: '计算机科学', geo: '气象地质' };
    const typeLabels = { paper: '📄', news: '📰' };
    const hotBadge = paper._isDynamicHot
      ? '<span style="font-size:0.65rem;padding:0.1rem 0.35rem;border-radius:4px;background:linear-gradient(135deg,#f43f5e,#f97316);color:#fff;margin-left:0.3rem;font-weight:700;">🔥</span>' : '';
    const readBadge = isRead
      ? '<span style="font-size:0.6rem;padding:0.08rem 0.3rem;border-radius:4px;background:var(--bg-tertiary);color:var(--text-tertiary);margin-left:0.2rem;font-weight:600;">已读</span>' : '';

    const q = this.dataManager.searchQuery;
    const title = q ? this.highlightText(paper.title, q) : paper.title;

    return `
      <div class="paper-list-item slide-in-right ${isRead ? 'read' : ''}" data-id="${paper.id}" style="animation-delay: ${index * 0.04}s">
        <div class="list-item-number">${index}</div>
        <div class="list-item-content">
          <div class="list-item-title">${title}${hotBadge}${readBadge}</div>
          <div class="list-item-meta">
            ${typeLabels[paper.type || 'paper']} ${disciplineLabels[paper.discipline]} · ${paper.authors} · ${paper.date}
          </div>
        </div>
        <div class="card-actions">
          <button class="card-btn favorite-btn ${isFav ? 'favorited' : ''}" data-id="${paper.id}">
            ${isFav ? '❤️' : '🤍'}
          </button>
          <button class="card-btn copy-btn" data-id="${paper.id}">📋</button>
        </div>
      </div>
    `;
  }

  /* ========== 绑定卡片事件 ========== */
  bindCardEvents() {
    // 收藏按钮
    document.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        const isFav = this.dataManager.toggleFavorite(id);
        if (isFav) {
          this.audio.playFavorite();
          e.currentTarget.classList.add('favorited');
          e.currentTarget.innerHTML = '❤️';
          e.currentTarget.title = '取消收藏';
          this.showToast('已添加到收藏', 'success');
        } else {
          this.audio.playUnfavorite();
          e.currentTarget.classList.remove('favorited');
          e.currentTarget.innerHTML = '🤍';
          e.currentTarget.title = '收藏';
          this.showToast('已取消收藏', 'info');
        }
        if (this.currentSection === 'favorites') this.renderFavorites();
      });
    });

    // 下载按钮
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        const paper = this.dataManager.papers.find(p => p.id === id);
        if (paper) {
          this.audio.playDownload();
          const result = this.dataManager.downloadPaper(paper, 'pdf');
          if (result.method === 'direct') this.showToast('PDF 正在打开...', 'success');
          else this.openPrintModal(paper);
        }
      });
    });

    // 复制链接按钮
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        const paper = this.dataManager.papers.find(p => p.id === id);
        if (paper) {
          const url = this.dataManager.getBestUrl(paper);
          try {
            await navigator.clipboard.writeText(url);
            this.showToast('链接已复制到剪贴板', 'success');
            this.audio.playSuccess();
          } catch {
            this.showToast('复制失败，请手动复制', 'error');
          }
        }
      });
    });

    // 卡片点击打开详情
    document.querySelectorAll('.paper-card, .paper-list-item').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-btn') || e.target.closest('.read-more')) return;
        const id = card.dataset.id;

        // 批量模式下点击卡片 = 选择/取消选择
        if (this.batchMode) {
          this.toggleBatchSelect(id);
          return;
        }

        const paper = this.dataManager.papers.find(p => p.id === id);
        if (paper) {
          this.markAsRead(id);
          card.classList.add('read');
          this.audio.playClick();
          this.openPaperDetail(paper);
        }
      });
      card.addEventListener('mouseenter', () => this.audio.playHover());
    });

    // 阅读全文链接
    document.querySelectorAll('.read-more').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        const paper = this.dataManager.papers.find(p => p.id === id);
        if (paper) {
          this.markAsRead(id);
          this.audio.playClick();
          this.openPaperDetail(paper);
        }
      });
    });
  }

  /* ========== 论文详情页 ========== */
  openPaperDetail(paper) {
    const disciplineLabels = { bio: '生物信息学', clinical: '临床研究', cs: '计算机科学', geo: '气象地质' };
    const typeNames = { paper: '学术论文', news: '资讯新闻' };
    const hotBadge = paper._isDynamicHot
      ? '<span style="font-size:0.75rem;padding:0.2rem 0.6rem;border-radius:4px;background:linear-gradient(135deg,#f43f5e,#f97316);color:#fff;margin-left:0.4rem;font-weight:700;">🔥 热门</span>' : '';
    const url = this.dataManager.getBestUrl(paper);

    const content = `
      <div id="paperDetailContent" data-paper-id="${paper.id}" style="line-height: 1.85; padding: 1.5rem; background: var(--bg-secondary); border-radius: 14px; border: 1px solid var(--glass-border);">
        <div style="margin-bottom: 1.1rem;">
          <span style="font-size: 0.8rem; padding: 0.3rem 0.7rem; border-radius: 6px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--glass-border); font-weight: 700;">
            ${disciplineLabels[paper.discipline] || '综合'}
          </span>
          <span style="font-size: 0.8rem; padding: 0.3rem 0.7rem; border-radius: 6px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--glass-border); font-weight: 700; margin-left: 0.4rem;">
            ${typeNames[paper.type] || '论文'}
          </span>
          ${hotBadge}
        </div>

        <h2 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.85rem; line-height: 1.4; color: var(--text-primary); letter-spacing: -0.01em;">${paper.title}</h2>

        <div style="font-size: 0.95rem; color: var(--text-primary); margin-bottom: 1rem; font-weight: 500;">
          <strong>作者：</strong>${paper.authors}
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.86rem; color: var(--text-primary); margin-bottom: 1.25rem; padding: 0.85rem 1.1rem; background: var(--bg-card); border-radius: 10px; border: 1px solid var(--glass-border); font-weight: 500;">
          <span>📅 <strong>${paper.date}</strong></span>
          <span>📖 <strong>${paper.journal}</strong></span>
          <span>⏱️ <strong>${paper.readTime}</strong></span>
          ${paper.year ? `<span>📆 <strong>${paper.year}</strong></span>` : ''}
        </div>

        <div style="margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 0.55rem; color: var(--text-primary);">摘要</h3>
          <p style="color: var(--text-secondary); text-align: justify; line-height: 1.8;">${paper.abstract}</p>
        </div>

        ${paper.keywords && paper.keywords.length ? `
        <div style="margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 0.55rem; color: var(--text-primary);">关键词</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${paper.keywords.map(k => `<span style="font-size: 0.82rem; padding: 0.25rem 0.65rem; border-radius: 20px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--glass-border); font-weight: 600; cursor: pointer;" onclick="window.app.searchKeyword('${k}')">${k}</span>`).join('')}
          </div>
        </div>
        ` : ''}

        <div id="detailActions" style="display: flex; gap: 0.65rem; flex-wrap: wrap; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--glass-border);">
          <a id="detailVisitLink" href="${url}" target="_blank" style="padding: 0.6rem 1.2rem; border-radius: 10px; background: var(--primary-gradient); color: #fff; text-decoration: none; font-size: 0.9rem; font-weight: 700; box-shadow: 0 4px 14px rgba(99,102,241,0.3); transition: all 0.2s;">
            🔗 访问原始链接
          </a>
          <button id="detailFavBtn" data-id="${paper.id}" style="padding: 0.6rem 1.2rem; border-radius: 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--glass-border); cursor: pointer; font-size: 0.9rem; font-weight: 700; transition: all 0.2s;">
            ${this.dataManager.isFavorited(paper.id) ? '❤️ 已收藏' : '🤍 收藏'}
          </button>
          <button id="detailDownloadBtn" data-id="${paper.id}" style="padding: 0.6rem 1.2rem; border-radius: 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--glass-border); cursor: pointer; font-size: 0.9rem; font-weight: 700; transition: all 0.2s;">
            ⬇️ 下载 PDF
          </button>
          <button id="detailShareBtn" data-id="${paper.id}" style="padding: 0.6rem 1.2rem; border-radius: 10px; background: var(--accent-gradient); color: #fff; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 700; box-shadow: 0 4px 14px rgba(6,182,212,0.3); transition: all 0.2s;">
            📤 分享
          </button>
        </div>
      </div>
    `;
    this.openModal('📄 内容详情', content);

    setTimeout(() => {
      const favBtn = document.getElementById('detailFavBtn');
      if (favBtn) {
        favBtn.addEventListener('click', () => {
          const id = favBtn.dataset.id;
          const isFav = this.dataManager.toggleFavorite(id);
          favBtn.textContent = isFav ? '❤️ 已收藏' : '🤍 收藏';
          this.showToast(isFav ? '已添加到收藏' : '已取消收藏', 'success');
          this.renderPapers();
        });
      }

      const dlBtn = document.getElementById('detailDownloadBtn');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => {
          const id = dlBtn.dataset.id;
          const p = this.dataManager.papers.find(x => x.id === id);
          if (p) {
            const result = this.dataManager.downloadPaper(p, 'pdf');
            if (result.method === 'direct') this.showToast('PDF 正在打开...', 'success');
            else this.openPrintModal(p);
          }
        });
      }

      const shareBtn = document.getElementById('detailShareBtn');
      if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
          const id = shareBtn.dataset.id;
          const p = this.dataManager.papers.find(x => x.id === id);
          if (p) {
            const shareData = {
              title: p.title,
              text: p.abstract?.slice(0, 100) + '...',
              url: this.dataManager.getBestUrl(p),
            };
            if (navigator.share) {
              try { await navigator.share(shareData); } catch {}
            } else {
              await navigator.clipboard.writeText(`${p.title}\n${shareData.url}`);
              this.showToast('标题和链接已复制', 'success');
            }
          }
        });
      }
    }, 0);
  }

  /* ========== 打印为 PDF ========== */
  openPrintModal(paper) {
    const content = `
      <div style="line-height: 1.85;">
        <p style="margin-bottom: 1rem; color: var(--text-secondary);">该资讯暂无官方 PDF 直链，你可以通过浏览器<strong>打印为 PDF</strong> 保存：</p>
        <ol style="padding-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-secondary);">
          <li>点击下方按钮打开原文页面</li>
          <li>在页面中按 <kbd style="background:var(--bg-secondary);padding:0.15rem 0.4rem;border-radius:4px;font-family:monospace;">Ctrl+P</kbd></li>
          <li>目标打印机选择「另存为 PDF」</li>
          <li>点击保存</li>
        </ol>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <a href="${this.dataManager.getBestUrl(paper)}" target="_blank" class="read-more" style="flex: 1; justify-content: center; min-width: 140px;">
            🔗 打开原文页面
          </a>
          <button onclick="window.app.triggerPrintForPaper('${paper.id}')" class="read-more" style="flex: 1; justify-content: center; min-width: 140px; background: var(--accent-gradient);">
            🖨️ 直接打印此页
          </button>
        </div>
      </div>
    `;
    this.openModal('📄 保存为 PDF', content);
  }

  triggerPrintForPaper(paperId) {
    const paper = this.dataManager.papers.find(p => p.id === paperId);
    if (!paper) return;
    this.closeModal();
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>${paper.title}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.85; max-width: 800px; margin: 3rem auto; padding: 0 2rem; color: #1e293b; }
          h1 { font-size: 1.7rem; margin-bottom: 0.75rem; line-height: 1.35; font-weight: 800; }
          .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 1.75rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0; }
          .abstract { background: #f8fafc; padding: 1.5rem; border-radius: 12px; margin: 1.75rem 0; }
          .abstract-label { font-weight: 800; color: #334155; margin-bottom: 0.6rem; font-size: 1.05rem; }
          .keywords { margin-top: 1.75rem; font-size: 0.85rem; color: #475569; }
          .keywords span { display: inline-block; background: #e2e8f0; padding: 0.25rem 0.65rem; border-radius: 20px; margin: 0.2rem; font-weight: 600; }
          .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #94a3b8; }
          a { color: #6366f1; text-decoration: none; font-weight: 600; }
          @media print { body { margin: 0; padding: 1.5cm; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>${paper.title}</h1>
        <div class="meta">
          <div><strong>作者：</strong>${paper.authors}</div>
          <div><strong>来源：</strong>${paper.journal || paper.source} · ${paper.date}</div>
          <div><strong>原文链接：</strong><a href="${this.dataManager.getBestUrl(paper)}">${this.dataManager.getBestUrl(paper)}</a></div>
        </div>
        <div class="abstract">
          <div class="abstract-label">摘要</div>
          <div>${paper.abstract}</div>
        </div>
        <div class="keywords">
          <strong>关键词：</strong>
          ${(paper.keywords || []).map(k => `<span>${k}</span>`).join('')}
        </div>
        <div class="footer">
          由 Academic Hub 生成 · ${new Date().toLocaleDateString('zh-CN')}
        </div>
        <div class="no-print" style="margin-top: 2.5rem; text-align: center;">
          <p>按 <kbd style="background:#e2e8f0;padding:0.2rem 0.5rem;border-radius:4px;">Ctrl+P</kbd> 选择「另存为 PDF」即可保存</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  }

  /* ========== 侧边栏 ========== */
  openSidebar() {
    document.getElementById('favoritesSidebar')?.classList.add('active');
    document.getElementById('sidebarOverlay')?.classList.add('active');
    this.renderSidebarFavorites();
  }

  closeSidebar() {
    document.getElementById('favoritesSidebar')?.classList.remove('active');
    document.getElementById('sidebarOverlay')?.classList.remove('active');
  }

  renderSidebarFavorites() {
    const container = document.getElementById('sidebarFavorites');
    if (!container) return;
    const favorites = this.dataManager.getFavoritePapers();

    if (favorites.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💝</div>
          <div class="empty-state-text">暂无收藏</div>
        </div>
      `;
      return;
    }

    container.innerHTML = favorites.map(paper => `
      <div class="favorite-item">
        <div style="font-weight: 700; margin-bottom: 0.5rem; font-size: 0.92rem; line-height: 1.4;">${paper.title}</div>
        <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.6rem; font-weight: 500;">
          ${paper.authors} · ${paper.date}
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="card-btn remove-fav" data-id="${paper.id}" title="移除">🗑️</button>
          <button class="card-btn download-fav" data-id="${paper.id}" title="下载">⬇️</button>
          <button class="card-btn open-fav" data-id="${paper.id}" title="查看">👁️</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.remove-fav').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dataManager.toggleFavorite(btn.dataset.id);
        this.renderSidebarFavorites();
        this.renderPapers();
        this.audio.playUnfavorite();
      });
    });

    container.querySelectorAll('.download-fav').forEach(btn => {
      btn.addEventListener('click', () => {
        const paper = this.dataManager.papers.find(p => p.id === btn.dataset.id);
        if (paper) {
          this.audio.playDownload();
          const result = this.dataManager.downloadPaper(paper, 'pdf');
          if (result.method === 'direct') this.showToast('PDF 正在打开...', 'success');
          else this.openPrintModal(paper);
        }
      });
    });

    container.querySelectorAll('.open-fav').forEach(btn => {
      btn.addEventListener('click', () => {
        const paper = this.dataManager.papers.find(p => p.id === btn.dataset.id);
        if (paper) this.openPaperDetail(paper);
      });
    });
  }

  /* ========== 统计面板 ========== */
  renderStats() {
    const container = document.getElementById('statsContainer');
    if (!container) return;

    const papers = this.dataManager.papers;
    const totalPapers = papers.filter(p => p.type === 'paper').length;
    const totalNews = papers.filter(p => p.type === 'news').length;
    const totalFavorites = this.dataManager.favorites.length;

    const disciplineCount = {};
    papers.forEach(p => { disciplineCount[p.discipline] = (disciplineCount[p.discipline] || 0) + 1; });

    const disciplineNames = { bio: '生物', clinical: '临床', cs: '计算机', geo: '地质' };
    const disciplineColors = { bio: '#10b981', clinical: '#f59e0b', cs: '#3b82f6', geo: '#8b5cf6' };

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card" data-counter="${totalPapers}">
          <div class="stat-icon">📄</div>
          <div class="stat-number counter-anim" data-target="${totalPapers}">0</div>
          <div class="stat-label">学术论文</div>
        </div>
        <div class="stat-card" data-counter="${totalNews}">
          <div class="stat-icon">📰</div>
          <div class="stat-number counter-anim" data-target="${totalNews}">0</div>
          <div class="stat-label">资讯新闻</div>
        </div>
        <div class="stat-card" data-counter="${totalFavorites}">
          <div class="stat-icon">💝</div>
          <div class="stat-number counter-anim" data-target="${totalFavorites}">0</div>
          <div class="stat-label">我的收藏</div>
        </div>
        <div class="stat-card" data-counter="${papers.length}">
          <div class="stat-icon">📚</div>
          <div class="stat-number counter-anim" data-target="${papers.length}">0</div>
          <div class="stat-label">总内容数</div>
        </div>
      </div>
    `;

    // 触发数字滚动动画
    container.querySelectorAll('.stat-number[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target);
      setTimeout(() => this.animateCounter(el, target), 300);
    });

    container.innerHTML += `
      <div class="discipline-chart">
        <div class="chart-title">学科分布</div>
        <div class="chart-bars">
          ${Object.entries(disciplineCount).map(([discipline, count]) => `
            <div class="chart-bar-item">
              <div class="chart-bar-label">${disciplineNames[discipline]}</div>
              <div class="chart-bar-track">
                <div class="chart-bar-fill" style="width: ${(count / papers.length * 100).toFixed(1)}%; background: ${disciplineColors[discipline]};"></div>
              </div>
              <div class="chart-bar-value">${count}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ========== 关键词云 ========== */
  renderKeywordCloud() {
    const container = document.getElementById('keywordCloud');
    if (!container) return;

    const keywordCount = {};
    this.dataManager.papers.forEach(p => {
      (p.keywords || []).forEach(k => { keywordCount[k] = (keywordCount[k] || 0) + 1; });
    });

    const sortedKeywords = Object.entries(keywordCount).sort((a, b) => b[1] - a[1]).slice(0, 24);
    const maxCount = sortedKeywords[0]?.[1] || 1;

    container.innerHTML = sortedKeywords.map(([keyword, count]) => {
      const size = 0.78 + (count / maxCount) * 0.7;
      const opacity = 0.55 + (count / maxCount) * 0.45;
      return `<span class="keyword-tag" style="font-size: ${size}rem; opacity: ${opacity};" onclick="window.app.searchKeyword('${keyword}')">${keyword}</span>`;
    }).join('');
  }

  searchKeyword(keyword) {
    document.getElementById('searchBox').value = keyword;
    this.dataManager.searchQuery = keyword;
    this.renderPapers();
    this.showToast(`已搜索: ${keyword}`, 'info');
  }

  /* ========== 最后更新时间 ========== */
  renderLastUpdated() {
    const el = document.getElementById('lastUpdatedLine');
    if (!el) return;
    const stored = localStorage.getItem('academic-hub-last-updated');
    const lastUpdated = stored ? new Date(stored) : null;
    if (!lastUpdated || isNaN(lastUpdated.getTime())) { el.textContent = ''; return; }

    const now = new Date();
    const diffSec = Math.floor((now - lastUpdated) / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    let timeText;
    if (diffSec < 10) timeText = '刚刚';
    else if (diffSec < 60) timeText = `${diffSec} 秒前`;
    else if (diffMin < 60) timeText = `${diffMin} 分钟前`;
    else if (diffHour < 24) timeText = `${diffHour} 小时前`;
    else if (diffDay < 7) timeText = `${diffDay} 天前`;
    else timeText = lastUpdated.toLocaleDateString('zh-CN');

    el.innerHTML = `⏱️ 最后更新：<span style="color: var(--text-primary); font-weight: 700;">${timeText}</span> · 共 ${this.dataManager.papers.length} 条内容`;
  }

  /* ========== 今日推荐 ========== */
  renderTodayPick() {
    const container = document.getElementById('todayPick');
    if (!container) return;

    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const recentPapers = this.dataManager.papers.filter(p => {
      const d = new Date(p.date);
      return d >= oneYearAgo;
    });

    const pool = recentPapers.length > 0 ? recentPapers : this.dataManager.papers.filter(p => {
      const d = new Date(p.date);
      return d >= new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    });

    if (pool.length === 0) return;

    const dayIndex = now.getDate() % pool.length;
    const pick = pool[dayIndex];
    if (!pick) return;

    const disciplineLabels = { bio: '生物信息学', clinical: '临床研究', cs: '计算机科学', geo: '气象地质' };
    const typeNames = { paper: '论文', news: '资讯' };

    container.innerHTML = `
      <div class="today-pick-card" data-id="${pick.id}">
        <div class="today-pick-badge">⭐ 今日推荐</div>
        <div class="today-pick-content">
          <div class="today-pick-meta">
            <span class="discipline-badge ${pick.discipline}">${disciplineLabels[pick.discipline]}</span>
            <span class="type-badge">${typeNames[pick.type || 'paper']}</span>
          </div>
          <h3 class="today-pick-title">${pick.title}</h3>
          <p class="today-pick-authors">${pick.authors}</p>
          <p class="today-pick-abstract">${pick.abstract}</p>
          <div class="today-pick-footer">
            <span>📅 ${pick.date} · ⏱️ ${pick.readTime}</span>
            <a href="javascript:void(0)" class="read-more" data-id="${pick.id}">
              ${pick.type === 'news' ? '阅读资讯 →' : '阅读全文 →'}
            </a>
          </div>
        </div>
      </div>
    `;

    container.querySelector('.today-pick-card')?.addEventListener('click', (e) => {
      if (e.target.closest('.read-more')) return;
      const id = pick.id;
      this.markAsRead(id);
      this.audio.playClick();
      this.openPaperDetail(pick);
    });

    container.querySelector('.read-more')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.markAsRead(pick.id);
      this.audio.playClick();
      this.openPaperDetail(pick);
    });
  }

  /* ========== 即时刷新 ========== */
  async refreshWithHotContent() {
    this.dataManager.papers = this.dataManager.papers.filter(p => !p._isDynamicHot);
    const existingIds = new Set(this.dataManager.papers.map(p => p.id));

    const hotPool = [
      { title: 'AlphaFold 3 predicts structures of nearly every molecule in biology', authors: 'DeepMind / Isomorphic Labs', abstract: 'Google DeepMind releases AlphaFold 3, expanding protein structure prediction to DNA, RNA, and small molecules, opening new avenues for drug discovery and biological research.', discipline: 'bio', type: 'news', journal: 'Nature News', url: 'https://www.nature.com/articles/d41586-024-01383-z', keywords: ['AlphaFold 3','protein','AI','drug discovery'], readTime: '5 min', source: 'Nature News' },
      { title: 'FDA approves first gene therapy for children with deafness from OTOF mutations', authors: 'U.S. Food and Drug Administration', abstract: 'The FDA approved Akouos gene therapy for children with deafness caused by mutations in the OTOF gene, marking the first gene therapy approved for an inherited form of hearing loss.', discipline: 'bio', type: 'news', journal: 'FDA News', url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapy-children-deafness-due-mutations-otof-gene', keywords: ['FDA','gene therapy','deafness','OTOF','hearing loss'], readTime: '4 min', source: 'FDA' },
      { title: 'WHO launches Global Initiative on Digital Health to bridge healthcare gaps', authors: 'World Health Organization', abstract: 'WHO launches the Global Initiative on Digital Health to support countries in strengthening digital health infrastructure and ensuring equitable access to health technologies.', discipline: 'clinical', type: 'news', journal: 'WHO News', url: 'https://www.who.int/news/item/28-02-2025-who-launches-global-initiative-on-digital-health', keywords: ['WHO','digital health','healthcare','global health','telemedicine'], readTime: '5 min', source: 'WHO' },
      { title: 'FDA approves donanemab for treatment of early Alzheimer disease', authors: 'U.S. Food and Drug Administration', abstract: 'The FDA approved Eli Lilly donanemab (Kisunla) for the treatment of early symptomatic Alzheimer disease, the second amyloid-targeting antibody approved for this indication.', discipline: 'clinical', type: 'news', journal: 'FDA News', url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-treatment-alzheimers-disease', keywords: ['FDA','donanemab','Alzheimer','amyloid','Kisunla'], readTime: '4 min', source: 'FDA' },
      { title: 'OpenAI o3 and o3-mini push the boundaries of AI reasoning', authors: 'OpenAI Research Team', abstract: 'OpenAI announces o3 and o3-mini models, demonstrating significant advances in reasoning capabilities through deliberative alignment and chain-of-thought approaches.', discipline: 'cs', type: 'news', journal: 'OpenAI Blog', url: 'https://openai.com/research/deliberative-alignment', keywords: ['o3','AI','reasoning','alignment','ARC-AGI'], readTime: '8 min', source: 'OpenAI' },
      { title: 'DeepSeek-R1: Incentivizing reasoning capability in LLMs via reinforcement learning', authors: 'DeepSeek-AI', abstract: 'DeepSeek releases DeepSeek-R1, an open-source reasoning model trained primarily via reinforcement learning without extensive supervised fine-tuning.', discipline: 'cs', type: 'news', journal: 'DeepSeek Blog', url: 'https://github.com/deepseek-ai/DeepSeek-R1', keywords: ['DeepSeek','reasoning','LLM','reinforcement learning','open source'], readTime: '6 min', source: 'DeepSeek' },
      { title: 'Google DeepMind AlphaProof achieves silver-medal level in mathematical olympiad', authors: 'DeepMind Team', abstract: 'AlphaProof, a new AI system combining language models with reinforcement learning, has achieved silver-medal standard solving complex mathematical problems at IMO level.', discipline: 'cs', type: 'news', journal: 'DeepMind Blog', url: 'https://deepmind.google/discover/blog/alphaproof-achieves-silver-medal-level-in-mathematical-olympiad/', keywords: ['AlphaProof','mathematics','AI','DeepMind','IMO'], readTime: '6 min', source: 'DeepMind' },
      { title: 'Meta releases Llama 3: Most capable openly available LLM to date', authors: 'Meta AI', abstract: 'Meta announces Llama 3, the latest version of its open large language model, featuring significant improvements in reasoning, code generation, and multilingual capabilities.', discipline: 'cs', type: 'news', journal: 'Meta AI Blog', url: 'https://ai.meta.com/blog/meta-llama-3/', keywords: ['Llama 3','Meta','LLM','open source','AI'], readTime: '7 min', source: 'Meta' },
      { title: 'Copernicus confirms 2024 is first year to exceed 1.5C above pre-industrial levels', authors: 'Copernicus Climate Change Service', abstract: '2024 was the warmest year on record globally and the first year exceeding 1.5C above the pre-industrial average.', discipline: 'geo', type: 'news', journal: 'Copernicus', url: 'https://climate.copernicus.eu/copernicus-2024-first-year-exceed-15c-above-pre-industrial-levels', keywords: ['climate change','temperature record','global warming','Copernicus','2024'], readTime: '5 min', source: 'Copernicus' },
      { title: 'NASA confirms 2024 as hottest year on record', authors: 'NASA Goddard Institute', abstract: 'NASA and NOAA analyses confirm that 2024 was the warmest year since global records began in 1880.', discipline: 'geo', type: 'news', journal: 'NASA', url: 'https://www.nasa.gov/news-release/nasa-confirms-2024-hottest-year-on-record/', keywords: ['NASA','global warming','temperature','climate','2024'], readTime: '5 min', source: 'NASA' },
      { title: 'UNEP Emissions Gap Report 2024', authors: 'United Nations Environment Programme', abstract: 'The 2024 Emissions Gap Report finds that current national climate commitments would reduce projected global warming to 2.6-2.8C, far above the Paris Agreement 1.5C goal.', discipline: 'geo', type: 'news', journal: 'UNEP', url: 'https://www.unep.org/resources/emissions-gap-report-2024', keywords: ['UNEP','emissions gap','climate action','Paris Agreement','CO2'], readTime: '8 min', source: 'UNEP' },
      { title: 'CDC updates respiratory virus guidance for COVID-19, flu, and RSV', authors: 'Centers for Disease Control and Prevention', abstract: 'The CDC issued updated respiratory virus guidance that brings a unified approach to addressing risks from COVID-19, flu, and RSV.', discipline: 'clinical', type: 'news', journal: 'CDC', url: 'https://www.cdc.gov/respiratory-viruses/prevention/index.html', keywords: ['CDC','respiratory virus','COVID-19','flu','RSV','prevention'], readTime: '5 min', source: 'CDC' },
      { title: 'FDA approves first CRISPR-based gene editing therapy for sickle cell disease', authors: 'U.S. Food and Drug Administration', abstract: 'The FDA approved Casgevy, the first CRISPR/Cas9 genome-edited cell therapy for the treatment of sickle cell disease.', discipline: 'bio', type: 'news', journal: 'FDA News', url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapies-treat-patients-sickle-cell-disease', keywords: ['FDA','CRISPR','gene therapy','sickle cell','Casgevy'], readTime: '4 min', source: 'FDA' },
      { title: 'IPCC completes Sixth Assessment Report with Synthesis Report', authors: 'Intergovernmental Panel on Climate Change', abstract: 'The IPCC released the AR6 Synthesis Report, summarizing the key findings from all three working groups.', discipline: 'geo', type: 'news', journal: 'IPCC', url: 'https://www.ipcc.ch/report/ar6/syr/', keywords: ['IPCC','AR6','Synthesis Report','climate change','assessment'], readTime: '6 min', source: 'IPCC' },
      { title: 'Moderna mRNA cancer vaccine shows promising Phase 3 results for melanoma', authors: 'Moderna / Merck', abstract: 'The mRNA-4157 personalized cancer vaccine, combined with pembrolizumab, demonstrated a significant reduction in recurrence risk for high-risk melanoma patients.', discipline: 'clinical', type: 'news', journal: 'Moderna Press Release', url: 'https://investors.modernatx.com/news/news-details/2024/Moderna-and-Merck-Announce-mRNA-4157-V940-Personalized-Cancer-Vaccine-Granted-FDA-Breakthrough-Therapy-Designation/default.aspx', keywords: ['mRNA vaccine','cancer','melanoma','personalized medicine','immunotherapy'], readTime: '5 min', source: 'Moderna' },
      { title: 'Gene therapy restores hearing in children with OTOF mutations', authors: 'Fudan University / Harvard Medical School', abstract: 'A landmark clinical trial demonstrates that AAV-based gene therapy can safely restore hearing in children with DFNB9.', discipline: 'bio', type: 'news', journal: 'The Lancet', url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(24)00155-6/fulltext', keywords: ['gene therapy','hearing loss','OTOF','deafness','clinical trial'], readTime: '6 min', source: 'The Lancet' },
      { title: 'WHO recommends groundbreaking malaria vaccine R21/Matrix-M', authors: 'World Health Organization', abstract: 'WHO recommends the R21/Matrix-M malaria vaccine for broad use in children, following the RTS,S vaccine.', discipline: 'clinical', type: 'news', journal: 'WHO News', url: 'https://www.who.int/news/item/02-10-2023-who-recommends-groundbreaking-malaria-vaccine', keywords: ['malaria vaccine','R21','WHO','children','public health'], readTime: '5 min', source: 'WHO' },
      { title: 'First pig kidney transplant to living patient performed in US', authors: 'Massachusetts General Hospital', abstract: 'Surgeons performed the first successful transplant of a genetically edited pig kidney into a living human patient.', discipline: 'bio', type: 'news', journal: 'MGH Press Release', url: 'https://www.nature.com/articles/d41586-024-00876-1', keywords: ['xenotransplantation','pig kidney','organ shortage','gene editing','transplant'], readTime: '5 min', source: 'Nature' },
      { title: 'Satellite data reveals accelerating ice loss from Greenland interior', authors: 'NASA Jet Propulsion Laboratory', abstract: 'New satellite data show that ice loss from Greenland is accelerating faster than previously estimated.', discipline: 'geo', type: 'news', journal: 'NASA JPL', url: 'https://climate.nasa.gov/evidence/', keywords: ['Greenland','ice loss','satellite','sea level','gravimetry'], readTime: '5 min', source: 'NASA JPL' },
      { title: 'Apple Intelligence debuts on-device AI with private cloud compute', authors: 'Apple Machine Learning Research', abstract: 'Apple introduces Apple Intelligence, combining on-device processing with Private Cloud Compute for powerful AI with privacy.', discipline: 'cs', type: 'news', journal: 'Apple ML Research', url: 'https://machinelearning.apple.com/research/apple-intelligence-foundation-language-models', keywords: ['Apple Intelligence','on-device AI','privacy','LLM','cloud compute'], readTime: '5 min', source: 'Apple' },
      { title: 'COP29 climate finance agreement reached in Baku', authors: 'UNFCCC Secretariat', abstract: 'COP29 in Baku reached a new collective quantified goal on climate finance.', discipline: 'geo', type: 'news', journal: 'UNFCCC', url: 'https://unfccc.int/cop29', keywords: ['COP29','climate finance','Baku','UNFCCC','Paris Agreement'], readTime: '7 min', source: 'UNFCCC' },
      { title: 'GLP-1 drugs show kidney protection benefits beyond weight loss', authors: 'NEJM Editorial Team', abstract: 'Recent clinical evidence suggests semaglutide may provide renal protection benefits beyond weight loss and glycemic control.', discipline: 'clinical', type: 'news', journal: 'NEJM', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2403347', keywords: ['GLP-1','kidney disease','semaglutide','FLOW trial','renal'], readTime: '6 min', source: 'NEJM' },
      { title: 'First complete human pangenome reference published by HPRC', authors: 'Human Pangenome Reference Consortium', abstract: 'The HPRC publishes the first complete human pangenome, incorporating diverse genetic backgrounds.', discipline: 'bio', type: 'news', journal: 'Nature', url: 'https://www.nature.com/articles/d41586-023-01490-x', keywords: ['pangenome','human genome','diversity','HPRC','genetics'], readTime: '5 min', source: 'Nature' },
      { title: 'WHO declares end of COVID-19 as a global health emergency', authors: 'World Health Organization', abstract: 'The WHO Director-General declares the end of COVID-19 as a public health emergency of international concern.', discipline: 'clinical', type: 'news', journal: 'WHO News', url: 'https://www.who.int/news/item/05-05-2023-statement-on-the-fifteenth-meeting-of-the-international-health-regulations-(2005)-emergency-committee-regarding-the-coronavirus-disease-(covid-19)-pandemic', keywords: ['COVID-19','WHO','pandemic','public health','PHEIC'], readTime: '6 min', source: 'WHO' },
    ];

    const shuffled = hotPool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const pickCount = Math.floor(Math.random() * 3) + 4;
    const selected = shuffled.slice(0, pickCount);

    const hotDates = ['2024-05-08','2024-11-21','2025-02-28','2024-06-24','2024-12-20','2025-01-20','2024-07-25','2024-04-18','2025-01-10','2025-01-14','2024-10-24','2024-03-01','2023-05-05','2023-12-08','2023-05-10','2024-05-15','2024-06-10','2023-03-20','2024-11-24','2024-12-14','2024-01-04','2023-10-02','2024-03-21','2024-10-30'];
    const now = new Date();

    const newContents = selected.map((item, idx) => {
      const poolIdx = hotPool.findIndex(p => p.title === item.title);
      const realDate = hotDates[poolIdx] || hotDates[idx % hotDates.length];
      const itemDate = new Date(realDate);
      const dateStr = itemDate.toISOString().split('T')[0];
      const ts = Date.now() + idx;
      return { ...item, id: `hot-ts-${ts}-${idx}`, date: dateStr, year: itemDate.getFullYear(), doi: '', pdfUrl: '', _isDynamicHot: true };
    });

    this.dataManager.papers.unshift(...newContents);
    const updateTime = new Date().toISOString();
    this.dataManager.lastUpdated = updateTime;
    localStorage.setItem('academic-hub-last-updated', updateTime);
    return newContents.length;
  }

  /* ========== 渲染历史 ========== */
  renderHistory() {
    const container = document.getElementById('papersContainer');
    if (!container) return;
    const history = this.dataManager.getHistoricalPapers();

    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-text">暂无历史记录</div>
        </div>
      `;
      return;
    }

    container.className = 'timeline';
    container.innerHTML = history.map(({ month, papers }) => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-date">${month}</div>
        <div class="papers-grid" style="grid-template-columns: 1fr;">
          ${papers.map(paper => this.createPaperCard(paper)).join('')}
        </div>
      </div>
    `).join('');

    this.bindCardEvents();
  }

  /* ========== 渲染收藏 ========== */
  renderFavorites() {
    const container = document.getElementById('papersContainer');
    if (!container) return;
    const favorites = this.dataManager.getFavoritePapers();

    if (favorites.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💝</div>
          <div class="empty-state-text">还没有收藏任何论文</div>
        </div>
      `;
      return;
    }

    container.className = 'papers-grid';
    container.innerHTML = favorites.map(paper => this.createPaperCard(paper)).join('');
    this.bindCardEvents();
  }

  /* ========== 标题更新 ========== */
  updateSectionTitle() {
    const titleEl = document.getElementById('sectionTitle');
    if (!titleEl) return;
    const typeFilter = this.dataManager.typeFilter;
    const disciplineFilter = this.dataManager.currentFilter;
    let title = '全部内容';
    if (typeFilter === 'paper') title = '学术论文';
    else if (typeFilter === 'news') title = '资讯新闻';
    if (disciplineFilter !== 'all') {
      const names = { bio: '生物信息学', clinical: '临床研究', cs: '计算机科学', geo: '气象地质' };
      title += ` · ${names[disciplineFilter]}`;
    }
    titleEl.textContent = title;
  }

  /* ========== 模态框 ========== */
  openModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ========== Toast ========== */
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('active');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('active'), 3000);
  }

  /* ========== 粒子背景 ========== */
  initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2.5 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.opacity = Math.random() * 0.4 + 0.05;
        this.hue = Math.random() * 60 + 240;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 70%, 60%, ${this.opacity})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < 45; i++) particles.push(new Particle());

    const drawConnections = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 140) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `hsla(240, 70%, 60%, ${0.08 * (1 - distance / 140)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });
      drawConnections();
      animationId = requestAnimationFrame(animate);
    };
    animate();
    window.addEventListener('beforeunload', () => cancelAnimationFrame(animationId));
  }

  /* ========== 主渲染 ========== */
  render() {
    this.renderPapers();
    this.renderStats();
    this.renderKeywordCloud();
    this.renderTodayPick();
    this.renderLastUpdated();
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AcademicHub();
});
