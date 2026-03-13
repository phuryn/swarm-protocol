#!/bin/bash
set -e

echo "🔧 Swarm Protocol Setup"
echo "==================="

# Check for Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Install Docker Desktop first."
  echo "   https://docs.docker.com/get-docker/"
  exit 1
fi

# Start PostgreSQL
echo "📦 Starting PostgreSQL..."
docker compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done
echo "✅ PostgreSQL is ready"

# Build the project
echo "🔨 Building Swarm Protocol..."
npm install
npm run build

echo ""
echo "✅ Swarm Protocol is ready!"
echo ""
echo "Add this to your Claude Code MCP config (~/.claude/config.json):"
echo ""
echo '  "mcpServers": {'
echo '    "swarm-protocol": {'
echo '      "command": "node",'
echo "      \"args\": [\"$(pwd)/dist/index.js\"],"
echo '      "env": {'
echo '        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/swarm_protocol"'
echo '      }'
echo '    }'
echo '  }'
echo ""
echo "Then restart Claude Code and all 19 coordination tools will be available."
echo ""
echo "Drop claude-md/COORDINATION.md into your repo's CLAUDE.md to enable automatic coordination."
