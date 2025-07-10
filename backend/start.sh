#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting iamarobot backend..."

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Sync database schema
echo "🗄️ Syncing database schema..."
npx prisma db push

# Start the application
echo "🎮 Starting application..."
node dist/index.js 