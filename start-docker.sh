#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# EventHub Docker Compose Startup Script
# ═══════════════════════════════════════════════════════════════════
# This script properly starts all EventHub services with correct
# configuration and ensures databases and volumes persist correctly.

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}       EventHub Docker Compose Startup Script${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed!${NC}"
    echo "Please install Docker from https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed!${NC}"
    echo "Please install Docker Compose or upgrade Docker Desktop"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"
echo ""

# Check .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env file not found, creating from template...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env from .env.example${NC}"
    else
        echo -e "${YELLOW}⚠ No .env.example found - using defaults${NC}"
    fi
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi
echo ""

# Menu
echo -e "${BLUE}What would you like to do?${NC}"
echo "1. Start all services (Backend + AI + Payment + PostgreSQL + Frontend)"
echo "2. Start backend only (PostgreSQL + Backend + Frontend)"
echo "3. Stop all services"
echo "4. View service logs"
echo "5. Remove all containers and volumes (WARNING: data loss!)"
echo "6. Check service health"
echo ""
read -p "Enter your choice (1-6): " choice
echo ""

case $choice in
    1)
        echo -e "${BLUE}Starting all services...${NC}"
        echo "Building and starting: PostgreSQL, Backend, AI Service, Payment Service, Frontend"
        echo ""

        docker-compose down --remove-orphans 2>/dev/null || true
        echo ""

        docker-compose up -d --build

        echo ""
        echo -e "${GREEN}✓ All services starting...${NC}"
        echo ""
        echo "Waiting for services to be ready..."
        sleep 5

        echo -e "${BLUE}Service URLs:${NC}"
        echo "  Frontend:           http://localhost:5050"
        echo "  Backend API:        http://localhost:3000"
        echo "  API Documentation:  http://localhost:3000/api-docs"
        echo "  AI Service:         http://localhost:8080"
        echo "  Payment Service:    http://localhost:8081"
        echo "  PostgreSQL:         localhost:5432"
        echo ""
        echo "View logs with:"
        echo "  docker-compose logs -f        # All services"
        echo "  docker-compose logs -f backend # Backend only"
        echo "  docker-compose logs -f ai     # AI service only"
        echo "  docker-compose logs -f payment # Payment service only"
        ;;

    2)
        echo -e "${BLUE}Starting backend stack (no AI/Payment services)...${NC}"
        echo "Starting: PostgreSQL, Backend, Frontend"
        echo ""

        docker-compose down --remove-orphans 2>/dev/null || true
        echo ""

        # Scale down the Java services
        docker-compose up -d --build --scale ai=0 --scale payment=0 db backend frontend

        echo ""
        echo -e "${GREEN}✓ Backend services starting...${NC}"
        echo ""
        echo -e "${BLUE}Service URLs:${NC}"
        echo "  Frontend:           http://localhost:5050"
        echo "  Backend API:        http://localhost:3000"
        echo "  API Documentation:  http://localhost:3000/api-docs"
        echo "  PostgreSQL:         localhost:5432"
        echo ""
        echo -e "${YELLOW}Note: AI and Payment services are NOT running${NC}"
        ;;

    3)
        echo -e "${BLUE}Stopping all services...${NC}"
        docker-compose down
        echo -e "${GREEN}✓ All services stopped${NC}"
        ;;

    4)
        echo -e "${BLUE}Showing logs for all services...${NC}"
        echo "Press Ctrl+C to exit"
        echo ""
        docker-compose logs -f
        ;;

    5)
        echo -e "${RED}WARNING: This will delete all data!${NC}"
        read -p "Are you sure? Type 'yes' to confirm: " confirm
        if [ "$confirm" = "yes" ]; then
            echo -e "${BLUE}Removing all containers and volumes...${NC}"
            docker-compose down -v
            docker volume rm eventhub_db_data 2>/dev/null || true
            docker volume rm eventhub_uploads 2>/dev/null || true
            echo -e "${GREEN}✓ All containers and volumes removed${NC}"
        else
            echo "Cancelled"
        fi
        ;;

    6)
        echo -e "${BLUE}Checking service health...${NC}"
        echo ""

        # Check PostgreSQL
        if docker-compose exec -T db pg_isready -U eventhub &>/dev/null; then
            echo -e "${GREEN}✓ PostgreSQL: Running${NC}"
        else
            echo -e "${RED}✗ PostgreSQL: Not running${NC}"
        fi

        # Check Backend
        if curl -s http://localhost:3000/api-docs > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend: Running${NC}"
        else
            echo -e "${RED}✗ Backend: Not running${NC}"
        fi

        # Check AI
        if curl -s http://localhost:8080/api/ai/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ AI Service: Running${NC}"
        else
            echo -e "${YELLOW}⚠ AI Service: Not running (this is normal if not needed)${NC}"
        fi

        # Check Payment
        if curl -s http://localhost:8081/api/payment/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Payment Service: Running${NC}"
        else
            echo -e "${YELLOW}⚠ Payment Service: Not running (this is normal if not needed)${NC}"
        fi

        # Check Frontend
        if curl -s http://localhost:5050 > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Frontend: Running${NC}"
        else
            echo -e "${RED}✗ Frontend: Not running${NC}"
        fi

        echo ""
        echo -e "${BLUE}Container Status:${NC}"
        docker-compose ps
        ;;

    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
