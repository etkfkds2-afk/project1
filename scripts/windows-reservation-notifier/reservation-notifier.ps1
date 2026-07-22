param(
  [int]$PollSeconds = 60,
  [switch]$NotifyExisting
)

$ErrorActionPreference = "Stop"

$appDir = Join-Path $env:APPDATA "AllthatmindReservationNotifier"
$configPath = Join-Path $appDir "config.json"
$seenPath = Join-Path $appDir "seen-reservations.json"
$logPath = Join-Path $appDir "notifier.log"
$statusPath = Join-Path $appDir "status.json"

function Write-Log {
  param([string]$Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logPath -Value "[$stamp] $Message"
}

function Read-JsonFile {
  param($Path, $Fallback)
  if (!(Test-Path $Path)) { return $Fallback }
  try {
    return Get-Content -Raw -Path $Path | ConvertFrom-Json
  } catch {
    Write-Log "JSON read failed: $Path / $($_.Exception.Message)"
    return $Fallback
  }
}

function Save-JsonFile {
  param($Path, $Value)
  $Value | ConvertTo-Json -Depth 8 | Set-Content -Path $Path -Encoding UTF8
}

function Save-Status {
  param(
    [string]$State,
    [string]$Message,
    $Branches = @{},
    [Nullable[datetime]]$LastSuccess = $null,
    [Nullable[datetime]]$LastNotification = $null
  )
  Save-JsonFile -Path $statusPath -Value @{
    state = $State
    message = $Message
    processId = $PID
    updatedAt = (Get-Date).ToString("o")
    lastSuccessAt = if ($LastSuccess) { $LastSuccess.Value.ToString("o") } else { $null }
    lastNotificationAt = if ($LastNotification) { $LastNotification.Value.ToString("o") } else { $null }
    branches = $Branches
  }
}

function Show-ReservationToast {
  param(
    [string]$Title,
    [string]$Message,
    [string]$ClickUrl = "https://project1-8fj.pages.dev/payment?view=reservation"
  )

  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

  $notify = New-Object System.Windows.Forms.NotifyIcon
  $openUrl = $ClickUrl
  $notify.add_BalloonTipClicked({
    Start-Process $openUrl
  })
  $notify.add_Click({
    Start-Process $openUrl
  })
  $notify.Icon = [System.Drawing.SystemIcons]::Information
  $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
  $notify.BalloonTipTitle = $Title
  $notify.BalloonTipText = $Message
  $notify.Visible = $true
  $notify.ShowBalloonTip(10000)
  Start-Sleep -Seconds 4
  $notify.ShowBalloonTip(10000)
  Start-Sleep -Seconds 8
  $notify.Dispose()
}

function Show-TestToast {
  Show-ReservationToast -Title "올댓마인드 알림 테스트" -Message "이 알림이 보이면 Windows 알림은 정상입니다."
}

function Get-ReservationBranch {
  param($Item)
  if ($Item._branch -eq "sinnonhyeon") { return "신논현점" }
  if ($Item._branch -eq "munrae") { return "문래점" }
  $branchName = [string]$Item.branchName
  $total = [string]$Item.total
  if (!$total) { $total = [string]$Item.estimateText }
  if ($branchName.Contains("신논현") -or $total.Contains("신논현")) { return "신논현점" }
  if ($branchName.Contains("문래") -or $total.Contains("문래")) { return "문래점" }
  return "문래점"
}

function Get-Reservations {
  param($Config)

  $headers = @{ Authorization = "Bearer $($Config.token)" }
  $items = @()
  $branchStatus = @{}

  foreach ($branch in $Config.branches) {
    $url = "$($branch.baseUrl.TrimEnd('/'))/reservations"
    try {
      $started = Get-Date
      $response = Invoke-RestMethod -Method Get -Uri $url -Headers $headers -TimeoutSec 30
      $branchItems = @($response.items)
      foreach ($item in $branchItems) {
        $item | Add-Member -NotePropertyName "_branch" -NotePropertyValue $branch.name -Force
        $items += $item
      }
      $elapsed = [math]::Round(((Get-Date) - $started).TotalMilliseconds)
      $branchStatus[$branch.name] = @{ ok = $true; count = $branchItems.Count; elapsedMs = $elapsed; error = $null }
    } catch {
      $message = $_.Exception.Message
      $branchStatus[$branch.name] = @{ ok = $false; count = 0; elapsedMs = $null; error = $message }
      Write-Log "Branch polling failed: $($branch.name) / $message"
    }
  }

  return @{ items = $items; branches = $branchStatus }
}

New-Item -ItemType Directory -Force -Path $appDir | Out-Null

if (!(Test-Path $configPath)) {
  Write-Log "Config file is missing: $configPath"
  throw "Config file is missing. Run install-notifier.ps1 first."
}

$config = Read-JsonFile -Path $configPath -Fallback $null
if (!$config -or !$config.token) {
  Write-Log "Config token is missing."
  throw "Reservation API token is missing. Run install-notifier.ps1 again."
}

$hadSeenFile = Test-Path $seenPath
$seenData = Read-JsonFile -Path $seenPath -Fallback @{ ids = @() }
$seen = @{}
foreach ($id in @($seenData.ids)) {
  if ($id) { $seen[[string]$id] = $true }
}

Write-Log "Reservation notifier started. PollSeconds=$PollSeconds NotifyExisting=$NotifyExisting"
$lastSuccess = $null
$lastNotification = $null
Save-Status -State "starting" -Message "Notifier started."

while ($true) {
  try {
    $pollResult = Get-Reservations -Config $config
    $reservations = @($pollResult.items)
    $successfulBranches = @($pollResult.branches.GetEnumerator() | Where-Object { $_.Value.ok })
    if ($successfulBranches.Count -eq 0) {
      throw "All reservation API branches failed."
    }
    $newItems = @()
    $lastSuccess = Get-Date
    Write-Log "Polling ok. SuccessfulBranches=$($successfulBranches.Count) ReservationCount=$($reservations.Count) SeenCount=$($seen.Count)"

    foreach ($item in $reservations) {
      $id = [string]$item._id
      if (!$id) { continue }
      $branchKey = [string]$item._branch
      $seenKey = "${branchKey}::$id"
      if (!$seen.ContainsKey($seenKey) -and !$seen.ContainsKey($id)) {
        $seen[$seenKey] = $true
        $newItems += $item
      } elseif (!$seen.ContainsKey($seenKey)) {
        $seen[$seenKey] = $true
      }
    }

    Save-JsonFile -Path $seenPath -Value @{ ids = @($seen.Keys) }

    if ($NotifyExisting -or $hadSeenFile) {
      foreach ($item in $newItems) {
        $branch = Get-ReservationBranch -Item $item
        $name = if ($item.name) { [string]$item.name } else { "이름 없음" }
        $phone = if ($item.phone) { [string]$item.phone } else { "연락처 없음" }
        $eventType = if ($item.eventType) { [string]$item.eventType } else { "행사명 없음" }
        Show-ReservationToast -Title "올댓마인드 새 예약신청" -Message "[새 예약 도착]`n$branch`n$name / $phone`n$eventType"
        $lastNotification = Get-Date
        Write-Log "New reservation notified: $id / $branch / $name"
      }
    }
    if (!$NotifyExisting -and !$hadSeenFile -and $newItems.Count -gt 0) {
      Write-Log "Initial seed completed without notifications. SeededCount=$($newItems.Count)"
    }
    $hadSeenFile = $true
    $partialFailure = @($pollResult.branches.GetEnumerator() | Where-Object { !$_.Value.ok }).Count -gt 0
    $state = if ($partialFailure) { "degraded" } else { "healthy" }
    $message = if ($partialFailure) { "One or more branches failed; healthy branches continue polling." } else { "All branches polled successfully." }
    Save-Status -State $state -Message $message -Branches $pollResult.branches -LastSuccess $lastSuccess -LastNotification $lastNotification
  } catch {
    Write-Log "Polling failed: $($_.Exception.Message)"
    Save-Status -State "error" -Message $_.Exception.Message -Branches $(if ($pollResult) { $pollResult.branches } else { @{} }) -LastSuccess $lastSuccess -LastNotification $lastNotification
  }

  Start-Sleep -Seconds $PollSeconds
}
