# SupremoCut - pega o mp3 recem-baixado do ElevenLabs e roda o anuncio inteiro.
#
# POR QUE ISTO EXISTE
#
# O ciclo de cada anuncio e sempre o mesmo: o Campelo (ou eu, no navegador dele)
# gera a voz no ElevenLabs, o arquivo cai em Downloads, e dali ate o MP4 pronto
# sao tres comandos que nunca mudam. Deixar isso num script evita o erro mais
# provavel da noite: pegar o mp3 do anuncio ANTERIOR e montar o video errado
# sem nada reclamar.
#
# A GUARDA
#
# `-MaxIdade` recusa um arquivo velho. Se a geracao falhou no navegador e o
# Downloads ainda tem o mp3 de dois anuncios atras, o script para em vez de
# seguir em frente com o audio errado.
#
# Uso:  .\pegar.ps1 -Nome "Everyday Finds" -Slug everyday-finds

param(
  [Parameter(Mandatory = $true)][string]$Nome,
  [Parameter(Mandatory = $true)][string]$Slug,
  [double]$MaxIdade = 180,
  [switch]$SoPegar
)

$ErrorActionPreference = "Stop"
$raiz = "F:\SupremoCut"
$py   = "$raiz\.venv\Scripts\python.exe"
$dl   = "C:\Users\willi\Downloads"

$mp3 = Get-ChildItem $dl -Filter *.mp3 | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $mp3) { throw "nao ha mp3 nenhum em Downloads" }

$idade = ((Get-Date) - $mp3.LastWriteTime).TotalSeconds
if ($idade -gt $MaxIdade) {
  throw ("o mp3 mais novo tem {0:N0}s de idade ({1}) - a geracao nao chegou. Nada foi montado." -f $idade, $mp3.Name)
}

$destino = "$raiz\trabalho\recebido\$Slug.mp3"
New-Item -ItemType Directory -Force -Path (Split-Path $destino) | Out-Null
Copy-Item $mp3.FullName $destino -Force

$dur = [double](& ffprobe -v error -show_entries format=duration -of csv=p=0 $destino)
"  {0}: {1:N2}s de audio ({2:N0}s atras)" -f $Nome, $dur, $idade

if ($SoPegar) { return }

$log = "$raiz\trabalho\log-$Slug.txt"
Remove-Item $log -ErrorAction SilentlyContinue
$cmd = "chcp 65001 >nul & cd /d $raiz\motor & " +
       "`"$py`" narracao.py --so `"$Nome`" --audio `"$destino`" > `"$log`" 2>&1 & " +
       "`"$py`" entregar_continuo.py --so `"$Nome`" --pasta aprovado >> `"$log`" 2>&1 & " +
       "`"$py`" masterizar.py --pasta aprovado --so $Slug >> `"$log`" 2>&1 & " +
       "echo FIM >> `"$log`""
Start-Process cmd -ArgumentList "/c", $cmd -WindowStyle Hidden
"  montando em segundo plano -> saida\aprovado\$Slug-pt.mp4"
