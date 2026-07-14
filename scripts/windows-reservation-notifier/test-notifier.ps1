$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$notify = New-Object System.Windows.Forms.NotifyIcon
$openUrl = "https://project1-8fj.pages.dev/payment?view=reservation"
$notify.add_BalloonTipClicked({
  Start-Process $openUrl
})
$notify.add_Click({
  Start-Process $openUrl
})
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$notify.BalloonTipTitle = "올댓마인드 알림 테스트"
$notify.BalloonTipText = "이 알림이 보이면 Windows 알림은 정상입니다."
$notify.Visible = $true
$notify.ShowBalloonTip(10000)
Start-Sleep -Seconds 4
$notify.ShowBalloonTip(10000)
Start-Sleep -Seconds 8
$notify.Dispose()

Write-Host "Test notification finished."
