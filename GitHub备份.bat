@echo off
setlocal enabledelayedexpansion

:: ========== 仅需修改这里 ==========
set "REPO_URL=https://github.com/ghostzhen/xiaochengxu_weight_record.git"
:: =================================

set "COMMIT_MSG=手动更新代码: %date% %time%"
set "BRANCH=main"

echo 🔍 检查 Git 环境...
:: 初始化仓库（首次用）
if not exist .git (
    echo 📦 初始化本地 Git 仓库...
    git init
)

:: 配置远程仓库
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin %REPO_URL%
) else (
    git remote set-url origin %REPO_URL%
)

:: 拉取最新代码（避免冲突）
echo ⬇️  拉取远程最新代码...
git pull origin %BRANCH% --allow-unrelated-histories || echo ⚠️  无远程分支，跳过拉取

:: 提交代码
echo 📤 提交代码到本地仓库...
git add .
git commit -m "%COMMIT_MSG%" || echo ⚠️  无代码变更，跳过提交

:: 推送到 GitHub
echo 🚀 推送到 GitHub (%BRANCH% 分支)...
git push -u origin %BRANCH%

echo.
echo ✅ 上传完成！
pause