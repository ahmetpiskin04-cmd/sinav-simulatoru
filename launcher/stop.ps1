# Arka planda çalışan Sınav Simülatörü sunucusunu kapatır
$Port = 3456
$stopped = 0
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'sinav-simulatoru' -and $_.CommandLine -match "start -p $Port" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $stopped++ }
Add-Type -AssemblyName System.Windows.Forms
$text = if ($stopped -gt 0) { 'Sınav Simülatörü kapatıldı.' } else { 'Sınav Simülatörü zaten çalışmıyordu.' }
[System.Windows.Forms.MessageBox]::Show($text, 'Sınav Simülatörü', 'OK', 'Information') | Out-Null
