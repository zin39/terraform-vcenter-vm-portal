#!/bin/bash
# VM Portal Deployment Script
# Run this on the production server (your-server-ip)

set -e  # Exit on error

echo "=========================================="
echo "VM Provisioning Portal - Deployment Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/var/www/vm-portal"
DB_NAME="vmportal"
DB_USER="vmportal"
DB_PASSWORD="CHANGE_THIS_PASSWORD"  # Change this!

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo ./deploy.sh)${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 1: Installing PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    apt-get update
    apt-get install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
    echo -e "${GREEN}PostgreSQL installed${NC}"
else
    echo -e "${GREEN}PostgreSQL already installed${NC}"
fi

echo -e "\n${YELLOW}Step 2: Creating database and user...${NC}"
sudo -u postgres psql -c "SELECT 1 FROM pg_user WHERE usename = '$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
echo -e "${GREEN}Database configured${NC}"

echo -e "\n${YELLOW}Step 3: Creating installation directory...${NC}"
mkdir -p $INSTALL_DIR/frontend
mkdir -p $INSTALL_DIR/backend/terraform-workspaces
mkdir -p $INSTALL_DIR/backend/migrations
echo -e "${GREEN}Directories created${NC}"

echo -e "\n${YELLOW}Step 4: Copying files...${NC}"
# Copy frontend (assumes dist folder exists)
if [ -d "./frontend-dist" ]; then
    cp -r ./frontend-dist/* $INSTALL_DIR/frontend/
    echo -e "${GREEN}Frontend copied${NC}"
else
    echo -e "${RED}Warning: frontend-dist folder not found. Copy manually.${NC}"
fi

# Copy backend binary
if [ -f "./approval_portal" ]; then
    cp ./approval_portal $INSTALL_DIR/backend/
    chmod +x $INSTALL_DIR/backend/approval_portal
    echo -e "${GREEN}Backend binary copied${NC}"
else
    echo -e "${RED}Warning: approval_portal binary not found. Copy manually.${NC}"
fi

# Copy migrations
if [ -d "./migrations" ]; then
    cp -r ./migrations/* $INSTALL_DIR/backend/migrations/
    echo -e "${GREEN}Migrations copied${NC}"
fi

# Copy environment file
if [ -f "./.env.production" ]; then
    cp ./.env.production $INSTALL_DIR/backend/.env
    echo -e "${YELLOW}Remember to edit $INSTALL_DIR/backend/.env with your settings!${NC}"
fi

echo -e "\n${YELLOW}Step 5: Setting permissions...${NC}"
chown -R www-data:www-data $INSTALL_DIR
chmod -R 755 $INSTALL_DIR
chmod 600 $INSTALL_DIR/backend/.env
echo -e "${GREEN}Permissions set${NC}"

echo -e "\n${YELLOW}Step 6: Installing systemd service...${NC}"
if [ -f "./vm-portal-backend.service" ]; then
    cp ./vm-portal-backend.service /etc/systemd/system/
    systemctl daemon-reload
    echo -e "${GREEN}Systemd service installed${NC}"
fi

echo -e "\n${YELLOW}Step 7: Configuring nginx...${NC}"
if [ -f "./nginx-vm-portal.conf" ]; then
    cp ./nginx-vm-portal.conf /etc/nginx/sites-available/vm-portal
    ln -sf /etc/nginx/sites-available/vm-portal /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    echo -e "${GREEN}Nginx configured${NC}"
else
    echo -e "${RED}Warning: nginx config not found${NC}"
fi

echo -e "\n${YELLOW}Step 8: Starting services...${NC}"
systemctl enable vm-portal-backend
systemctl start vm-portal-backend
echo -e "${GREEN}Backend service started${NC}"

echo -e "\n=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit /var/www/vm-portal/backend/.env with your actual credentials"
echo "2. Restart the backend: sudo systemctl restart vm-portal-backend"
echo "3. Access the portal at: http://your-server-ip:3000"
echo ""
echo "Default admin login:"
echo "  Email: admin@example.com"
echo "  Password: Admin123!"
echo ""
echo "Check service status: sudo systemctl status vm-portal-backend"
echo "View logs: sudo journalctl -u vm-portal-backend -f"
