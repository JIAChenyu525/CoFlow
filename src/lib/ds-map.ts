import type {
  CapabilityLevel,
  PriorityLevel,
  RoleType,
  TaskStatus as DsTaskStatus,
} from "@/components/ds";
import type { Capability, Priority, ProjectRole, TaskStatus } from "@prisma/client";

/** 把数据库枚举映射到设计系统组件的取值 */
export const DS_STATUS: Record<TaskStatus, DsTaskStatus> = {
  CLARIFY: "clarify",
  UNCLAIMED: "unclaimed",
  READY: "ready",
  IN_PROGRESS: "in_progress",
  IN_REVIEW: "pending_accept",
  DONE: "done",
  BLOCKED: "blocked",
  PAUSED: "paused",
  CANCELLED: "cancelled",
};

export const DS_PRIORITY: Record<Priority, PriorityLevel> = {
  P0: "P0",
  P1: "P1",
  P2: "P2",
  P3: "P3",
};

export const DS_ROLE: Record<ProjectRole, RoleType> = {
  OWNER: "initiator",
  LEAD: "owner",
  MEMBER: "member",
  REVIEWER: "reviewer",
  OBSERVER: "observer",
};

export const DS_CAPABILITY: Record<Capability, CapabilityLevel> = {
  AUTO: "auto",
  SEMI: "semi",
  MANUAL: "manual",
};
