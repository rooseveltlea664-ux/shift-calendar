@echo off
chcp 65001 >nul
title 智巡排班 - GitHub 一键同步脚本

echo ===================================================
echo   智巡排班 (ShiftMaster) - GitHub 一键同步工具
echo ===================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [提示] 检测到本机尚未识别到 Git 环境。
    echo 请先安装 Git 或使用 GitHub Desktop 客户端进行同步。
    echo.
    pause
    exit /b
)

echo [1/3] 正在添加所有变动文件...
git add .

echo [2/3] 提交本地修改...
set /p commit_msg=请输入本次更新备注 (直接按回车默认为自动更新): 
if "%commit_msg%"=="" set commit_msg=chore: update shift calendar

git commit -m "%commit_msg%"

echo [3/3] 正在推送到 GitHub 云端...
git push

echo.
echo ===================================================
echo   恭喜！已成功同步到您的 GitHub 仓库！
echo ===================================================
echo.
pause
