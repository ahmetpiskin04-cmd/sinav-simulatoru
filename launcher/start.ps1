# Sınav Simülatörü başlatıcı (masaüstü kısayolu start.vbs üzerinden çağırır)
# - Sunucu zaten açıksa yalnızca pencereyi açar
# - Kod son derlemeden sonra değiştiyse önce derler (next build)
# - Sunucuyu (next start) gizli başlatır; "açılıyor" sayfası hazır olunca uygulamaya geçer
$ErrorActionPreference = 'Stop'
$Root    = Split-Path -Parent $PSScriptRoot
$Port    = 3456
$Url     = "http://127.0.0.1:$Port/"
$Log     = Join-Path $PSScriptRoot 'server.log'
$ErrLog  = Join-Path $PSScriptRoot 'server.err.log'
$Loading = Join-Path $PSScriptRoot 'loading.html'

Add-Type -AssemblyName System.Windows.Forms
function Show-Error([string]$Text) {
    [System.Windows.Forms.MessageBox]::Show($Text, 'Sınav Simülatörü', 'OK', 'Error') | Out-Null
}

function Open-Window([string]$Address) {
    $edge = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($edge) {
        # Uygulama penceresi: adres çubuğu ve sekmeler olmadan, masaüstü uygulaması gibi
        Start-Process -FilePath $edge -ArgumentList "--app=$Address", '--window-size=1280,860'
    } else {
        Start-Process $Address
    }
}

function Test-AppRunning {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        return ($r.Content -match 'Sınav Simülatörü')
    } catch { return $false }
}

# 1) Zaten çalışıyorsa sadece aç
if (Test-AppRunning) { Open-Window $Url; exit 0 }

# 2) Port başka bir programdaysa uyar
$busy = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if ($busy.Count -gt 0) {
    Show-Error "$Port numaralı port başka bir program tarafından kullanılıyor (süreç: $($busy[0].OwningProcess)). O programı kapatıp tekrar deneyin."
    exit 1
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Show-Error 'Node.js bulunamadı. https://nodejs.org adresinden kurup tekrar deneyin.'; exit 1 }
$nextBin = Join-Path $Root 'node_modules\next\dist\bin\next'
if (-not (Test-Path $nextBin)) { Show-Error "Paketler kurulu değil. Proje klasöründe 'npm install' çalıştırın:`n$Root"; exit 1 }

# 3) Derleme gerekiyor mu? (.next\BUILD_ID yoksa ya da kaynak dosyalardan eskiyse)
$buildId = Join-Path $Root '.next\BUILD_ID'
$needBuild = -not (Test-Path $buildId)
if (-not $needBuild) {
    $builtAt = (Get-Item $buildId).LastWriteTimeUtc
    $sources = @(Get-ChildItem -Path (Join-Path $Root 'src') -Recurse -File)
    foreach ($f in 'package.json', 'next.config.ts', 'tsconfig.json', '.env.local') {
        $p = Join-Path $Root $f
        if (Test-Path $p) { $sources += Get-Item $p }
    }
    $needBuild = @($sources | Where-Object { $_.LastWriteTimeUtc -gt $builtAt }).Count -gt 0
}

# 4) "Açılıyor" sayfasını hemen göster (derleme/başlatma sürerken boş ekran olmasın)
$loadingUrl = ([System.Uri]$Loading).AbsoluteUri + "?port=$Port&build=$([int]$needBuild)"
Open-Window $loadingUrl

if ($needBuild) {
    $b = Start-Process -FilePath $node -ArgumentList "`"$nextBin`"", 'build' -WorkingDirectory $Root `
         -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput $Log -RedirectStandardError $ErrLog
    if ($b.ExitCode -ne 0) {
        Show-Error "Uygulama derlenemedi. Ayrıntılar:`n$Log`n$ErrLog"
        exit 1
    }
}

# 5) Sunucuyu gizli başlat; bu betik bittikten sonra da çalışmaya devam eder
# -H 127.0.0.1: yalnızca bu bilgisayardan erişilir (ev ağındaki diğer cihazlar göremez)
Start-Process -FilePath $node -ArgumentList "`"$nextBin`"", 'start', '-p', "$Port", '-H', '127.0.0.1' -WorkingDirectory $Root `
    -WindowStyle Hidden -RedirectStandardOutput $Log -RedirectStandardError $ErrLog | Out-Null
