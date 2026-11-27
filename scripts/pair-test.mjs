/**
 * 配对流程端到端测试（模拟 Connector 侧）
 * 用法：node scripts/pair-test.mjs
 * 它会打印配对码并轮询，直到有人在网页上确认。
 */
const BASE = process.env.BASE ?? "http://localhost:3000";

const start = await fetch(`${BASE}/api/device/pair/start`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "晨宇的台式机", os: "Windows 11" }),
});
const pairing = await start.json();
console.log("USER_CODE=" + pairing.user_code);

const deadline = Date.now() + 5 * 60 * 1000;
let last = "";
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, pairing.interval * 1000 || 3000));
  const res = await fetch(`${BASE}/api/device/pair/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      device_code: pairing.device_code,
      tool: {
        toolType: "claude-code",
        toolVersion: "2.1.322",
        capability: "AUTO",
        headlessOk: true,
      },
    }),
  });
  const data = await res.json();
  const tag = data.error ?? "ok";
  if (tag !== last) {
    console.log("POLL=" + tag);
    last = tag;
  }
  if (res.ok) {
    console.log("DEVICE_ID=" + data.device_id);
    console.log("ENDPOINT_ID=" + data.endpoint_id);
    console.log("TOKEN_PREFIX=" + data.device_token.slice(0, 12));
    console.log("SCOPES=" + data.scopes.join(","));
    process.exit(0);
  }
  if (data.error === "expired_token") process.exit(2);
}
console.log("TIMEOUT");
process.exit(3);
