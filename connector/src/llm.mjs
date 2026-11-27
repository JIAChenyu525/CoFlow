/**
 * 本地直连模型 API（OpenAI 兼容协议）。
 *
 * 密钥只存在本机 ~/.coflow/config.json（0600），不经过 CoFlow 服务器；
 * 服务器只负责排队与转发请求，永远看不到密钥。
 *
 * 兼容：DeepSeek、通义（DashScope 兼容模式）、Moonshot、火山方舟（OpenAI 兼容）、
 * 自建 vLLM / Ollama(OpenAI 端点) 等。
 */
export async function chatComplete({
  baseUrl,
  apiKey,
  model,
  system,
  user,
  timeoutMs = 120_000,
}) {
  const url = `${String(baseUrl).replace(/\/+$/, "")}/chat/completions`;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: user },
        ],
        temperature: 0.3,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new Error(`连接 ${url} 失败：${err?.message ?? err}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}：${body.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("API 返回内容为空");
  }
  return content.trim();
}
