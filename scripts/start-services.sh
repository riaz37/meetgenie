#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting MeetGenie Microservices...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Start infrastructure services
echo -e "${YELLOW}📦 Starting infrastructure services (Redis, Kafka)...${NC}"
docker-compose up -d redis zookeeper kafka

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Check if Kafka is ready
echo -e "${YELLOW}🔍 Checking Kafka readiness...${NC}"
timeout=60
counter=0
while ! docker exec meetgenie-kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}❌ Kafka failed to start within $timeout seconds${NC}"
        exit 1
    fi
    echo -e "${YELLOW}⏳ Waiting for Kafka... ($counter/$timeout)${NC}"
    sleep 1
    counter=$((counter + 1))
done

# Initialize Kafka topics
echo -e "${YELLOW}📝 Initializing Kafka topics...${NC}"
node scripts/init-kafka-topics.js

# Start microservices
echo -e "${YELLOW}🎯 Starting microservices...${NC}"

# Start API Gateway
echo -e "${GREEN}🌐 Starting API Gateway...${NC}"
npx nx serve api-gateway &

# Start all microservices
services=("auth-service" "user-management-service" "meeting-service" "transcription-service" "summarization-service" "qa-service" "payment-service" "billing-service" "admin-service")

for service in "${services[@]}"; do
    echo -e "${GREEN}🔧 Starting $service...${NC}"
    npx nx serve $service &
    sleep 2
done

echo -e "${GREEN}✅ All services started!${NC}"
echo -e "${BLUE}📋 Service URLs:${NC}"
echo -e "  🌐 API Gateway: http://localhost:3001/api"
echo -e "  🔐 Auth Service: http://localhost:3002/api"
echo -e "  👥 User Management: http://localhost:3003/api"
echo -e "  🎯 Meeting Service: http://localhost:3004/api"
echo -e "  🎤 Transcription: http://localhost:3005/api"
echo -e "  📝 Summarization: http://localhost:3006/api"
echo -e "  ❓ Q&A Service: http://localhost:3007/api"
echo -e "  💳 Payment Service: http://localhost:3008/api"
echo -e "  💰 Billing Service: http://localhost:3009/api"
echo -e "  ⚙️ Admin Service: http://localhost:3010/api"
echo -e "  🖥️ Kafka UI: http://localhost:8080"

echo -e "${YELLOW}💡 To stop all services, run: ./scripts/stop-services.sh${NC}"
echo -e "${YELLOW}📋 To check service health: curl http://localhost:3001/api/health/services${NC}"

# Keep script running
wait