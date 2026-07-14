@echo off
setlocal
cd /d "%~dp0"

echo.
echo [Allthatmind Reservation Notifier]
echo Installing Windows reservation notification task...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-notifier.ps1"

echo.
if errorlevel 1 (
  echo Installation failed. Please send this window text to support.
) else (
  echo Installation command finished.
)
echo.
pause
