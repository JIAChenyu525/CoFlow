/**
 * 演示数据：一个真实形状的小项目「朝夕相伴」。
 * 用途是让人看到事实层的"满状态"长什么样，而不是空壳界面。
 *
 * 运行：pnpm db:seed
 * 重灌：RESEED=1 pnpm db:seed
 */
import { Prisma, PrismaClient, type TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

const now = Date.now();
const ago = (days: number, hours = 0) => new Date(now - days * 864e5 - hours * 36e5);

async function main() {
  const existing = await prisma.project.findFirst();
  if (existing && process.env.RESEED !== "1") {
    console.log("已有项目数据，跳过 seed。需要重灌请用 RESEED=1 pnpm db:seed");
    return;
  }

  if (process.env.RESEED === "1") {
    await prisma.loginCode.deleteMany();
    await prisma.session.deleteMany();
    await prisma.devicePairing.deleteMany();
    await prisma.device.deleteMany();
    await prisma.projectEvent.deleteMany();
    await prisma.review.deleteMany();
    await prisma.artifact.deleteMany();
    await prisma.decision.deleteMany();
    await prisma.message.deleteMany();
    await prisma.taskDependency.deleteMany();
    await prisma.task.deleteMany();
    await prisma.milestone.deleteMany();
    await prisma.charter.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  }

  // 顺序即默认身份顺序：getCurrentUser 取 createdAt 最早的用户，所以发起人排第一
  const [chen, lin, zhou, shen, luo] = await Promise.all([
    prisma.user.create({
      data: { name: "陈屿", handle: "chenyu", email: "chenyu@coflow.dev", color: "#0F5F5C", createdAt: ago(9, 12) },
    }),
    prisma.user.create({
      data: { name: "林知夏", handle: "zhixia", email: "zhixia@coflow.dev", color: "#1E4C9A", createdAt: ago(9, 11) },
    }),
    prisma.user.create({
      data: { name: "周野", handle: "zhouye", email: "zhouye@coflow.dev", color: "#A95A06", createdAt: ago(9, 10) },
    }),
    prisma.user.create({
      data: { name: "沈可", handle: "shenke", email: "shenke@coflow.dev", color: "#7A3E8E", createdAt: ago(9, 9) },
    }),
    prisma.user.create({
      data: { name: "罗一", handle: "luoyi", email: "luoyi@coflow.dev", color: "#5A6270", createdAt: ago(9, 8) },
    }),
  ]);

  const project = await prisma.project.create({
    data: {
      name: "双人打卡应用「朝夕相伴」",
      key: "ZX",
      summary: "给需要共同记录生活的双人用户，做一个能真正用起来的打卡应用。",
      stage: "BUILD",
      createdAt: ago(9),
    },
  });

  await prisma.charter.create({
    data: {
      projectId: project.id,
      version: 1,
      goal: "完成可供双人实际使用的打卡应用首个版本，核心流程包括连续打卡提醒、睡前图片上传和照片共享。",
      targetUsers: "需要共同记录生活的双人用户，以情侣与室友为主。",
      scope: "打卡、提醒、图片上传、共享；小米与 iPhone 双端适配。",
      nonGoals: "社区、公开动态、复杂商城、桌面端。",
      constraints: "适配小米与 iPhone；视觉采用可爱粉色主题；界面不使用 emoji。",
      acceptance:
        "1. 双端安装后能完成一次完整打卡\n2. 睡前图片上传成功且对方可见\n3. 连续打卡提醒在约定时间触发\n4. 核心流程在一周真实使用中无阻断",
      decisionMakerId: chen.id,
      note: "初始章程",
      createdById: chen.id,
      createdAt: ago(9),
    },
  });

  await prisma.membership.createMany({
    data: [
      { projectId: project.id, userId: chen.id, role: "OWNER", joinedAt: ago(9) },
      { projectId: project.id, userId: lin.id, role: "LEAD", joinedAt: ago(9) },
      { projectId: project.id, userId: zhou.id, role: "MEMBER", joinedAt: ago(8) },
      { projectId: project.id, userId: shen.id, role: "REVIEWER", joinedAt: ago(8) },
      { projectId: project.id, userId: luo.id, role: "OBSERVER", joinedAt: ago(7) },
    ],
  });

  const m1 = await prisma.milestone.create({
    data: {
      projectId: project.id,
      title: "M1 · 核心流程可跑通",
      status: "ACTIVE",
      sort: 0,
      dueDate: ago(-6),
    },
  });
  const m2 = await prisma.milestone.create({
    data: {
      projectId: project.id,
      title: "M2 · 双端发布准备",
      status: "PLANNED",
      sort: 1,
      dueDate: ago(-20),
    },
  });

  const mk = (d: {
    title: string;
    status: TaskStatus;
    assigneeId?: string;
    reviewerId?: string;
    milestoneId?: string;
    priority?: "P0" | "P1" | "P2" | "P3";
    weight?: number;
    description?: string;
    inputs?: string;
    scope?: string;
    nonScope?: string;
    acceptance?: string;
    due?: Date;
    createdAt?: Date;
    blockedReason?: string;
    blockedNeeds?: string;
  }) =>
    prisma.task.create({
      data: {
        projectId: project.id,
        title: d.title,
        status: d.status,
        assigneeId: d.assigneeId ?? null,
        reviewerId: d.reviewerId ?? null,
        milestoneId: d.milestoneId ?? null,
        priority: d.priority ?? "P2",
        weight: d.weight ?? 1,
        description: d.description ?? "",
        inputs: d.inputs ?? "",
        scope: d.scope ?? "",
        nonScope: d.nonScope ?? "",
        acceptance: d.acceptance ?? "",
        dueDate: d.due ?? null,
        createdAt: d.createdAt ?? ago(8),
        blockedReason: d.blockedReason,
        blockedNeeds: d.blockedNeeds,
        version: 2,
      },
    });

  const tModel = await mk({
    title: "完成数据模型与权限约束",
    status: "DONE",
    assigneeId: lin.id,
    reviewerId: chen.id,
    milestoneId: m1.id,
    priority: "P0",
    weight: 3,
    description: "定义打卡、照片、用户三张表及其权限边界，确保双人关系之外不可见。",
    inputs: "章程 v1；隐私要求：照片仅双方可见",
    scope: "backend/db、backend/auth",
    nonScope: "前端页面、推送",
    acceptance: "1. 三张表结构与关系图确认\n2. 权限用例覆盖「非双方用户不可读照片」\n3. 迁移脚本可在空库执行成功",
    due: ago(5),
    createdAt: ago(8),
  });

  const tUpload = await mk({
    title: "实现睡前图片上传接口",
    status: "IN_REVIEW",
    assigneeId: zhou.id,
    reviewerId: lin.id,
    milestoneId: m1.id,
    priority: "P0",
    weight: 3,
    description: "支持睡前图片上传至对象存储，返回可分享链接，限制单张 10MB。",
    inputs: "数据模型 task_upload；对象存储桶配置；权限约束",
    scope: "backend/upload",
    nonScope: "图片裁剪、滤镜、相册 UI",
    acceptance: "1. 上传成功并返回有效期链接\n2. 超过 10MB 被拒绝且提示明确\n3. 非双方用户访问链接返回 403",
    due: ago(-1),
    createdAt: ago(6),
  });

  const tUi = await mk({
    title: "首页与打卡流程界面",
    status: "IN_PROGRESS",
    assigneeId: zhou.id,
    reviewerId: shen.id,
    milestoneId: m1.id,
    priority: "P1",
    weight: 3,
    description: "实现首页、打卡按钮、连续天数展示与上传入口。",
    inputs: "设计稿 v2；章程约束：粉色主题、不使用 emoji",
    scope: "app/screens/home、app/screens/checkin",
    nonScope: "设置页、历史相册",
    acceptance: "1. 主流程三次点击内完成打卡\n2. 视觉与设计稿一致\n3. 不使用 emoji",
    due: ago(-3),
    createdAt: ago(6),
  });

  const tPush = await mk({
    title: "打卡提醒推送",
    status: "BLOCKED",
    assigneeId: lin.id,
    reviewerId: chen.id,
    milestoneId: m2.id,
    priority: "P1",
    weight: 2,
    description: "在用户设定的时间推送打卡提醒。",
    inputs: "提醒时间设置接口",
    scope: "backend/notify",
    nonScope: "营销推送",
    acceptance: "1. 提醒在设定时间 ±2 分钟内到达\n2. 用户关闭后不再推送",
    due: ago(-8),
    createdAt: ago(5),
    blockedReason: "小米推送服务的企业资质审核尚未通过，无法申请生产环境通道。",
    blockedNeeds: "陈屿提供营业执照与审核进度；知夏确认是否可以先用本地通知兜底",
  });

  const tQa = await mk({
    title: "双端适配测试清单",
    status: "CLARIFY",
    assigneeId: shen.id,
    reviewerId: lin.id,
    milestoneId: m2.id,
    priority: "P2",
    weight: 1,
    description: "覆盖小米与 iPhone 主流机型的手工测试清单。",
    inputs: "",
    scope: "docs/qa",
    nonScope: "自动化测试",
    acceptance: "",
    due: ago(-6),
    createdAt: ago(2),
  });

  const tDesign = await mk({
    title: "设计稿：可爱粉色主题",
    status: "DONE",
    assigneeId: shen.id,
    reviewerId: chen.id,
    milestoneId: m1.id,
    priority: "P1",
    weight: 2,
    description: "输出首页、打卡、上传三页的视觉稿与组件规范。",
    inputs: "目标用户画像；约束：粉色主题、不用 emoji",
    scope: "设计稿文件",
    nonScope: "动效",
    acceptance: "1. 三页视觉稿完成\n2. 颜色与字号规范可交付给前端\n3. 不用 emoji",
    due: ago(4),
    createdAt: ago(7),
  });

  await mk({
    title: "用户引导与空状态文案",
    status: "UNCLAIMED",
    milestoneId: m2.id,
    priority: "P2",
    weight: 1,
    description: "首次进入的引导、无照片空状态、断网提示文案。",
    inputs: "产品口径说明",
    scope: "docs/copy",
    nonScope: "视觉设计",
    acceptance: "1. 文案覆盖三类空状态\n2. 与设计稿页面一致",
    due: ago(-10),
    createdAt: ago(1),
  });

  const tDemo = await mk({
    title: "项目路演材料初稿",
    status: "READY",
    assigneeId: chen.id,
    reviewerId: lin.id,
    milestoneId: m2.id,
    priority: "P3",
    weight: 1,
    description: "整理产品定位、核心流程与差异化，形成 8 页路演初稿。",
    inputs: "章程 v1；已确认决策 2 条；完成版设计稿",
    scope: "docs/pitch",
    nonScope: "产品界面改动",
    acceptance: "1. 8 页以内\n2. 与产品实际能力一致\n3. 不含无法验证的数据",
    due: ago(-12),
    createdAt: ago(1),
  });

  await prisma.taskDependency.createMany({
    data: [
      { taskId: tUi.id, dependsOnTaskId: tModel.id },
      { taskId: tUpload.id, dependsOnTaskId: tModel.id },
      { taskId: tQa.id, dependsOnTaskId: tUi.id },
      { taskId: tDemo.id, dependsOnTaskId: tDesign.id },
    ],
  });

  // ── 产物 ──
  const aCommit = await prisma.artifact.create({
    data: {
      projectId: project.id,
      taskId: tModel.id,
      type: "COMMIT",
      title: "数据模型与权限迁移脚本",
      location: "repo://backend/commit/a81f2c",
      version: "v1",
      submittedById: lin.id,
      createdAt: ago(5, 3),
    },
  });
  await prisma.artifact.create({
    data: {
      projectId: project.id,
      taskId: tUpload.id,
      type: "COMMIT",
      title: "睡前图片上传接口实现",
      location: "repo://backend/commit/d4e9b1",
      version: "v1",
      submittedById: zhou.id,
      createdAt: ago(1, 5),
    },
  });
  const aTest = await prisma.artifact.create({
    data: {
      projectId: project.id,
      taskId: tUpload.id,
      type: "TEST_REPORT",
      title: "上传接口单元测试报告",
      location: "repo://backend/actions/runs/8821",
      version: "v1",
      note: "18 passed / 0 failed",
      submittedById: zhou.id,
      createdAt: ago(1, 2),
    },
  });
  await prisma.artifact.create({
    data: {
      projectId: project.id,
      taskId: tDesign.id,
      type: "DESIGN",
      title: "三页视觉稿 v2",
      location: "https://www.figma.com/file/demo-zhaoxi",
      version: "v2",
      submittedById: shen.id,
      createdAt: ago(4, 4),
    },
  });
  await prisma.artifact.create({
    data: {
      projectId: project.id,
      taskId: tUi.id,
      type: "IMAGE",
      title: "首页实现截图",
      location: "artifacts/home-v1.png",
      version: "v1",
      submittedById: zhou.id,
      createdAt: ago(0, 6),
    },
  });

  // ── 验收 ──
  await prisma.review.create({
    data: {
      taskId: tModel.id,
      artifactId: aCommit.id,
      verdict: "PASS",
      criteriaNotes:
        "1. 三张表与关系图一致 ✓\n2. 非双方用户读照片返回 403，用例覆盖 ✓\n3. 迁移脚本在空库执行成功 ✓",
      comment: "权限边界写得比预期细，可以进入联调。",
      reviewerId: chen.id,
      createdAt: ago(4, 6),
    },
  });
  await prisma.review.create({
    data: {
      taskId: tDesign.id,
      verdict: "PASS",
      criteriaNotes: "1. 三页完成 ✓\n2. 规范可交付 ✓\n3. 无 emoji ✓",
      comment: "粉色没有做成廉价的糖果色，保持住。",
      reviewerId: chen.id,
      createdAt: ago(3, 8),
    },
  });

  // ── 决策 ──
  await prisma.decision.create({
    data: {
      projectId: project.id,
      title: "睡前图片走对象存储直传，不经业务服务器中转",
      conclusion: "客户端获取临时上传凭证后直传对象存储，业务服务只签发凭证与记录元数据。",
      rationale: "图片体积大，中转会拖垮单机带宽；直传还能降低后端内存占用与合规风险。",
      alternatives: "业务服务器中转（实现简单，但与约束中的成本目标冲突）",
      impact: "上传任务、权限校验、对象存储桶配置；隐私要求不变，链接仍需鉴权。",
      status: "CONFIRMED",
      version: 1,
      decidedById: chen.id,
      createdAt: ago(6, 2),
      confirmedAt: ago(6),
    },
  });
  await prisma.decision.create({
    data: {
      projectId: project.id,
      title: "首版不做社区与公开动态",
      conclusion: "首版仅保留双人私密空间，不提供任何公开发布能力。",
      rationale: "目标用户的核心诉求是私密记录；公开能力会引入审核与运营成本，与首版范围冲突。",
      alternatives: "做只读分享页（被否：增加隐私面）",
      impact: "产品范围、文案、权限模型；后续若要做需要新决策并重估范围。",
      status: "CONFIRMED",
      version: 1,
      decidedById: chen.id,
      createdAt: ago(8, 5),
      confirmedAt: ago(8, 4),
    },
  });
  await prisma.decision.create({
    data: {
      projectId: project.id,
      taskId: tPush.id,
      title: "提醒推送先用本地通知兜底，小米推送延后到 M2",
      conclusion: "M1 内用本地通知实现提醒，生产推送通道等资质通过后再切换。",
      rationale: "资质审核不可控，不应阻塞核心流程验收；本地通知足以验证提醒体验。",
      alternatives: "等待生产通道（被否：阻塞 M1）；改用第三方推送（新增依赖与成本）",
      impact: "提醒任务、M1 验收口径、双端测试清单。",
      status: "PROPOSED",
      version: 1,
      decidedById: lin.id,
      createdAt: ago(0, 9),
    },
  });

  // ── 消息 ──
  const msgs: {
    body: string;
    authorId: string;
    type?: "TEXT" | "SYSTEM" | "DECISION_PROPOSAL" | "ARTIFACT_SUBMIT" | "BLOCKER" | "AGENT_REPORT" | "TASK_REF";
    createdAt: Date;
    taskId?: string;
  }[] = [
    {
      body: "章程 v1 已确认。范围就按「打卡、提醒、上传、共享」走，社区和公开动态这次不碰。",
      authorId: chen.id,
      createdAt: ago(8, 4),
    },
    {
      body: "数据模型我先出，重点是照片的可见性：只能是两个人之间可见，任何第三方链接都要鉴权。",
      authorId: lin.id,
      createdAt: ago(7, 6),
    },
    {
      body: "设计稿 v2 传上去了。粉色压了一档饱和度，避免看起来太廉价；所有图标都是手绘的，没有用 emoji。",
      authorId: shen.id,
      createdAt: ago(4, 3),
      type: "ARTIFACT_SUBMIT",
    },
    {
      body: "上传接口做完了，直传方案确实省事。测试报告一起传了，18 个用例全过。",
      authorId: zhou.id,
      createdAt: ago(1, 2),
      type: "ARTIFACT_SUBMIT",
    },
    {
      body: "小米推送的生产通道还没批下来，资质卡在审核。这块我先挂阻塞，不拖着 M1。",
      authorId: lin.id,
      createdAt: ago(1, 1),
      type: "BLOCKER",
    },
    {
      body: "建议 M1 先用本地通知兜底，生产推送等资质通过再切。核心流程验收不该被审核节奏卡住。",
      authorId: lin.id,
      createdAt: ago(0, 9),
      type: "DECISION_PROPOSAL",
    },
    {
      body: "同意。双端测试清单这周要出，但清单缺机型和优先级输入，现在还是待澄清。",
      authorId: chen.id,
      createdAt: ago(0, 5),
    },
  ];
  for (const m of msgs) {
    await prisma.message.create({
      data: {
        projectId: project.id,
        authorId: m.authorId,
        body: m.body,
        type: m.type ?? "TEXT",
        taskId: m.taskId ?? null,
        createdAt: m.createdAt,
      },
    });
  }

  // ── 事件流 ──
  const ev = (
    type: string,
    actorId: string,
    subjectType: string,
    subjectId: string,
    payload: Record<string, unknown>,
    occurredAt: Date
  ) =>
    prisma.projectEvent.create({
      data: {
        projectId: project.id,
        type,
        actorType: "HUMAN",
        actorId,
        subjectType,
        subjectId,
        payload: payload as Prisma.InputJsonValue,
        occurredAt,
        receivedAt: occurredAt,
      },
    });

  await ev("project.created", chen.id, "project", project.id, { name: project.name, key: "ZX" }, ago(9));
  await ev("charter.updated", chen.id, "charter", project.id, { version: 1, note: "初始章程" }, ago(9, 1));
  await Promise.all([
    ev("task.created", lin.id, "task", tModel.id, { title: tModel.title, status: "CLARIFY" }, ago(8, 3)),
    ev("task.created", zhou.id, "task", tUi.id, { title: tUi.title, status: "CLARIFY" }, ago(8, 2)),
    ev("task.created", lin.id, "task", tPush.id, { title: tPush.title, status: "CLARIFY" }, ago(8, 1)),
    ev("task.created", shen.id, "task", tDesign.id, { title: tDesign.title, status: "CLARIFY" }, ago(7, 4)),
  ]);
  await Promise.all([
    ev("decision.confirmed", chen.id, "decision", "demo-1", { title: "首版不做社区与公开动态" }, ago(8, 4)),
    ev("artifact.submitted", lin.id, "artifact", aCommit.id, { title: aCommit.title }, ago(5, 3)),
    ev("task.status_changed", lin.id, "task", tModel.id, { from: "IN_PROGRESS", to: "IN_REVIEW" }, ago(5, 2)),
    ev("review.completed", chen.id, "task", tModel.id, { verdict: "PASS", nextStatus: "DONE" }, ago(4, 6)),
    ev("artifact.submitted", shen.id, "artifact", "demo-design", { title: "三页视觉稿 v2" }, ago(4, 4)),
    ev("decision.confirmed", chen.id, "decision", "demo-2", { title: "睡前图片走对象存储直传" }, ago(6)),
    ev("artifact.submitted", zhou.id, "artifact", aTest.id, { title: aTest.title }, ago(1, 2)),
    ev("task.status_changed", zhou.id, "task", tUpload.id, { from: "IN_PROGRESS", to: "IN_REVIEW" }, ago(1, 1)),
    ev("task.blocked", lin.id, "task", tPush.id, { blockedReason: "小米推送资质审核未通过" }, ago(1, 1)),
    ev("decision.proposed", lin.id, "decision", "demo-3", { title: "提醒推送先用本地通知兜底" }, ago(0, 9)),
    ev("task.status_changed", zhou.id, "task", tUi.id, { from: "READY", to: "IN_PROGRESS" }, ago(0, 6)),
  ]);

  console.log(`Seed 完成：项目 ${project.key} · 5 位成员 · 8 个任务 · 3 条决策`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
