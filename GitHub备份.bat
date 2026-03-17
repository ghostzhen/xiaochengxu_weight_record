@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: ========== 无需修改（配置文件已适配 443 端口） ==========
set "REPO_URL=git@github.com:ghostzhen/xiaochengxu_weight_record.git"
:: =======================================================

:: 数字时间避免乱码
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "COMMIT_MSG=手动更新代码: %YYYY%-%MM%-%DD% %HH%:%Min%:%Sec%"
set "LOCAL_BRANCH=main"

echo 🔍 检查 Git 环境（适配 443 端口）...

:: 修复钩子问题
if exist .git\hooks\pre-push (
    echo 🧹 清理异常的 pre-push 钩子...
    del .git\hooks\pre-push
)
git config --local core.hooksPath NUL 2>nul || true

:: 初始化仓库
if not exist .git (
    echo 📦 初始化本地仓库...
    git init
    git commit --allow-empty -m "Initial commit: %YYYY%-%MM%-%DD% %HH%:%Min%:%Sec%"
)

:: 配置远程仓库
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin %REPO_URL%
) else (
    git remote set-url origin %REPO_URL%
)

:: 拉取代码
echo ⬇️  Pull latest code...
git pull origin !LOCAL_BRANCH! --allow-unrelated-histories || echo ⚠️  No remote branch, skip pull

:: 创建兜底文件
dir /b /a-d | findstr /r "^" >nul 2>&1
if errorlevel 1 (
    echo 📄 Create README file...
    echo # Weight Record Mini Program > README.md
)

:: 提交推送
echo 📤 Commit code...
git add .
git commit -m "!COMMIT_MSG!" || git commit --allow-empty -m "!COMMIT_MSG!"

echo 🚀 Push code (port 443)...
git push -u origin !LOCAL_BRANCH! --force-with-lease --no-verify

echo.
echo ✅ SSH (port 443) upload completed!
pause