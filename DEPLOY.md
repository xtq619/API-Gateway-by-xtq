# 部署与运维指南

## 服务器信息

- 公网 IP: `101.133.230.197`
- 系统: Alibaba Cloud Linux 3
- SSH 别名: `ssh api-gw`
- 域名: `xtq619.xyz` (前端) / `api.xtq619.xyz` (API)
- SSL: Cloudflare Proxied
- 数据库: PostgreSQL 15 (Docker)
- 缓存: Redis 7 (Docker)

## 目录结构

服务器上只维护一个仓库 `newcreat`，通过软链接让 Docker 从 `/opt/api-gateway` 启动：

```
/opt/newcreat/                  ← Git 仓库（xtq619/newcreat）
└── api-gateway/                ← 后端 + 前端源码

/opt/api-gateway  →  /opt/newcreat/api-gateway  （软链接）
```

Docker Compose 从 `/opt/api-gateway` 启动，实际读取的是 `/opt/newcreat/api-gateway` 的文件。数据库 volume 不受目录影响，数据持久化。

## 首次部署

### 1. 安装环境

```bash
# 安装 Docker (阿里云镜像)
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git
sudo systemctl enable --now docker

# 配置 Docker 国内镜像
cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 2. 拉取代码并部署

```bash
# 拉取 newcreat 仓库
git clone https://ghfast.top/https://github.com/xtq619/newcreat.git /opt/newcreat

# 创建软链接（Docker 从 /opt/api-gateway 启动）
ln -s /opt/newcreat/api-gateway /opt/api-gateway
cd /opt/api-gateway

# 创建环境变量
cat > .env <<'EOF'
DB_USER=gateway
DB_PASSWORD=<随机密码>
DB_NAME=api_gateway
SECRET_KEY=<随机密钥>
ENCRYPTION_KEY=<Fernet密钥，用 python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 生成>
DOMAIN=<你的域名，如 example.com>
WX_APPID=<微信小程序 AppID，不需要可留空>
WX_SECRET=<微信小程序 Secret，不需要可留空>
EOF

# 构建并启动
docker compose -f docker-compose.prod.yml up -d --build

# 数据库迁移
docker compose -f docker-compose.prod.yml exec -w /app backend python -m alembic upgrade head

# 创建管理员
docker compose -f docker-compose.prod.yml exec -w /app backend python -m app.cli create-admin admin@xtq619.xyz <密码> Admin
```

### 3. 配置 Cloudflare Tunnel

> **为什么要用 Tunnel？** 阿里云对未备案域名在 80/443 端口实施 ICP 合规拦截（Beaver WAF 返回 403）。Cloudflare Tunnel 通过出站连接工作，绕过入站端口限制，不需要做 ICP 备案。

```bash
# 安装 cloudflared
curl -L https://ghfast.top/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# 登录 Cloudflare（会给出一个 URL，在浏览器打开授权）
cloudflared tunnel login

# 创建隧道
cloudflared tunnel create api-gateway

# 记下生成的 UUID，创建配置文件
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml <<EOF
tunnel: <UUID>
credentials-file: /root/.cloudflared/<UUID>.json

ingress:
  - hostname: xtq619.xyz
    service: http://localhost:80
  - hostname: api.xtq619.xyz
    service: http://localhost:80
  - service: http_status:404
EOF

# 设置 DNS 路由（会自动创建 CNAME 记录，不需要手动建 A 记录）
cloudflared tunnel route dns api-gateway xtq619.xyz
cloudflared tunnel route dns api-gateway api.xtq619.xyz

# 安装为系统服务并启动
cloudflared service install
systemctl start cloudflared
systemctl enable cloudflared

# 验证
systemctl status cloudflared
```

Cloudflare 设置（在控制台操作）：

- SSL/TLS 加密模式: **Flexible**
- Security Level: **Essentially Off**
- Browser Integrity Check: **关闭**
- Always Use HTTPS: **开启**

### 4. 阿里云安全组

| 协议 | 端口 | 授权对象 |
|------|------|---------|
| TCP | 22 | 0.0.0.0/0 |
| TCP | 80 | 0.0.0.0/0 |
| TCP | 443 | 0.0.0.0/0 |

## 日常运维

### 启动服务

```bash
cd /opt/api-gateway
docker compose -f docker-compose.prod.yml up -d --build
```

### 停止服务

```bash
docker compose -f docker-compose.prod.yml down
```

### 查看状态

```bash
docker compose -f docker-compose.prod.yml ps
```

### 查看日志

```bash
# 所有服务
docker compose -f docker-compose.prod.yml logs -f

# 单个服务
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx
```

### 更新代码

```bash
cd /opt/newcreat
git pull origin main
cd api-gateway
docker compose -f docker-compose.prod.yml up -d --build
```

如果涉及数据库模型变更:

```bash
docker compose -f docker-compose.prod.yml exec -w /app backend python -m alembic revision --autogenerate -m "描述"
docker compose -f docker-compose.prod.yml exec -w /app backend python -m alembic upgrade head
```

### 创建管理员

```bash
docker compose -f docker-compose.prod.yml exec -w /app backend python -m app.cli create-admin <邮箱> <密码> <名字>
```

### 添加模型

```bash
docker compose -f docker-compose.prod.yml exec -w /app backend python -m app.cli add-model <provider> <model_id> <display_name> <api_base> <api_key> <input_price> <output_price> <max_tokens>
```

示例:

```bash
# OpenAI
docker compose -f docker-compose.prod.yml exec -w /app backend python -m app.cli add-model openai gpt-4o "GPT-4o" "https://api.openai.com/v1" "sk-xxx" 0.003 0.006 4096

# Claude
docker compose -f docker-compose.prod.yml exec -w /app backend python -m app.cli add-model anthropic claude-sonnet-4-6 "Claude Sonnet 4.6" "https://api.anthropic.com/v1" "sk-ant-xxx" 0.003 0.015 8192
```

### 清理 Docker 空间

```bash
docker system prune -a --volumes
```

## 访问地址

| 服务 | 地址 |
|------|------|
| 前端 | https://xtq619.xyz |
| API | https://api.xtq619.xyz |
| API 文档 | https://api.xtq619.xyz/docs |
| 健康检查 | https://api.xtq619.xyz/health |

## 管理员账号

| 项目 | 值 |
|------|------|
| 邮箱 | admin@xtq619.xyz |
| 密码 | admin123 |

## 新机部署注意事项

以下文件中**硬编码了域名**，换域名时必须逐一修改：

| 文件 | 硬编码内容 | 说明 |
|------|-----------|------|
| `miniprogram/app.js` | `baseUrl: 'https://api.xtq619.xyz/api/v1'` | 小程序 API 地址 |
| `nginx/nginx.conf` | `server_name api.xtq619.xyz` / `server_name xtq619.xyz` | Nginx 路由 |
| `backend/app/services/news_fetcher.py` | `SILICON_VALLEY_PROXY = "https://ai.xtq619.xyz` | 海外新闻代理地址 |
| `docker-compose.prod.yml` | `DOMAIN` 环境变量（用于 CORS） | .env 文件控制 |

### .env 完整变量清单

| 变量 | 必需 | 说明 |
|------|------|------|
| `DB_USER` | 是 | PostgreSQL 用户名 |
| `DB_PASSWORD` | 是 | PostgreSQL 密码 |
| `DB_NAME` | 是 | 数据库名（默认 `api_gateway`） |
| `SECRET_KEY` | 是 | JWT 签名密钥（随机长字符串） |
| `ENCRYPTION_KEY` | 是 | Fernet 密钥，加密存储上游 API Key |
| `DOMAIN` | 是 | 域名，用于 CORS（如 `example.com`） |
| `WX_APPID` | 否 | 微信小程序 AppID（不需要微信登录可留空） |
| `WX_SECRET` | 否 | 微信小程序 Secret |

### 腾讯云硅谷新闻代理（可选）

如果需要海外 RSS 抓取功能，需要在腾讯云硅谷服务器部署新闻代理：

```bash
ssh tencent

# 创建代理服务（Flask，监听 5001 端口）
# 文件：/root/news_fetcher.py
# 功能：接收批量 RSS URL → 抓取 → 返回文章内容

# Nginx 配置（/etc/nginx/conf.d/ai.conf）
# ai.xtq619.xyz:443 → 127.0.0.1:5001

# 启动
nohup python3 /root/news_fetcher.py > /root/news_fetcher.log 2>&1 &
systemctl reload nginx
```

如果不需要海外代理，可以在 `news_fetcher.py` 中将 `SILICON_VALLEY_PROXY` 设为空字符串，RSS 源将直接从后端服务器抓取（部分境外源可能超时）。

## 服务器迁移（换新服务器）

当旧服务器快过期时，按以下步骤迁移到新服务器。

### 1. 备份旧服务器数据

SSH 连接旧服务器，导出数据库：

```bash
# 导出数据库
docker compose -f /opt/api-gateway/docker-compose.prod.yml exec postgres pg_dump -U gateway api_gateway > /tmp/api_gateway_backup.sql
```

在本地 PowerShell 下载备份文件：

```powershell
# 创建备份目录
mkdir D:\server-backup

# 下载数据库备份
scp root@旧IP:/tmp/api_gateway_backup.sql D:\server-backup\

# 下载 .env（保留密钥和配置）
scp root@旧IP:/opt/api-gateway/.env D:\server-backup\
```

> **注意**：`/opt/api-gateway` 是软链接指向 `/opt/newcreat/api-gateway`，下载 `.env` 即可。

### 2. 新服务器准备

1. 阿里云购买新 ECS（推荐 2核4G，Ubuntu/Alibaba Cloud Linux）
2. 安全组开放 22、80、443 端口
3. SSH 连接新服务器

```bash
ssh root@新IP
```

### 3. 新服务器安装环境

```bash
# 安装 Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git
sudo systemctl enable --now docker

# 配置 Docker 国内镜像
cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 4. 部署项目

```bash
# 拉取 newcreat 仓库
git clone https://ghfast.top/https://github.com/xtq619/newcreat.git /opt/newcreat

# 创建软链接
ln -s /opt/newcreat/api-gateway /opt/api-gateway
cd /opt/api-gateway

# 上传旧的 .env 到新服务器（在本地 PowerShell 执行）
scp D:\server-backup\.env root@新IP:/opt/api-gateway/.env

# 构建并启动
docker compose -f docker-compose.prod.yml up -d --build

# 后端实时日志：
docker compose -f docker-compose.prod.yml logs backend -f


### 5. 恢复数据库

```bash
# 上传备份到新服务器（在本地 PowerShell 执行）
scp D:\server-backup\api_gateway_backup.sql root@新IP:/tmp/

# 在新服务器上恢复
docker compose -f /opt/api-gateway/docker-compose.prod.yml exec -T postgres psql -U gateway api_gateway < /tmp/api_gateway_backup.sql

# 执行数据库迁移（如果有新增的表或字段）
docker compose -f docker-compose.prod.yml exec -w /app backend python -m alembic upgrade head
```

### 6. 配置 Cloudflare Tunnel

在新服务器上重新安装和配置 Cloudflare Tunnel（cert.pem 不能直接复制，需要重新登录）：

```bash
# 安装 cloudflared
curl -L https://ghfast.top/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# 登录（会给出 URL，在浏览器打开授权）
cloudflared tunnel login

# 创建隧道
cloudflared tunnel create api-gateway

# 记下 UUID，创建配置文件
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml <<EOF
tunnel: <UUID>
credentials-file: /root/.cloudflared/<UUID>.json

ingress:
  - hostname: xtq619.xyz
    service: http://localhost:80
  - hostname: api.xtq619.xyz
    service: http://localhost:80
  - service: http_status:404
EOF

# 删除旧的 DNS A 记录（在 Cloudflare 控制台或 API），然后设置新路由
cloudflared tunnel route dns api-gateway xtq619.xyz
cloudflared tunnel route dns api-gateway api.xtq619.xyz

# 安装为服务并启动
cloudflared service install
systemctl start cloudflared
systemctl enable cloudflared
```

### 7. 验证

```bash
# 检查服务状态
docker compose -f docker-compose.prod.yml ps

# 测试 API
curl https://api.xtq619.xyz/health
```

浏览器访问 https://xtq619.xyz 确认前端正常。

### 8. 释放旧服务器

确认新服务器一切正常后，在阿里云控制台释放旧 ECS 实例。
