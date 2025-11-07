#!/bin/bash

# Setup script for Quotient Advisor Agent
# This script will set up the project and verify everything is working

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🧠 Quotient Advisor Agent - Setup Script               ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check Node.js version
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm $(npm -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and add your OPENAI_API_KEY"
    echo "   You can get an API key from: https://platform.openai.com/api-keys"
    echo ""
    read -p "Press Enter to continue (you can add the API key later)..."
else
    echo "✅ .env file already exists"
fi
echo ""

# Build the project
echo "🔨 Building the project..."
npm run build
echo "✅ Project built successfully"
echo ""

# Run tests (optional)
read -p "Would you like to run tests? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧪 Running tests..."
    npm run test
    echo "✅ Tests completed"
    echo ""
fi

# Ask if user wants to start the server
read -p "Would you like to start the server now? (Y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "🚀 Starting the server..."
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   The server will start in development mode.             ║"
    echo "║                                                           ║"
    echo "║   Access points:                                          ║"
    echo "║   • Web UI: http://localhost:3000                         ║"
    echo "║   • API Docs: http://localhost:3000/api                   ║"
    echo "║                                                           ║"
    echo "║   Press Ctrl+C to stop the server                        ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    npm run start:dev
else
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "To start the server later, run:"
    echo "  npm run start:dev"
    echo ""
    echo "Access points:"
    echo "  • Web UI: http://localhost:3000"
    echo "  • API Docs: http://localhost:3000/api"
    echo ""
    echo "For more information, see:"
    echo "  • QUICKSTART.md - Quick start guide"
    echo "  • README.md - Full documentation"
    echo "  • DEPLOYMENT.md - Deployment options"
    echo ""
fi


