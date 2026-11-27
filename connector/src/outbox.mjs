import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * 本地事件队列。
 * 断线时事件留在磁盘上，重连后按序补传；服务端按 event_id 去重，
 * 所以「补传两次」和「补传一次」结果相同。
 */
const DIR = ".coflow";
const FILE = "outbox.json";

function filePath(cwd) {
  return path.join(cwd, DIR, FILE);
}

export function loadOutbox(cwd) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath(cwd), "utf8"));
    return Array.isArray(data.items) ? data : { seq: 0, items: [] };
  } catch {
    return { seq: 0, items: [] };
  }
}

function saveOutbox(cwd, box) {
  fs.mkdirSync(path.join(cwd, DIR), { recursive: true });
  fs.writeFileSync(filePath(cwd), JSON.stringify(box, null, 2));
}

export function enqueue(cwd, { sessionId, type, payload }) {
  const box = loadOutbox(cwd);
  box.seq += 1;
  box.items.push({
    seq: box.seq,
    event_id: crypto.randomUUID(),
    session_id: sessionId,
    type,
    payload,
    queued_at: new Date().toISOString(),
  });
  saveOutbox(cwd, box);
  return box.seq;
}

/** 返回 {accepted, duplicate, rejected, remaining} */
export async function flush(cwd, api) {
  const box = loadOutbox(cwd);
  const stats = { accepted: 0, duplicate: 0, rejected: 0, remaining: 0 };

  const bySession = new Map();
  for (const item of box.items) {
    if (!bySession.has(item.session_id)) bySession.set(item.session_id, []);
    bySession.get(item.session_id).push(item);
  }

  const keep = [];

  for (const [sessionId, items] of bySession) {
    for (let i = 0; i < items.length; i += 50) {
      const chunk = items.slice(i, i + 50);
      const res = await api.call(`/api/sessions/${sessionId}/events`, {
        method: "POST",
        body: JSON.stringify({
          events: chunk.map((it) => ({
            event_id: it.event_id,
            type: it.type,
            payload: it.payload,
          })),
        }),
      });

      if (!res.ok) {
        // 整批失败：全部留到下次
        keep.push(...chunk);
        continue;
      }

      const byId = new Map(res.data.results.map((r) => [r.event_id, r.status]));
      for (const it of chunk) {
        const status = byId.get(it.event_id);
        if (status === "accepted") stats.accepted++;
        else if (status === "duplicate") stats.duplicate++;
        else {
          stats.rejected++;
          if (status === "rejected") keep.push(it); // 可重试的拒绝先留着
        }
      }
    }
  }

  box.items = keep.sort((a, b) => a.seq - b.seq);
  stats.remaining = box.items.length;
  saveOutbox(cwd, box);
  return stats;
}
