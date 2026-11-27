"use server";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashToken, newToken, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth";
import { sendLoginCode, sendPasswordChangedNotice, sendResetCode } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";
import { hashPassword, passwordIssue, verifyPassword } from "@/lib/password";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

const COLORS = ["#0F5F5C", "#1E4C9A", "#A95A06", "#7A3E8E", "#5A6270", "#1D663C"];

function hashCode(email: string, code: string) {
  return crypto.createHash("sha256").update(`${email}:${code}`).digest("hex");
}

const emailSchema = z.string().trim().toLowerCase().email("请输入有效的邮箱地址");

export type RequestCodeResult =
  | { ok: true; delivered: boolean; devCode?: string }
  | { ok: false; error: string };

export async function requestCode(input: string): Promise<RequestCodeResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "请输入有效的邮箱地址" };
  const email = parsed.data;

  // 公开服务：按来源 IP 限流，避免有人换邮箱刷验证码邮件
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ipLimit = rateLimit(`code:ip:${ip}`, 10, 60 * 60 * 1000);
  if (!ipLimit.ok) {
    return { ok: false, error: "请求过于频繁，请稍后再试" };
  }

  const last = await prisma.loginCode.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "验证码刚发过，请 60 秒后再试" };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.loginCode.count({
    where: { email, createdAt: { gte: hourAgo } },
  });
  if (count >= MAX_CODES_PER_HOUR) {
    return { ok: false, error: "该邮箱请求过于频繁，请稍后再试" };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

  await prisma.loginCode.create({
    data: {
      email,
      codeHash: hashCode(email, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  let sent: { delivered: boolean; reason?: string };
  try {
    sent = await sendLoginCode(email, code);
  } catch (err) {
    // SMTP 配置错误、被限流、连接超时都会走到这里。
    // 给出可行动的提示，而不是让用户卡在一个转圈的表单上。
    console.error("[coflow] 验证码邮件发送失败:", err instanceof Error ? err.message : err);
    return { ok: false, error: "验证码发送失败，请稍后重试；多次失败请联系管理员" };
  }

  if (sent.delivered) {
    return { ok: true, delivered: true };
  }

  // 没有 SMTP 时的两条降级路径，安全级别完全不同：
  // 1) LOGIN_CODE_TO_LOG=1：验证码只写服务端日志，只有能登服务器的人看得到——公网部署用这个
  // 2) 本地开发：直接把验证码回给页面，方便调试——绝不能出现在公网环境
  if (process.env.LOGIN_CODE_TO_LOG === "1") {
    console.log(
      `[coflow] 登录验证码 ${email} => ${code}（SMTP 未配置，仅记录在服务端日志，10 分钟内有效）`
    );
    return { ok: true, delivered: false };
  }

  const devMode = process.env.NODE_ENV !== "production";
  if (devMode) {
    return { ok: true, delivered: false, devCode: code };
  }

  return { ok: false, error: "邮件服务未配置，请联系管理员" };
}

export type VerifyResult = { ok: false; error: string };

/** 校验并消费验证码；不建会话，供登录与注册共用 */
async function consumeCode(email: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const record = await prisma.loginCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, error: "请先获取验证码" };
  if (record.expiresAt < new Date()) return { ok: false, error: "验证码已过期，请重新获取" };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, error: "尝试次数过多，请重新获取验证码" };

  if (record.codeHash !== hashCode(email, code)) {
    await prisma.loginCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "验证码不正确" };
  }

  await prisma.loginCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}

/** 拿到（或按需创建）账号 */
async function ensureUser(email: string) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) return user;

  const prefix = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user";
  let handle = prefix.toLowerCase();
  for (let i = 2; i < 50; i++) {
    const taken = await prisma.user.findUnique({ where: { handle } });
    if (!taken) break;
    handle = `${prefix.toLowerCase()}${i}`;
  }
  const color = COLORS[Math.abs(email.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];
  user = await prisma.user.create({ data: { email, name: prefix, handle, color } });
  return user;
}

/** 建会话并跳转；所有登录入口共用 */
async function startSession(userId: string) {
  const raw = newToken();
  const hdrs = await headers();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: hdrs.get("user-agent")?.slice(0, 200) ?? null,
      ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    // 生产环境默认要求 HTTPS；用 IP + HTTP 做临时内测时设 COOKIE_SECURE=0
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "0",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function verifyCode(input: { email: string; code: string }): Promise<VerifyResult> {
  const emailParsed = emailSchema.safeParse(input.email);
  if (!emailParsed.success) return { ok: false, error: "邮箱格式不正确" };
  const email = emailParsed.data;
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "验证码是 6 位数字" };

  const consumed = await consumeCode(email, code);
  if (!consumed.ok) return consumed;

  const user = await ensureUser(email);
  await startSession(user.id);
  redirect("/");
}

/** 邮箱 + 密码登录 */
export async function loginWithPassword(input: {
  email: string;
  password: string;
}): Promise<VerifyResult> {
  const emailParsed = emailSchema.safeParse(input.email);
  if (!emailParsed.success) return { ok: false, error: "邮箱格式不正确" };
  const email = emailParsed.data;

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = rateLimit(`pw:${email}:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.ok) return { ok: false, error: "尝试次数过多，请 15 分钟后再试" };

  const user = await prisma.user.findUnique({ where: { email } });
  // 账号不存在和密码错误返回同一句话，避免被用来探测哪些邮箱注册过
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    return { ok: false, error: "邮箱或密码不正确" };
  }

  await startSession(user.id);
  redirect("/");
}

/** 邮箱验证码 + 设置密码：完成注册 */
export async function registerWithPassword(input: {
  email: string;
  code: string;
  password: string;
}): Promise<VerifyResult> {
  const emailParsed = emailSchema.safeParse(input.email);
  if (!emailParsed.success) return { ok: false, error: "邮箱格式不正确" };
  const email = emailParsed.data;

  const issue = passwordIssue(input.password);
  if (issue) return { ok: false, error: issue };

  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "验证码是 6 位数字" };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash) {
    return { ok: false, error: "这个邮箱已经设置过密码，请直接登录" };
  }

  const consumed = await consumeCode(email, code);
  if (!consumed.ok) return consumed;

  const user = await ensureUser(email);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(input.password) },
  });

  await startSession(user.id);
  redirect("/");
}

/** 忘记密码：发送重置验证码。刻意不暴露邮箱是否注册过 */
export async function requestPasswordReset(input: string): Promise<RequestCodeResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "请输入有效的邮箱地址" };
  const email = parsed.data;

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = rateLimit(`reset:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return { ok: false, error: "请求过于频繁，请稍后再试" };

  const last = await prisma.loginCode.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "验证码刚发过，请 60 秒后再试" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // 邮箱没注册也返回同样的结果，避免被用来探测账号是否存在
  if (!user) return { ok: true, delivered: false };

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.loginCode.create({
    data: {
      email,
      codeHash: hashCode(email, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  let sent: { delivered: boolean };
  try {
    sent = await sendResetCode(email, code);
  } catch (err) {
    console.error("[coflow] 重置验证码发送失败:", err instanceof Error ? err.message : err);
    return { ok: false, error: "验证码发送失败，请稍后重试" };
  }

  if (sent.delivered) return { ok: true, delivered: true };

  if (process.env.LOGIN_CODE_TO_LOG === "1") {
    console.log(`[coflow] 重置密码验证码 ${email} => ${code}（仅记录在服务端日志）`);
    return { ok: true, delivered: false };
  }
  const devMode = process.env.NODE_ENV !== "production";
  if (devMode) return { ok: true, delivered: false, devCode: code };
  return { ok: false, error: "邮件服务未配置，请联系管理员" };
}

/** 用邮箱验证码重置密码：成功后撤销所有旧会话，并发送提醒邮件 */
export async function resetPassword(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const emailParsed = emailSchema.safeParse(input.email);
  if (!emailParsed.success) return { ok: false, error: "邮箱格式不正确" };
  const email = emailParsed.data;

  const issue = passwordIssue(input.newPassword);
  if (issue) return { ok: false, error: issue };

  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "验证码是 6 位数字" };

  const consumed = await consumeCode(email, code);
  if (!consumed.ok) return consumed;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false, error: "账号不存在，请先注册" };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(input.newPassword) },
  });

  // 改密码后强制所有旧会话下线：如果密码是因为泄露才重置的，这一步才是关键
  await prisma.session.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await sendPasswordChangedNotice(email, new Date(), "reset").catch((err) => {
    console.error("[coflow] 密码修改提醒发送失败:", err instanceof Error ? err.message : err);
  });

  return { ok: true };
}

/** 已登录用户设置或修改密码 */
export async function setPassword(input: {
  currentPassword?: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return { ok: false, error: "登录状态已失效，请重新登录" };

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return { ok: false, error: "登录状态已失效，请重新登录" };
  }

  const issue = passwordIssue(input.newPassword);
  if (issue) return { ok: false, error: issue };

  if (session.user.passwordHash && !verifyPassword(input.currentPassword ?? "", session.user.passwordHash)) {
    return { ok: false, error: "当前密码不正确" };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: hashPassword(input.newPassword) },
  });

  if (session.user.email) {
    await sendPasswordChangedNotice(session.user.email, new Date(), "account").catch((err) => {
      console.error("[coflow] 密码修改提醒发送失败:", err instanceof Error ? err.message : err);
    });
  }

  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(raw) },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

/**
 * 仅供本地开发：跳过登录直接以某个演示身份进入。
 * 生产构建下不存在——它不是"后门"，是演示工具。
 */
export async function devSwitchUser(userId: string) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("dev switch disabled");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("用户不存在");

  const raw = newToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  redirect("/");
}
