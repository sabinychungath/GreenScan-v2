@echo off
echo.
echo =============================================
echo       🌍 Nature Talks App Server
echo =============================================
echo.
echo Starting local web server...
echo.
echo ✅ Clarifai AI will work when using web server
echo ❌ Clarifai AI blocked when opening HTML directly
echo.
echo 🌐 Open your browser and go to:
echo    http://localhost:8000
echo.
echo 🛑 Press Ctrl+C to stop the server
echo =============================================
echo.
cd /d "%~dp0"
python -m http.server 8000
echo.
echo Server stopped.
pause