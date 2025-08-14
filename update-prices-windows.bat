@echo off
setlocal enabledelayedexpansion

REM Script para actualizar precios de componentes en Windows
REM Requiere: curl instalado o Git Bash

echo === Actualizacion de Precios de Componentes ===
echo.

set API_URL=http://34.198.163.51/api

REM Solicitar credenciales
set /p USERNAME=Usuario: 
set /p PASSWORD=Contraseña: 

echo.
echo Autenticando...

REM Login para obtener token
curl -s -X POST "%API_URL%/auth/login" -H "Content-Type: application/json" -d "{\"username\": \"%USERNAME%\", \"password\": \"%PASSWORD%\"}" > temp_login.json

REM Extraer token (necesita procesamiento manual o usar jq si está instalado)
echo.
echo NOTA: Copia el token de temp_login.json y pegalo aqui:
set /p TOKEN=Token: 

echo.
echo Actualizando precios...
echo.

REM Lista de componentes y precios
echo C142688,0.2469 > prices.csv
echo C187634,1.0202 >> prices.csv
echo C371155,1.1700 >> prices.csv
echo C26870,0.2303 >> prices.csv
echo C7466304,0.2075 >> prices.csv
echo C5157517,0.2211 >> prices.csv
echo C4661,0.2814 >> prices.csv
echo C388141,0.2066 >> prices.csv
echo C6068480,0.8743 >> prices.csv
echo C965984,0.1928 >> prices.csv
echo C965988,0.2034 >> prices.csv
echo C268208,0.3768 >> prices.csv
echo C2915736,0.2438 >> prices.csv
echo C135570,0.2302 >> prices.csv
echo C5380832,0.2035 >> prices.csv
echo C5380835,0.2052 >> prices.csv
echo C5380864,0.2148 >> prices.csv
echo C45817,1.1405 >> prices.csv
echo C2836118,0.1811 >> prices.csv
echo C2765765,0.2110 >> prices.csv
echo C13917,0.4318 >> prices.csv
echo C5349575,0.2885 >> prices.csv
echo C5349576,0.3364 >> prices.csv
echo C5349577,0.3873 >> prices.csv
echo C5188042,0.1906 >> prices.csv
echo C5188043,0.2106 >> prices.csv
echo C5188044,0.2127 >> prices.csv
echo C20852,0.3238 >> prices.csv
echo C18199091,0.1778 >> prices.csv
echo C22389979,0.6795 >> prices.csv
echo C2900597,0.3922 >> prices.csv
echo C963394,0.2715 >> prices.csv
echo C717029,0.2902 >> prices.csv
echo C19727305,0.3427 >> prices.csv

REM Procesar cada línea
for /f "tokens=1,2 delims=," %%a in (prices.csv) do (
    echo Buscando %%a...
    
    REM Buscar componente
    curl -s -X GET "%API_URL%/components?search=%%a" -H "Authorization: Bearer %TOKEN%" > temp_search.json
    
    echo Ingresa el ID del componente %%a (o presiona Enter para saltar):
    set /p COMP_ID=ID: 
    
    if not "!COMP_ID!"=="" (
        echo Actualizando %%a a $%%b...
        curl -X PUT "%API_URL%/components/!COMP_ID!" -H "Content-Type: application/json" -H "Authorization: Bearer %TOKEN%" -d "{\"cost_price\": %%b}"
        echo.
    ) else (
        echo Saltando %%a
    )
)

echo.
echo Proceso completado!
del prices.csv
del temp_login.json
del temp_search.json
pause