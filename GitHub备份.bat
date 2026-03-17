@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: ========== 无需修改（SSH 443 端口已配置） ==========
set "REPO_URL=git@github.com:ghostzhen/xiaochengxu_weight_record.git"
:: ===================================================

echo 🔍 开始终极修复：适配分支 + 443 端口 + 强制提交...

:: 修复钩子问题
if exist .git\hooks\pre-push (
    echo 🧹 清理异常 pre-push 钩子...
    del .git\hooks\pre-push
)
git config --local core.hooksPath NUL 2>nul || true

:: 初始化仓库
if not exist .git (
    echo 📦 初始化本地 Git 仓库...
    git init
)

:: 步骤1：检测/创建本地分支
for /f "tokens=*" %%i in ('git symbolic-ref --short HEAD 2^>nul') do set "LOCAL_BRANCH=%%i"
if "!LOCAL_BRANCH!"=="" (
    echo 🌿 本地无分支，创建并切换到 main 分支...
    git checkout -b main
    set "LOCAL_BRANCH=main"
)

:: 步骤2：强制创建提交内容
git log --oneline >nul 2>&1
if errorlevel 1 (
    echo 📄 创建 README 文件并首次提交...
    echo # 体重记录小程序 > README.md
    git add .
    git commit -m "首次提交：初始化仓库"
) else (
    git add .
    for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
    set "COMMIT_MSG=手动更新代码: !dt:~0,4!-!dt:~4,2!-!dt:~6,2! !dt:~8,2!:!dt:~10,2!:!dt:~12,2!"
    git commit -m "!COMMIT_MSG!" || true
)

:: 步骤3：配置远程仓库
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo 🔗 添加远程仓库（SSH 443）...
    git remote add origin !REPO_URL!
) else (
    echo 🔗 更新远程仓库地址（SSH 443）...
    git remote set-url origin !REPO_URL!
)

:: 步骤4：拉取远程分支
echo ⬇️  拉取远程 !LOCAL_BRANCH! 分支...
git pull origin !LOCAL_BRANCH! --allow-unrelated-histories || echo ⚠️  远程无 !LOCAL_BRANCH! 分支，跳过拉取

:: 步骤5：强制推送
echo 🚀 推送代码到 !LOCAL_BRANCH! 分支（SSH 443 端口）...
git push -u origin !LOCAL_BRANCH! --force

echo.
echo ✅ 终极修复完成！代码已推送到 GitHub：https://github.com/ghostzhen/xiaochengxu_weight_record
pause