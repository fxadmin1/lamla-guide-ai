@echo off
title LAMLA Guide AI — 1-Click Live Cloud Upgrade
cd /d "%~dp0"
echo ========================================================
echo   LAMLA Guide AI — Pushing Changes to Live Internet
echo   Target: https://lamla-guide-ai.onrender.com
echo ========================================================
echo.
git add -A
set /p MSG="Enter a short description of your update (or press Enter for 'Site update'): "
if "%MSG%"=="" set MSG=Site update
git commit -m "%MSG%"
git push origin main
echo.
echo [SUCCESS] Your changes have been sent to GitHub!
echo Render is now automatically updating https://lamla-guide-ai.onrender.com
pause
