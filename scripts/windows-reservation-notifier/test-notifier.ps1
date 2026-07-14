$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$notify.BalloonTipTitle = "Allthatmind notifier test"
$notify.BalloonTipText = "If you see this, Windows notifications are working."
$notify.Visible = $true
$notify.ShowBalloonTip(10000)
Start-Sleep -Seconds 12
$notify.Dispose()

Write-Host "Test notification finished."
