import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * 配置目录默认 ~/.coflow。
 * COFLOW_HOME 可以覆盖——同一台机器上模拟多台设备时用得到，
 * 也是「一个用户多台电脑」在本地的等价物。
 */
export const CONFIG_DIR = process.env.COFLOW_HOME
  ? path.resolve(process.env.COFLOW_HOME)
  : path.join(os.homedir(), ".coflow");
export const USING_HOME_OVERRIDE = !!process.env.COFLOW_HOME;

const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  return CONFIG_FILE;
}

export function requireConfig() {
  const config = loadConfig();
  if (!config?.deviceToken) {
    console.error(`还没有登录（配置目录 ${CONFIG_DIR}）。先执行：coflow login`);
    process.exit(1);
  }
  return config;
}

export function configPath() {
  return CONFIG_FILE;
}
