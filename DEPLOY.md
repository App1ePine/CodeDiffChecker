# 部署指南 (Deployment Guide)

本文档介绍如何将 Code Diff Checker 部署到 Linux 服务器，并使用 Caddy + PM2 进行管理。

## 架构说明

-   **前端**：构建为静态资源，由 Caddy 直接托管
-   **后端**：编译为独立可执行文件，由 PM2 守护运行。内部端口：`4000`
-   **反向代理**：Caddy 将 `/api/` 转发给后端，并自动配置 HTTPS

## 1. 本地构建

### 前端构建
```bash
yarn build
# 产物目录: dist/
```

### 后端构建
```bash
yarn server:build:linux
# 产物文件: server/dist/server
```

## 2. 上传文件到服务器

将以下文件/目录上传到服务器（例如 `/var/www/app`）：

```
本地                                    → 服务器
────────────────────────────────────────────────────────────
dist/                                   → /var/www/app/dist/
server/dist/server                      → /var/www/app/server/dist/server
server/src/generated/                   → /var/www/app/server/src/generated/
server/prisma/                          → /var/www/app/server/prisma/
ecosystem.config.cjs                    → /var/www/app/ecosystem.config.cjs
```

**使用 rsync 上传示例**：
```bash
# 前端
rsync -avz dist/ user@server:/var/www/app/dist/

# 后端可执行文件
rsync -avz server/dist/server user@server:/var/www/app/server/dist/

# Prisma 生成的客户端（重要！）
rsync -avz server/src/generated/ user@server:/var/www/app/server/src/generated/

# Prisma Schema
rsync -avz server/prisma/ user@server:/var/www/app/server/prisma/

# PM2 配置
rsync -avz ecosystem.config.cjs user@server:/var/www/app/
```

**设置执行权限**：
```bash
ssh user@server "chmod +x /var/www/app/server/dist/server"
```

## 3. 配置 PM2

**⚠️ 重要**：在启动 PM2 之前，**必须**编辑服务器上的 `ecosystem.config.cjs`，将域名改为你的实际域名：

```javascript
env: {
  NODE_ENV: 'production',
  PORT: 4000,
  FRONTEND_ORIGIN: 'https://yourdomain.com',  // ⚠️ 必须修改为你的域名
  SHARE_BASE_URL: 'https://yourdomain.com'    // ⚠️ 必须修改为你的域名
}
```

这两个环境变量会在安装时写入 `server/.env` 文件，决定了：
- `FRONTEND_ORIGIN`：CORS 允许的前端域名
- `SHARE_BASE_URL`：分享链接的基础 URL

启动后端：
```bash
cd /var/www/app
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # 设置开机自启
```

## 4. 配置 Caddy

创建 Caddyfile（`/etc/caddy/Caddyfile`）：

```caddy
yourdomain.com {
    # 前端静态资源根目录
    root * /var/www/app/dist
    
    # 后端 API 代理
    @api path /api/*
    handle @api {
        reverse_proxy http://127.0.0.1:30003
    }
    
    # 前端路由（SPA 支持）
    handle {
        try_files {path} /index.html
        file_server {
            index index.html
        }
    }
    
    # 开启压缩
    encode gzip
}
```

**注意**：将 `127.0.0.1:30003` 改为你在 `ecosystem.config.cjs` 中设置的端口。

重启 Caddy：
```bash
sudo systemctl reload caddy
```

## 5. 通过网页完成安装

1.  访问 `https://yourdomain.com`
2.  系统会自动跳转到安装页面
3.  填写以下信息：
    - **数据库类型**：MySQL 或 PostgreSQL
    - **数据库连接信息**：主机、端口、数据库名、用户名、密码
    - **管理员账号**：用户名、邮箱、昵称、密码
    - **JWT Secret**：点击"Generate"自动生成
4.  点击"Install & Initialize"
5.  系统会自动：
    - 连接数据库
    - 创建数据库和表
    - 创建管理员账号
    - 写入配置文件（`server/.env`）
    - 初始化数据库连接
6.  安装完成后自动跳转到首页

## 6. 常见问题

-   **502 Bad Gateway**：检查后端是否启动 (`pm2 status`)，以及端口是否为 4000
-   **安装后 404**：检查 Caddyfile 的 `try_files` 配置是否正确
-   **权限错误**：确保 Caddy 有权限读取 `/var/www/app/dist`，且 PM2 有权限写入 `server/.env`
-   **CORS 错误**：确保 `ecosystem.config.cjs` 中的 `FRONTEND_ORIGIN` 与你的域名一致
-   **Prisma 引擎错误**：确保上传了 `server/src/generated/` 目录。
