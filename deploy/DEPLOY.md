# 部署到阿里云 Ubuntu 22.04

服务器：47.98.117.68，2 核 2G，Ubuntu 22.04。

整条链路大约 15 分钟，其中构建占大半。全程只需要在服务器上执行 `deploy/setup.sh`。

---

## 第 0 步：放行端口

阿里云控制台 → 实例 → **网络与安全组** → 安全组规则 → 入方向 → 手动添加：

| 端口 | 协议 | 授权对象 | 用途 |
| --- | --- | --- | --- |
| 22 | TCP | 你的公网 IP/32 | SSH（默认可能已开） |
| 3000 | TCP | 你的公网 IP/32 | 应用访问 |

端口 3000 先只放行你自己的 IP，确认没问题再考虑放开。

---

## 第 1 步：上传代码

在**你自己的 Windows** 上打开 PowerShell，执行：

```powershell
scp D:\CoFlow-deploy.tar.gz root@47.98.117.68:/opt/
```

首次连接会问是否信任主机，输入 `yes`，然后输入服务器 root 密码（在阿里云控制台「重置密码」里设置）。

传完后 SSH 登录：

```powershell
ssh root@47.98.117.68
```

解压：

```bash
mkdir -p /opt/coflow
tar -xzf /opt/CoFlow-deploy.tar.gz -C /opt/coflow --strip-components=1
```

> 压缩包里**不含** `node_modules`、`.next`、`.env`，也不含本地数据库密码。

---

## 第 2 步：一键部署

```bash
cd /opt/coflow
bash deploy/setup.sh
```

脚本会依次：装 Node 20 与 pnpm → 加 2G 交换分区 → 装 PostgreSQL 并建库 → 生成 `.env`（随机数据库密码）→ 装依赖 → 执行迁移 → 构建 → 注册 systemd 服务自启。

2G 内存构建会比较慢，看到 `Creating an optimized production build` 后等 3—10 分钟是正常的。

结束时如果打印「部署完成」，浏览器打开：

```
http://47.98.117.68:3000
```

---

## 第 3 步：第一次登录

当前没有配置邮件服务，验证码**不会发到邮箱，也不会显示在网页上**，只写进服务器日志：

1. 在登录页输入你的邮箱，点「发送验证码」；
2. 回到 SSH 窗口：

```bash
journalctl -u coflow -n 200 | grep 验证码
```

3. 复制那六位数字填进页面即可登录。

> 这样做是因为公网服务器不能把验证码显示在页面上——那样任何人都能登录任何账号。
> 日志只有能登服务器的人看得到。

---

## 第 4 步：冒烟检查

```bash
curl http://127.0.0.1:3000/api/health
# {"ok":true,"db":"ok",...}
```

然后在浏览器里：登录 → 建一个项目 → 建一个任务。能走通就说明部署成功了。

---

## 常见问题

**页面打不开**
先确认本机能否 curl 通：`curl -I http://127.0.0.1:3000`。能通就是安全组没放行 3000；不能通就看日志 `journalctl -u coflow -n 50`。

**构建时被 killed**
内存不够。确认交换分区已生效 `free -h`（Swap 应有 2.0Gi）。若仍被杀，把 `NODE_OPTIONS` 调到 `--max-old-space-size=1024` 再试。

**改完代码怎么更新**

```bash
cd /opt/coflow
# 重新上传解压后：
pnpm install --frozen-lockfile && pnpm exec prisma migrate deploy && pnpm build
systemctl restart coflow
```

---

## 接下来建议做的三件事

1. **配 SMTP，关掉日志验证码**
   编辑 `/opt/coflow/.env`：填 `SMTP_HOST/PORT/USER/PASS/FROM`，删掉 `LOGIN_CODE_TO_LOG=1`，然后 `systemctl restart coflow`。

2. **加域名与 HTTPS（需要 ICP 备案）**
   大陆服务器绑域名必须先备案，通常 7—20 个工作日。备案下来之前只能用 IP 访问。
   有了域名之后：装 nginx 反代到 127.0.0.1:3000 + certbot 申请证书，然后把 `.env` 里的 `COOKIE_SECURE` 改成 1。

3. **打开每日备份**

```bash
crontab -e
# 加入一行：
0 3 * * * /opt/coflow/deploy/backup.sh
```

`backup.sh` 每天凌晨 3 点把数据库导出到 `/var/backups/coflow`，保留 7 天。
