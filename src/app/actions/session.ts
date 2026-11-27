"use server";

import { devSwitchUser } from "./auth";

/** 开发环境身份切换：跳过登录，直接以演示身份建立会话 */
export async function switchUser(formData: FormData) {
  const id = String(formData.get("userId") ?? "");
  if (!id) return;
  await devSwitchUser(id);
}
