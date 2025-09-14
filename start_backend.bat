@echo off
echo.
echo =============================================
echo    🌍 Nature Talks - Secure Backend Server
echo =============================================
echo.
echo Installing dependencies...
call npm install
echo.
echo ✅ Clarifai API Key: SECURE on backend
echo ❌ No CORS issues 
echo 🔒 Frontend calls secure /api/classify endpoint
echo.
echo Starting backend server...
echo.
echo 🌐 Open your browser and go to:
echo    http://localhost:3000
echo.
echo 🛑 Press Ctrl+C to stop the server
echo =============================================
echo.
npm start
echo.
echo Backend stopped.
pause