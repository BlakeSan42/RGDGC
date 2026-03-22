# RGDGC Local Development Guide

## Overview

This guide walks you through setting up the complete RGDGC development environment on your MacBook Pro, including:
- Backend API (Python/FastAPI)
- Mobile app (React Native/Expo)
- iOS development with Xcode
- Testing on your iPhone
- Using VS Code and Claude Code

---

## 1. Prerequisites

### 1.1 Required Software

| Software | Version | Purpose | Install Command |
|----------|---------|---------|-----------------|
| **Homebrew** | Latest | Package manager | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| **Node.js** | 18+ LTS | JavaScript runtime | `brew install node@18` |
| **Python** | 3.11+ | Backend runtime | `brew install python@3.11` |
| **Docker Desktop** | Latest | Containers | Download from docker.com |
| **VS Code** | Latest | Code editor | `brew install --cask visual-studio-code` |
| **Xcode** | 15+ | iOS development | App Store |
| **Git** | Latest | Version control | `brew install git` |

### 1.2 Install Everything

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install core tools
brew install node@18 python@3.11 git postgresql@15

# Install development tools
brew install --cask visual-studio-code docker

# Install Xcode from App Store, then:
xcode-select --install
sudo xcodebuild -license accept

# Verify installations
node --version    # Should be 18.x or higher
python3 --version # Should be 3.11.x or higher
docker --version  # Should show Docker version
```

### 1.3 VS Code Extensions

Install these extensions:
```bash
# Run in terminal
code --install-extension ms-python.python
code --install-extension ms-python.vscode-pylance
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension formulahendry.docker-explorer
code --install-extension mtxr.sqltools
code --install-extension mtxr.sqltools-driver-pg
```

---

## 2. Project Setup

### 2.1 Clone or Create Project

```bash
# Create project directory
mkdir -p ~/Projects/rgdgc-app
cd ~/Projects/rgdgc-app

# If cloning from GitHub:
# git clone https://github.com/your-org/rgdgc-app.git .

# Or create new structure:
mkdir -p backend mobile admin-dashboard bot docs
```

### 2.2 Backend Setup (FastAPI + Python)

```bash
cd ~/Projects/rgdgc-app/backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Create requirements.txt
cat > requirements.txt << 'EOF'
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
asyncpg==0.29.0
alembic==1.13.1
pydantic==2.5.3
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
redis==5.0.1
httpx==0.26.0
web3==6.14.0
python-dotenv==1.0.0
EOF

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rgdgc
REDIS_URL=redis://localhost:6379
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
DEBUG=true
ENVIRONMENT=development
EOF
```

### 2.3 Create Basic Backend Structure

```bash
# Create directory structure
mkdir -p app/{api/v1,core,db,models,schemas,services}
touch app/__init__.py app/api/__init__.py app/api/v1/__init__.py
touch app/core/__init__.py app/db/__init__.py
touch app/models/__init__.py app/schemas/__init__.py app/services/__init__.py

# Create main.py
cat > app/main.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="RGDGC API",
    description="River Grove Disc Golf Club API",
    version="1.0.0"
)

# CORS for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "RGDGC API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0.0"}
EOF

# Create config.py
cat > app/config.py << 'EOF'
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    secret_key: str
    jwt_secret_key: str
    debug: bool = False
    environment: str = "development"
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
EOF
```

### 2.4 Mobile App Setup (React Native + Expo)

```bash
cd ~/Projects/rgdgc-app

# Install Expo CLI and EAS CLI globally
npm install -g expo-cli eas-cli

# Create Expo project
npx create-expo-app mobile --template expo-template-blank-typescript
cd mobile

# Install core dependencies
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npm install react-native-gesture-handler react-native-reanimated
npm install axios @tanstack/react-query
npm install expo-secure-store expo-camera expo-location

# Install dev dependencies
npm install -D @types/react @types/react-native
```

### 2.5 Configure Expo for Development

```bash
cd ~/Projects/rgdgc-app/mobile

# Update app.json
cat > app.json << 'EOF'
{
  "expo": {
    "name": "RGDGC",
    "slug": "rgdgc",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1B5E20"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.rgdgc.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1B5E20"
      },
      "package": "com.rgdgc.app"
    },
    "plugins": [
      "expo-camera",
      "expo-location"
    ]
  }
}
EOF
```

---

## 3. Running the Development Environment

### 3.1 Start Backend with Docker

```bash
cd ~/Projects/rgdgc-app

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=rgdgc
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
EOF

# Start database and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 3.2 Start Backend API

```bash
cd ~/Projects/rgdgc-app/backend

# Activate virtual environment
source venv/bin/activate

# Run the API with hot reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# API is now running at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### 3.3 Start Mobile App (Expo)

Open a new terminal:
```bash
cd ~/Projects/rgdgc-app/mobile

# Start Expo development server
npx expo start

# This will show a QR code and options:
# - Press 'i' to open iOS simulator
# - Press 'a' to open Android emulator
# - Scan QR code with Expo Go app on your iPhone
```

---

## 4. iOS Development with Xcode

### 4.1 Setup Xcode

```bash
# Make sure Xcode Command Line Tools are installed
xcode-select --install

# Accept Xcode license
sudo xcodebuild -license accept

# Install CocoaPods (for native iOS dependencies)
sudo gem install cocoapods
```

### 4.2 Generate iOS Native Project

```bash
cd ~/Projects/rgdgc-app/mobile

# Generate native iOS project (for custom native code)
npx expo prebuild --platform ios

# Install iOS dependencies
cd ios
pod install
cd ..
```

### 4.3 Open in Xcode

```bash
# Open iOS project in Xcode
open ios/rgdgc.xcworkspace
```

In Xcode:
1. Select your development team (Signing & Capabilities)
2. Select your iPhone as the run target
3. Press Cmd+R to build and run

### 4.4 Run on Physical iPhone

**Method 1: Expo Go (Fastest for development)**
```bash
# In mobile directory
npx expo start

# On your iPhone:
# 1. Install "Expo Go" from App Store
# 2. Open Camera app
# 3. Scan the QR code from terminal
# 4. App opens in Expo Go
```

**Method 2: Development Build (Full native features)**
```bash
# Create development build
npx expo run:ios --device

# This will:
# 1. Build the app
# 2. Install on your connected iPhone
# 3. Run with native features
```

**Method 3: Xcode Direct (Full control)**
1. Connect iPhone via USB
2. Open `ios/rgdgc.xcworkspace` in Xcode
3. Select your iPhone as target device
4. Product → Run (Cmd+R)

### 4.5 iPhone Trust Settings

On your iPhone:
1. Go to Settings → General → VPN & Device Management
2. Find your Developer App certificate
3. Tap "Trust"

---

## 5. VS Code Setup

### 5.1 Workspace Configuration

```bash
cd ~/Projects/rgdgc-app

# Create VS Code workspace settings
mkdir -p .vscode
cat > .vscode/settings.json << 'EOF'
{
  "python.defaultInterpreterPath": "${workspaceFolder}/backend/venv/bin/python",
  "python.formatting.provider": "black",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[python]": {
    "editor.defaultFormatter": "ms-python.python"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.exclude": {
    "**/__pycache__": true,
    "**/node_modules": true,
    "**/.expo": true
  }
}
EOF

# Create launch configurations for debugging
cat > .vscode/launch.json << 'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:app", "--reload", "--port", "8000"],
      "cwd": "${workspaceFolder}/backend",
      "envFile": "${workspaceFolder}/backend/.env"
    },
    {
      "name": "React Native",
      "type": "reactnative",
      "request": "launch",
      "platform": "ios",
      "cwd": "${workspaceFolder}/mobile"
    }
  ]
}
EOF

# Create recommended extensions
cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "formulahendry.docker-explorer",
    "mtxr.sqltools",
    "mtxr.sqltools-driver-pg"
  ]
}
EOF
```

### 5.2 Open Project

```bash
# Open entire project in VS Code
code ~/Projects/rgdgc-app
```

---

## 6. Using Claude Code

### 6.1 Install Claude Code

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Or via Homebrew
brew install claude-code
```

### 6.2 Initialize in Project

```bash
cd ~/Projects/rgdgc-app

# Initialize Claude Code
claude-code init

# This creates .claude/ directory with configuration
```

### 6.3 Common Claude Code Commands

```bash
# Ask Claude to help with code
claude-code "Create a new API endpoint for user registration"

# Review code
claude-code review backend/app/api/v1/users.py

# Generate tests
claude-code "Write tests for the user service"

# Debug an error
claude-code "Why is this authentication failing?" --file backend/app/core/security.py

# Run in interactive mode
claude-code --interactive
```

### 6.4 Claude Code with VS Code

Install the Claude Code VS Code extension:
1. Open VS Code
2. Go to Extensions (Cmd+Shift+X)
3. Search for "Claude Code"
4. Install and configure with your API key

---

## 7. Development Workflow

### 7.1 Daily Workflow

```bash
# Terminal 1: Start services
cd ~/Projects/rgdgc-app
docker-compose up -d

# Terminal 2: Start backend
cd ~/Projects/rgdgc-app/backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 3: Start mobile
cd ~/Projects/rgdgc-app/mobile
npx expo start

# Then press 'i' for iOS simulator or scan QR for your iPhone
```

### 7.2 Testing API Endpoints

```bash
# Health check
curl http://localhost:8000/health

# Or open Swagger UI
open http://localhost:8000/docs
```

### 7.3 Database Management

```bash
# Connect to PostgreSQL
docker-compose exec db psql -U postgres -d rgdgc

# Run SQL
SELECT * FROM users;
\q  # Exit

# Create migration
cd ~/Projects/rgdgc-app/backend
source venv/bin/activate
alembic revision --autogenerate -m "add users table"

# Apply migrations
alembic upgrade head
```

### 7.4 Hot Reload

| Component | Hot Reload | How It Works |
|-----------|------------|--------------|
| Backend (FastAPI) | ✓ | `--reload` flag auto-restarts on file changes |
| Mobile (Expo) | ✓ | Automatic on save, shake device to reload |
| iOS Native | Partial | Cmd+R in simulator, full rebuild for native changes |

---

## 8. Testing on Your iPhone

### 8.1 Quick Method: Expo Go

```bash
# Make sure your Mac and iPhone are on same WiFi network

cd ~/Projects/rgdgc-app/mobile
npx expo start

# On iPhone:
# 1. Open Camera
# 2. Point at QR code
# 3. Tap the notification to open in Expo Go
```

### 8.2 Full Build: Development Client

```bash
# First time: Create EAS project
cd ~/Projects/rgdgc-app/mobile
eas login  # Login to Expo account
eas build:configure

# Create development build for iOS
eas build --profile development --platform ios

# Or build locally (requires Xcode)
npx expo run:ios --device
```

### 8.3 Testing Checklist

| Test | How |
|------|-----|
| API connectivity | Create a simple fetch to /health |
| Navigation | Tap through all tabs |
| Round scoring | Create a test round |
| Camera (AR) | Test AR distance feature |
| Push notifications | Send test notification |
| Offline mode | Turn off WiFi, continue using |

---

## 9. Debugging

### 9.1 Backend Debugging (VS Code)

```bash
# In VS Code:
# 1. Set breakpoints in Python files
# 2. Press F5 (or Run → Start Debugging)
# 3. Select "FastAPI" configuration
# 4. Make API calls to hit breakpoints
```

### 9.2 Mobile Debugging

```bash
# React Native Debugger
npx expo start

# In app, shake device or press Cmd+D (simulator)
# Select "Debug Remote JS"

# Or use Flipper
brew install --cask flipper
# Open Flipper, connect to running app
```

### 9.3 iOS Debugging (Xcode)

1. Open `ios/rgdgc.xcworkspace` in Xcode
2. Set breakpoints in Swift/Objective-C files
3. Run app (Cmd+R)
4. Use LLDB console for inspection

### 9.4 Common Issues

| Issue | Solution |
|-------|----------|
| "Port 8000 in use" | `lsof -i :8000` then `kill -9 <PID>` |
| "Pod install failed" | `cd ios && pod deintegrate && pod install` |
| "Expo won't connect" | Same WiFi? Try `npx expo start --tunnel` |
| "Build failed iOS" | Clean build: Cmd+Shift+K in Xcode |
| "Database connection failed" | `docker-compose restart db` |

---

## 10. Quick Reference Commands

```bash
# === DOCKER ===
docker-compose up -d          # Start services
docker-compose down           # Stop services
docker-compose logs -f api    # View logs
docker-compose restart db     # Restart specific service

# === BACKEND ===
cd backend
source venv/bin/activate      # Activate Python venv
uvicorn app.main:app --reload # Start with hot reload
pip install -r requirements.txt # Install deps
alembic upgrade head          # Run migrations

# === MOBILE ===
cd mobile
npx expo start                # Start dev server
npx expo start --ios          # Start + open iOS sim
npx expo run:ios --device     # Build and run on iPhone
npx expo prebuild             # Generate native projects
eas build --platform ios      # Cloud build

# === XCODE ===
open ios/rgdgc.xcworkspace    # Open in Xcode
cd ios && pod install         # Install CocoaPods deps
# Cmd+R to run
# Cmd+Shift+K to clean

# === GIT ===
git status
git add .
git commit -m "message"
git push

# === CLAUDE CODE ===
claude-code "help me with..."
claude-code --interactive
```

---

## 11. Recommended Terminal Setup

```bash
# Install iTerm2 (better terminal)
brew install --cask iterm2

# Install Oh My Zsh (better shell)
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# Add useful aliases to ~/.zshrc
cat >> ~/.zshrc << 'EOF'

# RGDGC Project Aliases
alias rgdgc="cd ~/Projects/rgdgc-app"
alias rgdgc-api="cd ~/Projects/rgdgc-app/backend && source venv/bin/activate && uvicorn app.main:app --reload"
alias rgdgc-mobile="cd ~/Projects/rgdgc-app/mobile && npx expo start"
alias rgdgc-docker="cd ~/Projects/rgdgc-app && docker-compose up -d"
alias rgdgc-stop="cd ~/Projects/rgdgc-app && docker-compose down"
EOF

source ~/.zshrc
```

Now you can just type:
- `rgdgc` - Go to project
- `rgdgc-docker` - Start Docker services
- `rgdgc-api` - Start API
- `rgdgc-mobile` - Start mobile app

---

*Document Version: 1.0*
*Last Updated: March 2026*
*Owner: RGDGC Tech Team*
