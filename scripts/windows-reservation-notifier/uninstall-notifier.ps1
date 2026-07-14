$ErrorActionPreference = "Stop"

$taskName = "AllthatmindReservationNotifier"

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "Scheduled task removed: $taskName"
} else {
  Write-Host "Scheduled task not found: $taskName"
}

Write-Host "Config and history files remain at: $env:APPDATA\AllthatmindReservationNotifier"
