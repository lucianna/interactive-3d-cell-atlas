param([int]$Port = 8080)

$root = $PSScriptRoot
if (-not $root) { $root = "C:\Users\lmueck\.gemini\antigravity\scratch\glb-interactive-viewer" }

$endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Loopback, $Port)
$listener = New-Object System.Net.Sockets.TcpListener($endpoint)
$listener.Start()

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host " 3D GLB Interactive Studio running at http://localhost:$Port/" -ForegroundColor Green
Write-Host " Serving directory: $root" -ForegroundColor Gray
Write-Host " Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Cyan

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".glb"  = "model/gltf-binary"
    ".gltf" = "model/gltf+json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            if (-not [string]::IsNullOrEmpty($requestLine)) {
                # Consume remaining headers
                while ($true) {
                    $h = $reader.ReadLine()
                    if ([string]::IsNullOrEmpty($h)) { break }
                }

                $parts = $requestLine.Split(' ')
                $method = $parts[0]
                $rawPath = [System.Uri]::UnescapeDataString($parts[1].Split('?')[0]).TrimStart('/')
                if ([string]::IsNullOrWhiteSpace($rawPath)) { $rawPath = "index.html" }

                $filePath = Join-Path $root $rawPath
                if (Test-Path $filePath -PathType Leaf) {
                    $ext = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
                    $contentType = $mimeTypes[$ext]
                    if (-not $contentType) { $contentType = "application/octet-stream" }

                    $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
                    $headerStr = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($fileBytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerStr)
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    if ($method -ne "HEAD") {
                        $stream.Write($fileBytes, 0, $fileBytes.Length)
                    }
                } else {
                    $notFound = [System.Text.Encoding]::ASCII.GetBytes("HTTP/1.1 404 Not Found`r`nContent-Length: 9`r`nConnection: close`r`n`r`nNot Found")
                    $stream.Write($notFound, 0, $notFound.Length)
                }
                $stream.Flush()
            }
        } catch {
            # Ignore client disconnect errors
        } finally {
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
