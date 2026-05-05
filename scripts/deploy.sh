#!/bin/bash

# Simple API Deployment Script
# Builds the API, copies to server, and restarts PM2
# Usage: ./scripts/deploy.sh

set -e

# Configuration
SSH_HOST="${SSH_HOST:-gcp-api}"
REMOTE_PATH="/opt/pasoll-api"
PM2_NAME="pasoll-api"

echo "🚀 Building API..."
npm run build:api

echo "📤 Copying files to server..."
scp -r dist/api/* "$SSH_HOST:$REMOTE_PATH/"

echo "⚙️  Installing dependencies and restarting PM2..."
ssh "$SSH_HOST" << 'ENDSSH'
    cd /opt/pasoll-api
    
    # Load environment (nvm, bashrc, profile)
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" 2>/dev/null || true
    [ -s "$HOME/.bashrc" ] && source "$HOME/.bashrc" 2>/dev/null || true
    [ -s "$HOME/.profile" ] && source "$HOME/.profile" 2>/dev/null || true
    
    # Install dependencies and restart PM2
    npm install --production --silent
    pm2 kill
    pm2 start ecosystem.config.js --env production
ENDSSH

echo "✅ Deployment complete!"
echo "📊 Check status: ssh $SSH_HOST 'pm2 status $PM2_NAME'"
echo "📋 View logs: ssh $SSH_HOST 'pm2 logs $PM2_NAME'"

