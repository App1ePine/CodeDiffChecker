# Code Diff Checker

一个基于 Vue 3、Element Plus 与 `@git-diff-view` 的在线差异对比工作区，后端由 Hono 与 Prisma 提供注册、认证和分享管理能力。支持 MySQL/MariaDB 和 PostgreSQL 数据库。

## 功能特性

- **差异对比**：在两个编辑面板内粘贴或输入代码，支持统一视图与分栏视图的差异预览，并提供语法高亮显示功能。
- **安全认证**：登录后通过 HttpOnly Cookie 保持安全的持久会话。
- **分享管理**：已认证用户可以创建分享链接、设置可见性和过期时间，并在之后编辑或删除分享。
- **公开分享**：公开分享页以只读模式呈现 diff，同时保留视图切换与高亮能力。
- **安装向导**：首次部署提供图形化安装界面，轻松配置数据库和管理员账号。
- **多数据库支持**：原生支持 MySQL/MariaDB 和 PostgreSQL。

## 仓库结构

- `src/`：基于 Rsbuild 的 Vue 3 前端代码。
- `server/`：基于 Hono 的 TypeScript REST API。
- `server/prisma/`：Prisma Schema 定义。
- `scripts/`：前后端辅助脚本。

## 部署指南

### 前置条件

- Node.js ≥ 18（推荐 20+)。
- Yarn/Bun（项目使用 Yarn 是方便压缩打包）。
- 数据库实例：MariaDB 10.5+ / MySQL 8.0+ 或 PostgreSQL 18+。

### 1. 克隆仓库并安装依赖
```bash
git clone https://github.com/App1ePine/CodeDiffChecker.git
cd CodeDiffChecker
yarn install
```

### 2. 启动服务

在开发模式下启动：

```bash
# 同时启动前端和后端
yarn dev
```

### 3. 安装配置

访问 `http://localhost:3001`。首次访问会自动跳转到安装页面：

1.  **数据库配置**：选择数据库类型（MySQL 或 PostgreSQL），填写连接信息。
2.  **管理员账号**：设置系统管理员的用户名、邮箱和密码。
3.  **安全设置**：自动生成或手动填写 JWT Secret。

点击 "Install & Initialize" 完成安装。系统会自动创建数据库、初始化表结构并写入配置文件。

### 4. 生产构建与部署

1. **前端构建**
   ```bash
   yarn build
   ```
   构建产物位于 `dist/`，可部署到任意静态文件托管（Nginx、CDN、对象存储等）。

2. **后端构建与运行**
   ```bash
   yarn server:build
   ```
   构建后会在 `server/dist/server` 生成可执行文件。部署时可采用下列方式之一：
    - 使用 `yarn server:start`；
    - 直接执行 `server/dist/server`；
    - 将可执行文件放入系统服务（systemd、pm2 等）统一管理。

   部署后请通过反向代理（如 Nginx）暴露 `PORT`（默认 4000）。

### 5. 运行状况检查

- 查看后端日志输出，确认数据库连接成功并监听在预期端口。
- 登录后访问受保护接口（例如 `GET /api/auth/me`）和分享链接，验证 Cookie 与域名配置无误。

## API 速览

所有 API 均以 `/api` 为前缀，关键路由如下：

- `POST /api/install`：系统安装与初始化。
- `POST /api/auth/register`：注册账号并写入会话 Cookie。
- `POST /api/auth/login`：使用邮箱与密码登录。
- `POST /api/auth/logout`：注销并清除会话。
- `GET /api/auth/me`：获取当前登录用户。
- `POST /api/shares`：创建分享（需登录）。
- `GET /api/shares`：列出当前用户的分享。
- `PATCH /api/shares/:id`：更新分享标题、可见性或过期时间。
- `DELETE /api/shares/:id`：删除分享。
- `GET /api/public/shares/:slug`：读取公开分享（遵循隐藏与过期规则）。

## 注意事项

- 前端请求默认携带 `credentials: 'include'`，请确保后端 CORS 配置允许来自 `FRONTEND_ORIGIN` 的跨域请求。
- `JWT_SECRET` 与数据库密码务必使用生产级强度。
- 分享链接基于 `SHARE_BASE_URL` 生成，请在每个环境中设置成对应的前端访问地址。
