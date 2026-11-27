-- CoFlow 本地数据库初始化（PostgreSQL 14+）
-- 用超级用户执行一次：
--   psql -U postgres -f scripts/init-db.sql
-- 它只新建本项目的库与账号，不修改其他库。

-- 把下面的密码换成你自己的本地开发密码，不要提交真实密码到仓库
CREATE ROLE coflow WITH LOGIN PASSWORD 'change-me-local-only';
CREATE DATABASE coflow OWNER coflow ENCODING 'UTF8';
