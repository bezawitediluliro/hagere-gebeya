#!/bin/bash
echo "🛑 Stopping existing server..."
kill $(lsof -ti:3000) 2>/dev/null
sleep 1

echo "🚀 Starting Hager Gebeya backend..."
export PATH="$PATH:/Users/bezawit/.local/share/fnm/node-versions/v24.9.0/installation/bin"
cd "$(dirname "$0")"
npm run dev
