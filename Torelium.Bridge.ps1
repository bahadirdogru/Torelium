# Torelium HTTP Bridge — TcpListener (http.sys / Start-Job HttpListener sorunlarindan kacinir)
# Kullanim: pwsh -NoProfile -File Torelium.Bridge.ps1 -Token <guid> -CookieFile <path>
param(
    [Parameter(Mandatory = $true)][string]$Token,
    [Parameter(Mandatory = $true)][string]$CookieFile
)

$ErrorActionPreference = 'Stop'
$port = 9060

function Send-TorNewnym {
    $cookieHex = [BitConverter]::ToString([IO.File]::ReadAllBytes($CookieFile)).Replace("-", "")
    $tcp = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 9051)
    try {
        $stream = $tcp.GetStream()
        $stream.ReadTimeout = 5000
        $w = New-Object System.IO.StreamWriter($stream)
        $w.AutoFlush = $true
        $r = New-Object System.IO.StreamReader($stream)

        # AUTHENTICATE and wait for response
        $w.WriteLine("AUTHENTICATE $cookieHex")
        $authResp = $r.ReadLine()
        if ($null -eq $authResp -or -not $authResp.StartsWith("250")) {
            throw "AUTHENTICATE failed: $authResp"
        }

        # SIGNAL NEWNYM and wait for response
        $w.WriteLine("SIGNAL NEWNYM")
        $nymResp = $r.ReadLine()
        if ($null -eq $nymResp -or -not $nymResp.StartsWith("250")) {
            throw "SIGNAL NEWNYM failed: $nymResp"
        }

        # Clean disconnect
        $w.WriteLine("QUIT")
        try { $r.ReadLine() | Out-Null } catch {}
    }
    finally {
        $tcp.Close()
    }
}

function Get-TorCountryCode {
    param([string]$ip)
    $cookieHex = [BitConverter]::ToString([IO.File]::ReadAllBytes($CookieFile)).Replace("-", "")
    $tcp = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 9051)
    try {
        $stream = $tcp.GetStream()
        $stream.ReadTimeout = 10000
        $w = New-Object System.IO.StreamWriter($stream)
        $w.AutoFlush = $true
        $r = New-Object System.IO.StreamReader($stream)
        $w.WriteLine("AUTHENTICATE $cookieHex")
        $w.WriteLine("GETINFO ip-to-country/$ip")
        $w.Flush()
        $country = "Unknown"
        for ($n = 0; $n -lt 32; $n++) {
            $line = $r.ReadLine()
            if ($null -eq $line) { break }
            if ($line -match 'ip-to-country/.*=([A-Z]{2})') { $country = $matches[1]; break }
            if ($line -match '^250 OK') { break }
        }
        $w.WriteLine("QUIT")
        $w.Flush()
        return $country
    }
    finally {
        $tcp.Close()
    }
}

function Write-HttpResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        [hashtable]$ExtraHeaders,
        [byte[]]$Body
    )
    if ($null -eq $Body) { $Body = [byte[]]@() }
    $h = [ordered]@{}
    foreach ($k in $ExtraHeaders.Keys) { $h[$k] = $ExtraHeaders[$k] }
    $h['Content-Type'] = 'application/json; charset=utf-8'
    $h['Content-Length'] = $Body.Length.ToString()
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append("HTTP/1.1 $StatusCode $StatusText`r`n")
    foreach ($key in $h.Keys) {
        [void]$sb.Append($key).Append(': ').Append($h[$key]).Append("`r`n")
    }
    [void]$sb.Append("`r`n")
    $headerBytes = [Text.Encoding]::UTF8.GetBytes($sb.ToString())
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($Body.Length -gt 0) { $stream.Write($Body, 0, $Body.Length) }
}

try {
    if (-not (Test-Path -LiteralPath $CookieFile)) {
        [Console]::Error.WriteLine("[BRIDGE] Cookie yok: $CookieFile")
        exit 2
    }

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    $listener.Start()

    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 15000
            $stream.WriteTimeout = 15000
            $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::UTF8, $false, 8192, $true)

            $reqLine = $reader.ReadLine()
            if ($null -eq $reqLine) { continue }
            if ($reqLine -notmatch '^(GET|OPTIONS)\s+(\S+)\s+HTTP/\d') { continue }

            $method = $matches[1]
            $target = $matches[2]
            $uri = [Uri]::new("http://127.0.0.1$target")
            $path = $uri.AbsolutePath

            $headers = @{}
            while ($true) {
                $line = $reader.ReadLine()
                if ($null -eq $line) { break }
                if ($line -eq '') { break }
                if ($line -match '^([^:]+):\s*(.*)$') {
                    $headers[$matches[1].ToLowerInvariant()] = $matches[2].Trim()
                }
            }

            $origin = $headers['origin']
            $cors = if ($origin) { $origin } else { '*' }

            $common = @{
                'Access-Control-Allow-Origin'      = $cors
                'Access-Control-Allow-Methods'     = 'GET, POST, OPTIONS'
                'Access-Control-Allow-Headers'     = 'Content-Type, X-Bridge-Token'
                'Connection'                       = 'close'
            }

            if ($method -eq 'OPTIONS') {
                Write-HttpResponse -Stream $stream -StatusCode 200 -StatusText 'OK' -ExtraHeaders $common -Body ([byte[]]@())
                continue
            }

            $reqToken = $headers['x-bridge-token']
            if ($reqToken -ne $Token) {
                $json = (@{ success = $false; message = 'unauthorized' } | ConvertTo-Json -Compress)
                $body = [Text.Encoding]::UTF8.GetBytes($json)
                Write-HttpResponse -Stream $stream -StatusCode 403 -StatusText 'Forbidden' -ExtraHeaders $common -Body $body
                continue
            }

            $result = @{ success = $false; message = 'Invalid command' }

            if ($path -eq '/ping') {
                $result = @{ success = $true; message = 'pong' }
            }
            elseif ($path -eq '/newnym') {
                try {
                    Send-TorNewnym
                    $result = @{ success = $true; message = 'NEWNYM sent' }
                }
                catch {
                    $result = @{ success = $false; message = "Tor control error: $($_.Exception.Message)" }
                }
            }
            elseif ($path -eq '/country') {
                $q = $uri.Query.TrimStart('?')
                $ip = $null
                if ($q -match '(^|&)ip=([^&]+)') {
                    $ip = [Uri]::UnescapeDataString($matches[2])
                }
                if ($ip -and $ip -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
                    try {
                        $c = Get-TorCountryCode -ip $ip
                        $result = @{ success = $true; country = $c }
                    }
                    catch {
                        $result = @{ success = $true; country = 'Unknown' }
                    }
                }
                else {
                    $result = @{ success = $false; message = 'Invalid IP format' }
                }
            }

            $jsonOk = $result | ConvertTo-Json -Compress
            $bodyOk = [Text.Encoding]::UTF8.GetBytes($jsonOk)
            Write-HttpResponse -Stream $stream -StatusCode 200 -StatusText 'OK' -ExtraHeaders $common -Body $bodyOk
        }
        catch { }
        finally {
            try { $client.Close() } catch { }
        }
    }
}
catch {
    [Console]::Error.WriteLine("[BRIDGE] $($_.Exception.Message)")
    exit 1
}
finally {
    if ($listener) { try { $listener.Stop() } catch { } }
}
