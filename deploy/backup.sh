#!/usr/bin/env bash
#
# 每日数据库备份：pg_dump 压缩后存到 /var/backups/coflow，保留 7 天。
# 安装：crontab -e 加入 0 3 * * * /opt/coflow/deploy/backup.sh

set -euo pipefail

DB_NAME=${DB_NAME:-coflow}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/coflow}
KEEP_DAYS=${KEEP_DAYS:-7}

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M)

sudo -u postgres pg_dump "$DB_NAME" | gzip > "$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"

# 只删本脚本生成的备份，不碰目录里的其他文件
find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}-*.sql.gz" -mtime "+${KEEP_DAYS}" -delete

echo "备份完成：$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"
