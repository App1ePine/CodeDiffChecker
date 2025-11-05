# Code Diff Checker

一个基于 Vue 3、Element Plus 与 `@git-diff-view` 的在线差异对比工作区，后端由 Hono 与 MariaDB 提供注册、认证和分享管理能力。

## 功能特性

- 在两个编辑面板内粘贴或输入代码，支持统一视图与分栏视图的差异预览，并提供语法高亮显示功能。
- 登录后通过 HttpOnly Cookie 保持安全的持久会话。
- 已认证用户可以创建分享链接、设置可见性和过期时间，并在之后编辑或删除分享。
- 公开分享页以只读模式呈现 diff，同时保留视图切换与高亮能力。

## 仓库结构

- `src/`：基于 Rsbuild 的 Vue 3 前端代码。
- `server/`：基于 Hono 的 TypeScript REST API。
- `server/sql/`：集中存放数据库 SQL（如 `init.sql` 等）。
- `scripts/`：前后端辅助脚本。

## 部署指南

### 前置条件

- Node.js ≥ 18（推荐 20+)。
- Yarn/Bun（项目使用 Yarn 是方便压缩打包）。
- MariaDB 10.5+/MySQL 8.0+ 数据库实例。

### 1. 克隆仓库并安装依赖
```bash
git clone https://github.com/App1ePine/CodeDiffChecker.git
cd CodeDiffChecker
yarn install
```

### 2. 配置环境变量

#### 第一步：复制示例文件

```bash
cp .env.example .env.development
cp .env.example .env.production
cp server/.env.example server/.env.development
cp server/.env.example server/.env.production
cp server/.env.local.example server/.env.local
```

#### 第二步：填写前端环境（`.env.development` / `.env.production`）

- `PUBLIC_API_BASE_URL`：前端调用的后端地址。开发环境一般是 `http://localhost:4000`，线上填写后端真实域名。

#### 第三步：填写后端运行环境（`server/.env.development` / `server/.env.production`）

必填项如下：

- `PORT`：后端监听端口，默认 4000，可按需要修改。
- `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`：业务数据库连接信息。
- `JWT_SECRET`：32 位以上随机字符串，用于生成登录令牌。
- `TOKEN_EXPIRES_IN`：令牌有效期（如 `7d`、`12h`）。
- `FRONTEND_ORIGIN`、`SHARE_BASE_URL`：前端实际访问域名，用于跨域与分享链接生成。

#### 第四步：填写数据库脚本专用信息（`server/.env.local`）

复制自 `server/.env.local.example`，仅供 `yarn db:create` / `yarn db:init` / `yarn db:export` / `yarn db:import` 使用：

- `DB_ADMIN_HOST` / `DB_ADMIN_PORT` / `DB_ADMIN_USER` / `DB_ADMIN_PASSWORD`：具备建库、授权权限的管理员账号。
- `DB_BACKUP_DIR`（可选）：备份文件输出目录，默认 `server/backups`。

### 3. 初始化数据库

使用脚本完成数据库创建与初始数据导入：

```bash
yarn db:create   # 使用 DB_ADMIN_* 创建数据库并授权
yarn db:init     # 执行 server/sql/init.sql 建立结构与默认数据
```

`yarn db:init` 会执行 `server/sql/init.sql`，默认插入一个管理员账号（用户名 `admin`，密码 `ChangeMe123!`，上线后请立即重置或删除）。你可以按需编辑该 SQL
文件以补充自定义初始数据。

> 提示：`DB_ADMIN_*` 仅供脚本建库与授权使用，正式运行时仍由 `DB_USER` 连接数据库。请务必配置完整的管理员信息后再执行 `yarn db:create`。

### 4. 本地开发调试

在两个终端中分别启动后端与前端：
```bash
# 终端 A：启动 Hono API（默认端口 4000）
yarn server:dev

# 终端 B：启动 Rsbuild 开发服务器（默认端口 3001）
yarn dev
```

访问 `http://localhost:3001` 体验前端；如前后端不在同一域名，请确保 `PUBLIC_API_BASE_URL` 指向正确的 API 地址。

### 5. 生产构建与部署

1. **前端构建**
   ```bash
   yarn build
   ```
   构建产物位于 `dist/`，可部署到任意静态文件托管（Nginx、CDN、对象存储等）。部署前确保 `.env.production` 中的 `PUBLIC_API_BASE_URL` 指向生产 API。

2. **后端构建与运行**
   ```bash
   yarn server:build
   ```
   构建后会在 `server/dist/server` 生成可执行文件。部署时可采用下列方式之一：
    - 使用 `yarn server:start`（会读取当前环境变量）；
    - 直接执行 `server/dist/server`，在外部注入所有必要的环境变量；
    - 将可执行文件放入系统服务（systemd、pm2 等）统一管理。

   部署后请通过反向代理（如 Nginx）暴露 `PORT`，并配置 HTTPS。记得同步更新 `FRONTEND_ORIGIN`、`SHARE_BASE_URL` 以及前端的 `PUBLIC_API_BASE_URL`。

3. **数据库更新**
   当代码涉及数据库结构调整时，修改 `server/sql/init.sql` 后重新执行：
   ```bash
   yarn db:init
   ```
   在生产环境中建议先执行 `yarn db:export` 创建压缩备份，再重新初始化。

### 6. 数据迁出 / 迁入

- 导出整库 JSON 并使用 Gzip 压缩（默认输出到 `server/backups`，可通过 `DB_BACKUP_DIR` 自定义）：
  ```bash
  yarn db:export
  ```
- 从压缩备份文件恢复数据（会清空备份文件中包含的表）：
  ```bash
  yarn db:import server/backups/backup-YYYY-MM-DDTHH-mm-ss.json.gz
  ```

### 7. 运行状况检查

- 查看后端日志输出，确认数据库连接成功并监听在预期端口。
- 登录后访问受保护接口（例如 `GET /api/auth/me`）和分享链接，验证 Cookie 与域名配置无误。

## API 速览

所有 API 均以 `/api` 为前缀，关键路由如下：

- `POST /api/auth/register`：注册账号并写入会话 Cookie。
- `POST /api/auth/login`：使用邮箱与密码登录。
- `POST /api/auth/logout`：注销并清除会话。
- `GET /api/auth/me`：获取当前登录用户。
- `POST /api/shares`：创建分享（需登录）。
- `GET /api/shares`：列出当前用户的分享。
- `PATCH /api/shares/:id`：更新分享标题、可见性或过期时间。
- `DELETE /api/shares/:id`：删除分享。
- `GET /api/public/shares/:slug`：读取公开分享（遵循隐藏与过期规则）。

所有受保护接口均依赖登录后发放的 HttpOnly Cookie。

## 注意事项

- 前端请求默认携带 `credentials: 'include'`，请确保后端 CORS 配置允许来自 `FRONTEND_ORIGIN` 的跨域请求。
- `JWT_SECRET` 与数据库密码务必使用生产级强度，并避免提交到仓库。
- 分享链接基于 `SHARE_BASE_URL` 生成，请在每个环境中设置成对应的前端访问地址。
- 如需扩展新的环境变量，前端必须保留 `PUBLIC_` 前缀才能在浏览器中读取。
