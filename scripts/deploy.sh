#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

build_ssh_cmd() {
	local port="$1"
	local key="$2"
	local cmd="ssh -o StrictHostKeyChecking=no"
	if [ -n "${port}" ]; then
		cmd+=" -p ${port}"
	fi
	if [ -n "${key}" ]; then
		cmd+=" -i ${key}"
	fi
	printf '%s' "${cmd}"
}

RSYNC_OPTS=(-a -v -z --delete --partial --progress)

if [ -f "$PROJECT_ROOT/.env" ]; then
	set -o allexport
	source "$PROJECT_ROOT/.env"
	set +o allexport
fi

FRONT_USER="${DEPLOY_USER:?Need DEPLOY_USER for frontend}"
FRONT_HOST="${DEPLOY_HOST:?Need DEPLOY_HOST for frontend}"
FRONT_PATH="${DEPLOY_PATH:?Need DEPLOY_PATH for frontend}"
FRONT_PORT="${DEPLOY_PORT:-}"
FRONT_KEY="${DEPLOY_SSH_KEY:-}"

FRONT_SSH_CMD="$(build_ssh_cmd "${FRONT_PORT}" "${FRONT_KEY}")"
rsync "${RSYNC_OPTS[@]}" -e "${FRONT_SSH_CMD}" "${PROJECT_ROOT}/dist/" "${FRONT_USER}@${FRONT_HOST}:${FRONT_PATH}"
echo "Frontend deploy to ${FRONT_USER}@${FRONT_HOST}:${FRONT_PATH} completed."

SERVER_ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "${SERVER_ENV_FILE}" ]; then
	set -o allexport
	source "${SERVER_ENV_FILE}"
	set +o allexport

	BACK_USER="${SERVER_DEPLOY_USER:?Need SERVER_DEPLOY_USER for backend}"
	BACK_HOST="${SERVER_DEPLOY_HOST:?Need SERVER_DEPLOY_HOST for backend}"
	BACK_PATH="${SERVER_DEPLOY_PATH:?Need SERVER_DEPLOY_PATH for backend}"
	BACK_PORT="${SERVER_DEPLOY_PORT:-}"
	BACK_KEY="${SERVER_DEPLOY_SSH_KEY:-}"

	BACK_SSH_CMD="$(build_ssh_cmd "${BACK_PORT}" "${BACK_KEY}")"
	rsync "${RSYNC_OPTS[@]}" -e "${BACK_SSH_CMD}" "${PROJECT_ROOT}/server/dist/" "${BACK_USER}@${BACK_HOST}:${BACK_PATH}"
	echo "Backend deploy to ${BACK_USER}@${BACK_HOST}:${BACK_PATH} completed."
else
	echo "Warning: ${SERVER_ENV_FILE} not found, backend deploy skipped." >&2
fi
