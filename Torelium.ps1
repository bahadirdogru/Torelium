Write-Host "=============================================="
Write-Host " TORELIUM STEALTH BROWSER v7.6"
Write-Host " CreepJS-Proof | Lifecycle Managed | Extension Injected"
Write-Host " Tor + Helium + Advanced Spoofing"
Write-Host "=============================================="

# 1. YAPILANDIRMA
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$torDir = Join-Path $scriptDir "tor"
$torExe = Join-Path $torDir "tor.exe"
$torLog = Join-Path $torDir "tor.log"

$heliumDir = Join-Path $scriptDir "helium"
$helium = Join-Path $heliumDir "chrome.exe" # Will be searched if not here
$profileRoot = "$env:TEMP\helium_profiles"
$extensionSrc = Join-Path $scriptDir "extension"

function Get-Tor {
    if (-not (Test-Path $torExe)) {
        Write-Host "[TOR] Tor bulunamadi, indiriliyor..." -ForegroundColor Yellow
        $url = "https://archive.torproject.org/tor-package-archive/torbrowser/15.0.7/tor-expert-bundle-windows-x86_64-15.0.7.tar.gz"
        $zipFile = Join-Path $scriptDir "tor-expert-bundle.tar.gz"
        
        try {
            Invoke-WebRequest -Uri $url -OutFile $zipFile -ErrorAction Stop
            Write-Host "[TOR] Indirme tamamlandi, ayiklaniyor..." -ForegroundColor Cyan
            
            if (-not (Test-Path $torDir)) { New-Item -ItemType Directory -Path $torDir -Force | Out-Null }
            
            # Use tar.exe (built-in on Windows 10+)
            tar -xf $zipFile -C $torDir --strip-components=1
            
            Remove-Item $zipFile -ErrorAction SilentlyContinue
            Write-Host "[TOR] Hazir." -ForegroundColor Green
        }
        catch {
            Write-Host "[HATA] Tor indirilemedi: $_" -ForegroundColor Red
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
            Invoke-WebRequest -Uri $url -OutFile $zipFile -ErrorAction Stop
            Write-Host "[HELIUM] Indirme tamamlandi, ayiklaniyor..." -ForegroundColor Cyan
            
            if (-not (Test-Path $heliumDir)) { New-Item -ItemType Directory -Path $heliumDir -Force | Out-Null }
            
            Expand-Archive -Path $zipFile -DestinationPath $heliumDir -Force
            Remove-Item $zipFile -ErrorAction SilentlyContinue
            Write-Host "[HELIUM] Hazir." -ForegroundColor Green
        }
        catch {
            Write-Host "[HATA] Helium indirilemedi: $_" -ForegroundColor Red
            exit 1
        }
    }
    
    # Update $helium path by searching recursively if not at direct root
    $found = Get-ChildItem -Path $heliumDir -Recurse -Filter "chrome.exe" | Select-Object -First 1
    if ($found) { $script:helium = $found.FullName }
}

# ESKİ PROFILLERİ TEMİZLE
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
    Get-Job | Stop-Job -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -ErrorAction SilentlyContinue
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

    $torArgs = "--ControlPort 9051 --CookieAuthentication 0 --Log ""notice file tor.log"""
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
        $tcp = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 9051)
        $stream = $tcp.GetStream()
        $writer = New-Object System.IO.StreamWriter($stream)
        $writer.AutoFlush = $true
        $writer.WriteLine("AUTHENTICATE """"")
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
    param($profilePath)
    $extPath = Join-Path $profilePath "ToreliumExtension"
    New-Item -ItemType Directory -Path $extPath -Force | Out-Null
    Copy-Item -Path "$extensionSrc\*" -Destination $extPath -Force -Recurse
    Write-Host "[EXTENSION] Yuklendi." -ForegroundColor Cyan
    return $extPath
}

# STARTUP
Stop-Tor
Get-Helium
$profilePath = New-IsolatedProfile
Start-Tor
Invoke-TorNewnym

# Start Bridge Job on Port 9060
$bridgeJob = Start-Job -ScriptBlock {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://127.0.0.1:9060/")
    $listener.Prefixes.Add("http://localhost:9060/")
    try {
        $listener.Start()
        while ($listener.IsListening) {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response
            
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }

            $path = $request.Url.AbsolutePath
            $result = @{ success = $false; message = "Invalid command" }

            if ($path -eq "/ping") { $result = @{ success = $true; message = "pong" } }
            elseif ($path -eq "/newnym") {
                try {
                    $tcp = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 9051)
                    $w = New-Object System.IO.StreamWriter($tcp.GetStream())
                    $w.AutoFlush = $true
                    $w.WriteLine('AUTHENTICATE ""'); $w.WriteLine("SIGNAL NEWNYM"); $w.WriteLine("QUIT")
                    $tcp.Close()
                    $result = @{ success = $true; message = "NEWNYM sent" }
                } catch { $result = @{ success = $false; message = "Tor error: $_" } }
            }
            elseif ($path -eq "/country") {
                $ip = $request.QueryString["ip"]
                if ($ip) {
                    $country = "Unknown"
                    try {
                        $tcp = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 9051)
                        $w = New-Object System.IO.StreamWriter($tcp.GetStream())
                        $w.AutoFlush = $true
                        $w.WriteLine('AUTHENTICATE ""')
                        $w.WriteLine("GETINFO ip-to-country/$ip")
                        $reader = New-Object System.IO.StreamReader($tcp.GetStream())
                        while ($line = $reader.ReadLine()) {
                            if ($line -match "ip-to-country/.*=([A-Z]{2})") { $country = $matches[1]; break }
                            if ($line -match "250 OK") { break }
                        }
                        $tcp.Close()
                    } catch {}
                    $result = @{ success = $true; country = $country }
                }
            }
            $json = $result | ConvertTo-Json -Compress
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
        }
    } catch { Write-Error "Bridge Error: $_" }
}

Write-Host "[BRIDGE] Aktif: http://127.0.0.1:9060" -ForegroundColor Gray

$spoofExtension = New-SpoofExtension $profilePath

# Build a single argument string for better space/quote handling
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.116 Safari/537.36"
$chromeParams = @(
    "--user-data-dir=""$profilePath"""
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
}

# Cleanup
if ($bridgeJob) { Stop-Job $bridgeJob; Remove-Job $bridgeJob }
if ($global:torProcess) { Stop-Process -Id $global:torProcess.Id -Force -ErrorAction SilentlyContinue }
Stop-Tor
if (Test-Path $profilePath) { Remove-Item -Recurse -Force $profilePath -ErrorAction SilentlyContinue }
Write-Host "[TORELIUM] Kapatildi." -ForegroundColor Green