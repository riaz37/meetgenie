#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping MeetGenie Microservices...${NC}"

# Stop all Node.js processes (microservices)
echo -e "${YELLOW}🔧 Stopping microservices...${NC}"
pkill -f "nx serve" || true

# Stop Docker containers
echo -e "${YELLOW}📦 Stopping infrastructure services...${NC}"
docker-compose down

echo -e "${GREEN}✅ All services stopped!${NC}"