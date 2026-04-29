"""
Academic Hub - 数据模型
Paper 数据模型，含去重、排序、学科分类、日期筛选
"""

from datetime import datetime


class Paper:
    """学术论文/资讯数据模型"""
    
    def __init__(self, data=None):
        self.id = ''
        self.title = ''
        self.authors = ''
        self.abstract = ''
        self.discipline = 'cs'
        self.type = 'paper'
        self.journal = ''
        self.date = ''
        self.year = 0
        self.doi = ''
        self.url = ''
        self.pdfUrl = ''
        self.keywords = []
        self.readTime = '3 min'
        self.source = ''
        
        if data:
            self.from_dict(data)
    
    def from_dict(self, data):
        """从字典加载"""
        self.id = data.get('id', '')
        self.title = data.get('title', '')
        self.authors = data.get('authors', '')
        self.abstract = data.get('abstract', '')
        self.discipline = data.get('discipline', 'cs')
        self.type = data.get('type', 'paper')
        self.journal = data.get('journal', '')
        self.date = data.get('date', '')
        self.year = data.get('year', 0)
        self.doi = data.get('doi', '')
        self.url = data.get('url', '')
        self.pdfUrl = data.get('pdfUrl', '')
        self.keywords = data.get('keywords', [])
        self.readTime = data.get('readTime', '3 min')
        self.source = data.get('source', '')
    
    def to_dict(self):
        """导出为字典"""
        return {
            'id': self.id,
            'title': self.title,
            'authors': self.authors,
            'abstract': self.abstract,
            'discipline': self.discipline,
            'type': self.type,
            'journal': self.journal,
            'date': self.date,
            'year': self.year,
            'doi': self.doi,
            'url': self.url,
            'pdfUrl': self.pdfUrl,
            'keywords': self.keywords,
            'readTime': self.readTime,
            'source': self.source,
        }
    
    def is_recent(self, days=30):
        """判断是否为近期内容"""
        try:
            d = datetime.strptime(self.date, '%Y-%m-%d')
            return (datetime.now() - d).days <= days
        except:
            return False
    
    def __repr__(self):
        return f"<Paper {self.id}: {self.title[:50]}...>"


class PaperCollection:
    """论文集合管理"""
    
    def __init__(self):
        self.papers = []
    
    def add(self, paper):
        """添加论文"""
        if isinstance(paper, dict):
            paper = Paper(paper)
        self.papers.append(paper)
    
    def extend(self, papers):
        """批量添加"""
        for p in papers:
            self.add(p)
    
    def deduplicate(self):
        """去重"""
        seen = set()
        unique = []
        for p in self.papers:
            key = (p.title.strip().lower(), p.url.strip().lower())
            if key not in seen and p.title and p.url:
                seen.add(key)
                unique.append(p)
        self.papers = unique
    
    def sort_by_date(self, reverse=True):
        """按日期排序"""
        def get_date(p):
            try:
                return datetime.strptime(p.date, '%Y-%m-%d')
            except:
                return datetime.min
        self.papers.sort(key=get_date, reverse=reverse)
    
    def filter_by_discipline(self, discipline):
        """按学科筛选"""
        return [p for p in self.papers if p.discipline == discipline]
    
    def filter_by_type(self, ptype):
        """按类型筛选"""
        return [p for p in self.papers if p.type == ptype]
    
    def filter_by_date_range(self, start, end):
        """按日期范围筛选"""
        result = []
        for p in self.papers:
            try:
                d = datetime.strptime(p.date, '%Y-%m-%d')
                if start <= d <= end:
                    result.append(p)
            except:
                continue
        return result
    
    def to_list(self):
        """导出为字典列表"""
        return [p.to_dict() for p in self.papers]
    
    def __len__(self):
        return len(self.papers)
