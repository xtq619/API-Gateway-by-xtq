#!/bin/bash
set -e

# ============================================
# API Gateway 部署脚本
# 用法: ./deploy.sh <your-domain.com>
# ============================================

DOMAIN=${1:?用法: ./deploy.sh <your-domain.com>}

echo "========================================"
echo "  API Gateway 部署 - $DOMAIN"
echo "========================================"

# 1. 检查 .env
if [ ! -f .env ]; then
    echo "[!] .env 文件不存在，正在创建..."
    cat > .env <<EOF
DB_USER=gateway
DB_PASSWORD=$(openssl rand -hex 16)
DB_NAME=api_gateway
SECRET_KEY=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || echo "CHANGE_ME")
DOMAIN=$DOMAIN
EOF
    echo "    .env 已创建，请检查并修改后重新运行此脚本"
    exit 1
fi

# 2. 替换 nginx 中的域名
echo "[1/5] 配置 nginx 域名..."
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" nginx/nginx.conf

# 3. 先启动 nginx（HTTP only，用于 certbot 验证）
echo "[2/5] 临时启动 nginx（HTTP only）..."
# 临时配置：只监听 80
cat > /tmp/nginx-temp.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN api.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'initializing...';
        add_header Content-Type text/plain;
    }
}
EOF
cp nginx/nginx.conf nginx/nginx.conf.bak
cp /tmp/nginx-temp.conf nginx/nginx.conf

docker compose -f docker-compose.prod.yml up -d nginx certbot
sleep 3

# 4. 申请 SSL 证书
echo "[3/5] 申请 SSL 证书 (Let's Encrypt)..."
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot -w /var/www/certbot \
    -d $DOMAIN \
    -d api.$DOMAIN \
    --email admin@$DOMAIN \
    --agree-tos \
    --non-interactive || {
        echo "[!] SSL 证书申请失败，请确认："
        echo "    1. 域名 $DOMAIN 已解析到本服务器 IP"
        echo "    2. 阿里云安全组已开放 80 端口"
        exit 1
    }

# 恢复完整 nginx 配置
cp nginx/nginx.conf.bak nginx/nginx.conf
rm nginx/nginx.conf.bak

# 5. 构建并启动所有服务
echo "[4/5] 构建并启动所有服务..."
docker compose -f docker-compose.prod.yml up -d --build

# 6. 初始化数据库
echo "[5/5] 初始化数据库..."
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

echo ""
echo "========================================"
echo "  部署完成！"
echo ""
echo "  前端: https://$DOMAIN"
echo "  API:  https://api.$DOMAIN"
echo "  文档: https://api.$DOMAIN/docs"
echo "  健康: https://api.$DOMAIN/health"
echo "========================================"
echo ""
echo "后续步骤:"
echo "  1. 创建管理员:"
echo "     docker compose -f docker-compose.prod.yml exec backend python -m app.cli create-admin admin@example.com <密码> Admin"
echo "  2. 添加模型:"
echo "     docker compose -f docker-compose.prod.yml exec backend python -m app.cli add-model openai gpt-4o \"GPT-4o\" \"https://api.openai.com/v1\" \"sk-xxx\" 0.003 0.006 4096"
