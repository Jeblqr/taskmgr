#!/bin/bash
set -e

echo "Building Frontend..."
cd web
npm install
npm run build
cd ..

echo "Building Backend..."
cd server
cargo build --release
cd ..

echo "Setting up Systemd Service..."
# Adjust path in service file if needed (already absolute in my generation, but for portability sed is better)
# For now, assuming user will copy it or link it.

# Copy service file (requires sudo usually, but script might be run as user then sudo cp)
echo "To install systemd service:"
echo "sudo cp task-mgr.service /etc/systemd/system/"
echo "sudo systemctl daemon-reload"
echo "sudo systemctl enable task-mgr"
echo "sudo systemctl start task-mgr"

echo "Build Complete."
