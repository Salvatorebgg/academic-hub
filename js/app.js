/**
 * Academic Hub v3.3 - 主应用逻辑
 * 2026年4月更新：148条真实学术内容 + 用户系统 + 云端收藏
 * 增强功能：阅读进度、批量操作、搜索高亮、阅读历史、回到顶部、丰富导出
 */

class AcademicHub {
  constructor() {
    this.dataManager = window.dataManager;
    this.audio = window.audioEngine;
    this.currentSection = 'latest';
    this.readingHistory = this.loadReadingHistory();
    this.readProgress = this.loadReadProgress();
    this.batchMode = false;
    this.batchSelected = new Set();
    this.sortOrder = 'date-desc';
    this.currentUser = this.loadCurrentUser();
    this.init();
  }

  async init() {
    await this.dataManager.loadPapers();
    this.dataManager.setCurrentUser(this.currentUser);
    this.initTheme();
    this.initSystemTheme();
    this.initSearchHistory();
    this.bindEvents();
    this.initScrollEffects();
    this.initViewportAnimations();
    this.initKeyboardShortcuts();
    this.initUserSystem();
    this.render();
    this.initParticles();
    this.initVisibilityPause();
    this.initRippleEffects();

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
    this.viewportObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          this.viewportObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  }

  observeViewportAnimations() {
    if (!this.viewportObserver) return;
    document.querySelectorAll('.paper-card:not(.revealed), .paper-list-item:not(.revealed), .stat-card:not(.revealed), .today-pick-card:not(.revealed), .discipline-chart:not(.revealed), .keyword-cloud:not(.revealed)').forEach(el => {
      el.classList.add('reveal');
      this.viewportObserver.observe(el);
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
      // L 打开登录
      if ((e.key === 'l' || e.key === 'L') && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        if (this.currentUser) {
          this.openCloudModal();
        } else {
          this.openAuthModal();
        }
      }
      // ? 显示快捷键帮助
      if (e.key === '?' && document.activeElement.tagName !== 'INPUT') {
        this.openShortcutsHelp();
      }
    });
  }

  /* ========== 快捷键帮助面板 ========== */
  openShortcutsHelp() {
    const shortcuts = [
      { key: '/', desc: '聚焦搜索框' },
      { key: 'Esc', desc: '关闭模态框/侧边栏/搜索历史' },
      { key: '1', desc: '切换到 [最新内容]' },
      { key: '2', desc: '切换到 [历史时间线]' },
      { key: '3', desc: '切换到 [我的收藏]' },
      { key: 'T', desc: '切换 亮色/暗色 主题' },
      { key: 'B', desc: '切换批量选择模式' },
      { key: 'L', desc: '打开登录/注册面板' },
      { key: '?', desc: '显示本快捷键帮助面板' },
    ];
    const content = `
      <div style="display: grid; gap: 0.75rem;">
        ${shortcuts.map(s => `
          <div style="display: flex; align-items: center; gap: 1rem; padding: 0.6rem 0.9rem; background: var(--bg-secondary); border-radius: 10px;">
            <span class="kbd-hint" style="min-width: 2.5rem; text-align: center; font-size: 0.85rem;">${s.key}</span>
            <span style="font-size: 0.9rem; color: var(--text-primary); font-weight: 600;">${s.desc}</span>
          </div>
        `).join('')}
      </div>
    `;
    this.openModal('⌨️ 键盘快捷键', content);
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

  /* ========== 阅读进度 ========== */
  loadReadProgress() {
    try {
      return JSON.parse(localStorage.getItem('academic-hub-progress') || '{}');
    } catch { return {}; }
  }

  saveReadProgress() {
    localStorage.setItem('academic-hub-progress', JSON.stringify(this.readProgress));
  }

  getReadProgress(id) {
    return this.readProgress[id] || 0;
  }

  setReadProgress(id, percent) {
    this.readProgress[id] = Math.max(this.readProgress[id] || 0, percent);
    this.saveReadProgress();
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
      this.audio.playClick();
      this.openCloudModal();
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
            <li>当前用户：${this.currentUser || '未登录'}</li>
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
    document.getElementById('cloudManageBtn')?.addEventListener('click', () => {
      this.audio.playClick();
      this.openCloudModal();
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

    // 排序
    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
      this.sortOrder = e.target.value;
      this.renderPapers();
      this.showToast(`已按 ${e.target.options[e.target.selectedIndex].text} 排序`, 'info');
    });

    // 模态框关闭
    document.getElementById('modalClose')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });

    // 用户认证
    document.getElementById('loginBtn')?.addEventListener('click', () => this.openAuthModal());
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    document.getElementById('authModalClose')?.addEventListener('click', () => this.closeAuthModal());
    document.getElementById('authModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeAuthModal();
    });
    document.getElementById('showRegisterBtn')?.addEventListener('click', () => this.switchAuthForm('register'));
    document.getElementById('showLoginBtn')?.addEventListener('click', () => this.switchAuthForm('login'));
    document.getElementById('doLoginBtn')?.addEventListener('click', () => this.doLogin());
    document.getElementById('doRegisterBtn')?.addEventListener('click', () => this.doRegister());

    // 云端管理
    document.getElementById('cloudModalClose')?.addEventListener('click', () => this.closeCloudModal());
    document.getElementById('cloudModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeCloudModal();
    });
    document.getElementById('exportCloudBtn')?.addEventListener('click', () => this.exportUserFavorites());
    document.getElementById('importCloudBtn')?.addEventListener('click', () => document.getElementById('importFileInput')?.click());
    document.getElementById('importFileInput')?.addEventListener('change', (e) => this.importUserFavorites(e));
    document.getElementById('clearCloudBtn')?.addEventListener('click', () => this.clearUserFavorites());
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

  /* ========== 排序论文 ========== */
  sortPapers(papers) {
    const sorted = [...papers];
    switch (this.sortOrder) {
      case 'date-desc':
        sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
      case 'date-asc':
        sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case 'title-asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'type':
        sorted.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'paper' ? -1 : 1;
          return new Date(b.date) - new Date(a.date);
        });
        break;
    }
    return sorted;
  }

  /* ========== 渲染论文列表（最新资讯：2026年及以后） ========== */
  renderPapers() {
    const container = document.getElementById('papersContainer');
    if (!container) return;

    const papers = this.sortPapers(this.dataManager.getLatestPapers());
    this.updateSectionTitle('latest');

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
    this.observeViewportAnimations();
    this.initRippleEffects();
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
    const newBadge = paper.date && paper.date.startsWith('2026')
      ? '<span class="new-badge">🆕 2026</span>' : '';
    const yearBadge = paper.year
      ? `<span class="year-badge">${paper.year}</span>` : '';

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
            ${yearBadge}${newBadge}${hotBadge}${readBadge}
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

        ${this.renderRelatedPapers(paper)}
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

      // 相关推荐点击
      document.querySelectorAll('.related-paper-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          const p = this.dataManager.papers.find(x => x.id === id);
          if (p) {
            this.closeModal();
            setTimeout(() => {
              this.markAsRead(id);
              this.audio.playClick();
              this.openPaperDetail(p);
            }, 250);
          }
        });
      });
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

  /* ========== 相关推荐 ========== */
  renderRelatedPapers(currentPaper) {
    const others = this.dataManager.papers.filter(p =>
      p.id !== currentPaper.id &&
      (p.discipline === currentPaper.discipline ||
       (p.keywords || []).some(k => (currentPaper.keywords || []).includes(k)))
    );
    if (others.length === 0) return '';
    const shuffled = others.sort(() => 0.5 - Math.random()).slice(0, 3);
    const disciplineLabels = { bio: '生物信息学', clinical: '临床研究', cs: '计算机科学', geo: '气象地质' };

    return `
      <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--glass-border);">
        <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 1rem; color: var(--text-primary);">📎 相关推荐</h3>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${shuffled.map(p => `
            <div class="related-paper-item" data-id="${p.id}" style="padding: 0.85rem 1rem; background: var(--bg-card); border-radius: 10px; border: 1px solid var(--glass-border); cursor: pointer; transition: all 0.2s;">
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.3rem; line-height: 1.4;">${p.title}</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 500;">
                <span style="color: var(--primary); font-weight: 700;">${disciplineLabels[p.discipline]}</span> · ${p.authors.split(',')[0]} et al. · ${p.date}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
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

    // 触发数字滚动动画（必须在 innerHTML += 之前执行，否则 += 会重建 DOM 导致动画元素被替换）
    container.querySelectorAll('.stat-number[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target);
      setTimeout(() => this.animateCounter(el, target), 300);
    });

    // 用 insertAdjacentHTML 追加，避免重建已有 DOM
    container.insertAdjacentHTML('beforeend', `
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
    `);
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
    // 优先推荐2026年内容，其次2025年
    const y2026 = this.dataManager.papers.filter(p => p.date && p.date.startsWith('2026'));
    const y2025 = this.dataManager.papers.filter(p => p.date && p.date.startsWith('2025'));
    const pool = y2026.length > 0 ? y2026 : (y2025.length > 0 ? y2025 : this.dataManager.papers);

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
          <h3 class="today-pick-title">${pick.title}${pick.date && pick.date.startsWith('2026') ? '<span class="new-badge">🆕 2026</span>' : ''}</h3>
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

  /* ========== 即时刷新：从现有2026年数据中随机推荐 ========== */
  async refreshWithHotContent() {
    // 清除旧的动态内容
    this.dataManager.papers = this.dataManager.papers.filter(p => !p._isDynamicHot);

    // 只从现有2026年数据中随机选择推荐
    const y2026 = this.dataManager.papers.filter(p => p.year >= 2026 && !p._isDynamicHot);
    if (y2026.length === 0) return 0;

    const shuffled = y2026.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const pickCount = Math.min(Math.floor(Math.random() * 3) + 4, shuffled.length);
    const selected = shuffled.slice(0, pickCount);

    const now = new Date();
    const newContents = selected.map((item, idx) => {
      const ts = Date.now() + idx;
      return { ...item, id: `hot-ts-${ts}-${idx}`, _isDynamicHot: true };
    });

    this.dataManager.papers.unshift(...newContents);
    const updateTime = new Date().toISOString();
    this.dataManager.lastUpdated = updateTime;
    localStorage.setItem('academic-hub-last-updated', updateTime);
    return newContents.length;
  }

  /* ========== 渲染历史（历史推送：2026年以前） ========== */
  renderHistory() {
    const container = document.getElementById('papersContainer');
    if (!container) return;
    this.updateSectionTitle('history');
    const history = this.dataManager.getHistoryPapers();

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
    this.observeViewportAnimations();
    this.initRippleEffects();
  }

  /* ========== 渲染收藏 ========== */
  renderFavorites() {
    const container = document.getElementById('papersContainer');
    if (!container) return;
    this.updateSectionTitle('favorites');
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
    this.observeViewportAnimations();
    this.initRippleEffects();
  }

  /* ========== 标题与横幅更新 ========== */
  updateSectionTitle(section) {
    const titleEl = document.getElementById('sectionTitle');
    const bannerEl = document.getElementById('sectionBanner');
    const bannerTextEl = document.getElementById('bannerText');
    if (!titleEl) return;

    const typeFilter = this.dataManager.typeFilter;
    const disciplineFilter = this.dataManager.currentFilter;
    let title = '全部内容';
    let bannerClass = '';
    let bannerIcon = '';
    let bannerText = '';

    if (section === 'latest') {
      title = '🆕 2026年最新';
      bannerClass = 'latest-banner';
      bannerIcon = '🚀';
      const count = this.dataManager.getLatestPapers().length;
      bannerText = `2026年最新前沿 · 共 ${count} 条高质量内容`;
    } else if (section === 'history') {
      title = '📚 经典归档';
      bannerClass = 'history-banner';
      bannerIcon = '📖';
      const count = this.dataManager.papers.filter(p => p.year < 2026).length;
      bannerText = `经典学术归档 · 共 ${count} 条 (2001-2025)`;
    } else if (section === 'favorites') {
      title = '💝 我的收藏';
      bannerClass = 'favorites-banner';
      bannerIcon = '❤️';
      const count = this.dataManager.favorites.length;
      bannerText = `我的收藏夹 · 共 ${count} 篇`;
    }

    if (typeFilter === 'paper') title += ' · 学术论文';
    else if (typeFilter === 'news') title += ' · 资讯新闻';
    if (disciplineFilter !== 'all') {
      const names = { bio: '生物信息学', clinical: '临床研究', cs: '计算机科学', geo: '气象地质' };
      title += ` · ${names[disciplineFilter]}`;
    }
    titleEl.textContent = title;

    if (bannerEl && bannerTextEl) {
      bannerEl.className = 'section-banner ' + bannerClass;
      bannerTextEl.textContent = bannerText;
      const iconEl = bannerEl.querySelector('.banner-icon');
      if (iconEl) iconEl.textContent = bannerIcon;
    }
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
    this.observeViewportAnimations();
  }

  /* ========== 添加涟漪效果 ========== */
  addRippleEffect(element) {
    element.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      ripple.classList.add('ripple');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  }

  /* ========== 初始化涟漪效果 ========== */
  initRippleEffects() {
    document.querySelectorAll('.paper-card, .discipline-tag, .view-btn, .batch-btn, .read-more').forEach(el => {
      this.addRippleEffect(el);
    });
  }

  /* ========== 用户认证系统 ========== */
  loadCurrentUser() {
    try {
      return localStorage.getItem('academic-hub-current-user') || null;
    } catch { return null; }
  }

  saveCurrentUser(username) {
    if (username) {
      localStorage.setItem('academic-hub-current-user', username);
    } else {
      localStorage.removeItem('academic-hub-current-user');
    }
  }

  initUserSystem() {
    this.updateUserUI();
  }

  updateUserUI() {
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');
    const userNameDisplay = document.getElementById('userNameDisplay');
    if (!loginBtn || !userMenu) return;

    if (this.currentUser) {
      loginBtn.classList.add('hidden');
      userMenu.classList.remove('hidden');
      if (userNameDisplay) userNameDisplay.textContent = this.currentUser;
    } else {
      loginBtn.classList.remove('hidden');
      userMenu.classList.add('hidden');
    }
  }

  openAuthModal() {
    document.getElementById('authModal')?.classList.add('active');
    this.switchAuthForm('login');
  }

  closeAuthModal() {
    document.getElementById('authModal')?.classList.remove('active');
  }

  switchAuthForm(form) {
    const loginForm = document.getElementById('authLoginForm');
    const registerForm = document.getElementById('authRegisterForm');
    const title = document.getElementById('authModalTitle');
    if (form === 'register') {
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      if (title) title.textContent = '📝 用户注册';
    } else {
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
      if (title) title.textContent = '🔐 用户登录';
    }
  }

  getUsers() {
    try {
      const stored = localStorage.getItem('academic-hub-users');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  }

  saveUsers(users) {
    localStorage.setItem('academic-hub-users', JSON.stringify(users));
  }

  hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return String(hash);
  }

  doLogin() {
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    if (!username || !password) {
      this.showToast('请输入用户名和密码', 'error');
      return;
    }
    const users = this.getUsers();
    if (!users[username]) {
      this.showToast('用户不存在', 'error');
      return;
    }
    if (users[username].password !== this.hashPassword(password)) {
      this.showToast('密码错误', 'error');
      return;
    }
    this.currentUser = username;
    this.saveCurrentUser(username);
    this.dataManager.setCurrentUser(username);
    this.updateUserUI();
    this.closeAuthModal();
    this.showToast(`欢迎回来，${username}！`, 'success');
    this.renderStats();
    if (this.currentSection === 'favorites') this.renderFavorites();
  }

  doRegister() {
    const username = document.getElementById('regUsername')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const password2 = document.getElementById('regPassword2')?.value;
    if (!username || !password) {
      this.showToast('请填写完整信息', 'error');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      this.showToast('用户名需3-20位字母/数字/下划线', 'error');
      return;
    }
    if (password.length < 6) {
      this.showToast('密码至少6位', 'error');
      return;
    }
    if (password !== password2) {
      this.showToast('两次密码不一致', 'error');
      return;
    }
    const users = this.getUsers();
    if (users[username]) {
      this.showToast('用户名已被注册', 'error');
      return;
    }
    users[username] = { password: this.hashPassword(password), createdAt: new Date().toISOString() };
    this.saveUsers(users);
    this.currentUser = username;
    this.saveCurrentUser(username);
    this.dataManager.setCurrentUser(username);
    this.updateUserUI();
    this.closeAuthModal();
    this.showToast(`注册成功，欢迎 ${username}！`, 'success');
    this.renderStats();
  }

  logout() {
    this.currentUser = null;
    this.saveCurrentUser(null);
    this.dataManager.clearCurrentUser();
    this.updateUserUI();
    this.showToast('已退出登录', 'info');
    this.renderStats();
    if (this.currentSection === 'favorites') this.renderFavorites();
  }

  openCloudModal() {
    const stats = document.getElementById('cloudStats');
    if (stats) {
      const favCount = this.dataManager.favorites.length;
      const userLabel = this.currentUser ? `当前用户：<strong>${this.currentUser}</strong>` : '当前状态：<strong>未登录</strong>（收藏保存在本地）';
      stats.innerHTML = `${userLabel}<br>收藏数量：<strong>${favCount}</strong> 篇`;
    }
    document.getElementById('cloudModal')?.classList.add('active');
  }

  closeCloudModal() {
    document.getElementById('cloudModal')?.classList.remove('active');
  }

  exportUserFavorites() {
    const payload = {
      version: 1,
      username: this.currentUser || 'anonymous',
      exportedAt: new Date().toISOString(),
      favorites: this.dataManager.favorites,
      readingHistory: Array.from(this.readingHistory),
      readProgress: this.readProgress
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic-hub-backup-${this.currentUser || 'local'}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('收藏备份已导出', 'success');
    this.audio.playDownload();
  }

  importUserFavorites(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const payload = JSON.parse(e.target.result);
        if (!payload || !Array.isArray(payload.favorites)) {
          this.showToast('文件格式不正确', 'error');
          return;
        }
        this.dataManager.favorites = payload.favorites;
        this.dataManager.saveFavorites();
        if (payload.readingHistory) {
          this.readingHistory = new Set(payload.readingHistory);
          this.saveReadingHistory();
        }
        if (payload.readProgress) {
          this.readProgress = payload.readProgress;
          this.saveReadProgress();
        }
        this.showToast(`成功导入 ${payload.favorites.length} 条收藏`, 'success');
        this.renderStats();
        if (this.currentSection === 'favorites') this.renderFavorites();
        this.closeCloudModal();
      } catch (err) {
        this.showToast('导入失败：文件解析错误', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  clearUserFavorites() {
    if (!confirm('确定要清空所有收藏吗？此操作不可恢复。')) return;
    this.dataManager.favorites = [];
    this.dataManager.saveFavorites();
    this.showToast('收藏已清空', 'info');
    this.renderStats();
    if (this.currentSection === 'favorites') this.renderFavorites();
    this.closeCloudModal();
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AcademicHub();
});
