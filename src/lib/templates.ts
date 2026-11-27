/**
 * 项目模板（设计 §12.3 阶段四：模板复用）
 *
 * 模板只是预填：章程字段与一批任务定义。
 * 它不替人做决定——生成的任务停在「待认领」，负责人与就绪状态仍要人推进。
 */

export type TemplateTask = {
  title: string;
  description: string;
  inputs: string;
  scope: string;
  nonScope: string;
  acceptance: string;
  priority: "P0" | "P1" | "P2" | "P3";
  weight: number;
  milestone?: number;
  dependsOn?: number[];
};

export type ProjectTemplate = {
  id: string;
  name: string;
  tagline: string;
  minutes: number;
  charter: {
    goal: string;
    targetUsers: string;
    scope: string;
    nonGoals: string;
    constraints: string;
    acceptance: string;
  };
  milestones: string[];
  tasks: TemplateTask[];
};

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: "software",
    name: "软件小团队",
    tagline: "从数据模型到可以交付的版本，六个任务覆盖主流程",
    minutes: 3,
    charter: {
      goal: "完成<项目名>的首个可用版本，核心流程可以被真实用户完整走通。",
      targetUsers: "<填写目标用户：谁在什么场景下使用它>",
      scope: "核心业务流程、数据与接口、基础错误处理、必要端适配。",
      nonGoals: "社区、运营后台、复杂权限体系、性能极致优化。",
      constraints: "技术栈在开工前确定；不引入未经评估的第三方服务；隐私数据最小化。",
      acceptance:
        "1. 核心流程可以完整走通，无需人工干预\n2. 关键路径有可执行的测试\n3. 没有阻断性缺陷，已知问题写进交付说明",
    },
    milestones: ["M1 · 骨架与契约", "M2 · 核心流程", "M3 · 联调与交付"],
    tasks: [
      {
        title: "定义数据模型与接口契约",
        description: "把核心实体、关系与接口边界定下来，后续两端都按这份契约开发。",
        inputs: "项目章程；核心业务流程说明",
        scope: "数据模型设计文档、接口定义",
        nonScope: "具体实现、UI",
        acceptance: "1. 实体与关系图确认\n2. 接口清单含入参出参与错误码\n3. 权限边界写明",
        priority: "P0",
        weight: 2,
        milestone: 0,
      },
      {
        title: "搭建项目骨架与本地运行环境",
        description: "让任何人 clone 下来能在十分钟内跑起来。",
        inputs: "数据模型与接口契约",
        scope: "仓库结构、构建脚本、本地启动说明",
        nonScope: "业务逻辑",
        acceptance: "1. 一条命令可启动\n2. 新人按说明能跑通\n3. 环境变量有示例文件",
        priority: "P0",
        weight: 2,
        milestone: 0,
        dependsOn: [0],
      },
      {
        title: "实现核心流程（服务端）",
        description: "按契约实现主流程的服务端逻辑与错误处理。",
        inputs: "接口契约；骨架代码",
        scope: "服务端接口与数据访问",
        nonScope: "界面、部署",
        acceptance: "1. 接口按契约返回\n2. 异常路径有明确错误码\n3. 单元测试覆盖主流程",
        priority: "P0",
        weight: 3,
        milestone: 1,
        dependsOn: [1],
      },
      {
        title: "实现核心流程（客户端）",
        description: "实现主流程界面与交互，包含加载、空状态与错误提示。",
        inputs: "接口契约；视觉规范",
        scope: "主流程页面与组件",
        nonScope: "设置页、帮助页",
        acceptance: "1. 主流程三次点击内完成\n2. 空状态与错误态都有文案\n3. 与视觉稿一致",
        priority: "P0",
        weight: 3,
        milestone: 1,
        dependsOn: [1],
      },
      {
        title: "联调与异常处理",
        description: "端到端跑通，补齐网络异常、重复提交、超时等边界。",
        inputs: "服务端与客户端实现",
        scope: "联调修复、边界处理",
        nonScope: "新功能",
        acceptance: "1. 断网与超时有提示\n2. 重复提交不会产生脏数据\n3. 主流程无阻断",
        priority: "P1",
        weight: 2,
        milestone: 2,
        dependsOn: [2, 3],
      },
      {
        title: "交付说明与上线检查",
        description: "写清怎么用、已知问题、回滚方式。",
        inputs: "联调结果；产物清单",
        scope: "交付文档、上线检查表",
        nonScope: "代码改动",
        acceptance: "1. 使用说明覆盖主流程\n2. 已知问题逐条列出\n3. 回滚步骤可执行",
        priority: "P1",
        weight: 1,
        milestone: 2,
        dependsOn: [4],
      },
    ],
  },
  {
    id: "content",
    name: "内容创作",
    tagline: "资料 → 初稿 → 视觉 → 校对，事实与版本都可追溯",
    minutes: 3,
    charter: {
      goal: "完成<内容标题>的终稿，事实可核对、风格统一、可直接发布。",
      targetUsers: "<填写读者：他们为什么读、读完做什么>",
      scope: "资料收集、结构、初稿、视觉、校对。",
      nonGoals: "渠道投放、付费推广、衍生产品。",
      constraints: "事实必须有来源；引用需可追溯；不使用未授权素材。",
      acceptance:
        "1. 所有关键事实有来源链接\n2. 结构符合约定大纲\n3. 校对后无错别字与事实错误",
    },
    milestones: ["M1 · 资料与结构", "M2 · 成稿", "M3 · 校对与发布"],
    tasks: [
      {
        title: "资料收集与事实核对",
        description: "收集一手资料，标注每条事实的来源。",
        inputs: "选题说明",
        scope: "资料清单与来源表",
        nonScope: "写作",
        acceptance: "1. 关键事实逐条有来源\n2. 存疑处单独列出\n3. 无未经验证的数据",
        priority: "P0",
        weight: 2,
        milestone: 0,
      },
      {
        title: "确定大纲与结构",
        description: "给出章节结构与每节要表达的核心观点。",
        inputs: "资料清单",
        scope: "大纲文档",
        nonScope: "正文",
        acceptance: "1. 每节有一句话主旨\n2. 逻辑顺序可被读者跟随\n3. 负责人确认",
        priority: "P0",
        weight: 1,
        milestone: 0,
        dependsOn: [0],
      },
      {
        title: "撰写初稿",
        description: "按大纲写完，先求完整再求精致。",
        inputs: "大纲；资料清单",
        scope: "正文初稿",
        nonScope: "配图与排版",
        acceptance: "1. 覆盖大纲全部章节\n2. 引用与来源对应\n3. 无明显事实错误",
        priority: "P0",
        weight: 3,
        milestone: 1,
        dependsOn: [1],
      },
      {
        title: "视觉与配图",
        description: "配图、封面与版式，保证与文字口径一致。",
        inputs: "初稿",
        scope: "图片与版式文件",
        nonScope: "正文修改",
        acceptance: "1. 每张图有来源或授权\n2. 与正文口径一致\n3. 移动端可读",
        priority: "P1",
        weight: 2,
        milestone: 1,
        dependsOn: [1],
      },
      {
        title: "校对与事实复核",
        description: "逐句校对，并复核所有数据与引述。",
        inputs: "初稿；配图",
        scope: "校对记录与终稿",
        nonScope: "结构重写",
        acceptance: "1. 错别字为零\n2. 数据与来源一致\n3. 敏感表述已处理",
        priority: "P0",
        weight: 2,
        milestone: 2,
        dependsOn: [2, 3],
      },
      {
        title: "发布物料准备",
        description: "标题、摘要、封面文案与各渠道版本。",
        inputs: "终稿",
        scope: "发布物料",
        nonScope: "投放执行",
        acceptance: "1. 每个渠道一版\n2. 标题与正文一致\n3. 链接与二维码可用",
        priority: "P1",
        weight: 1,
        milestone: 2,
        dependsOn: [4],
      },
    ],
  },
  {
    id: "competition",
    name: "竞赛项目",
    tagline: "评分点 → 产品 → 技术 → 包装，四条工作流并行推进",
    minutes: 3,
    charter: {
      goal: "完成<赛事名称>的参赛作品，覆盖评分要点并可现场演示。",
      targetUsers: "评审专家与赛事主办方",
      scope: "方案、原型、实现、作品书、演示材料。",
      nonGoals: "赛后运营、商业化落地。",
      constraints: "严格遵守赛程与格式要求；数据与引用可核查；演示环境提前演练。",
      acceptance:
        "1. 作品书符合格式要求\n2. 核心功能可现场演示\n3. 每个评分点都有对应证据",
    },
    milestones: ["M1 · 选题与方案", "M2 · 实现与材料", "M3 · 演练与提交"],
    tasks: [
      {
        title: "赛题拆解与评分点映射",
        description: "把评分细则逐条拆开，映射到具体交付物。",
        inputs: "赛事通知与评分细则",
        scope: "评分点映射表",
        nonScope: "方案设计",
        acceptance: "1. 每个评分点有对应交付物\n2. 权重明确\n3. 负责人确认",
        priority: "P0",
        weight: 2,
        milestone: 0,
      },
      {
        title: "产品方案与原型",
        description: "确定要解决什么问题、给谁、怎么用。",
        inputs: "评分点映射表",
        scope: "方案文档、原型",
        nonScope: "技术实现",
        acceptance: "1. 问题与用户明确\n2. 核心流程可演示\n3. 与评分点对齐",
        priority: "P0",
        weight: 3,
        milestone: 0,
        dependsOn: [0],
      },
      {
        title: "技术实现与数据",
        description: "做出可运行的原型，准备好演示数据。",
        inputs: "原型与方案",
        scope: "代码与数据",
        nonScope: "视觉包装",
        acceptance: "1. 核心流程可跑\n2. 演示数据可复现\n3. 无阻断性缺陷",
        priority: "P0",
        weight: 3,
        milestone: 1,
        dependsOn: [1],
      },
      {
        title: "视觉与包装",
        description: "界面、图表、PPT 视觉统一。",
        inputs: "方案与实现",
        scope: "视觉物料",
        nonScope: "技术改动",
        acceptance: "1. 风格统一\n2. 图表数据可核查\n3. 分辨率满足投影要求",
        priority: "P1",
        weight: 2,
        milestone: 1,
        dependsOn: [1],
      },
      {
        title: "作品书撰写",
        description: "按赛事格式撰写，所有结论有数据支撑。",
        inputs: "评分点映射；实现与数据",
        scope: "作品书",
        nonScope: "演示脚本",
        acceptance: "1. 格式合规\n2. 每个结论有出处\n3. 与产品实际能力一致",
        priority: "P0",
        weight: 3,
        milestone: 1,
        dependsOn: [2, 3],
      },
      {
        title: "演示与答辩演练",
        description: "写脚本、控时间、预设提问。",
        inputs: "作品书与演示环境",
        scope: "演示脚本与问答准备",
        nonScope: "产品改动",
        acceptance: "1. 时长符合要求\n2. 演示环境稳定\n3. 预设问题有答复",
        priority: "P1",
        weight: 2,
        milestone: 2,
        dependsOn: [4],
      },
    ],
  },
];

export function getTemplate(id: string | null | undefined) {
  if (!id || id === "blank") return null;
  return TEMPLATES.find((t) => t.id === id) ?? null;
}
