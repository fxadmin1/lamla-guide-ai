@echo off
title LAMLA Guide AI — Production Pipeline (Test, Build, Push & Verify Live)
cd /d "%~dp0"
echo ======================================================================
echo   LAMLA Guide AI — Synchronized Production Deployment Pipeline
echo   Target Production Domain: https://lamla-guide-ai.onrender.com
echo ======================================================================
echo.

echo [1/4] Running automated Python AI, Security Isolation & 5-Feature QA Suites...
.venv\Scripts\python.exe python_ai\test_system.py || goto :fail
.venv\Scripts\python.exe python_ai\test_security_isolation.py || goto :fail
.venv\Scripts\python.exe python_ai\test_five_features_upgrade.py || goto :fail

echo.
echo [2/4] Verifying TypeScript static types...
call node_modules\.bin\tsc.cmd -p tsconfig.json --noEmit || goto :fail

echo.
echo [3/4] Committing & pushing verified changes to GitHub (origin/main)...
git add -A
set /p MSG="Enter release description (or press Enter for 'Production release'): "
if "%MSG%"=="" set MSG=Production release
git commit -m "%MSG%"
git push origin main || goto :fail

echo.
echo [4/4] Polling https://lamla-guide-ai.onrender.com until new release is verified live...
.venv\Scripts\python.exe python_ai\verify_production_live.py --url https://lamla-guide-ai.onrender.com --wait-seconds 540
goto :eof

:fail
echo.
echo [ABORTED] Verification failed before production release. Fix errors above and retry.
exit /b 1
