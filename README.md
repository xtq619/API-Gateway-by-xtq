# API Gateway — LLM API 中转站

统一代理 OpenAI、Claude 等多模型 API，提供 API Key 分发、用量计费、速率限制、审计日志等完整 SaaS 功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.10+ / FastAPI / SQLAlchemy 2.0 / asyncpg |
| 数据库 | PostgreSQL 15 |
| 缓存/限流 | Redis 7 |
| 前端 (Web) | React 19 / TypeScript / Vite / TailwindCSS 4 / Zustand / Recharts |
| 部署 | Docker Compose + Nginx + Cloudflare Tunnel (阿里云 ECS) |
| 域名 | xtq619.xyz (前端) / api.xtq619.xyz (API) |

## 项目结构

```text
api-gateway/
├── backend/
│   ├── alembic/              # 数据库迁移（共 15 个）
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py     # 配置（数据库、Redis、JWT、微信）
│   │   │   ├── database.py   # 异步 SQLAlchemy 引擎
│   │   │   ├── security.py   # bcrypt / JWT / Fernet / SHA-256
│   │   │   ├── dependencies.py
│   │   │   └── exceptions.py
│   │   ├── models/
│   │   │   ├── user.py           # 用户（含 wx_openid）
│   │   │   ├── api_key.py        # API 密钥（SHA-256 + 模型权限）
│   │   │   ├── model_registry.py # 模型注册表
│   │   │   ├── billing.py        # 计费账户 + 交易记录
│   │   │   ├── usage_log.py      # 用量日志
│   │   │   ├── feedback.py       # 用户留言
│   │   │   ├── ai_news.py        # 军事资讯
│   │   │   ├── news_setting.py   # 资讯抓取配置
│   │   │   ├── battle.py         # 擂台对战记录
│   │   │   ├── digest.py         # SMTP 摘要配置
│   │   │   ├── user_digest.py    # 用户订阅偏好
│   │   │   └── worldcup.py       # 世界杯竞猜 + 情绪投票
│   │   ├── schemas/          # Pydantic 请求/响应模型（含 worldcup.py）
│   │   ├── api/
│   │   │   ├── v1/           # 管理 API（JWT 认证）
│   │   │   │   ├── auth.py        # 注册/登录/微信登录/微信绑定
│   │   │   │   ├── keys.py        # API 密钥 CRUD
│   │   │   │   ├── models.py      # 模型列表
│   │   │   │   ├── proxy.py       # 代理接口
│   │   │   │   ├── usage.py       # 用量统计
│   │   │   │   ├── billing.py     # 充值/余额/交易
│   │   │   │   ├── admin.py       # 管理后台
│   │   │   │   ├── feedback.py    # 留言
│   │   │   │   ├── feedback_admin.py
│   │   │   │   ├── news_admin.py  # 军事资讯管理 + 抓取设置
│   │   │   │   ├── digest.py      # 摘要订阅
│   │   │   │   ├── user_digest.py
│   │   │   │   ├── battle.py      # 擂台 SSE + WebSocket
│   │   │   │   ├── hub_admin.py
│   │   │   │   └── worldcup.py    # 世界杯竞猜 + 情绪投票
│   │   │   └── public/       # 对外 API（OpenAI 兼容 + 公开接口）
│   │   ├── services/
│   │   │   ├── proxy_service.py       # 核心代理（SSE 流式 + 计费）
│   │   │   ├── auth_service.py        # 登录注册 + 微信登录
│   │   │   ├── billing_service.py     # 余额扣费（行锁）
│   │   │   ├── rate_limiter.py        # Redis 滑动窗口
│   │   │   ├── battle_service.py      # 擂台辩论逻辑
│   │   │   ├── news_fetcher.py        # 军事 RSS 抓取 + AI 摘要（均匀分配）
│   │   │   ├── news_setting_service.py # 资讯抓取配置读写
│   │   │   ├── digest.py              # 每日摘要编译
│   │   │   ├── notifier.py            # SMTP 邮件发送
│   │   │   └── worldcup_service.py    # 世界杯竞猜/情绪服务
│   │   ├── middleware/
│   │   └── main.py           # FastAPI 入口 + APScheduler
│   ├── tests/
│   └── Dockerfile
├── frontend/                 # React Web 前端
│   ├── src/
│   │   ├── pages/            # 14 个页面
│   │   ├── components/       # Layout / ProtectedRoute / MusicPlayer / CursorRing
│   │   ├── lib/              # api.ts (60+ 方法) / store.ts (Zustand)
│   │   └── index.css         # TailwindCSS 4 主题
│   └── Dockerfile
├── nginx/nginx.conf
├── docker-compose.yml        # 本地开发
├── docker-compose.prod.yml   # 生产部署
├── deploy.sh
├── start.bat                 # Windows 一键启动
└── README.md                 # 本文件
```

## 核心功能

### 后端

- **统一 API 代理**：兼容 OpenAI SDK，支持流式/非流式响应，1.5x 加价
- **API Key 管理**：SHA-256 哈希存储，有效期、启禁用、模型权限
- **速率限制**：Redis 滑动窗口，per-key RPM
- **用量计费**：按 token 实时扣费，预付制，行锁防并发
- **多模型管理**：OpenAI、Anthropic、Azure、自定义模型
- **模型擂台**：两个 AI 辩论 + 裁判评判（SSE 流式 / WebSocket）
- **世界杯**：赛程展示、竞猜预测、情绪投票、赛事分析
- **军事资讯**：4 个 RSS 源均匀分配抓取 → AI 中文摘要 → 自动发布
- **资讯设置**：管理员可配置每日抓取数量、推送时间，支持手动触发
- **每日摘要**：APScheduler 定时 → 编译 → SMTP 邮件推送
- **留言反馈**：用户提交 + 管理员回复
- **微信登录**：`/auth/wxlogin` + `/auth/wxbind`

### Web 前端

- 登录/注册、工作空间 Hub、仪表盘、密钥管理、用量统计、充值计费、模型列表
- 管理后台：用户管理、**军事资讯管理**（抓取设置 + 资讯列表）、留言管理、SMTP 配置
- 留言反馈、每日摘要、模型擂台

## 军事资讯抓取

- **数据源**：The War Zone、Defense News、C4ISRNET、Task & Purpose
- **均匀分配**：4 个源每源取 `ceil(总数/4)` 条，去重后截断为设定数量
- **AI 处理**：英文原文 → 中文军事摘要（80-120 字）
- **定时任务**：APScheduler，每日北京时间指定时间自动抓取
- **管理员配置**：网页后台可修改抓取数量（1-50 条）、推送时间（时:分）
- **手动触发**：管理员可随时点击"自动抓取"手动触发
- **超时保护**：120 秒总超时，单源 20 秒超时

## 快速开始

### 本地开发

```bash
# 启动 Docker 服务
docker compose up -d postgres redis

# 后端
cd backend
pip install -e .
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
```

访问 `http://localhost:5173`

### 生产部署

```bash
# /opt/api-gateway 是 /opt/newcreat/api-gateway 的软链接
cd /opt/newcreat
git pull origin main
cd api-gateway
docker compose -f docker-compose.prod.yml up -d --build
```

## API 文档

- Swagger: `https://api.xtq619.xyz/docs`
- 健康检查: `https://api.xtq619.xyz/health`

## 环境变量（.env，由 docker-compose.prod.yml 读取）

| 变量 | 必需 | 说明 |
|------|------|------|
| DB_USER | 是 | PostgreSQL 用户名 |
| DB_PASSWORD | 是 | PostgreSQL 密码 |
| DB_NAME | 否 | 数据库名（默认 `api_gateway`） |
| SECRET_KEY | 是 | JWT 签名密钥 |
| ENCRYPTION_KEY | 是 | Fernet 密钥（加密上游 API Key） |
| DOMAIN | 是 | 域名（用于 CORS，如 `example.com`） |
| WX_APPID | 否 | 微信小程序 AppID |
| WX_SECRET | 否 | 微信小程序 AppSecret |
| MARKUP_RATIO | 否 | API 加价比例（默认 1.5x） |

## 数据库迁移记录

| 迁移 ID | 说明 |
| ------- | ---- |
| 6c835882e158 | 初始表结构 |
| fa43d14845ee | API 密钥模型权限 |
| 7a1b2c3d4e5f | 留言表 |
| 8b2c3d4e5f6g | AI 资讯表 |
| 9c3d4e5f6a7b | 留言回复字段 |
| ad4e5f6a7b8c | SMTP 摘要配置 |
| be5f6a7b8c9d | 用户摘要偏好 |
| cf6a7b8c9d0e | 擂台记录 |
| d1a2b3c4d5e6 | 微信 openid |
| e2f3a4b5c6d7 | 资讯抓取配置 |
| f3a4b5c6d7e8 | 用户摘要 last_sent_date |
| g4h5i6j7k8l9 | 资讯 is_sensitive 标记 |
| h5i6j7k8l9m0 | 用户头像 avatar_url |
| i6j7k8l9m0n1 | Hub 内容管理 |
| j7k8l9m0n1o2 | 世界杯竞猜 + 情绪投票 |
