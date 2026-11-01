@echo off
chcp 65001 >nul
echo ====================================================================
echo   KHỞI ĐỘNG HỆ THỐNG IOT LANDSLIDE GUARD (LOCAL RUN)
echo ====================================================================

echo [1/2] Đang khởi động Backend API (Cổng 5000)...
start "Landslide Backend" cmd /k "cd backend && node src/index.js"

timeout /t 2 >nul

echo [2/2] Đang khởi động Frontend Web Dashboard (Cổng 3001)...
start "Landslide Frontend" cmd /k "cd frontend && node node_modules\vite\bin\vite.js"

echo.
echo ====================================================================
echo  Hệ thống đang chạy!
echo  - Backend:  http://localhost:5000
echo  - Frontend: http://localhost:3001
echo ====================================================================
echo.
pause
