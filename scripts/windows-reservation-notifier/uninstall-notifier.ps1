$ErrorActionPreference = "Stop"

$taskName = "AllthatmindReservationNotifier"

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "작업 스케줄러 제거 완료: $taskName"
} else {
  Write-Host "등록된 작업이 없습니다: $taskName"
}

Write-Host "설정/기록 파일은 유지됩니다: $env:APPDATA\AllthatmindReservationNotifier"
