import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

/**
 * 系统剪贴板读写。
 *
 * Windows 上不走控制台管道——PowerShell 5.1 的控制台编码会把中文弄坏，
 * 改成临时文件中转，读写都按 UTF-8，实测中文往返一致。
 */
const tmpFile = (tag) =>
  path.join(os.tmpdir(), `coflow-clip-${tag}-${crypto.randomBytes(4).toString("hex")}.txt`);

export function copyToClipboard(text) {
  if (process.platform === "win32") {
    const file = tmpFile("in");
    fs.writeFileSync(file, text, "utf8");
    try {
      execFileSync("powershell", [
        "-NoProfile",
        "-Command",
        `Set-Clipboard -Value ([IO.File]::ReadAllText('${file.replace(/'/g, "''")}', [Text.Encoding]::UTF8))`,
      ]);
    } finally {
      try {
        fs.unlinkSync(file);
      } catch {}
    }
    return true;
  }

  if (process.platform === "darwin") {
    execFileSync("pbcopy", { input: text });
    return true;
  }

  try {
    execFileSync("xclip", ["-selection", "clipboard"], { input: text });
    return true;
  } catch {
    return false;
  }
}

export function readClipboard() {
  if (process.platform === "win32") {
    const out = tmpFile("out");
    try {
      execFileSync("powershell", [
        "-NoProfile",
        "-Command",
        `[IO.File]::WriteAllText('${out.replace(/'/g, "''")}', (Get-Clipboard -Raw), (New-Object Text.UTF8Encoding $false))`,
      ]);
      return fs.readFileSync(out, "utf8").trim();
    } finally {
      try {
        fs.unlinkSync(out);
      } catch {}
    }
  }

  if (process.platform === "darwin") {
    return execFileSync("pbpaste", { encoding: "utf8" }).trim();
  }

  try {
    return execFileSync("xclip", ["-selection", "clipboard", "-o"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}
