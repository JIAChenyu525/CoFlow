/**
 * 幂等性验证：同一个 event_id 连发两次，第二次必须被判为 duplicate，
 * 且数据库里只应存在一条记录。
 *
 * 用法：node scripts/idempotency-test.mjs <sessionId> <deviceToken>
 */
const [sessionId, token] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3000";

if (!sessionId || !token) {
  console.error("用法：node scripts/idempotency-test.mjs <sessionId> <deviceToken>");
  process.exit(1);
}

const eventId = `evt_test_${Date.now()}`;
const body = JSON.stringify({
  events: [
    {
      event_id: eventId,
      type: "agent.progress",
      payload: { note: "幂等测试事件", n: 1 },
    },
  ],
});

async function send(label) {
  const res = await fetch(`${BASE}/api/sessions/${sessionId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body,
  });
  const data = await res.json();
  console.log(`${label}: HTTP ${res.status} →`, JSON.stringify(data.results?.[0] ?? data));
  return data.results?.[0]?.status;
}

const first = await send("第一次");
const second = await send("第二次");
const third = await send("第三次");

console.log("");
console.log(`event_id: ${eventId}`);
console.log(
  first === "accepted" && second === "duplicate" && third === "duplicate"
    ? "✓ 幂等成立：首次入账，后续判重"
    : "✗ 幂等不成立"
);
