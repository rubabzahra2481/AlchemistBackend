# Setup script for Quotient Advisor Agent (PowerShell)
# This script will set up the project and verify everything is working

$ErrorActionPreference = "Stop"

Write-Host "╔═══════════════════════════════════════════════════════════╗"
Write-Host "║                                                           ║"
Write-Host "║   🧠 Quotient Advisor Agent - Setup Script               ║"
Write-Host "║                                                           ║"
Write-Host "╚═══════════════════════════════════════════════════════════╝"
Write-Host ""

# Check Node.js version
Write-Host "📋 Checking prerequisites..."

try {
    $nodeVersion = node -v
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    
    if ($versionNumber -lt 18) {
        Write-Host "❌ Node.js version 18 or higher is required. Current version: $nodeVersion" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18 or higher." -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm -v
    Write-Host "✅ npm $npmVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ npm is not installed." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Install dependencies
Write-Host "📦 Installing dependencies..."
npm install
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Create .env file if it doesn't exist
if (-not (Test-Path .env)) {
    Write-Host "⚙️  Creating .env file..."
    Copy-Item .env.example .env
    Write-Host "✅ .env file created" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Please edit .env and add your OPENAI_API_KEY" -ForegroundColor Yellow
    Write-Host "   You can get an API key from: https://platform.openai.com/api-keys"
    Write-Host ""
    Read-Host "Press Enter to continue (you can add the API key later)"
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

Write-Host ""

# Build the project
Write-Host "🔨 Building the project..."
npm run build
Write-Host "✅ Project built successfully" -ForegroundColor Green
Write-Host ""

# Run tests (optional)
$runTests = Read-Host "Would you like to run tests? (y/N)"
if ($runTests -eq "y" -or $runTests -eq "Y") {
    Write-Host "🧪 Running tests..."
    npm run test
    Write-Host "✅ Tests completed" -ForegroundColor Green
    Write-Host ""
}

# Ask if user wants to start the server
$startServer = Read-Host "Would you like to start the server now? (Y/n)"
if ($startServer -ne "n" -and $startServer -ne "N") {
    Write-Host ""
    Write-Host "🚀 Starting the server..."
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗"
    Write-Host "║                                                           ║"
    Write-Host "║   The server will start in development mode.             ║"
    Write-Host "║                                                           ║"
    Write-Host "║   Access points:                                          ║"
    Write-Host "║   • Web UI: http://localhost:3000                         ║"
    Write-Host "║   • API Docs: http://localhost:3000/api                   ║"
    Write-Host "║                                                           ║"
    Write-Host "║   Press Ctrl+C to stop the server                        ║"
    Write-Host "║                                                           ║"
    Write-Host "╚═══════════════════════════════════════════════════════════╝"
    Write-Host ""
    npm run start:dev
} else {
    Write-Host ""
    Write-Host "✅ Setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To start the server later, run:"
    Write-Host "  npm run start:dev"
    Write-Host ""
    Write-Host "Access points:"
    Write-Host "  • Web UI: http://localhost:3000"
    Write-Host "  • API Docs: http://localhost:3000/api"
    Write-Host ""
    Write-Host "For more information, see:"
    Write-Host "  • QUICKSTART.md - Quick start guide"
    Write-Host "  • README.md - Full documentation"
    Write-Host "  • DEPLOYMENT.md - Deployment options"
    Write-Host ""
}


