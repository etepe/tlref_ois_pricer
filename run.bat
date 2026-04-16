@echo off
REM TLREF OIS Pricer - one-click launcher for Windows.
REM Starts the Vite dev server and opens the app in Chrome.

setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js bulunamadi. Lutfen https://nodejs.org/ adresinden kurun.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Bagimliliklar yukleniyor (ilk calismada bir defa^)...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install basarisiz oldu.
        pause
        exit /b 1
    )
)

echo Dev server baslatiliyor: http://localhost:5173
start "" cmd /c "timeout /t 4 /nobreak >nul && start chrome http://localhost:5173"
call npm run dev
