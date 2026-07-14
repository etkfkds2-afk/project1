param(
  [int]$PollSeconds = 60,
  [switch]$NotifyExisting
)

$ErrorActionPreference = "Stop"

$appDir = Join-Path $env:APPDATA "AllthatmindReservationNotifier"
$configPath = Join-Path $appDir "config.json"
$seenPath = Join-Path $appDir "seen-reservations.json"
$logPath = Join-Path $appDir "notifier.log"

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

function Show-ReservationToast {
  param(
    [string]$Title,
    [string]$Message
  )

  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

  $notify = New-Object System.Windows.Forms.NotifyIcon
  $notify.Icon = [System.Drawing.SystemIcons]::Information
  $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
  $notify.BalloonTipTitle = $Title
  $notify.BalloonTipText = $Message
  $notify.Visible = $true
  $notify.ShowBalloonTip(10000)
  Start-Sleep -Seconds 12
  $notify.Dispose()
}

function Get-ReservationBranch {
  param($Item)
  $branchName = [string]$Item.branchName
  $total = [string]$Item.total
  if (!$total) { $total = [string]$Item.estimateText }
  if ($branchName.Contains("신논현") -or $total.Contains("신논현")) { return "신논현점" }
  if ($branchName.Contains("문래") -or $total.Contains("문래")) { return "문래점" }
  if ($Item._branch -eq "sinnonhyeon") { return "신논현점" }
  return "문래점"
}

function Get-Reservations {
  param($Config)

  $headers = @{ Authorization = "Bearer $($Config.token)" }
  $items = @()

  foreach ($branch in $Config.branches) {
    $url = "$($branch.baseUrl.TrimEnd('/'))/reservations"
    $response = Invoke-RestMethod -Method Get -Uri $url -Headers $headers -TimeoutSec 30
    foreach ($item in @($response.items)) {
      $item | Add-Member -NotePropertyName "_branch" -NotePropertyValue $branch.name -Force
      $items += $item
    }
  }

  return $items
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

while ($true) {
  try {
    $reservations = @(Get-Reservations -Config $config)
    $newItems = @()

    foreach ($item in $reservations) {
      $id = [string]$item._id
      if (!$id) { continue }
      if (!$seen.ContainsKey($id)) {
        $seen[$id] = $true
        $newItems += $item
      }
    }

    Save-JsonFile -Path $seenPath -Value @{ ids = @($seen.Keys) }

    if ($NotifyExisting -or $hadSeenFile) {
      foreach ($item in $newItems) {
        $branch = Get-ReservationBranch -Item $item
        $name = if ($item.name) { [string]$item.name } else { "이름 없음" }
        $phone = if ($item.phone) { [string]$item.phone } else { "연락처 없음" }
        $eventType = if ($item.eventType) { [string]$item.eventType } else { "행사명 없음" }
        Show-ReservationToast -Title "올댓마인드 새 예약신청" -Message "$branch`n$name / $phone`n$eventType"
        Write-Log "New reservation notified: $id / $branch / $name"
      }
    }
    $hadSeenFile = $true
  } catch {
    Write-Log "Polling failed: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds $PollSeconds
}
