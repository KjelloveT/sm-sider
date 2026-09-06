# Rota er mappa dette skriptet ligg i, slik at repoet kan liggje kvar som helst
# — og slik at eit skript inne i ein worktree serverer den worktreen.
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8081/')
$listener.Start()
Write-Host 'Server running on http://localhost:8081'
$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript'
  '.css'  = 'text/css'
  '.json' = 'application/json; charset=utf-8'
  '.csv'  = 'text/csv; charset=utf-8'
  '.png'  = 'image/png'
  '.woff2' = 'font/woff2'
  '.woff'  = 'font/woff'
  '.xml'  = 'application/xml'
  '.ico'  = 'image/x-icon'
  '.mp3'  = 'audio/mpeg'
  '.wav'  = 'audio/wav'
  '.ogg'  = 'audio/ogg'
  '.m4a'  = 'audio/mp4'
  '.flac' = 'audio/flac'
  '.opus' = 'audio/ogg'
  '.webm' = 'audio/webm'
}
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $res.SendChunked = $true
    $local = $req.Url.LocalPath.TrimStart('/')
    if ($local -eq '') { $local = 'index.html' }
    $path = Join-Path $root $local
    # Ei mappe-URL skal oppføre seg som i produksjon: /lydskurd sender
    # nettlesaren vidare til /lydskurd/, og /lydskurd/ serverer index.html
    # derifra. Utan vidaresendinga peikar kvar relativ sti i sida eitt hakk
    # for høgt, og sida lastar utan stilark og skript.
    $redirected = $false
    if ([System.IO.Directory]::Exists($path)) {
      if ($req.Url.LocalPath.EndsWith('/')) {
        $path = Join-Path $path 'index.html'
      } else {
        $res.StatusCode = 301
        $res.RedirectLocation = $req.Url.LocalPath + '/'
        $redirected = $true
      }
    }
    if ($redirected) {
      # Ingen kropp — nettlesaren skal berre gå til den nye adressa.
    } elseif ([System.IO.File]::Exists($path)) {
      $ext = [System.IO.Path]::GetExtension($path)
      $res.ContentType = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch {
    Write-Host "Error: $_"
  } finally {
    $res.OutputStream.Flush()
    $res.Close()
  }
}
