#!/bin/sh
# Replace the port in nginx config with the one provided by Cloud Run
sed -i "s|listen 0.0.0.0:8080;|listen 0.0.0.0:$PORT;|g" /etc/nginx/conf.d/default.conf

# Start Nginx
exec nginx -g 'daemon off;'