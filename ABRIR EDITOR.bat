@echo off
chcp 65001 >nul
title SupremoCut - Editor
cd /d "%~dp0"

echo.
echo   ============================================
echo      S U P R E M O C U T
echo   ============================================
echo.
echo   Abrindo o editor...
echo.
echo   O navegador abre sozinho em alguns segundos.
echo.
echo   IMPORTANTE: nao feche esta janela preta
echo   enquanto estiver editando. Ela e o motor.
echo.
echo   Pra fechar tudo no fim: feche esta janela.
echo   ============================================
echo.

if not exist ".venv\Scripts\python.exe" (
  echo   [ERRO] Nao encontrei a instalacao do SupremoCut.
  echo   Esta pasta deveria ter uma subpasta .venv
  echo.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" "motor\supremo.py" editor

echo.
echo   Editor fechado.
echo.
timeout /t 3 >nul
