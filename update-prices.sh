#!/bin/bash

# Script para actualizar precios de costo de componentes
# Uso: bash update-prices.sh

API_URL="http://34.198.163.51/api"
TOKEN=""  # Se solicitará al usuario

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Actualización de Precios de Componentes ==="
echo ""

# Solicitar credenciales
read -p "Usuario: " USERNAME
read -s -p "Contraseña: " PASSWORD
echo ""

# Login para obtener token
echo ""
echo "🔐 Autenticando..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}")

# Extraer token de la respuesta
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Error al autenticar. Verifica las credenciales.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Autenticación exitosa${NC}"
echo ""

# Array de componentes y precios
declare -A PRICES=(
    ["C142688"]="0.2469"
    ["C187634"]="1.0202"
    ["C371155"]="1.1700"
    ["C26870"]="0.2303"
    ["C7466304"]="0.2075"
    ["C5157517"]="0.2211"
    ["C4661"]="0.2814"
    ["C388141"]="0.2066"
    ["C6068480"]="0.8743"
    ["C965984"]="0.1928"
    ["C965988"]="0.2034"
    ["C268208"]="0.3768"
    ["C2915736"]="0.2438"
    ["C135570"]="0.2302"
    ["C5380832"]="0.2035"
    ["C5380835"]="0.2052"
    ["C5380864"]="0.2148"
    ["C45817"]="1.1405"
    ["C2836118"]="0.1811"
    ["C2765765"]="0.2110"
    ["C13917"]="0.4318"
    ["C5349575"]="0.2885"
    ["C5349576"]="0.3364"
    ["C5349577"]="0.3873"
    ["C5188042"]="0.1906"
    ["C5188043"]="0.2106"
    ["C5188044"]="0.2127"
    ["C20852"]="0.3238"
    ["C18199091"]="0.1778"
    ["C22389979"]="0.6795"
    ["C2900597"]="0.3922"
    ["C963394"]="0.2715"
    ["C717029"]="0.2902"
    ["C19727305"]="0.3427"
)

# Contadores
SUCCESS=0
FAILED=0
NOT_FOUND=0

echo "📊 Actualizando ${#PRICES[@]} componentes..."
echo ""

# Crear archivo de log
LOG_FILE="price_update_$(date +%Y%m%d_%H%M%S).log"
echo "Log de actualización de precios - $(date)" > $LOG_FILE
echo "========================================" >> $LOG_FILE
echo "" >> $LOG_FILE

# Procesar cada componente
for CODE in "${!PRICES[@]}"; do
    PRICE=${PRICES[$CODE]}
    
    echo -n "🔍 $CODE → \$${PRICE} ... "
    
    # Buscar componente por código
    SEARCH_RESPONSE=$(curl -s -X GET "$API_URL/components?search=$CODE" \
        -H "Authorization: Bearer $TOKEN")
    
    # Extraer ID del componente
    COMPONENT_ID=$(echo $SEARCH_RESPONSE | grep -o "\"id\":\"[^\"]*\".*\"code\":\"$CODE\"" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$COMPONENT_ID" ]; then
        echo -e "${YELLOW}⚠️  No encontrado${NC}"
        echo "$CODE - No encontrado" >> $LOG_FILE
        ((NOT_FOUND++))
        continue
    fi
    
    # Actualizar precio
    UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/components/$COMPONENT_ID" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"cost_price\": $PRICE}")
    
    # Verificar respuesta
    if echo "$UPDATE_RESPONSE" | grep -q "error"; then
        echo -e "${RED}❌ Error${NC}"
        echo "$CODE - Error: $UPDATE_RESPONSE" >> $LOG_FILE
        ((FAILED++))
    else
        echo -e "${GREEN}✅ Actualizado${NC}"
        echo "$CODE - Actualizado a $PRICE" >> $LOG_FILE
        ((SUCCESS++))
    fi
    
    # Pequeña pausa para no sobrecargar el servidor
    sleep 0.2
done

echo ""
echo "========================================" >> $LOG_FILE
echo "Resumen: $SUCCESS exitosos, $FAILED errores, $NOT_FOUND no encontrados" >> $LOG_FILE

# Mostrar resumen
echo ""
echo "========================================"
echo "📈 RESUMEN DE ACTUALIZACIÓN"
echo "========================================"
echo -e "${GREEN}✅ Actualizados exitosamente: $SUCCESS${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Con errores: $FAILED${NC}"
fi
if [ $NOT_FOUND -gt 0 ]; then
    echo -e "${YELLOW}⚠️  No encontrados: $NOT_FOUND${NC}"
fi
echo ""
echo "📄 Log guardado en: $LOG_FILE"
echo ""

# Si hay componentes no encontrados, ofrecer crearlos
if [ $NOT_FOUND -gt 0 ]; then
    echo -e "${YELLOW}Hay $NOT_FOUND componentes no encontrados.${NC}"
    echo "Puedes crearlos manualmente o revisar los códigos."
fi