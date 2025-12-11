# Check for root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

echo "Stpping existing service..."
systemctl stop task-mgr || true

echo "Building Frontend..."
cd web
npm install
npm run build
cd ..

echo "Building Backend..."
cd server
cargo build --release
cd ..

echo "Installing to /opt/task-mgr..."
mkdir -p /opt/task-mgr/server
mkdir -p /opt/task-mgr/web
mkdir -p /opt/task-mgr/data/logs

# Copy Binaries
cp server/target/release/server /opt/task-mgr/server/task-mgr-server
chmod +x /opt/task-mgr/server/task-mgr-server

# Copy Web Assets
cp -r web/dist/* /opt/task-mgr/web/

# Setup DB (preserve if exists)
if [ ! -f /opt/task-mgr/tasks.db ]; then
    echo "Initializing Database..."
    touch /opt/task-mgr/tasks.db
fi

# Install Service
echo "Installing Systemd Service..."
cp task-mgr.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable task-mgr
systemctl start task-mgr

echo "Installation Complete!"
echo "Service status:"
systemctl status task-mgr --no-pager
