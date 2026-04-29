# Academic Hub 部署指南

把本地项目发布成在线网址，别人点开链接就能看。

---

## 方案一：GitHub Pages（推荐 ⭐）

免费、稳定、自动部署，国内访问尚可。

### 步骤

1. **创建 GitHub 仓库**
   - 打开 https://github.com/new
   - 仓库名填 `academic-hub`（或任意名字）
   - 选 **Public**（免费）
   - 点击 **Create repository**

2. **上传代码**
   在本地 `academic-hub` 文件夹内打开终端/PowerShell，执行：

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/你的用户名/academic-hub.git
   git push -u origin main
   ```

3. **开启 GitHub Pages**
   - 进入仓库 → **Settings** → 左侧 **Pages**
   - Source 选择 **GitHub Actions**
   - 等待 1-2 分钟，系统会自动识别 `.github/workflows/deploy.yml`
   - 部署完成后，访问 `https://你的用户名.github.io/academic-hub/`

4. **获取链接**
   - 部署成功后，链接格式：`https://<username>.github.io/academic-hub/`
   - 直接复制发给任何人即可

---

## 方案二：Cloudflare Pages（国内访问最快 🚀）

CDN 全球加速，国内速度比 GitHub Pages 快很多。

### 步骤

1. 打开 https://dash.cloudflare.com/，注册/登录
2. 左侧菜单 → **Pages** → **Create a project**
3. 连接 GitHub 仓库（或拖拽上传）
4. 构建设置：
   - **Build command**: 留空（纯静态，无需构建）
   - **Build output directory**: `/`
5. 点击 **Save and Deploy**
6. 获得 `https://xxx.pages.dev` 链接，直接分享

---

## 方案三：Vercel（最便捷 ⚡）

自动部署，界面简洁。

### 步骤

1. 打开 https://vercel.com/，用 GitHub 账号登录
2. 点击 **Add New...** → **Project**
3. 导入你的 `academic-hub` 仓库
4. **Framework Preset** 选 `Other`
   - **Build Command**: 留空
   - **Output Directory**: `./`
5. 点击 **Deploy**
6. 获得 `https://xxx.vercel.app` 链接

---

## 方案四：Netlify（拖拽部署 📦）

不用 Git，直接把文件夹拖进去就完成。

### 步骤

1. 打开 https://app.netlify.com/drop
2. 把本地 `academic-hub` 文件夹**压缩成 ZIP**
3. 把 ZIP 文件拖到网页里
4. 立刻获得 `https://xxx.netlify.app` 链接

---

## 方案对比

| 平台 | 难度 | 国内速度 | 自定义域名 | 自动部署 |
|------|------|----------|-----------|----------|
| GitHub Pages | 中 | ⭐⭐⭐ | ✅ | ✅ |
| Cloudflare Pages | 中 | ⭐⭐⭐⭐⭐ | ✅ | ✅ |
| Vercel | 低 | ⭐⭐⭐⭐ | ✅ | ✅ |
| Netlify | 极低 | ⭐⭐⭐ | ✅ | ❌（需重新上传）|

---

## 快速推荐

- **想一步到位**：用 **Netlify Drop**，拖个 ZIP 就完事
- **想长期维护**：用 **GitHub Pages** 或 **Cloudflare Pages**，推代码自动更新
- **国内分享为主**：首选 **Cloudflare Pages**

---

## 部署前检查清单

- [ ] `index.html` 在仓库根目录
- [ ] `js/data-json.js` 已包含所有数据（140 条）
- [ ] `js/app.js`、`js/data.js`、`js/audio.js` 都在
- [ ] `css/style.css` 已更新到最新样式
- [ ] 本地双击 `index.html` 能正常显示所有内容

---

## 更新部署

以后内容更新了，只需要：

```bash
git add .
git commit -m "更新内容"
git push
```

GitHub Actions / Cloudflare / Vercel 会自动重新部署，链接不变。
