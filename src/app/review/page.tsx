import { redirect } from "next/navigation";

/**
 * 「本周」模块已下线：导航入口撤掉后，这里保留一个跳转，
 * 避免旧链接或书签打到 404。
 */
export default function ReviewPage() {
  redirect("/");
}
