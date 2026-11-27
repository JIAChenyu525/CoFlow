/** 极简 API 客户端：全局 fetch，无依赖 */
export function createApi(config) {
  const base = (config.baseUrl || "http://localhost:3000").replace(/\/+$/, "");

  async function call(pathname, options = {}) {
    const headers = { "content-type": "application/json" };
    if (config.deviceToken) headers.authorization = `Bearer ${config.deviceToken}`;
    Object.assign(headers, options.headers ?? {});

    let res;
    try {
      res = await fetch(base + pathname, { ...options, headers });
    } catch (err) {
      return { ok: false, status: 0, data: { error: "network_error", detail: String(err) } };
    }

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data };
  }

  return { base, call };
}
