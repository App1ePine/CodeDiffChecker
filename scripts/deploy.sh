#!/usr/bin/env bash
set -euo pipefail

# 从项目根路径和脚本相对路径加载 .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -o allexport
  source "$PROJECT_ROOT/.env"
  set +o allexport
fi

# 必需环境变量：DEPLOY_USER、DEPLOY_HOST、DEPLOY_PATH
: "${DEPLOY_USER:?Need DEPLOY_USER}"
: "${DEPLOY_HOST:?Need DEPLOY_HOST}"
: "${DEPLOY_PATH:?Need DEPLOY_PATH}"

# 可选：DEPLOY_SSH_KEY、DEPLOY_PORT
SSH_CMD="ssh -o StrictHostKeyChecking=no"
if [ -n "${DEPLOY_PORT:-}" ]; then
  SSH_CMD="$SSH_CMD -p ${DEPLOY_PORT}"
fi
if [ -n "${DEPLOY_SSH_KEY:-}" ]; then
  SSH_CMD="$SSH_CMD -i ${DEPLOY_SSH_KEY}"
fi

# rsync 选项（按需调整）
RSYNC_OPTS=( -a -v -z --delete --partial --progress )

# 同步 dist 目录到远端（注意包含 @）
rsync "${RSYNC_OPTS[@]}" -e "${SSH_CMD}" dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"

echo "Deploy to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH} completed."
