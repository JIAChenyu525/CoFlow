#!/usr/bin/env bash
#
# CoFlow 一键部署（Ubuntu 22.04 / 24.04）
# 用法：把项目放到 /opt/coflow，然后 sudo bash deploy/setup.sh
#
# 会做：装 Node 20 与 pnpm、加 2G 交换分区、装 PostgreSQL 并建库、
#       生成 .env、装依赖、执行迁移、构建、注册 systemd 服务。
# 可重复执行，已完成的步骤会跳过。
#
# 没有配置 SMTP 时，登录验证码只写进服务端日志（不发到网页），
# 查看方式：journalctl -u coflow -n 200 | grep 验证码

set -euo pipefail

APP_DIR=${APP_DIR:-/opt/coflow}
APP_USER=${APP_USER:-coflow}
DB_NAME=${DB_NAME:-coflow}
DB_USER=${DB_USER:-coflow}

say() { printf "\n\033[1m== %s\033[0m\n" "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 或 sudo 运行"
  exit 1
fi

if [ ! -f "$APP_DIR/package.json" ]; then
  echo "找不到 $APP_DIR/package.json"
  echo "请先把项目源码放到 $APP_DIR（见 deploy/DEPLOY.md 的“上传代码”）"
  exit 1
fi

# ── 1. 基础依赖 ─────────────────────────────────────────────
say "1/8 安装基础依赖"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  curl ca-certificates gnupg git openssl postgresql postgresql-contrib

# ── 2. Node 20 + pnpm ───────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  say "2/8 安装 Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
else
  say "2/8 Node.js 已安装：$(node -v)"
fi
command -v pnpm >/dev/null 2>&1 || npm i -g pnpm@10

# ── 3. 交换分区（2G 内存构建时不够用）───────────────────────
say "3/8 检查交换分区"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "已添加 2G 交换分区"
else
  echo "已有交换分区，跳过"
fi

# ── 4. 数据库 ───────────────────────────────────────────────
say "4/8 准备数据库"
systemctl enable --now postgresql

DB_PASS=""
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  DB_PASS=$(openssl rand -hex 12)
  sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';"
  echo "已创建数据库账号 ${DB_USER}"
else
  echo "数据库账号已存在，保留原密码"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER} ENCODING 'UTF8';"
  echo "已创建数据库 ${DB_NAME}"
else
  echo "数据库 ${DB_NAME} 已存在"
fi

# ── 5. 运行用户 ─────────────────────────────────────────────
say "5/8 准备运行用户 ${APP_USER}"
id -u "$APP_USER" >/dev/null 2>&1 || useradd -r -m -s /bin/bash "$APP_USER"

cd "$APP_DIR"

# ── 6. 环境变量 ─────────────────────────────────────────────
say "6/8 生成环境变量"
if [ ! -f .env ]; then
  if [ -z "$DB_PASS" ]; then
    echo "数据库账号已存在但脚本拿不到密码。"
    echo "请手动创建 $APP_DIR/.env（参考 deploy/env.production.example），填好 DATABASE_URL 后重新运行。"
    exit 1
  fi
  sed "s|__DB_PASS__|${DB_PASS}|" deploy/env.production.example > .env
  chmod 600 .env
  echo "已生成 .env"
  echo "数据库密码：${DB_PASS}（已写入 .env，请自行保存）"
else
  echo ".env 已存在，跳过"
fi

# ── 7. 依赖、迁移、构建 ─────────────────────────────────────
say "7/8 安装依赖并构建（2G 内存下需要几分钟，请耐心等）"
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm exec prisma migrate deploy
NODE_OPTIONS=--max-old-space-size=1536 pnpm build

chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ── 8. 系统服务 ─────────────────────────────────────────────
say "8/8 注册开机自启服务"
cp deploy/coflow.service /etc/systemd/system/coflow.service
systemctl daemon-reload
systemctl enable coflow
systemctl restart coflow

sleep 5
IP=$(curl -fsS --max-time 5 https://api.ipify.org || echo "<公网IP>")
if curl -fsS --max-time 5 http://127.0.0.1:3000/api/health >/dev/null; then
  say "部署完成"
  echo "访问地址：http://${IP}:3000"
  echo "健康检查：http://${IP}:3000/api/health"
  echo ""
  echo "浏览器打不开的话，去阿里云控制台「网络与安全组」放行 TCP 3000。"
  echo "第一次登录：在登录页填邮箱获取验证码，然后在服务器执行"
  echo "  journalctl -u coflow -n 200 | grep 验证码"
  echo "日志：journalctl -u coflow -f"
else
  say "服务已启动但健康检查未通过"
  echo "查看日志：journalctl -u coflow -n 50 --no-pager"
  exit 1
fi
