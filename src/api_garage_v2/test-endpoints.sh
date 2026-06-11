#!/bin/bash

# ========================================
# 🧪 Garage Webhook API - Test Script
# ========================================
# Quick test script for all webhook endpoints
# 
# Usage: ./test-endpoints.sh [BASE_URL] [BEARER_TOKEN]
# Example: ./test-endpoints.sh http://localhost:5000 your_token_here

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BASE_URL="${1:-http://localhost:5000}"
BEARER_TOKEN="${2}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🧪 Garage Webhook API Test Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if token is provided
if [ -z "$BEARER_TOKEN" ]; then
    echo -e "${RED}❌ Error: Bearer token not provided${NC}"
    echo ""
    echo "Usage: ./test-endpoints.sh [BASE_URL] [BEARER_TOKEN]"
    echo "Example: ./test-endpoints.sh http://localhost:5000 your_token_here"
    echo ""
    echo "To get your token from .env file:"
    echo "  grep GARAGE_WEBHOOK_SECRET_KEY ../api/.env"
    exit 1
fi

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "  Base URL: $BASE_URL"
echo "  Token: ${BEARER_TOKEN:0:20}..."
echo ""

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    echo -e "${YELLOW}Testing: $name${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -X GET "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $BEARER_TOKEN" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X POST "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $BEARER_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo -e "${GREEN}✅ PASSED${NC} (HTTP $http_code)"
        echo "   Response: $(echo $body | jq -r '.status // .success' 2>/dev/null || echo 'OK')"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAILED${NC} (HTTP $http_code)"
        echo "   Response: $body"
        ((FAILED++))
    fi
    echo ""
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🏥 Health Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test health endpoint (no auth required)
echo -e "${YELLOW}Testing: Health Check${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/health")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✅ Server is running${NC}"
    echo "   Response: $(echo $body | jq -r '.message' 2>/dev/null || echo 'OK')"
else
    echo -e "${RED}❌ Server is not responding${NC}"
    echo "   HTTP Code: $http_code"
    exit 1
fi
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔑 Authentication Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test without token (should fail)
echo -e "${YELLOW}Testing: Request without token (should fail)${NC}"
response=$(curl -s -w "\n%{http_code}" \
    -X POST "$BASE_URL/api_garage/public/roDetails/list" \
    -H "Content-Type: application/json" \
    -d '{"pageno": 1, "per_page": 10}')
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" -eq 401 ] || [ "$http_code" -eq 403 ]; then
    echo -e "${GREEN}✅ Correctly rejected${NC} (HTTP $http_code)"
else
    echo -e "${RED}❌ Should have been rejected${NC} (HTTP $http_code)"
fi
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📋 RO Endpoints${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test RO List
test_endpoint \
    "RO List (Basic)" \
    "POST" \
    "/api_garage/public/roDetails/list" \
    '{"pageno": 1, "per_page": 10}'

# Test RO List with filters
test_endpoint \
    "RO List (With Filters)" \
    "POST" \
    "/api_garage/public/roDetails/list" \
    '{"pageno": 1, "per_page": 10, "status": "open"}'

# Test RO Details (use a valid RO ID from your database)
# Note: You may need to change the roid to match your data
test_endpoint \
    "RO Details" \
    "GET" \
    "/api_garage/public/roDetails/details?roid=1"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔧 Defect Update Endpoints${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test defect update (Note: This will actually update data if RO/defect exists)
# Using invalid IDs to avoid accidentally modifying production data
test_endpoint \
    "Update Defect (Test)" \
    "POST" \
    "/api_garage/public/updateVehicleDefect_v2" \
    '{
      "roid": 99999,
      "defectid": 99999,
      "work_order_number": "TEST-WO-001",
      "work_order_status": "In_Progress",
      "defects_details": {
        "defect_id": 99999,
        "status": "In_Progress",
        "external_ro_id": 99999
      }
    }'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Check the output above.${NC}"
    exit 1
fi
