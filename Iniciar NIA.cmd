@echo off
cd /d "%~dp0"
echo Iniciando NIA. Mantenha esta janela aberta durante o uso.
echo Precisa de um arquivo .env com GEMINI_API_KEY. Veja LEIA-ME.txt.
echo Abra http://127.0.0.1:8000 no navegador.
node server.cjs
pause
