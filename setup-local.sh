#!/bin/bash

# Local Development Setup Script
# This script sets up PostgreSQL and runs the application locally

set -e

echo "🚀 Multi-Source Sync Pipeline - Local Setup"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PostgreSQL is installed
echo "📦 Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL not found${NC}"
    echo "Please install PostgreSQL first:"
    echo "  macOS: brew install postgresql@15"
    echo "  Linux: sudo apt-get install postgresql"
    echo "  Windows: Download from https://www.postgresql.org/download/windows/"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL installed${NC}"

# Check if PostgreSQL is running
echo ""
echo "🔍 Checking if PostgreSQL is running..."
if ! pg_isready -h localhost &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL not running${NC}"
    echo "Starting PostgreSQL..."
    
    if command -v brew &> /dev/null; then
        brew services start postgresql@15 || true
        sleep 2
    elif command -v systemctl &> /dev/null; then
        sudo systemctl start postgresql || true
        sleep 2
    fi
fi

if pg_isready -h localhost &> /dev/null; then
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
else
    echo -e "${RED}❌ Could not start PostgreSQL${NC}"
    echo "Please start PostgreSQL manually and run this script again"
    exit 1
fi

# Create database if it doesn't exist
echo ""
echo "🗄️  Creating database..."
PGPASSWORD=postgres psql -h localhost -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'sync_pipeline'" | grep -q 1 || \
PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE sync_pipeline"
echo -e "${GREEN}✅ Database ready${NC}"

# Install dependencies
echo ""
echo "📥 Installing npm dependencies..."
npm install > /dev/null 2>&1
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Run migrations
echo ""
echo "🔄 Running database migrations..."
npx prisma migrate deploy --skip-generate
echo -e "${GREEN}✅ Migrations complete${NC}"

# Generate Prisma client
echo ""
echo "⚙️  Generating Prisma client..."
npx prisma generate > /dev/null 2>&1
echo -e "${GREEN}✅ Prisma client generated${NC}"

# Build TypeScript
echo ""
echo "🔨 Building TypeScript..."
npm run build > /dev/null 2>&1
echo -e "${GREEN}✅ Build complete${NC}"

# Summary
echo ""
echo "=============================================="
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Start the development server:"
echo "   ${YELLOW}npm run dev${NC}"
echo ""
echo "2. In another terminal, test the API:"
echo "   ${YELLOW}curl http://localhost:3000/health/ready${NC}"
echo ""
echo "3. View database (visual editor):"
echo "   ${YELLOW}npm run prisma:studio${NC}"
echo ""
echo "4. Trigger a sync:"
echo "   ${YELLOW}curl -X POST http://localhost:3000/api/v1/sync \\${NC}"
echo "   ${YELLOW}  -H 'Authorization: Bearer sync-pipeline-admin-key-secure-random-token-123456789abcdef' \\${NC}"
echo "   ${YELLOW}  -H 'Content-Type: application/json'${NC}"
echo ""
echo "Documentation:"
echo "  - README.md: Project overview"
echo "  - doc/LOCAL_SETUP.md: Detailed setup guide"
echo "  - doc/API.md: API endpoints"
echo "  - doc/ARCHITECTURE.md: System design"
echo ""
