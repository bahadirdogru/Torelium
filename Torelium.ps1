Write-Host "=============================================="
Write-Host " TORELIUM STEALTH BROWSER v7.6"
Write-Host " CreepJS-Proof | Lifecycle Managed | Extension Injected"
Write-Host " Tor + Helium + Advanced Spoofing"
Write-Host "=============================================="

# 1. YAPILANDIRMA
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$torDir = Join-Path $scriptDir "tor"
$torExe = Join-Path $torDir "tor.exe"
$torLog = Join-Path $torDir "tor.log"
$torDataDir = Join-Path $torDir "data"
$torCookieFile = Join-Path $torDataDir "control_auth_cookie"

$heliumDir = Join-Path $scriptDir "helium"
$helium = Join-Path $heliumDir "chrome.exe"
$profileRoot = "$env:TEMP\helium_profiles"
$extensionSrc = Join-Path $scriptDir "extension"

$bridgeToken = [guid]::NewGuid().ToString('N')

$script:profilePath = $null
$script:bridgeJob = $null

# Expected SHA256 hashes — update these from official release pages when changing versions
$torExpectedHash = "UPDATE_WITH_REAL_HASH_FROM_TORPROJECT_ORG"
$heliumExpectedHash = "UPDATE_WITH_REAL_HASH_FROM_GITHUB_RELEASE"

function Test-FileHash {
    param($FilePath, $ExpectedHash)
    if ($ExpectedHash -like "UPDATE_*") {
        Write-Host "[GUVENLIK] Hash dogrulamasi yapilandirilmamis. Lutfen bilinen hash'i ayarlayin." -ForegroundColor Yellow
        return $true
    }
    $actualHash = (Get-FileHash -Path $FilePath -Algorithm SHA256).Hash
    if ($actualHash -ne $ExpectedHash) {
        Write-Host "[GUVENLIK] Hash uyusmazligi! Dosya: $FilePath" -ForegroundColor Red
        Write-Host "  Beklenen : $ExpectedHash" -ForegroundColor Red
        Write-Host "  Gercek   : $actualHash" -ForegroundColor Red
        return $false
    }
    Write-Host "[GUVENLIK] Hash dogrulandi." -ForegroundColor Green
    return $true
}

function Get-Tor {
    if (-not (Test-Path $torExe)) {
        Write-Host "[TOR] Tor bulunamadi, indiriliyor..." -ForegroundColor Yellow
        $url = "https://archive.torproject.org/tor-package-archive/torbrowser/15.0.7/tor-expert-bundle-windows-x86_64-15.0.7.tar.gz"
        $zipFile = Join-Path $scriptDir "tor-expert-bundle.tar.gz"

        try {
            Invoke-WebRequest -Uri $url -OutFile $zipFile -UseBasicParsing -ErrorAction Stop

            if (-not (Test-FileHash -FilePath $zipFile -ExpectedHash $torExpectedHash)) {
                Remove-Item $zipFile -ErrorAction SilentlyContinue
                Write-Host "[HATA] Tor arsivi hash dogrulamasindan gecemedi." -ForegroundColor Red
                exit 1
            }

            Write-Host "[TOR] Indirme tamamlandi, ayiklaniyor..." -ForegroundColor Cyan

            if (-not (Test-Path $torDir)) { New-Item -ItemType Directory -Path $torDir -Force | Out-Null }

            tar -xf $zipFile -C $torDir --strip-components=1

            Remove-Item $zipFile -ErrorAction SilentlyContinue
            Write-Host "[TOR] Hazir." -ForegroundColor Green
        }
        catch {
            Write-Host "[HATA] Tor indirme hatasi olustu." -ForegroundColor Red
            exit 1
        }
    }
}

function Get-Helium {
    if (-not (Test-Path $helium) -and -not (Get-ChildItem -Path $heliumDir -Recurse -Filter "chrome.exe" -ErrorAction SilentlyContinue)) {
        Write-Host "[HELIUM] Helium bulunamadi, indiriliyor..." -ForegroundColor Yellow
        $url = "https://github.com/imputnet/helium-windows/releases/download/0.9.4.1/helium_0.9.4.1_x64-windows.zip"
        $zipFile = Join-Path $scriptDir "helium.zip"

        try {
            Invoke-WebRequest -Uri $url -OutFile $zipFile -UseBasicParsing -ErrorAction Stop

            if (-not (Test-FileHash -FilePath $zipFile -ExpectedHash $heliumExpectedHash)) {
                Remove-Item $zipFile -ErrorAction SilentlyContinue
                Write-Host "[HATA] Helium arsivi hash dogrulamasindan gecemedi." -ForegroundColor Red
                exit 1
            }

            Write-Host "[HELIUM] Indirme tamamlandi, ayiklaniyor..." -ForegroundColor Cyan

            if (-not (Test-Path $heliumDir)) { New-Item -ItemType Directory -Path $heliumDir -Force | Out-Null }

            Expand-Archive -Path $zipFile -DestinationPath $heliumDir -Force
            Remove-Item $zipFile -ErrorAction SilentlyContinue
            Write-Host "[HELIUM] Hazir." -ForegroundColor Green
        }
        catch {
            Write-Host "[HATA] Helium indirme hatasi olustu." -ForegroundColor Red
            exit 1
        }
    }

    $found = Get-ChildItem -Path $heliumDir -Recurse -Filter "chrome.exe" | Select-Object -First 1
    if ($found) { $script:helium = $found.FullName }
}

# ESKİ PROFİLLERİ TEMİZLE
if (Test-Path $profileRoot) {
    Get-ChildItem $profileRoot -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path $profileRoot | Out-Null

function New-IsolatedProfile {
    $profilePath = Join-Path $profileRoot ("profile_" + (Get-Random))
    New-Item -ItemType Directory -Path $profilePath | Out-Null
    return $profilePath
}

function Stop-Bridge {
    $port = 9060
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
    if ($process) { Stop-Process -Id $process -Force -ErrorAction SilentlyContinue }
    if ($script:bridgeJob) {
        Stop-Job $script:bridgeJob -ErrorAction SilentlyContinue
        Remove-Job $script:bridgeJob -ErrorAction SilentlyContinue
    } else {
        Get-Job | Stop-Job -ErrorAction SilentlyContinue
        Get-Job | Remove-Job -ErrorAction SilentlyContinue
    }
}

function Stop-Tor {
    Write-Host "[TOR] Temizleniyor..." -ForegroundColor DarkGray
    Stop-Bridge
    Get-Process -Name "tor" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Start-Tor {
    Stop-Tor
    Get-Tor
    Write-Host "[TOR] Baslatiliyor..." -ForegroundColor Cyan
    if (Test-Path $torLog) { Remove-Item $torLog -ErrorAction SilentlyContinue }
    if (-not (Test-Path $torDataDir)) { New-Item -ItemType Directory -Path $torDataDir -Force | Out-Null }

    $torArgs = "--ControlPort 9051 --CookieAuthentication 1 --DataDirectory ""$torDataDir"" --Log ""notice file tor.log"""
    $global:torProcess = Start-Process $torExe -WorkingDirectory $torDir -ArgumentList $torArgs -PassThru

    $connected = $false
    $timeout = 30
    while (-not $connected -and $timeout -gt 0) {
        Start-Sleep 2
        if (Test-Path $torLog) {
            $log = Get-Content $torLog -Tail 50 -ErrorAction SilentlyContinue
            if ($log -match "Bootstrapped 100%") { $connected = $true }
        }
        $timeout -= 2
    }
    if ($connected) { Write-Host "[TOR] Baglanti basarili." -ForegroundColor Green }
}

function Invoke-TorNewnym {
    try {
        $cookieHex = [BitConverter]::ToString([IO.File]::ReadAllBytes($torCookieFile)).Replace("-", "")
        $tcp = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 9051)
        $stream = $tcp.GetStream()
        $writer = New-Object System.IO.StreamWriter($stream)
        $writer.AutoFlush = $true
        $writer.WriteLine("AUTHENTICATE $cookieHex")
        $writer.WriteLine("SIGNAL NEWNYM")
        $writer.WriteLine("QUIT")
        $tcp.Close()
        Write-Host "[TOR] Yeni devre olusturuldu." -ForegroundColor Yellow
    }
    catch {
        Write-Host "[TOR] Kontrol portu hatasi!" -ForegroundColor Red
    }
}

function New-SpoofExtension {
    param($profilePath, $token)
    $extPath = Join-Path $profilePath "ToreliumExtension"
    New-Item -ItemType Directory -Path $extPath -Force | Out-Null
    Copy-Item -Path "$extensionSrc\*" -Destination $extPath -Force -Recurse
    $bridgeConfig = @{ token = $token } | ConvertTo-Json
    Set-Content -Path (Join-Path $extPath "bridge_config.json") -Value $bridgeConfig -Force
    Write-Host "[EXTENSION] Yuklendi." -ForegroundColor Cyan
    return $extPath
}

function Invoke-Cleanup {
    if ($script:bridgeJob) {
        Stop-Job $script:bridgeJob -ErrorAction SilentlyContinue
        Remove-Job $script:bridgeJob -ErrorAction SilentlyContinue
        $script:bridgeJob = $null
    }
    if ($global:torProcess -and -not $global:torProcess.HasExited) {
        Stop-Process -Id $global:torProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Get-Process -Name "tor" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if ($script:profilePath -and (Test-Path $script:profilePath)) {
        Remove-Item -Recurse -Force $script:profilePath -ErrorAction SilentlyContinue
    }
    Write-Host "[TORELIUM] Kapatildi." -ForegroundColor Green
}

Register-EngineEvent PowerShell.Exiting -Action { Invoke-Cleanup } | Out-Null

# STARTUP
Stop-Tor
Get-Helium
$script:profilePath = New-IsolatedProfile
Start-Tor
Invoke-TorNewnym

# Start Bridge Job on Port 9060
$script:bridgeJob = Start-Job -ArgumentList $bridgeToken, $torCookieFile -ScriptBlock {
    param($token, $cookieFile)

    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://127.0.0.1:9060/")
    $listener.Prefixes.Add("http://localhost:9060/")
    try {
        $listener.Start()
        while ($listener.IsListening) {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response

            # CORS — token auth provides real security; CORS is permissive for localhost bridge
            $origin = $request.Headers["Origin"]
            if ($origin) {
                $response.Headers.Add("Access-Control-Allow-Origin", $origin)
            } else {
                $response.Headers.Add("Access-Control-Allow-Origin", "*")
            }
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, X-Bridge-Token")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }

            # Token authentication
            $reqToken = $request.Headers["X-Bridge-Token"]
            if ($reqToken -ne $token) {
                $result = @{ success = $false; message = "unauthorized" }
                $json = $result | ConvertTo-Json -Compress
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 403
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }

            $path = $request.Url.AbsolutePath
            $result = @{ success = $false; message = "Invalid command" }

            if ($path -eq "/ping") { $result = @{ success = $true; message = "pong" } }
            elseif ($path -eq "/newnym") {
                try {
                    $cookieHex = [BitConverter]::ToString([IO.File]::ReadAllBytes($cookieFile)).Replace("-", "")
                    $tcp = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 9051)
                    $w = New-Object System.IO.StreamWriter($tcp.GetStream())
                    $w.AutoFlush = $true
                    $w.WriteLine("AUTHENTICATE $cookieHex")
                    $w.WriteLine("SIGNAL NEWNYM")
                    $w.WriteLine("QUIT")
                    $tcp.Close()
                    $result = @{ success = $true; message = "NEWNYM sent" }
                } catch { $result = @{ success = $false; message = "Tor control error" } }
            }
            elseif ($path -eq "/country") {
                $ip = $request.QueryString["ip"]
                if ($ip -and $ip -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
                    $country = "Unknown"
                    try {
                        $cookieHex = [BitConverter]::ToString([IO.File]::ReadAllBytes($cookieFile)).Replace("-", "")
                        $tcp = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 9051)
                        $w = New-Object System.IO.StreamWriter($tcp.GetStream())
                        $w.AutoFlush = $true
                        $w.WriteLine("AUTHENTICATE $cookieHex")
                        $w.WriteLine("GETINFO ip-to-country/$ip")
                        $reader = New-Object System.IO.StreamReader($tcp.GetStream())
                        while ($line = $reader.ReadLine()) {
                            if ($line -match "ip-to-country/.*=([A-Z]{2})") { $country = $matches[1]; break }
                            if ($line -match "250 OK") { break }
                        }
                        $tcp.Close()
                    } catch {}
                    $result = @{ success = $true; country = $country }
                } else {
                    $result = @{ success = $false; message = "Invalid IP format" }
                }
            }
            $json = $result | ConvertTo-Json -Compress
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
        }
    } catch { Write-Error "Bridge error occurred" }
}

# Wait for bridge to be ready before starting browser
$bridgeReady = $false
$retries = 10
while (-not $bridgeReady -and $retries -gt 0) {
    Start-Sleep 1
    try {
        $testResp = Invoke-WebRequest -Uri "http://127.0.0.1:9060/ping" -Headers @{ "X-Bridge-Token" = $bridgeToken } -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($testResp.StatusCode -eq 200) { $bridgeReady = $true }
    } catch { $retries-- }
}
if ($bridgeReady) {
    Write-Host "[BRIDGE] Aktif: http://127.0.0.1:9060" -ForegroundColor Green
} else {
    Write-Host "[BRIDGE] UYARI: Bridge baslatilamadi! Job durumu kontrol ediliyor..." -ForegroundColor Red
    Receive-Job $script:bridgeJob -ErrorAction SilentlyContinue
}

$spoofExtension = New-SpoofExtension $script:profilePath $bridgeToken

# Build a single argument string for better space/quote handling
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.116 Safari/537.36"
$chromeParams = @(
    "--user-data-dir=""$($script:profilePath)"""
    "--load-extension=""$spoofExtension"""
    "--test-type"
    "--disable-infobars"
    "--disable-notifications"
    "--disable-popup-blocking"
    "--proxy-server=socks5://127.0.0.1:9050"
    "--proxy-bypass-list=`"<-loopback>`""
    "--disable-features=TranslateUI,VizDisplayCompositor"
    "--disable-blink-features=AutomationControlled"
    "--disable-default-apps"
    "--disable-ipc-flooding-protection"
    "--disable-renderer-backgrounding"
    "--disable-backgrounding-occluded-windows"
    "--disable-field-trial-config"
    "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"
    "--disable-webrtc-multiple-routes"
    "--disable-webrtc-hw-decoding"
    "--disable-webrtc-hw-encoding"
    "--use-fake-device-for-media-stream"
    "--use-fake-ui-for-media-stream"
    "--disable-media-stream"
    "--disable-reading-from-canvas"
    "--disable-webgl"
    "--disable-accelerated-2d-canvas"
    "--disable-accelerated-video-decode"
    "--disable-gpu-sandbox"
    "--disable-plugins-discovery"
    "--disable-device-discovery-notifications"
    "--disable-speech-api"
    "--disable-background-networking"
    "--disable-background-timer-throttling"
    "--disable-client-side-phishing-detection"
    "--disable-sync"
    "--disable-translate"
    "--window-size=1366,768"
    "--window-position=100,100"
    "--force-device-scale-factor=1"
    "--use-gl=angle"
    "--use-angle=d3d11"
    "--max_old_space_size=4096"
    "--lang=en-US"
    "--force-time-zone=America/New_York"
    "--tz=America/New_York"
    "--accept-lang=en-US,en"
    "--user-agent=""$ua"""
    "--enable-precise-memory-info"
    "--no-first-run"
    "--no-default-browser-check"
    "--disable-logging"
    "--silent-debugger-extension-api"
    "--new-window"
    "https://check.torproject.org/"
    "https://abrahamjuliot.github.io/creepjs/"
)

# Convert array to a single string for Start-Process to avoid argument splitting
$argString = $chromeParams -join " "

if (Test-Path $helium) {
    try {
        $env:TZ = "America/New_York"
        $browserProcess = Start-Process -FilePath $helium -ArgumentList $argString -PassThru
        $browserProcess | Wait-Process
    }
    catch {
        Write-Host "[HATA] Helium baslatilamadi." -ForegroundColor Red
    }
    finally {
        Invoke-Cleanup
    }
} else {
    Write-Host "[HATA] Helium bulunamadi." -ForegroundColor Red
    Invoke-Cleanup
}
