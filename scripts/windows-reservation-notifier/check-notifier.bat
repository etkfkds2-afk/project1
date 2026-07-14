@echo off
setlocal
cd /d "%~dp0"

echo.
echo [Allthatmind Reservation Notifier]
echo Scheduled task status:
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-ScheduledTask -TaskName AllthatmindReservationNotifier | Format-List TaskName,State"

echo.
echo Latest log:
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p = Join-Path $env:APPDATA 'AllthatmindReservationNotifier\notifier.log'; if (Test-Path $p) { Get-Content $p -Tail 40 } else { Write-Host 'No log file found:' $p }"

echo.
pause
