# 部署与运维指南

## 服务器信息

- 公网 IP: `47.122.19.239`
- 系统: Alibaba Cloud Linux 3
- 域名: `xtq619.xyz` (前端) / `api.xtq619.xyz` (API)
- SSL: Cloudflare Flexible SSL
- 数据库: PostgreSQL 15 (Docker)
- 缓存: Redis 7 (Docker)

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
# 拉取代码
git clone https://ghfast.top/https://github.com/xtq619/API-Gateway-by-xtq.git /opt/api-gateway
cd /opt/api-gateway

# 创建环境变量
cat > .env <<EOF
DB_USER=gateway
DB_PASSWORD=<随机密码>
DB_NAME=api_gateway
SECRET_KEY=<随机密钥>
ENCRYPTION_KEY=<Fernet密钥>
DOMAIN=xtq619.xyz
EOF

# 构建并启动
docker compose -f docker-compose.prod.yml up -d --build

# 数据库迁移
docker compose -f docker-compose.prod.yml exec -w /app backend python -m alembic upgrade head

# 创建管理员
docker compose -f docker-compose.prod.yml exec -w /app backend python -m app.cli create-admin admin@xtq619.xyz <密码> Admin
```

### 3. Cloudflare DNS 配置

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | 47.122.19.239 | Proxied (橙色) |
| A | api | 47.122.19.239 | Proxied (橙色) |

SSL/TLS 加密模式: **Flexible**

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
docker compose -f docker-compose.prod.yml up -d
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
cd /opt/api-gateway
git pull
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

## 服务器迁移（换新服务器）

当旧服务器快过期时，按以下步骤迁移到新服务器。

### 1. 备份旧服务器数据

SSH 连接旧服务器，导出数据库：

```bash
# 导出数据库
docker compose -f /opt/api-gateway/docker-compose.prod.yml exec postgres pg_dump -U gateway api_gateway > /tmp/api_gateway_backup.sql

# 下载到本地（在本地 PowerShell 执行）
scp root@旧IP:/tmp/api_gateway_backup.sql D:\
```

备份 .env（如果需要保留密钥）：

```bash
scp root@旧IP:/opt/api-gateway/.env D:\
```

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
# 拉取代码
git clone https://ghfast.top/https://github.com/xtq619/API-Gateway-by-xtq.git /opt/api-gateway
cd /opt/api-gateway

# 创建 .env（用旧的或新建）
cat > .env <<EOF
DB_USER=gateway
DB_PASSWORD=<随机密码>
DB_NAME=api_gateway
SECRET_KEY=<随机密钥>
ENCRYPTION_KEY=<Fernet密钥>
DOMAIN=xtq619.xyz
EOF

# 构建并启动
docker compose -f docker-compose.prod.yml up -d --build

# 数据库迁移
docker compose -f docker-compose.prod.yml exec -w /app backend python -m alembic upgrade head

# 创建管理员
docker compose -f docker-compose.prod.yml exec -w /app backend python -m app.cli create-admin admin@xtq619.xyz admin123 Admin
```

### 5. 恢复数据库

```bash
# 上传备份到新服务器（在本地 PowerShell 执行）
scp D:\api_gateway_backup.sql root@新IP:/tmp/

# 在新服务器上恢复
docker compose -f /opt/api-gateway/docker-compose.prod.yml exec -T postgres psql -U gateway api_gateway < /tmp/api_gateway_backup.sql
```

### 6. 更新 Cloudflare DNS

登录 Cloudflare，把两条 A 记录的 IP 改成新服务器 IP：

| Type | Name | 旧 IP | 新 IP |
|------|------|-------|-------|
| A | @ | 旧IP | 新IP |
| A | api | 旧IP | 新IP |

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
