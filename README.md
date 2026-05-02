# API Gateway — LLM API 中转站

统一代理 OpenAI、Claude 等多模型 API，提供 API Key 分发、用量计费、速率限制、审计日志等完整 SaaS 功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.10+ / FastAPI / SQLAlchemy 2.0 / asyncpg |
| 数据库 | PostgreSQL 15 |
| 缓存/限流 | Redis 7 |
| 后台任务 | ARQ (async Redis Queue) |
| 前端 | React 18 / TypeScript / Vite / TailwindCSS / Recharts |

## 快速开始

### 一键启动（Windows）

双击项目根目录下的 `start.bat`，脚本会自动完成：

1. 检测并启动 Docker Desktop
2. 启动 PostgreSQL 和 Redis
3. 安装后端依赖（首次）
4. 执行数据库迁移
5. 安装前端依赖（首次）
6. 启动后端（端口 8000）和前端（端口 5173）

启动后访问 `http://localhost:5173` 即可使用，关闭脚本窗口不会停止服务。

### 手动启动

#### 前置条件

- Python 3.10+
- Node.js 22+
- PostgreSQL 15+
- Redis 7+

#### 1. 克隆并配置

```bash
cd api-gateway

# 编辑 backend/.env 配置数据库连接等
```

#### 2. 启动基础设施

```bash
docker-compose up -d postgres redis
```

#### 3. 初始化数据库

```bash
cd backend
pip install -e .
alembic upgrade head
```

#### 4. 创建管理员和添加模型

```bash
# 创建管理员
python -m app.cli create-admin admin@example.com admin123 Admin

# 添加 OpenAI 模型
python -m app.cli add-model openai gpt-4o "GPT-4o" \
  "https://api.openai.com/v1" "sk-your-openai-key" 0.003 0.006 4096

# 添加 Claude 模型
python -m app.cli add-model anthropic claude-sonnet-4-6 "Claude Sonnet 4.6" \
  "https://api.anthropic.com/v1" "sk-ant-your-key" 0.003 0.015 8192
```

#### 5. 启动后端

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

#### 6. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 `http://localhost:5173` 即可使用。

### Docker 一键启动

```bash
docker-compose up -d
```

## API 文档

启动后端后访问 `http://localhost:8000/docs` 查看 Swagger 文档。

## 对外 API（OpenAI 兼容格式）

终端用户使用 API Key 调用：

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer sk-YOUR-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello!"}]}'
```

## 项目结构

```
api-gateway/
├── backend/
│   ├── alembic/              # 数据库迁移
│   ├── app/
│   │   ├── core/             # 配置、安全、依赖注入
│   │   ├── models/           # SQLAlchemy 模型
│   │   ├── schemas/          # Pydantic 模型
│   │   ├── api/              # API 路由
│   │   │   ├── v1/           # 管理 API（JWT）
│   │   │   └── public/       # 对外 API（OpenAI 兼容）
│   │   ├── services/         # 业务逻辑
│   │   ├── middleware/       # 中间件
│   │   └── main.py           # 入口
│   ├── tests/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/       # 布局组件
│   │   ├── pages/            # 页面
│   │   └── lib/              # API 客户端、状态管理
│   └── Dockerfile
├── docker-compose.yml
├── start.bat               # Windows 一键启动脚本
└── README.md
```

## 核心功能

- **统一 API 代理**：兼容 OpenAI SDK，支持流式/非流式响应
- **API Key 管理**：SHA-256 哈希存储，支持有效期、启禁用
- **速率限制**：Redis 滑动窗口，per-key RPM 限制
- **用量计费**：按 token 实时扣费，预付制
- **多模型管理**：支持 OpenAI、Anthropic、Azure、自定义模型
- **管理后台**：用户管理、模型上下架、全局统计
