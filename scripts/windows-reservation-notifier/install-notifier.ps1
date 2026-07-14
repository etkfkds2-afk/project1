$ErrorActionPreference = "Stop"

$taskName = "AllthatmindReservationNotifier"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$notifierPath = Join-Path $scriptDir "reservation-notifier.ps1"
$appDir = Join-Path $env:APPDATA "AllthatmindReservationNotifier"
$configPath = Join-Path $appDir "config.json"

if (!(Test-Path $notifierPath)) {
  throw "reservation-notifier.ps1 not found: $notifierPath"
}

New-Item -ItemType Directory -Force -Path $appDir | Out-Null

$token = Read-Host "예약관리 API 토큰을 입력하세요"
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "예약관리 API 토큰이 비어 있습니다."
}

$config = @{
  token = $token.Trim()
  branches = @(
    @{
      name = "munrae"
      baseUrl = "https://www.allthatmind.com/_functions"
    },
    @{
      name = "sinnonhyeon"
      baseUrl = "https://allthatmind2.wixsite.com/website/_functions"
    }
  )
}

$config | ConvertTo-Json -Depth 8 | Set-Content -Path $configPath -Encoding UTF8

$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$notifierPath`""
$action = New-ScheduledTaskAction -Execute $powershell -Argument $argument
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "올댓마인드 예약관리 새 예약 Windows 알림" -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "설치 완료: $taskName"
Write-Host "설정 파일: $configPath"
Write-Host "알림 감시가 지금 시작되었습니다."
