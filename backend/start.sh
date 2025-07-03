#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting iamarobot backend..."

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "🎮 Starting application..."
node dist/index.js 