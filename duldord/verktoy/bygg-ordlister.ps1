# Byggjer ordlister frå Norsk Ordbank (Språkbanken, CC-BY 4.0).
# Kjeldefilene er Latin-1-koda og tabseparerte. Kolonne 3 = OPPSLAG (ordforma), kolonne 4 = TAG.
$ErrorActionPreference = 'Stop'
$base = $PSScriptRoot
$latin1 = [System.Text.Encoding]::GetEncoding(28591)

# ae/oe/aa skrivast som teiknkodar, ikkje som literalar: PowerShell 5.1 les ei .ps1-fil
# utan BOM som ANSI, og då blir slike literalar mojibake — nettopp feilen som gjorde at
# den gamle ordlista mangla alle desse orda.
$AE = [char]0xE6; $OE = [char]0xF8; $AA = [char]0xE5
$LETTERS = "a-z$AE$OE$AA"

function Read-Forms([string]$path) {
    $set = [System.Collections.Generic.HashSet[string]]::new()
    $reader = [System.IO.StreamReader]::new($path, $latin1)
    $null = $reader.ReadLine()   # hopp over kolonneoverskrifta
    while ($null -ne ($line = $reader.ReadLine())) {
        $c = $line.Split("`t")
        if ($c.Length -lt 4) { continue }
        $word = $c[2].ToLowerInvariant()
        # Eigennamn ("prop") er ikkje gyldige i ordspel
        if ($c[3] -like '*prop*') { continue }
        # Berre reine bokstavord — ingen mellomrom, bindestrek, tal eller teikn
        if ($word -notmatch "^[$LETTERS]+`$") { continue }
        $null = $set.Add($word)
    }
    $reader.Close()
    return $set
}

Write-Host 'Les nynorsk ...'
$nno = Read-Forms (Join-Path $base 'nno\fullformer_2012.txt')
Write-Host "  $($nno.Count) unike nynorske ordformer"

Write-Host 'Les bokmål ...'
$nob = Read-Forms (Join-Path $base 'nob\fullformsliste.txt')
Write-Host "  $($nob.Count) unike bokmålsformer"

# --- Duldord: nynorske ord på nøyaktig 5 teikn ---
$duldord = $nno | Where-Object { $_.Length -eq 5 } | Sort-Object
Write-Host "Duldord: $($duldord.Count) femteikns nynorskord"
$out = [ordered]@{
    app     = 'duldord'
    version = 1
    kjelde  = 'Norsk Ordbank - Nynorsk 2012 (Spraakbanken, Nasjonalbiblioteket), CC-BY 4.0'
    henta   = '2026-08-04'
    tal     = $duldord.Count
    ord     = @($duldord)
}
$json = $out | ConvertTo-Json -Depth 4 -Compress
[System.IO.File]::WriteAllText((Join-Path $base 'duldord-gjettbare.json'), $json, [System.Text.UTF8Encoding]::new($false))

# --- Ordsmia: nynorsk + bokmål, opp til 9 teikn (maks tal brikker i spelet) ---
$alle = [System.Collections.Generic.HashSet[string]]::new([string[]]@($nno))
$alle.UnionWith([string[]]@($nob))
$ordsmia = $alle | Where-Object { $_.Length -ge 2 -and $_.Length -le 9 } | Sort-Object
Write-Host "Ordsmia: $($ordsmia.Count) ord paa 2-9 teikn"
$out2 = [ordered]@{
    meta = [ordered]@{
        total_ord   = $ordsmia.Count
        prosessert  = '2026-08-04'
        source      = 'Norsk Ordbank - Nynorsk 2012 + Bokmaal 2005 (Spraakbanken), CC-BY 4.0'
        beskrivelse = 'Norske ordformer (fullformer), 2-9 teikn, eigennamn utelatne'
    }
    ord = @($ordsmia)
}
$json2 = $out2 | ConvertTo-Json -Depth 4 -Compress
[System.IO.File]::WriteAllText((Join-Path $base 'ordsmia-ordliste.json'), $json2, [System.Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host 'Kontroll - ordformer med ae/oe/aa:'
Write-Host "  duldord: $(($duldord | Where-Object { $_ -match "[$AE$OE$AA]" }).Count) av $($duldord.Count)"
Write-Host "  ordsmia: $(($ordsmia | Where-Object { $_ -match "[$AE$OE$AA]" }).Count) av $($ordsmia.Count)"
Get-ChildItem (Join-Path $base '*.json') | Select-Object Name, @{n='kB';e={[math]::Round($_.Length/1kb)}}
