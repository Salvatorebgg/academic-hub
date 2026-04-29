# Academic Hub 一键部署脚本 (PowerShell)
# 用法：在 academic-hub 文件夹内右键 → 使用 PowerShell 运行

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Academic Hub 部署助手" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 git
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Host "❌ 未检测到 Git，请先安装：https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

# 获取 GitHub 用户名
$username = Read-Host "请输入你的 GitHub 用户名"
if ([string]::IsNullOrWhiteSpace($username)) {
    Write-Host "❌ 用户名不能为空" -ForegroundColor Red
    exit 1
}

$repo = Read-Host "请输入仓库名（直接回车使用默认：academic-hub）"
if ([string]::IsNullOrWhiteSpace($repo)) {
    $repo = "academic-hub"
}

Write-Host ""
Write-Host "步骤 1/4: 初始化 Git 仓库..." -ForegroundColor Yellow
if (-not (Test-Path .git)) {
    git init
}

Write-Host "步骤 2/4: 添加文件到暂存区..." -ForegroundColor Yellow
git add .

Write-Host "步骤 3/4: 提交代码..." -ForegroundColor Yellow
git commit -m "Initial commit: Academic Hub v3.0"

Write-Host "步骤 4/4: 推送到 GitHub..." -ForegroundColor Yellow
git branch -M main
$remoteUrl = "https://github.com/$username/$repo.git"
git remote remove origin 2>$null
git remote add origin $remoteUrl
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ 推送成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "接下来请完成以下操作：" -ForegroundColor Cyan
    Write-Host "1. 打开仓库页面：https://github.com/$username/$repo" -ForegroundColor White
    Write-Host "2. 点击 Settings → Pages" -ForegroundColor White
    Write-Host "3. Source 选择 [GitHub Actions]" -ForegroundColor White
    Write-Host "4. 等待 1-2 分钟自动部署" -ForegroundColor White
    Write-Host ""
    Write-Host "部署完成后访问：" -ForegroundColor Green
    Write-Host "   https://$username.github.io/$repo/" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "⚠️ 推送失败，可能原因：" -ForegroundColor Red
    Write-Host "   - GitHub 仓库尚未创建，请先在 https://github.com/new 创建" -ForegroundColor White
    Write-Host "   - 未登录 GitHub 账号，请先执行 git config --global user.name \"你的名字\"" -ForegroundColor White
    Write-Host "   - 未配置邮箱，请先执行 git config --global user.email \"你的邮箱\"" -ForegroundColor White
    Write-Host ""
}

Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
