/**
 * 15 分钟上手流程。
 *
 * 每一步都对应系统里一个真实状态，不是教程里的勾选框：
 * 判定依据全部来自数据库，做完就是做完，没做就是没做。
 */

export type OnboardingState = {
  projects: number;
  devices: number;
  endpointsWithPaths: number;
  preparedTasks: number; // 已就绪及之后状态的任务
  sessions: number; // 领取过租约的会话
  completedTasks: number; // 与你相关（负责人/验收人）且已通过验收的任务
  deliveredSessions: number; // 你的设备提交成功过的会话
};

export type Step = {
  id: string;
  title: string;
  desc: string;
  why: string;
  minutes: number;
  done: boolean;
  href?: string;
  action?: string;
  command?: string;
  note?: string;
};

export function buildSteps(s: OnboardingState): Step[] {
  return [
    {
      id: "project",
      title: "建一个项目",
      desc: "写清目标、范围、非目标和验收标准。这是一切上下文的地基。",
      why: "没有章程，Agent 拿到的只会是一堆没有方向的资料。",
      minutes: 3,
      done: s.projects > 0,
      href: "/projects/new",
      action: s.projects > 0 ? "再建一个" : "创建项目",
    },
    {
      id: "device",
      title: "连接一台设备",
      desc: "在目标电脑运行连接器，用配对码把它授权给你的账号。",
      why: "设备令牌只代表「这台机器可以替谁领任务」，与模型密钥无关。",
      minutes: 3,
      done: s.devices > 0,
      href: "/agent",
      action: s.devices > 0 ? "管理设备" : "去配对",
      command: "node <连接器目录>/bin/coflow.mjs login --base <本系统地址>",
    },
    {
      id: "paths",
      title: "给端点授权目录",
      desc: "明确告诉平台：这个端点可以读写哪个目录。",
      why: "没有授权就等于只读。自动执行必须先在边界内。",
      minutes: 2,
      done: s.endpointsWithPaths > 0,
      href: "/agent",
      action: "去授权",
    },
    {
      id: "task",
      title: "有一个「已就绪」的任务",
      desc: "建好任务，补齐输入材料和逐条可检查的验收标准。",
      why: "缺输入或验收标准的任务会停在待澄清——这不是流程障碍，是在拦你。",
      minutes: 3,
      done: s.preparedTasks > 0,
      href: "/",
      action: "去项目里建任务",
      note: "路径：项目 → 任务与分工 → 新建任务 → 输入齐备 → 标记就绪",
    },
    {
      id: "deliver",
      title: "跑通一次完整交付",
      desc: "派发 → 领取 → 执行 → 提交 → 人工验收。",
      why: "这条链路跑通一次，后面所有协作都只是它的重复。",
      minutes: 4,
      // 只认「与你相关」的交付：你负责/你验收完成的任务，或你的设备提交过结果
      done: s.completedTasks > 0 || s.deliveredSessions > 0,
      href: "/agent",
      action: s.sessions > 0 ? "去验收" : "去派发",
      command: "coflow pull        # 或 coflow run（AUTO 端点）",
    },
  ];
}

export function progressOf(steps: Step[]) {
  const done = steps.filter((s) => s.done).length;
  return {
    done,
    total: steps.length,
    percent: Math.round((done / steps.length) * 100),
    next: steps.find((s) => !s.done) ?? null,
  };
}
