#!/bin/bash

DEPLOY_DIR="/opt/timetracker"
JAR_NAME="employee-timetracker-1.0.0.jar"
APP_PORT=8080

echo "=== Stopping old backend ==="
pkill -f "$JAR_NAME" || true
sleep 3

echo "=== Starting new backend ==="
nohup java -jar "$DEPLOY_DIR/$JAR_NAME" \
    --server.port=$APP_PORT \
    > "$DEPLOY_DIR/app.log" 2>&1 &

echo "Backend started on port $APP_PORT"

echo "=== Setting up Nginx for frontend ==="
if command -v nginx &> /dev/null; then
    sudo cp -r "$DEPLOY_DIR/frontend/"* /var/www/html/
    sudo nginx -s reload
    echo "Nginx reloaded"
else
    echo "Nginx not installed — frontend files at $DEPLOY_DIR/frontend/"
fi

echo "=== Deploy complete ==="
