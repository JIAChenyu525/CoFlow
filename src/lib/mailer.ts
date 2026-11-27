import "server-only";

type SendResult = { delivered: boolean; reason?: string };

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;
  return { host, port, user, pass, from };
}

/**
 * 统一发信入口。
 * 没配 SMTP 时不假装发送成功——开发环境由调用方降级显示，生产环境直接报错，
 * 避免"点了发送但永远收不到"。
 */
async function deliver(
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<SendResult> {
  const { host, port, user, pass, from } = smtpConfig();
  if (!host || !user || !pass) {
    return { delivered: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const { default: nodemailer } = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transport.sendMail({ from: `CoFlow <${from}>`, to, subject, text, html });
  return { delivered: true };
}

const shell = (body: string) =>
  `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#171a1f">${body}</div>`;

const codeBlock = (code: string) =>
  `<p style="font-size:28px;letter-spacing:6px;font-weight:700;color:#0f5f5c">${code}</p>`;

export async function sendLoginCode(email: string, code: string): Promise<SendResult> {
  return deliver(
    email,
    `CoFlow 登录验证码：${code}`,
    `你的 CoFlow 登录验证码是 ${code}，10 分钟内有效。\n\n如果不是你本人操作，请忽略这封邮件。`,
    shell(
      `<p>你的 CoFlow 登录验证码是：</p>${codeBlock(code)}<p style="color:#71767f">10 分钟内有效。如果不是你本人操作，请忽略这封邮件。</p>`
    )
  );
}

export async function sendResetCode(email: string, code: string): Promise<SendResult> {
  return deliver(
    email,
    `CoFlow 重置密码验证码：${code}`,
    `你正在重置 CoFlow 账号密码，验证码是 ${code}，10 分钟内有效。\n\n如果这不是你本人操作，请忽略这封邮件，你的密码不会改变。`,
    shell(
      `<p>你正在重置 CoFlow 账号密码，验证码是：</p>${codeBlock(code)}
       <p style="color:#71767f">10 分钟内有效。如果这不是你本人操作，请忽略这封邮件，你的密码不会改变。</p>`
    )
  );
}

/** 密码被修改后的提醒邮件：不改密码的人也会收到，用来发现异常 */
export async function sendPasswordChangedNotice(
  email: string,
  at: Date,
  source: "reset" | "account"
): Promise<SendResult> {
  const when = at.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  const how = source === "reset" ? "通过邮箱验证码重置" : "在账号与安全页面修改";
  return deliver(
    email,
    "CoFlow 密码已修改提醒",
    `你的 CoFlow 账号密码刚刚（${when}）${how}成功。\n\n如果这不是你本人操作，请立即用「忘记密码」重新设置，并检查设备与会话是否被他人登录。`,
    shell(
      `<p>你的 CoFlow 账号密码刚刚被修改。</p>
       <p><strong>时间：</strong>${when}<br/><strong>方式：</strong>${how}</p>
       <p style="color:#c0392b">如果这不是你本人操作，请立即使用「忘记密码」重新设置，并在「账号与安全」中撤销其他会话。</p>`
    )
  );
}
