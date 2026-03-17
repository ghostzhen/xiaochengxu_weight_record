@echo off
setlocal enabledelayedexpansion

:: ========== 仅需修改这里 ==========
set "REPO_URL=https://github.com/ghostzhen/xiaochengxu_weight_record.git"
:: =================================

:: 自动检测本地分支（兼容 main/master）
for /f "tokens=*" %%i in ('git symbolic-ref --short HEAD 2^>nul') do set "LOCAL_BRANCH=%%i"
if "!LOCAL_BRANCH!"=="" set "LOCAL_BRANCH=main"

set "COMMIT_MSG=手动更新代码: %date% %time%"

echo 🔍 检查 Git 环境...
:: 初始化仓库（首次用）
if not exist .git (
    echo 📦 初始化本地 Git 仓库...
    git init
    :: 强制创建初始提交（解决空仓库问题）
    git commit --allow-empty -m "初始化仓库"
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
git pull origin !LOCAL_BRANCH! --allow-unrelated-histories || echo ⚠️  无远程分支，跳过拉取

:: 提交代码（允许空提交）
echo 📤 提交代码到本地仓库...
git add .
git commit -m "%COMMIT_MSG%" || git commit --allow-empty -m "%COMMIT_MSG%"

:: 推送到 GitHub（强制推送初始分支）
echo 🚀 推送到 GitHub (!LOCAL_BRANCH! 分支)...
git push -u origin !LOCAL_BRANCH! --force-with-lease

echo.
echo ✅ 上传完成！
pause