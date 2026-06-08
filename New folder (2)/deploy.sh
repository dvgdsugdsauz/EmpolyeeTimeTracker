#!/bin/bash

DEPLOY_DIR="/opt/timetracker"
JAR_NAME="employee-timetracker-1.0.0.jar"
APP_PORT=8081

echo "=== Stopping old backend ==="
pkill -f "$JAR_NAME" || true
sleep 2

echo "=== Starting new backend ==="
nohup java -jar "$DEPLOY_DIR/$JAR_NAME" \
    --server.port=$APP_PORT \
    > "$DEPLOY_DIR/app.log" 2>&1 &

echo "Backend started on port $APP_PORT"

echo "=== Configuring Nginx ==="
if command -v nginx &> /dev/null; then
    # Write nginx config — serve frontend from deploy dir, proxy /api to backend
    sudo tee /etc/nginx/sites-available/timetracker > /dev/null << 'NGINXCONF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /opt/timetracker/frontend;
    index index.html;

    # Serve React SPA — fallback to index.html for client-side routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to Spring Boot backend
    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}
NGINXCONF

    # Enable our config, disable default
    sudo ln -sf /etc/nginx/sites-available/timetracker /etc/nginx/sites-enabled/timetracker
    sudo rm -f /etc/nginx/sites-enabled/default

    sudo nginx -t && sudo nginx -s reload
    echo "Nginx configured and reloaded"
else
    echo "Nginx not installed — frontend files at $DEPLOY_DIR/frontend/"
fi

echo "=== Deploy complete ==="
