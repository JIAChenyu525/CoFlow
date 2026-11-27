import React from 'react'

/* ============================================================================
   1. 任务状态徽标 (9 种：6 主状态 + 3 旁路状态)
      核心设计规范：
      - 6 种主状态采用「完整闭合档案签」结构，按生命周期从虚框→空心→浅底→描边→左印章竖条→实心绿章递进
      - 3 种旁路状态采用「阻断/截停异形编码」（黑红实心截停章、左侧双道杠虚边、斜纹底+删除线）
      - 严格支持 20px (compact) 与 22px (default) 高度
      - 同时具备：颜色极性 + 边框虚实/左粗边 + 10×10px 独特几何矢量符号 + 文字特征
   ============================================================================ */

export type TaskStatus =
  | 'clarify' // 待澄清 (主状态 1)
  | 'unclaimed' // 待认领 (主状态 2)
  | 'ready' // 已就绪 (主状态 3)
  | 'in_progress' // 进行中 (主状态 4)
  | 'pending_accept' // 待验收 (主状态 5)
  | 'done' // 已完成 (主状态 6)
  | 'blocked' // 已阻塞 (旁路状态 1)
  | 'paused' // 已暂停 (旁路状态 2)
  | 'cancelled' // 已取消 (旁路状态 3)

export interface TaskStatusMeta {
  status: TaskStatus
  label: string
  code: string
  category: 'main' | 'bypass'
  encodingDesc: string
}

export const TASK_STATUS_LIST: TaskStatusMeta[] = [
  {
    status: 'clarify',
    label: '待澄清',
    code: 'M1',
    category: 'main',
    encodingDesc: '虚线琥珀外框 + 暖黄浅底 + 空心菱形问号标',
  },
  {
    status: 'unclaimed',
    label: '待认领',
    code: 'M2',
    category: 'main',
    encodingDesc: '细实线岩石灰框 + 纸白空心底 + 虚线圆环标',
  },
  {
    status: 'ready',
    label: '已就绪',
    code: 'M3',
    category: 'main',
    encodingDesc: '钢笔蓝实线框 + 浅蓝底 + 双环靶点标',
  },
  {
    status: 'in_progress',
    label: '进行中',
    code: 'M4',
    category: 'main',
    encodingDesc: '深墨青主色实框 + 青瓷浅底 + 实心右向推进三角',
  },
  {
    status: 'pending_accept',
    label: '待验收',
    code: 'M5',
    category: 'main',
    encodingDesc: '左侧 3px 火漆琥珀加粗印章边 + 暖黄底 + 盾形核验标',
  },
  {
    status: 'done',
    label: '已完成',
    code: 'M6',
    category: 'main',
    encodingDesc: '档案绿高对比实心满底 + 反白字 + 封存方框对勾标',
  },
  {
    status: 'blocked',
    label: '已阻塞',
    code: 'B1',
    category: 'bypass',
    encodingDesc: '[旁路] 朱砂红高对比实心底 + 反白粗体 + 八角截停横杠标',
  },
  {
    status: 'paused',
    label: '已暂停',
    code: 'B2',
    category: 'bypass',
    encodingDesc: '[旁路] 左侧 3px 石墨重边 + 上下虚线框 + 双竖线挂起标',
  },
  {
    status: 'cancelled',
    label: '已取消',
    code: 'B3',
    category: 'bypass',
    encodingDesc: '[旁路] 45° 斜纹凹槽底 + 文字删除线 + 斜杠终止圆标',
  },
]

export function StatusGlyph({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'clarify':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden="true">
          <path d="M5 0.9L9.1 5L5 9.1L0.9 5L5 0.9Z" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="5" cy="5" r="1.1" fill="currentColor" />
        </svg>
      )
    case 'unclaimed':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden="true">
          <circle
            cx="5"
            cy="5"
            r="3.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeDasharray="2 1.4"
          />
        </svg>
      )
    case 'ready':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden="true">
          <circle cx="5" cy="5" r="3.6" stroke="currentColor" strokeWidth="1.25" />
          <circle cx="5" cy="5" r="1.5" fill="currentColor" />
        </svg>
      )
    case 'in_progress':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden="true">
          <path d="M2.2 1.8L8.2 5L2.2 8.2V1.8Z" fill="currentColor" />
        </svg>
      )
    case 'pending_accept':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden="true">
          <path
            d="M5 1L8.4 2.3V5.1C8.4 7.1 6.9 8.4 5 9.1C3.1 8.4 1.6 7.1 1.6 5.1V2.3L5 1Z"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle cx="5" cy="5" r="1.2" fill="currentColor" />
        </svg>
      )
    case 'done':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden="true">
          <rect x="1.2" y="1.2" width="7.6" height="7.6" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2.9 5.1L4.3 6.5L7.2 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
        </svg>
      )
    case 'blocked':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden="true">
          <path
            d="M3.2 1.1H6.8L8.9 3.2V6.8L6.8 8.9H3.2L1.1 6.8V3.2L3.2 1.1Z"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path d="M3 5H7" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'paused':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden="true">
          <rect x="2.2" y="2" width="1.8" height="6" fill="currentColor" />
          <rect x="6" y="2" width="1.8" height="6" fill="currentColor" />
        </svg>
      )
    case 'cancelled':
      return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden="true">
          <circle cx="5" cy="5" r="3.6" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2.6 7.4L7.4 2.6" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      )
  }
}

export function TaskStatusBadge({
  status,
  size = 'compact',
}: {
  status: TaskStatus
  size?: 'compact' | 'default'
}) {
  const meta = TASK_STATUS_LIST.find((item) => item.status === status)!
  const heightClass = size === 'compact' ? 'h-[20px] px-1.5 text-[11px]' : 'h-[22px] px-2 text-[11px]'

  const styleMap: Record<TaskStatus, React.CSSProperties> = {
    clarify: {
      backgroundColor: 'var(--cf-warning-bg)',
      color: 'var(--cf-warning)',
      border: '1px dashed var(--cf-warning)',
      borderRadius: 'var(--cf-radius-badge)',
    },
    unclaimed: {
      backgroundColor: 'var(--cf-surface-card)',
      color: 'var(--cf-neutral)',
      border: '1px solid var(--cf-border-strong)',
      borderRadius: 'var(--cf-radius-badge)',
    },
    ready: {
      backgroundColor: 'var(--cf-info-bg)',
      color: 'var(--cf-info)',
      border: '1px solid var(--cf-info-border)',
      borderRadius: 'var(--cf-radius-badge)',
    },
    in_progress: {
      backgroundColor: 'var(--cf-primary-tint)',
      color: 'var(--cf-primary)',
      border: '1px solid var(--cf-primary)',
      borderRadius: 'var(--cf-radius-badge)',
      fontWeight: 600,
    },
    pending_accept: {
      backgroundColor: 'var(--cf-warning-bg)',
      color: 'var(--cf-warning)',
      borderTop: '1px solid var(--cf-warning)',
      borderRight: '1px solid var(--cf-warning)',
      borderBottom: '1px solid var(--cf-warning)',
      borderLeft: '3px solid var(--cf-warning)',
      borderRadius: 'var(--cf-radius-badge)',
      fontWeight: 600,
    },
    done: {
      backgroundColor: 'var(--cf-success)',
      color: 'var(--cf-surface-card)',
      border: '1px solid var(--cf-success)',
      borderRadius: 'var(--cf-radius-badge)',
      fontWeight: 600,
    },
    blocked: {
      backgroundColor: 'var(--cf-danger)',
      color: 'var(--cf-surface-card)',
      border: '1px solid var(--cf-danger)',
      borderRadius: '0px',
      fontWeight: 600,
    },
    paused: {
      backgroundColor: 'var(--cf-neutral-bg)',
      color: 'var(--cf-text-secondary)',
      borderTop: '1px dashed var(--cf-text-tertiary)',
      borderRight: '1px dashed var(--cf-text-tertiary)',
      borderBottom: '1px dashed var(--cf-text-tertiary)',
      borderLeft: '3px solid var(--cf-neutral)',
      borderRadius: '0px',
    },
    cancelled: {
      color: 'var(--cf-text-tertiary)',
      border: '1px solid var(--cf-border-strong)',
      borderRadius: '0px',
    },
  }

  return (
    <span
      style={styleMap[status]}
      title={`${meta.label} (${meta.encodingDesc})`}
      className={`inline-flex items-center gap-1 leading-none select-none shrink-0 ${heightClass} ${
        status === 'cancelled' ? 'cf-pattern-cancelled' : ''
      }`}
    >
      <StatusGlyph status={status} />
      <span className={status === 'cancelled' ? 'line-through decoration-[1.2px]' : ''}>
        {meta.label}
      </span>
    </span>
  )
}

/* ============================================================================
   2. 优先级标签 P0–P3 (P0 最紧急)
   ============================================================================ */

export type PriorityLevel = 'P0' | 'P1' | 'P2' | 'P3'

export function PriorityBadge({
  level,
  showLabel = true,
}: {
  level: PriorityLevel
  showLabel?: boolean
}) {
  const config: Record<
    PriorityLevel,
    { text: string; style: React.CSSProperties; icon: React.ReactNode }
  > = {
    P0: {
      text: '紧急阻断',
      style: {
        backgroundColor: 'var(--cf-danger-bg)',
        color: 'var(--cf-danger)',
        border: '1px solid var(--cf-danger)',
        borderLeftWidth: '3px',
        borderRadius: 'var(--cf-radius-badge)',
      },
      icon: (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0">
          <path d="M2 5.5L5 2.5L8 5.5M2 8.2L5 5.2L8 8.2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ),
    },
    P1: {
      text: '高优推进',
      style: {
        backgroundColor: 'var(--cf-warning-bg)',
        color: 'var(--cf-warning)',
        border: '1px solid var(--cf-warning-border)',
        borderLeftWidth: '3px',
        borderLeftColor: 'var(--cf-warning)',
        borderRadius: 'var(--cf-radius-badge)',
      },
      icon: (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0">
          <path d="M2 6.5L5 3.5L8 6.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ),
    },
    P2: {
      text: '常规排期',
      style: {
        backgroundColor: 'var(--cf-surface-secondary)',
        color: 'var(--cf-primary)',
        border: '1px solid var(--cf-primary-border)',
        borderRadius: 'var(--cf-radius-badge)',
      },
      icon: (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0">
          <path d="M2 5H8" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ),
    },
    P3: {
      text: '低优暂缓',
      style: {
        backgroundColor: 'var(--cf-surface-card)',
        color: 'var(--cf-text-tertiary)',
        border: '1px dashed var(--cf-border-strong)',
        borderRadius: 'var(--cf-radius-badge)',
      },
      icon: (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      ),
    },
  }

  const item = config[level]
  return (
    <span
      style={item.style}
      className="inline-flex h-[20px] items-center gap-1 px-1.5 text-[11px] font-medium leading-none"
    >
      {item.icon}
      <span className="font-mono-tabular font-semibold">{level}</span>
      {showLabel && <span className="text-[10px] opacity-90">· {item.text}</span>}
    </span>
  )
}

/* ============================================================================
   3. 角色标签 (5 种：发起人、负责人、成员、评审、观察员)
   ============================================================================ */

export type RoleType = 'initiator' | 'owner' | 'member' | 'reviewer' | 'observer'

export interface RoleBadgeMeta {
  role: RoleType
  label: string
  code: string
  permissionNote: string
}

export const ROLE_LIST: RoleBadgeMeta[] = [
  { role: 'initiator', label: '发起人', code: 'INIT', permissionNote: '立项与章程签署权' },
  { role: 'owner', label: '负责人', code: 'LEAD', permissionNote: '任务拆解与指派权' },
  { role: 'member', label: '成员', code: 'MEMB', permissionNote: '任务认领与产物提交权' },
  { role: 'reviewer', label: '评审', code: 'REVW', permissionNote: '证据核验与验收裁决权' },
  { role: 'observer', label: '观察员', code: 'OBSV', permissionNote: '全局只读查阅权' },
]

export function RoleBadge({ role }: { role: RoleType }) {
  const styles: Record<RoleType, { style: React.CSSProperties; dotColor: string; label: string }> = {
    initiator: {
      label: '发起人',
      dotColor: 'var(--cf-primary-deep)',
      style: {
        backgroundColor: 'var(--cf-primary)',
        color: 'var(--cf-surface-card)',
        border: '1px solid var(--cf-primary-deep)',
        borderRadius: 'var(--cf-radius-badge)',
      },
    },
    owner: {
      label: '负责人',
      dotColor: 'var(--cf-primary)',
      style: {
        backgroundColor: 'var(--cf-primary-tint)',
        color: 'var(--cf-primary)',
        border: '1px solid var(--cf-primary-border)',
        borderRadius: 'var(--cf-radius-badge)',
      },
    },
    reviewer: {
      label: '评审',
      dotColor: 'var(--cf-warning)',
      style: {
        backgroundColor: 'var(--cf-warning-bg)',
        color: 'var(--cf-warning)',
        border: '1px solid var(--cf-warning-border)',
        borderRadius: 'var(--cf-radius-badge)',
      },
    },
    member: {
      label: '成员',
      dotColor: 'var(--cf-neutral)',
      style: {
        backgroundColor: 'var(--cf-surface-secondary)',
        color: 'var(--cf-text-secondary)',
        border: '1px solid var(--cf-border-strong)',
        borderRadius: 'var(--cf-radius-badge)',
      },
    },
    observer: {
      label: '观察员',
      dotColor: 'var(--cf-text-muted)',
      style: {
        backgroundColor: 'var(--cf-surface-card)',
        color: 'var(--cf-text-tertiary)',
        border: '1px dashed var(--cf-border-strong)',
        borderRadius: 'var(--cf-radius-badge)',
      },
    },
  }

  const current = styles[role]
  return (
    <span
      style={current.style}
      className="inline-flex h-[20px] items-center gap-1.5 px-1.5 text-[11px] font-medium leading-none"
    >
      <span
        style={{
          backgroundColor: role === 'initiator' ? 'var(--cf-surface-card)' : current.dotColor,
        }}
        className="h-1.5 w-1.5 shrink-0"
      />
      <span>{current.label}</span>
    </span>
  )
}

/* ============================================================================
   4. 能力等级徽标 (自动接入、半自动、手动 —— 半自动支持伴随一条降级说明)
   ============================================================================ */

export type CapabilityLevel = 'auto' | 'semi' | 'manual'

export function CapabilityBadge({
  level,
  degradeReason,
}: {
  level: CapabilityLevel
  degradeReason?: string
}) {
  if (level === 'auto') {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span
          style={{
            backgroundColor: 'var(--cf-primary-tint)',
            color: 'var(--cf-primary)',
            border: '1px solid var(--cf-primary)',
            borderRadius: 'var(--cf-radius-badge)',
          }}
          className="inline-flex h-[20px] items-center gap-1.5 px-2 text-[11px] font-semibold leading-none"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
            <circle cx="5" cy="5" r="3.8" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="5" cy="5" r="1.8" fill="currentColor" />
          </svg>
          <span>自动接入</span>
          <span className="font-mono-tabular text-[10px] opacity-80">MCP-LIVE</span>
        </span>
      </div>
    )
  }

  if (level === 'semi') {
    return (
      <div className="inline-flex flex-col gap-1">
        <div className="inline-flex items-center gap-2">
          <span
            style={{
              backgroundColor: 'var(--cf-warning-bg)',
              color: 'var(--cf-warning)',
              borderTop: '1px solid var(--cf-warning)',
              borderRight: '1px dashed var(--cf-warning)',
              borderBottom: '1px solid var(--cf-warning)',
              borderLeft: '3px solid var(--cf-warning)',
              borderRadius: 'var(--cf-radius-badge)',
            }}
            className="inline-flex h-[20px] items-center gap-1.5 px-2 text-[11px] font-semibold leading-none"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
              <path d="M5 1.2A3.8 3.8 0 1 0 8.8 5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 1.2L8.8 5H5V1.2Z" fill="currentColor" />
            </svg>
            <span>半自动</span>
            <span className="font-mono-tabular text-[10px]">SEMI-ASSIST</span>
          </span>
        </div>
        {degradeReason && (
          <div
            style={{
              backgroundColor: 'var(--cf-warning-bg)',
              borderColor: 'var(--cf-warning-border)',
              color: 'var(--cf-warning)',
            }}
            className="inline-flex items-center gap-1.5 border-l-2 px-2 py-0.5 text-[12px] leading-[18px]"
          >
            <span className="font-mono-tabular text-[10px] font-semibold uppercase">[降级说明]</span>
            <span>{degradeReason}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <span
      style={{
        backgroundColor: 'var(--cf-surface-secondary)',
        color: 'var(--cf-text-secondary)',
        border: '1px solid var(--cf-border-strong)',
        borderRadius: 'var(--cf-radius-badge)',
      }}
      className="inline-flex h-[20px] items-center gap-1.5 px-2 text-[11px] font-medium leading-none"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
        <rect x="1.8" y="1.8" width="6.4" height="6.4" stroke="currentColor" strokeWidth="1.2" />
        <path d="M3.5 5H6.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <span>手动提交</span>
      <span className="font-mono-tabular text-[10px] text-[var(--cf-text-tertiary)]">MANUAL</span>
    </span>
  )
}

/* ============================================================================
   特殊要求专席：紧凑行式「风险提示」组件 (高 / 中 / 低 三级)
   ============================================================================ */

export type RiskSeverity = 'high' | 'medium' | 'low'

export interface RiskRowItemProps {
  severity: RiskSeverity
  code: string
  message: string
  targetRef: string
  slaOrMeta?: string
  actionLabel?: string
  onAction?: () => void
}

export function RiskRowItem({
  severity,
  code,
  message,
  targetRef,
  slaOrMeta,
  actionLabel,
  onAction,
}: RiskRowItemProps) {
  const config: Record<
    RiskSeverity,
    {
      label: string
      rowStyle: React.CSSProperties
      badgeStyle: React.CSSProperties
      icon: React.ReactNode
    }
  > = {
    high: {
      label: '高风险',
      rowStyle: {
        backgroundColor: 'var(--cf-danger-bg)',
        borderColor: 'var(--cf-danger-border)',
        borderLeft: '4px solid var(--cf-danger)',
      },
      badgeStyle: {
        backgroundColor: 'var(--cf-danger)',
        color: 'var(--cf-surface-card)',
      },
      icon: (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <path d="M6 1.2L11 10.2H1L6 1.2Z" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 4.8V7.2M6 8.6V9.1" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ),
    },
    medium: {
      label: '中风险',
      rowStyle: {
        backgroundColor: 'var(--cf-warning-bg)',
        borderColor: 'var(--cf-warning-border)',
        borderLeft: '4px solid var(--cf-warning)',
      },
      badgeStyle: {
        backgroundColor: 'var(--cf-warning)',
        color: 'var(--cf-surface-card)',
      },
      icon: (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <path d="M6 1L11 6L6 11L1 6L6 1Z" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="6" cy="6" r="1.3" fill="currentColor" />
        </svg>
      ),
    },
    low: {
      label: '低风险',
      rowStyle: {
        backgroundColor: 'var(--cf-surface-card)',
        borderColor: 'var(--cf-border-strong)',
        borderLeft: '4px solid var(--cf-info)',
      },
      badgeStyle: {
        backgroundColor: 'var(--cf-info-bg)',
        color: 'var(--cf-info)',
        border: '1px solid var(--cf-info-border)',
      },
      icon: (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 4V6.5M6 8V8.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ),
    },
  }

  const current = config[severity]

  return (
    <div
      style={current.rowStyle}
      className="flex min-h-[30px] flex-wrap items-center justify-between gap-2 border px-2.5 py-1 text-[12px]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          style={current.badgeStyle}
          className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded-[2px] px-1.5 text-[11px] font-semibold leading-none"
        >
          {current.icon}
          <span>{current.label}</span>
        </span>
        <span className="font-mono-tabular shrink-0 text-[11px] font-semibold text-[var(--cf-text-secondary)]">
          [{code}]
        </span>
        <span className="truncate text-[13px] font-medium text-[var(--cf-text-primary)]">{message}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <span
          style={{
            backgroundColor: 'var(--cf-surface-secondary)',
            borderColor: 'var(--cf-border-strong)',
            color: 'var(--cf-primary)',
          }}
          className="border px-1.5 py-0.5 font-mono-tabular text-[11px] font-medium"
        >
          {targetRef}
        </span>
        {slaOrMeta && (
          <span className="font-mono-tabular text-[11px] text-[var(--cf-text-tertiary)]">{slaOrMeta}</span>
        )}
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            style={{
              borderColor: 'var(--cf-border-strong)',
              backgroundColor: 'var(--cf-surface-card)',
              color: 'var(--cf-text-primary)',
            }}
            className="h-[22px] border px-2 text-[11px] font-medium hover:bg-[var(--cf-surface-tertiary)]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

/* ============================================================================
   5. 按钮 (主要、次要、幽灵、危险；尺寸：标准、小、极小；状态：默认、悬停、禁用、加载中)
   ============================================================================ */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'default' | 'sm' | 'xs'
export type ButtonVisualState = 'default' | 'hover' | 'disabled' | 'loading'

export function CfButton({
  variant = 'primary',
  size = 'default',
  visualState = 'default',
  children,
  onClick,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  visualState?: ButtonVisualState
  children: React.ReactNode
  onClick?: () => void
}) {
  const sizeClasses: Record<ButtonSize, string> = {
    default: 'h-[32px] px-3 text-[13px]',
    sm: 'h-[26px] px-2.5 text-[12px]',
    xs: 'h-[22px] px-2 text-[11px]',
  }

  const isDisabled = visualState === 'disabled' || visualState === 'loading'

  const getStyle = (): React.CSSProperties => {
    if (visualState === 'disabled') {
      return {
        backgroundColor: 'var(--cf-surface-tertiary)',
        color: 'var(--cf-text-muted)',
        border: '1px solid var(--cf-border-subtle)',
        borderRadius: 'var(--cf-radius-control)',
        cursor: 'not-allowed',
      }
    }

    switch (variant) {
      case 'primary':
        return {
          backgroundColor:
            visualState === 'hover' ? 'var(--cf-primary-deep)' : 'var(--cf-primary)',
          color: 'var(--cf-surface-card)',
          border: '1px solid var(--cf-primary-deep)',
          borderRadius: 'var(--cf-radius-control)',
        }
      case 'secondary':
        return {
          backgroundColor:
            visualState === 'hover' ? 'var(--cf-surface-tertiary)' : 'var(--cf-surface-card)',
          color: 'var(--cf-text-primary)',
          border:
            visualState === 'hover'
              ? '1px solid var(--cf-border-strong-hover)'
              : '1px solid var(--cf-border-strong)',
          borderRadius: 'var(--cf-radius-control)',
        }
      case 'ghost':
        return {
          backgroundColor:
            visualState === 'hover' ? 'var(--cf-surface-tertiary)' : 'transparent',
          color: 'var(--cf-text-secondary)',
          border: '1px solid transparent',
          borderRadius: 'var(--cf-radius-control)',
        }
      case 'danger':
        return {
          backgroundColor:
            visualState === 'hover' ? 'var(--cf-danger)' : 'var(--cf-danger-bg)',
          color:
            visualState === 'hover' ? 'var(--cf-surface-card)' : 'var(--cf-danger)',
          border: '1px solid var(--cf-danger)',
          borderRadius: 'var(--cf-radius-control)',
        }
    }
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      style={getStyle()}
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-colors select-none ${sizeClasses[size]}`}
    >
      {visualState === 'loading' && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="animate-spin shrink-0"
        >
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
          <path d="M6 1.5A4.5 4.5 0 0 1 10.5 6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
      <span>{children}</span>
    </button>
  )
}

/* ============================================================================
   7. 提示条 (信息、警告、危险、成功 —— 用于页面内的说明与告警)
   ============================================================================ */

export type BannerTone = 'info' | 'warning' | 'danger' | 'success'

export function InlineBanner({
  tone,
  title,
  description,
  code,
}: {
  tone: BannerTone
  title: string
  description: string
  code?: string
}) {
  const config: Record<
    BannerTone,
    { style: React.CSSProperties; badgeText: string; icon: React.ReactNode }
  > = {
    info: {
      badgeText: '规则说明',
      style: {
        backgroundColor: 'var(--cf-info-bg)',
        borderColor: 'var(--cf-info-border)',
        borderLeft: '3px solid var(--cf-info)',
        color: 'var(--cf-info)',
      },
      icon: (
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <circle cx="6" cy="6" r="4.8" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 5.2V8.5M6 3.5V4" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      ),
    },
    warning: {
      badgeText: '注意核验',
      style: {
        backgroundColor: 'var(--cf-warning-bg)',
        borderColor: 'var(--cf-warning-border)',
        borderLeft: '3px solid var(--cf-warning)',
        color: 'var(--cf-warning)',
      },
      icon: (
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <path d="M6 1.3L10.8 10.2H1.2L6 1.3Z" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 4.8V7.3M6 8.5V9" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      ),
    },
    danger: {
      badgeText: '阻断告警',
      style: {
        backgroundColor: 'var(--cf-danger-bg)',
        borderColor: 'var(--cf-danger-border)',
        borderLeft: '3px solid var(--cf-danger)',
        color: 'var(--cf-danger)',
      },
      icon: (
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeWidth="1.3" />
          <path d="M4 4L8 8M8 4L4 8" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      ),
    },
    success: {
      badgeText: '事实已锁定',
      style: {
        backgroundColor: 'var(--cf-success-bg)',
        borderColor: 'var(--cf-success-border)',
        borderLeft: '3px solid var(--cf-success)',
        color: 'var(--cf-success)',
      },
      icon: (
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3.5 6.2L5.2 7.9L8.6 4.2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ),
    },
  }

  const current = config[tone]

  return (
    <div
      style={{
        ...current.style,
        borderRadius: 'var(--cf-radius-control)',
      }}
      className="flex items-start justify-between gap-3 border px-3 py-2 text-[12px]"
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{current.icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{title}</span>
            <span className="font-mono-tabular text-[10px] opacity-80">[{current.badgeText}]</span>
          </div>
          <p className="mt-0.5 text-[12px] leading-[18px] text-[var(--cf-text-secondary)]">
            {description}
          </p>
        </div>
      </div>
      {code && (
        <span className="font-mono-tabular shrink-0 text-[11px] opacity-85">{code}</span>
      )}
    </div>
  )
}

/* ============================================================================
   11. 头像与头像组 (单人、头像组重叠排列，超过 5 个显示 +N)
   ============================================================================ */

export interface CollaboratorAvatarItem {
  id: string
  name: string
  short: string
  kind: 'human' | 'agent'
  roleColor?: string
}

export function SingleAvatar({
  item,
  size = 26,
}: {
  item: CollaboratorAvatarItem
  size?: number
}) {
  const isAgent = item.kind === 'agent'
  return (
    <span
      title={`${item.name} (${isAgent ? '本地 AI 连接器' : '团队成员'})`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: isAgent ? 'var(--cf-primary)' : 'var(--cf-surface-card)',
        color: isAgent ? 'var(--cf-surface-card)' : 'var(--cf-text-primary)',
        borderColor: isAgent ? 'var(--cf-primary-deep)' : 'var(--cf-border-strong)',
        borderRadius: isAgent ? '2px' : '9999px',
      }}
      className="relative inline-flex shrink-0 items-center justify-center border font-mono-tabular text-[11px] font-semibold select-none"
    >
      {item.short}
      {isAgent && (
        <span
          style={{ backgroundColor: 'var(--cf-success)' }}
          className="absolute -right-0.5 -bottom-0.5 h-2 w-2 border border-[var(--cf-surface-card)]"
        />
      )}
    </span>
  )
}

export function AvatarGroup({
  items,
  max = 5,
}: {
  items: CollaboratorAvatarItem[]
  max?: number
}) {
  const visible = items.slice(0, max)
  const overflow = items.length - visible.length

  return (
    <div className="inline-flex items-center">
      {visible.map((item, idx) => (
        <div
          key={item.id}
          style={{ marginLeft: idx === 0 ? 0 : '-7px', zIndex: visible.length - idx }}
          className="relative"
        >
          <SingleAvatar item={item} size={26} />
        </div>
      ))}
      {overflow > 0 && (
        <span
          style={{
            marginLeft: '-5px',
            zIndex: 0,
            backgroundColor: 'var(--cf-surface-tertiary)',
            color: 'var(--cf-text-primary)',
            borderColor: 'var(--cf-border-strong)',
          }}
          className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full border px-1.5 font-mono-tabular text-[10px] font-semibold"
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

/* ============================================================================
   12. 进度条 (细列表型、标准卡片型、上下文包三段颜色预算型)
   ============================================================================ */

export function ThinProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="flex items-center gap-2">
      <div
        style={{
          backgroundColor: 'var(--cf-surface-tertiary)',
          borderRadius: '1px',
        }}
        className="h-[4px] flex-1 overflow-hidden"
      >
        <div
          style={{
            width: `${clamped}%`,
            backgroundColor: clamped === 100 ? 'var(--cf-success)' : 'var(--cf-primary)',
          }}
          className="h-full transition-all"
        />
      </div>
      <span className="font-mono-tabular w-9 text-right text-[11px] text-[var(--cf-text-secondary)]">
        {clamped}%
      </span>
    </div>
  )
}

export function StandardProgressBar({
  label,
  doneCount,
  totalCount,
}: {
  label: string
  doneCount: number
  totalCount: number
}) {
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-[var(--cf-text-primary)]">{label}</span>
        <span className="font-mono-tabular text-[11px] text-[var(--cf-text-secondary)]">
          {doneCount}/{totalCount} 项已验收 ({pct}%)
        </span>
      </div>
      <div
        style={{
          backgroundColor: 'var(--cf-surface-tertiary)',
          borderColor: 'var(--cf-border-strong)',
          borderRadius: 'var(--cf-radius-badge)',
        }}
        className="h-[8px] w-full overflow-hidden border"
      >
        <div
          style={{
            width: `${pct}%`,
            backgroundColor: pct === 100 ? 'var(--cf-success)' : 'var(--cf-primary)',
          }}
          className="h-full"
        />
      </div>
    </div>
  )
}

export function ContextBudgetProgressBar({
  charterTokens,
  artifactTokens,
  warningTokens,
  maxTokens,
}: {
  charterTokens: number
  artifactTokens: number
  warningTokens: number
  maxTokens: number
}) {
  const p1 = Math.min(100, (charterTokens / maxTokens) * 100)
  const p2 = Math.min(100 - p1, (artifactTokens / maxTokens) * 100)
  const p3 = Math.min(100 - p1 - p2, (warningTokens / maxTokens) * 100)
  const totalUsed = charterTokens + artifactTokens + warningTokens
  const totalPct = ((totalUsed / maxTokens) * 100).toFixed(1)

  return (
    <div
      style={{
        backgroundColor: 'var(--cf-surface-card)',
        borderColor: 'var(--cf-border-strong)',
        borderRadius: 'var(--cf-radius-control)',
      }}
      className="border p-2.5"
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[var(--cf-text-primary)]">
            上下文包预算 (Context Pack Budget)
          </span>
          <span className="font-mono-tabular text-[11px] text-[var(--cf-warning)]">
            [三段水位监控]
          </span>
        </div>
        <span className="font-mono-tabular text-[11px] font-semibold text-[var(--cf-text-primary)]">
          {totalUsed.toLocaleString()} / {maxTokens.toLocaleString()} tok ({totalPct}%)
        </span>
      </div>

      {/* 三段颜色轨道 */}
      <div
        style={{
          backgroundColor: 'var(--cf-surface-tertiary)',
          borderColor: 'var(--cf-border-strong)',
        }}
        className="flex h-[10px] w-full overflow-hidden border"
      >
        <div
          style={{ width: `${p1}%`, backgroundColor: 'var(--cf-primary)' }}
          title={`章程与固定事实: ${charterTokens} tok`}
          className="h-full border-r border-[var(--cf-surface-card)]"
        />
        <div
          style={{ width: `${p2}%`, backgroundColor: 'var(--cf-warning)' }}
          title={`任务上下文与证据摘要: ${artifactTokens} tok`}
          className="h-full border-r border-[var(--cf-surface-card)]"
        />
        <div
          style={{ width: `${p3}%`, backgroundColor: 'var(--cf-danger)' }}
          title={`讨论摘录/溢出风险区: ${warningTokens} tok`}
          className="h-full"
        />
      </div>

      {/* 三段图例 */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--cf-text-secondary)]">
        <div className="flex items-center gap-1.5">
          <span style={{ backgroundColor: 'var(--cf-primary)' }} className="h-2 w-2 shrink-0" />
          <span>章程与基线事实:</span>
          <span className="font-mono-tabular font-medium">{charterTokens.toLocaleString()} tok</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ backgroundColor: 'var(--cf-warning)' }} className="h-2 w-2 shrink-0" />
          <span>产物证据增量:</span>
          <span className="font-mono-tabular font-medium">{artifactTokens.toLocaleString()} tok</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ backgroundColor: 'var(--cf-danger)' }} className="h-2 w-2 shrink-0" />
          <span>临时讨论缓存 (超限裁剪):</span>
          <span className="font-mono-tabular font-medium text-[var(--cf-danger)]">
            {warningTokens.toLocaleString()} tok
          </span>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   13. 分隔线与 Key-Value 小标签
   ============================================================================ */

export function KeyValueTag({
  k,
  v,
  mono = true,
  highlight = false,
}: {
  k: string
  v: string
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <span
      style={{
        borderColor: highlight ? 'var(--cf-primary-border)' : 'var(--cf-border-strong)',
        borderRadius: 'var(--cf-radius-badge)',
      }}
      className="inline-flex h-[20px] overflow-hidden border text-[11px] leading-none"
    >
      <span
        style={{
          backgroundColor: 'var(--cf-surface-secondary)',
          color: 'var(--cf-text-tertiary)',
          borderRight: '1px solid var(--cf-border-subtle)',
        }}
        className="flex items-center px-1.5"
      >
        {k}
      </span>
      <span
        style={{
          backgroundColor: highlight ? 'var(--cf-primary-tint)' : 'var(--cf-surface-card)',
          color: highlight ? 'var(--cf-primary)' : 'var(--cf-text-primary)',
        }}
        className={`flex items-center px-1.5 font-medium ${mono ? 'font-mono-tabular' : ''}`}
      >
        {v}
      </span>
    </span>
  )
}
