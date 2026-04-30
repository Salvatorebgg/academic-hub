/**
 * Academic Hub - live source discovery
 * Pulls verified papers/news from open public APIs, then lets DataManager merge
 * them with the local archive. Everything runs without keys or a backend.
 */
(function () {
  const SOURCE_TIMEOUT_MS = 8500;
  const DIRECT_SOURCE_LIMIT = 18;
  const DEFAULT_RECENT_DAYS = 120;

  const TOPICS = [
    {
      discipline: 'cs',
      query: 'artificial intelligence machine learning large language models',
      news: '"artificial intelligence" OR "machine learning" OR "large language model"'
    },
    {
      discipline: 'bio',
      query: 'bioinformatics genomics single cell CRISPR',
      news: 'bioinformatics OR genomics OR CRISPR OR "single cell"'
    },
    {
      discipline: 'clinical',
      query: 'clinical trial oncology medicine therapy',
      news: '"clinical trial" OR oncology OR medicine OR therapy OR FDA'
    },
    {
      discipline: 'geo',
      query: 'climate change earth science geoscience remote sensing',
      news: '"climate change" OR "earth science" OR geoscience OR "remote sensing"'
    }
  ];

  function timeoutSignal(ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return { signal: controller.signal, cancel: () => clearTimeout(timer) };
  }

  function daysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }

  function cleanText(value, fallback = '') {
    const div = document.createElement('div');
    div.innerHTML = String(value || fallback || '');
    return div.textContent
      .replace(/\s+/g, ' ')
      .replace(/\[[^\]]+\]/g, '')
      .trim();
  }

  function stableId(prefix, text) {
    let hash = 2166136261;
    const raw = String(text || prefix);
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${(hash >>> 0).toString(36)}`;
  }

  function estimateReadTime(text) {
    const raw = String(text || '');
    const chinese = (raw.match(/[\u4e00-\u9fff]/g) || []).length;
    const english = (raw.match(/[a-zA-Z]+/g) || []).length;
    return `${Math.max(1, Math.round((chinese + english) / 220))} min`;
  }

  function extractKeywords(text, fallback = []) {
    const stop = new Set(['using', 'based', 'study', 'analysis', 'research', 'science', 'model', 'models', 'data', 'with', 'from', 'into']);
    const words = String(text || '')
      .toLowerCase()
      .match(/[a-z][a-z-]{3,}/g) || [];
    const counts = new Map();
    words.forEach((word) => {
      if (!stop.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
    });
    const generated = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([word]) => word);
    return [...new Set([...(fallback || []), ...generated])].slice(0, 8);
  }

  function reconstructAbstract(invertedIndex) {
    if (!invertedIndex || typeof invertedIndex !== 'object') return '';
    const pairs = [];
    Object.entries(invertedIndex).forEach(([word, positions]) => {
      (positions || []).forEach((pos) => pairs.push([pos, word]));
    });
    return pairs
      .sort((a, b) => a[0] - b[0])
      .map(([, word]) => word)
      .join(' ');
  }

  async function fetchJson(url, ms = SOURCE_TIMEOUT_MS) {
    const timer = timeoutSignal(ms);
    try {
      const response = await fetch(url, {
        signal: timer.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      timer.cancel();
    }
  }

  function normalizePaper(item) {
    const title = cleanText(item.title);
    const url = item.url || item.doi || item.pdfUrl;
    if (!title || !url || !/^https?:\/\//i.test(url)) return null;
    const date = item.date || new Date().toISOString().slice(0, 10);
    if (new Date(date).getTime() > Date.now() + 86400000) return null;
    const year = Number(item.year || date.slice(0, 4)) || new Date().getFullYear();
    const abstract = cleanText(item.abstract, title);
    return {
      id: item.id || stableId(item.sourceApi || item.source || 'live', url + title),
      discipline: item.discipline || 'cs',
      type: item.type || 'paper',
      title,
      authors: cleanText(item.authors || item.source || 'Source'),
      abstract: abstract.length > 900 ? `${abstract.slice(0, 897)}...` : abstract,
      date,
      year,
      journal: cleanText(item.journal || item.source || item.sourceApi || 'Live source'),
      source: cleanText(item.source || item.sourceApi || 'Live source'),
      sourceApi: item.sourceApi || 'Live',
      url,
      doi: item.doi || '',
      pdfUrl: item.pdfUrl || '',
      keywords: extractKeywords(`${title} ${abstract}`, item.keywords || []),
      readTime: item.readTime || estimateReadTime(`${title} ${abstract}`),
      citedBy: Number(item.citedBy || 0),
      qualityScore: Number(item.qualityScore || 70),
      verified: item.verified !== false,
      _live: true,
      _retrievedAt: item.retrievedAt || new Date().toISOString()
    };
  }

  async function fetchSnapshot() {
    const snapshotItems = [];
    const inline = window.LIVE_FEED_DATA;
    if (inline && Array.isArray(inline.papers)) {
      snapshotItems.push(...inline.papers);
    }
    try {
      const data = await fetchJson(`data/live-feed.json?v=${Date.now()}`, 5000);
      if (data && Array.isArray(data.papers)) {
        snapshotItems.push(...data.papers);
      }
    } catch (error) {
      // Opening index.html directly cannot fetch local JSON; inline data covers that path.
    }
    return snapshotItems.map(normalizePaper).filter(Boolean);
  }

  function openAlexUrl(topic, seed) {
    const params = new URLSearchParams({
      search: topic.query,
      filter: `from_publication_date:${daysAgo(DEFAULT_RECENT_DAYS)},has_abstract:true,is_retracted:false`,
      'per-page': String(DIRECT_SOURCE_LIMIT),
      sample: String(DIRECT_SOURCE_LIMIT),
      seed: String(seed),
      select: [
        'id',
        'doi',
        'display_name',
        'publication_date',
        'publication_year',
        'authorships',
        'primary_location',
        'open_access',
        'cited_by_count',
        'abstract_inverted_index',
        'concepts',
        'topics',
        'type'
      ].join(',')
    });
    return `https://api.openalex.org/works?${params.toString()}`;
  }

  async function fetchOpenAlex(seed) {
    const batches = await Promise.allSettled(TOPICS.map(async (topic, idx) => {
      const data = await fetchJson(openAlexUrl(topic, seed + idx));
      return (data.results || []).map((work) => {
        const location = work.primary_location || {};
        const source = location.source || {};
        const doiUrl = work.doi || '';
        const doi = doiUrl.replace(/^https:\/\/doi\.org\//i, '');
        const abstract = reconstructAbstract(work.abstract_inverted_index);
        const authors = (work.authorships || [])
          .map((a) => a.author && a.author.display_name)
          .filter(Boolean)
          .slice(0, 6)
          .join(', ');
        const concepts = (work.concepts || [])
          .map((c) => c.display_name)
          .filter(Boolean)
          .slice(0, 5);
        const topics = (work.topics || [])
          .map((t) => t.display_name)
          .filter(Boolean)
          .slice(0, 3);
        return normalizePaper({
          id: stableId('openalex', work.id || doiUrl || work.display_name),
          discipline: topic.discipline,
          type: 'paper',
          title: work.display_name,
          authors: authors || 'OpenAlex indexed authors',
          abstract,
          date: work.publication_date,
          year: work.publication_year,
          journal: source.display_name || 'OpenAlex',
          source: source.display_name || 'OpenAlex',
          sourceApi: 'OpenAlex',
          url: location.landing_page_url || doiUrl || work.id,
          doi,
          pdfUrl: location.pdf_url || (work.open_access && work.open_access.oa_url) || '',
          keywords: [...concepts, ...topics],
          readTime: estimateReadTime(abstract),
          citedBy: work.cited_by_count || 0,
          qualityScore: Math.min(100, 72 + Math.log10((work.cited_by_count || 0) + 1) * 12),
          verified: true
        });
      }).filter(Boolean);
    }));
    return batches.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  }

  function gdeltUrl(topic) {
    const params = new URLSearchParams({
      query: `${topic.news} sourcelang:english`,
      mode: 'artlist',
      format: 'json',
      maxrecords: '25',
      sort: 'HybridRel',
      timespan: '7d'
    });
    return `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
  }

  async function fetchGdelt() {
    const batches = await Promise.allSettled(TOPICS.map(async (topic) => {
      const data = await fetchJson(gdeltUrl(topic), 7000);
      return (data.articles || []).map((article) => {
        const dateRaw = String(article.seendate || article.date || '');
        const date = dateRaw.length >= 8
          ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
          : new Date().toISOString().slice(0, 10);
        const domain = article.domain || article.sourceCountry || 'GDELT';
        return normalizePaper({
          id: stableId('gdelt', article.url || article.title),
          discipline: topic.discipline,
          type: 'news',
          title: article.title,
          authors: domain,
          abstract: `来自 ${domain} 的最新报道。该条目由 GDELT 全球新闻索引发现，可点击原文查看完整内容。`,
          date,
          year: Number(date.slice(0, 4)),
          journal: domain,
          source: domain,
          sourceApi: 'GDELT',
          url: article.url,
          keywords: extractKeywords(`${article.title} ${topic.news}`),
          readTime: '4 min',
          qualityScore: 68,
          verified: true
        });
      }).filter(Boolean);
    }));
    return batches.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  }

  function deduplicate(items) {
    const seen = new Set();
    const unique = [];
    for (const item of items) {
      const key = (item.doi || item.url || item.title).toLowerCase().replace(/\/$/, '');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }
    return unique;
  }

  async function load(options = {}) {
    const seed = options.seed || Math.floor(Date.now() / 1000);
    const tasks = [fetchSnapshot()];
    if (options.network !== false) {
      tasks.push(fetchOpenAlex(seed), fetchGdelt());
    }
    const parts = await Promise.allSettled(tasks);
    const papers = parts.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    const unique = deduplicate(papers)
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
    return {
      generatedAt: new Date().toISOString(),
      total: unique.length,
      sources: ['OpenAlex', 'GDELT', 'GitHub snapshot'],
      papers: unique
    };
  }

  window.AcademicLiveFeed = {
    load,
    normalizePaper,
    deduplicate
  };
})();
