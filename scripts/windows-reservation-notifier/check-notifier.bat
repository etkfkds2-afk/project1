@echo off
setlocal
cd /d "%~dp0"

echo.
echo [Allthatmind Reservation Notifier]
echo Scheduled task status:
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$t = Get-ScheduledTask -TaskName AllthatmindReservationNotifier -ErrorAction SilentlyContinue; if (!$t) { Write-Host 'NOT INSTALLED' -ForegroundColor Red } else { $i = Get-ScheduledTaskInfo -TaskName AllthatmindReservationNotifier; $t | Format-List TaskName,State,Description; $i | Format-List LastRunTime,LastTaskResult,NextRunTime; Write-Host ('Execution limit: ' + $t.Settings.ExecutionTimeLimit); Write-Host ('Action: ' + $t.Actions.Execute + ' ' + $t.Actions.Arguments) }"

echo.
echo Runtime status:
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p = Join-Path $env:APPDATA 'AllthatmindReservationNotifier\status.json'; if (Test-Path $p) { Get-Content -Raw $p } else { Write-Host 'No runtime status found:' $p -ForegroundColor Yellow }"

echo.
echo Latest log:
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p = Join-Path $env:APPDATA 'AllthatmindReservationNotifier\notifier.log'; if (Test-Path $p) { Get-Content $p -Tail 40 } else { Write-Host 'No log file found:' $p }"

echo.
pause
