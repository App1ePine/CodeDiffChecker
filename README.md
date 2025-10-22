# Code Diff Checker

一个基于 Vue 3 + Element Plus 的 Paste 管理平台，可创建、编辑、分享并监控代码片段的访问状态。

## 功能特性

- **Paste 创建/编辑**：支持标题、内容、访问权限（公开/仅持有链接/仅自己）与过期时间（1 天、7 天、永久或保留现有设置）。
- **仪表盘管理**：提供分页、过期状态与可见性筛选，可快速复制分享链接、切换可见性、删除 Paste。
- **分享可用性保障**：后端对分享链接进行访问控制、过期校验，并通过指标和日志输出暴露健康状态。
- **监控与日志**：内置 Prometheus 指标（`/metrics`）、健康检查（`/health`）以及访问日志，便于部署后观察服务质量。

## 快速开始

> 以下命令均可使用 npm / yarn / bun 等包管理工具执行，示例以 `yarn` 为主。

### 1. 安装依赖

```bash
yarn install
```

### 2. 启动后端服务

```bash
# 默认监听 http://localhost:4000
yarn server
```

可选环境变量：

| 变量名 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 后端服务端口 | `4000` |
| `DEFAULT_USER_ID` | 未显式传入 `x-user-id` 时使用的用户标识 | `demo-user` |
| `PUBLIC_BASE_URL` | 构造分享链接时使用的公共域名 | 根据请求自动推断 |

常用接口：

- `GET /pastes`：分页获取当前用户的 Paste 列表，支持 `page`、`pageSize`、`visibility`、`status`（`active` / `expired`）筛选。
- `POST /pastes`：创建新 Paste。
- `PATCH /pastes/:id`：更新标题、内容、访问权限、过期时间。
- `DELETE /pastes/:id`：删除 Paste。
- `GET /share/:shareId`：基于分享链接访问内容，会自动阻止私有或已过期的分享。
- `GET /metrics`：导出 Prometheus 指标，包含分享访问次数、不可用原因统计、HTTP 请求耗时直方图等。
- `GET /health`：返回当前健康状态。

### 3. 启动前端

```bash
# 默认监听 http://localhost:3001
yarn dev
```

前端默认会将 API 请求发送到 `http://localhost:4000`，可通过 `.env` 或运行时变量覆盖：

| 变量名 | 说明 | 默认值 |
| --- | --- | --- |
| `VITE_API_BASE` | 后端 API 地址 | `http://localhost:4000` |
| `VITE_DEFAULT_USER_ID` | 默认用户标识（会写入 `x-user-id` 请求头） | `demo-user` |

### 4. 构建与预览

```bash
# 生成前端产物
yarn build

# 预览打包结果
yarn preview
```

部署时可将 `dist` 目录交由静态资源服务器托管，同时使用 `yarn server`（或自定义进程管理工具）常驻运行后端服务。

## 监控与日志

- **日志**：后端通过 `morgan` 输出标准访问日志，并在错误处理中记录详细异常信息。
- **指标**：`/metrics` 提供 Prometheus 兼容指标，主要包括 HTTP 请求耗时、分享链接访问计数、不可用原因等。
- **健康检查**：`/health` 提供轻量健康状态，适用于容器存活探针。

监控示例：

- 分享可用性：`paste_share_views_total`、`paste_share_unavailable_total{reason="expired|private|not_found"}`。
- HTTP 延迟：`http_request_duration_seconds_bucket` 等直方图指标。

## 数据持久化

默认情况下，Paste 数据会存储在 `server/data/pastes.json` 中，可根据部署环境挂载持久卷或替换为其它存储实现。

