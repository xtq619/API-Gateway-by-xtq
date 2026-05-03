@echo off
chcp 65001 >nul
title API Gateway - One Click Start

echo ========================================
echo        API Gateway - One Click Start
echo ========================================
echo.

:: Check if Docker Desktop is running
docker info >nul 2>&1
if %errorlevel% neq 0 goto start_docker
goto docker_ready

:start_docker
echo [1/4] Docker not running, starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo       Waiting for Docker to start...

:wait_docker
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if %errorlevel% neq 0 goto wait_docker
echo       Docker is ready
goto run_services

:docker_ready
echo [1/4] Docker is running

:run_services
:: Kill old processes on port 8000 and 5173
call :kill_port 8000 backend
call :kill_port 5173 frontend

:: Start PostgreSQL and Redis
echo [2/4] Starting PostgreSQL and Redis...
docker-compose -f "%~dp0docker-compose.yml" up -d postgres redis

echo       Waiting for database to be ready...
timeout /t 3 /nobreak >nul

:: Install backend dependencies (first time only)
cd /d "%~dp0backend"
pip show api-gateway >nul 2>&1
if %errorlevel% equ 0 goto backend_deps_ok
echo [3/4] Installing backend dependencies (first time only)...
call pip install -e . >nul 2>&1
goto backend_deps_done
:backend_deps_ok
echo [3/4] Backend dependencies OK
:backend_deps_done

:: Run database migrations (idempotent, instant when up-to-date)
echo       Running database migrations...
call alembic upgrade head 2>nul

:: Install frontend dependencies (first time only)
cd /d "%~dp0frontend"
if exist "node_modules" goto frontend_deps_ok
echo       Installing frontend dependencies (first time only)...
call npm install
goto frontend_deps_done
:frontend_deps_ok
echo       Frontend dependencies OK
:frontend_deps_done

:: Start backend and frontend
echo [4/5] Starting backend and frontend...
start "API-Gateway-Backend" cmd /k "cd /d %~dp0backend && uvicorn app.main:app --reload --port 8000"
start "API-Gateway-Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Start Cloudflare Tunnel
echo [5/5] Starting Cloudflare Tunnel...
start "API-Gateway-Tunnel" cmd /k "cloudflared tunnel run xtq619"

echo.
echo ========================================
echo   All services started!
echo   Frontend (local):  http://localhost:5173
echo   Frontend (public): https://app.xtq619.xyz
echo   API (public):      https://api.xtq619.xyz
echo   Backend API Docs:  http://localhost:8000/docs
echo ========================================
echo.
echo Closing this window does not stop the services.
pause
goto :eof

:kill_port
set PORT=%1
set LABEL=%2
for /f "tokens=5 delims= " %%p in ('netstat -ano ^| find ":%PORT% " ^| find "LISTENING"') do (
    echo       Killing old %LABEL% process (PID %%p^)...
    taskkill /PID %%p /F >nul 2>&1
)
goto :eof
