@echo off
rem Starts the local Spare Parts system (backend + frontend) and opens it in the browser.
rem Works without internet. Close the two server windows to stop it.
cd /d "%~dp0"

rem Already running? Just open the browser.
curl -s -o nul http://localhost:5173 && goto open

start "Spare Parts - Backend"  cmd /k npm --prefix backend run dev
start "Spare Parts - Frontend" cmd /k npm --prefix frontend run dev

echo Starting Spare Parts servers...
set /a tries=0
:wait
timeout /t 1 /nobreak >nul
set /a tries+=1
curl -s -o nul http://localhost:5173 && curl -s -o nul http://localhost:4000/api/health && goto open
if %tries% lss 60 goto wait
echo Servers did not start within 60 seconds - check the two server windows for errors.
pause
exit /b 1

:open
start "" http://localhost:5173