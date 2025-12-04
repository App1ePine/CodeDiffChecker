# Code Diff Checker

<p align="center">
  <img src="https://img.shields.io/badge/Vue.js-35495E?style=flat-square&logo=vuedotjs&logoColor=4FC08D" alt="Vue" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Hono-E36002?style=flat-square&logo=hono&logoColor=white" alt="Hono" />
  <img src="https://img.shields.io/badge/Prisma-3982CE?style=flat-square&logo=Prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Rsbuild-000000?style=flat-square&logo=rsbuild&logoColor=white" alt="Rsbuild" />
</p>

<p align="center">
  一个基于 Vue3、ElementPlus 与 <code>@git-diff-view</code> 的现代化在线代码差异对比工作区。<br/>
  后端由 Hono 与 Prisma 驱动，提供完整的注册、认证、分享管理及多数据库支持能力。
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> • 
  <a href="#-技术栈">技术栈</a> • 
  <a href="#-部署指南">部署指南</a> • 
  <a href="#-api-速览">API 文档</a>
</p>

---

## ✨ 功能特性

- 📝 **专业级差异对比**
  支持统一视图与分栏视图切换，内置语法高亮，提供流畅的代码审查体验。

- 🔐 **企业级安全认证**
  基于 HttpOnly Cookie 的安全会话管理，全方位保护用户状态与数据安全。

- 🔗 **灵活的分享管理**
  一键生成分享链接，支持自定义可见性（公开/私有）与过期时间，随时管理已发布的分享。

- 🌍 **沉浸式公开分享**
  为访客提供只读的差异对比视图，保留完整的视图切换与代码高亮能力，提升阅读体验。

- 🔍 **探索发现**
  浏览社区公开的代码分享，发现他人的代码变更与优化思路。

- 🛡️ **密码保护**
  支持为分享设置访问密码，确保敏感代码仅对授权人员可见。

- 🧙‍♂️ **图形化安装向导**
  零门槛部署，通过直观的图形界面完成数据库连接与管理员账户配置。

- 🗄️ **多数据库原生支持**
  无缝适配 MySQL/MariaDB、PostgreSQL 与 MSSQL，满足不同环境的存储需求。

## 🛠️ 技术栈

### 前端
- **框架**: [Vue 3](https://vuejs.org/)
- **UI 组件库**: [Element Plus](https://element-plus.org/)
- **Diff 渲染**: [@git-diff-view/vue](https://github.com/MrWangJustToDo/git-diff-view)
- **构建工具**: [Rsbuild](https://rsbuild.dev/)

### 后端
- **运行时**: [Bun](https://bun.sh/)
- **Web 框架**: [Hono](https://hono.dev/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **验证**: [Zod](https://zod.dev/)

## 📂 仓库结构

- `src/`：基于 Rsbuild 的 Vue 3 前端代码。
- `server/`：基于 Hono 的 TypeScript REST API。
- `server/prisma/`：Prisma Schema 定义。

## 🚀 部署指南

### 前置条件

- **Runtime**: [Bun](https://bun.sh/) (推荐) 或 Node.js ≥ 18。
- **数据库**:
  - MariaDB 10.5+ / MySQL 8.0+
  - PostgreSQL 18+
  - MSSQL 2017+

### 1. 克隆仓库并安装依赖

```bash
git clone https://github.com/App1ePine/CodeDiffChecker.git
cd CodeDiffChecker
bun install
```

### 2. 启动服务

在开发模式下启动：

```bash
# 同时启动前端和后端
bun run dev
```

### 3. 安装配置

访问 `http://localhost:3001`。首次访问会自动跳转到安装页面：

1.  **数据库配置**：选择数据库类型（MySQL、PostgreSQL 或 MSSQL），填写连接信息。
2.  **管理员账号**：设置系统管理员的用户名、邮箱和密码。
3.  **安全设置**：自动生成或手动填写 JWT Secret。

点击 "Install & Initialize" 完成安装。系统会自动创建数据库、初始化表结构并写入配置文件。

### 4. 生产构建与部署

#### 前端构建
```bash
bun run build
```
构建产物位于 `dist/`，可部署到任意静态文件托管（Nginx、CDN、对象存储等）。

#### 后端构建与运行
```bash
bun run server:build
```
构建后会在 `server/dist/server` 生成可执行文件。部署时可采用下列方式之一：
- 使用 `bun run server:start`
- 直接执行 `server/dist/server`
- 将可执行文件放入系统服务（systemd、pm2 等）统一管理

> **注意**: 部署后请通过反向代理（如 Nginx）暴露 `PORT`（默认 4000）。

### 5. 运行状况检查

- 查看后端日志输出，确认数据库连接成功并监听在预期端口。
- 登录后访问受保护接口（例如 `GET /api/auth/me`）和分享链接，验证 Cookie 与域名配置无误。

## 🔌 API 速览

所有 API 均以 `/api` 为前缀，关键路由如下：

| 方法     | 路径                       | 描述                               |
| :------- | :------------------------- | :--------------------------------- |
| `POST`   | `/api/install`             | 系统安装与初始化                   |
| `POST`   | `/api/auth/register`       | 注册账号并写入会话 Cookie          |
| `POST`   | `/api/auth/login`          | 使用邮箱与密码登录                 |
| `POST`   | `/api/auth/logout`         | 注销并清除会话                     |
| `GET`    | `/api/auth/me`             | 获取当前登录用户                   |
| `POST`   | `/api/shares`              | 创建分享（需登录）                 |
| `GET`    | `/api/shares`              | 列出当前用户的分享                 |
| `PATCH`  | `/api/shares/:id`          | 更新分享标题、可见性或过期时间     |
| `DELETE` | `/api/shares/:id`          | 删除分享                           |
| `GET`    | `/api/public/shares/:slug` | 读取公开分享（遵循隐藏与过期规则） |

## ⚠️ 注意事项

- 前端请求默认携带 `credentials: 'include'`，请确保后端 CORS 配置允许来自 `FRONTEND_ORIGIN` 的跨域请求。
- `JWT_SECRET` 与数据库密码务必使用生产级强度。
- 分享链接基于 `SHARE_BASE_URL` 生成，请在每个环境中设置成对应的前端访问地址。
