import type {
  ArtifactType,
  DecisionStatus,
  MessageType,
  Priority,
  ProjectRole,
  ProjectStage,
  ReviewVerdict,
  TaskStatus,
} from "@prisma/client";

export const STATUS_META: Record<
  TaskStatus,
  { label: string; tone: string; column?: boolean; hint: string }
> = {
  CLARIFY: { label: "待澄清", tone: "slate", column: true, hint: "缺输入或验收标准" },
  UNCLAIMED: { label: "待认领", tone: "slate", column: true, hint: "尚未指定负责人" },
  READY: { label: "已就绪", tone: "blue", column: true, hint: "可开始执行" },
  IN_PROGRESS: { label: "进行中", tone: "accent", column: true, hint: "正在执行" },
  IN_REVIEW: { label: "待验收", tone: "amber", column: true, hint: "等待人工验收" },
  DONE: { label: "已完成", tone: "green", column: true, hint: "已通过验收" },
  BLOCKED: { label: "已阻塞", tone: "red", column: false, hint: "等待外部支持" },
  PAUSED: { label: "已暂停", tone: "slate", column: false, hint: "主动暂停" },
  CANCELLED: { label: "已取消", tone: "slate", column: false, hint: "不再执行" },
};

export const BOARD_COLUMNS: TaskStatus[] = [
  "CLARIFY",
  "UNCLAIMED",
  "READY",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

export const PRIORITY_META: Record<Priority, { label: string; tone: string }> = {
  P0: { label: "P0", tone: "red" },
  P1: { label: "P1", tone: "amber" },
  P2: { label: "P2", tone: "slate" },
  P3: { label: "P3", tone: "slate" },
};

export const ROLE_META: Record<ProjectRole, { label: string; hint: string }> = {
  OWNER: { label: "发起人", hint: "目标决策权 · 最终验收" },
  LEAD: { label: "负责人", hint: "拆解 · 派发 · 验收" },
  MEMBER: { label: "成员", hint: "执行 · 提交产物" },
  REVIEWER: { label: "评审", hint: "质量判定 · 退回或通过" },
  OBSERVER: { label: "观察员", hint: "只读" },
};

export const STAGE_META: Record<ProjectStage, { label: string }> = {
  DEFINE: { label: "定义" },
  BUILD: { label: "开发" },
  INTEGRATE: { label: "联调" },
  REVIEW: { label: "验收" },
  ARCHIVED: { label: "归档" },
};

export const ARTIFACT_META: Record<ArtifactType, { label: string }> = {
  COMMIT: { label: "代码提交" },
  BUILD: { label: "构建包" },
  DOC: { label: "文档" },
  DESIGN: { label: "设计稿" },
  IMAGE: { label: "图片" },
  DATA: { label: "数据表" },
  TEST_REPORT: { label: "测试报告" },
  LINK: { label: "外部链接" },
  NOTE: { label: "说明" },
};

export const VERDICT_META: Record<ReviewVerdict, { label: string; tone: string }> = {
  PASS: { label: "通过", tone: "green" },
  RETURN: { label: "退回", tone: "red" },
  NEED_MORE: { label: "补充材料", tone: "amber" },
};

export const DECISION_META: Record<DecisionStatus, { label: string; tone: string }> = {
  PROPOSED: { label: "提案", tone: "amber" },
  CONFIRMED: { label: "已确认", tone: "green" },
  SUPERSEDED: { label: "已被替代", tone: "slate" },
};

export const MESSAGE_TYPE_META: Record<MessageType, { label: string }> = {
  TEXT: { label: "讨论" },
  TASK_REF: { label: "任务引用" },
  DECISION_PROPOSAL: { label: "决策提案" },
  BLOCKER: { label: "阻塞求助" },
  ARTIFACT_SUBMIT: { label: "产物提交" },
  SYSTEM: { label: "系统事件" },
  AGENT_REPORT: { label: "Agent 汇报" },
};

/** 有权执行验收的角色 */
export const REVIEW_ROLES: ProjectRole[] = ["OWNER", "LEAD", "REVIEWER"];
/** 有权改目标、归档的角色 */
export const ADMIN_ROLES: ProjectRole[] = ["OWNER", "LEAD"];
