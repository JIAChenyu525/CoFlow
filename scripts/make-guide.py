# -*- coding: utf-8 -*-
"""
生成《CoFlow 使用指南》Word 文档。
运行：python scripts/make-guide.py
输出：docs/CoFlow-使用指南.docx
"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "CoFlow-使用指南.docx")

FONT = "微软雅黑"
MONO = "Consolas"
INK = RGBColor(0x17, 0x1A, 0x1F)
MUTED = RGBColor(0x5A, 0x60, 0x68)
ACCENT = RGBColor(0x0F, 0x5F, 0x5C)

doc = Document()

# ── 页面与基础样式 ───────────────────────────────────────────
sec = doc.sections[0]
sec.page_width = Cm(21)
sec.page_height = Cm(29.7)
sec.top_margin = Cm(2.4)
sec.bottom_margin = Cm(2.2)
sec.left_margin = Cm(2.6)
sec.right_margin = Cm(2.6)

normal = doc.styles["Normal"]
normal.font.name = FONT
normal.font.size = Pt(10.5)
normal.font.color.rgb = INK
normal.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
normal.paragraph_format.line_spacing = 1.45
normal.paragraph_format.space_after = Pt(6)


def _set_font(run, name=FONT, size=10.5, bold=False, color=None, mono=False):
    run.font.name = MONO if mono else name
    run.font.size = Pt(size)
    run.bold = bold
    if color is not None:
        run.font.color.rgb = color
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)


def shade(el, fill):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    el.append(shd)


def h1(text, num=None):
    doc.add_page_break()
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(10)
    r = p.add_run(f"{num}  {text}" if num else text)
    _set_font(r, size=19, bold=True, color=INK)
    # 标题下一条细线
    pPr = p._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "8")
    bottom.set(qn("w:space"), "6")
    bottom.set(qn("w:color"), "D2CCBE")
    pbdr.append(bottom)
    pPr.append(pbdr)
    return p


def h2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run(text)
    _set_font(r, size=13.5, bold=True, color=ACCENT)
    return p


def h3(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text)
    _set_font(r, size=11.5, bold=True, color=INK)
    return p


def para(text, size=10.5, color=None, bold=False, space_after=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    r = p.add_run(text)
    _set_font(r, size=size, bold=bold, color=color or INK)
    return p


def bullet(text, level=0):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.left_indent = Cm(0.75 + level * 0.6)
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(text)
    _set_font(r, size=10.5)
    return p


def numbered(text):
    p = doc.add_paragraph(style="List Number")
    p.paragraph_format.left_indent = Cm(0.75)
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(text)
    _set_font(r, size=10.5)
    return p


def code(lines, note=None):
    if isinstance(lines, str):
        lines = [lines]
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    shade(cell._tc.get_or_add_tcPr(), "F4F2EC")
    cell.paragraphs[0].text = ""
    for i, line in enumerate(lines):
        p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.2
        r = p.add_run(line)
        _set_font(r, size=9, mono=True)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    if note:
        para(note, size=9, color=MUTED)


def table(headers, rows, widths=None, font_size=9.5):
    tbl = doc.add_table(rows=1, cols=len(headers))
    tbl.style = "Table Grid"
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = tbl.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ""
        p = hdr[i].paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(h)
        _set_font(r, size=font_size, bold=True, color=INK)
        shade(hdr[i]._tc.get_or_add_tcPr(), "F1EEE6")
    for row in rows:
        cells = tbl.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            r = p.add_run(str(val))
            _set_font(r, size=font_size)
    if widths:
        for i, w in enumerate(widths):
            for row in tbl.rows:
                row.cells[i].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return tbl


def callout(title, text, tone="info"):
    fill = {"info": "E3F0EE", "warn": "FBF0DC", "danger": "FAE6E2"}[tone]
    tbl = doc.add_table(rows=1, cols=1)
    cell = tbl.cell(0, 0)
    shade(cell._tc.get_or_add_tcPr(), fill)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(title)
    _set_font(r, size=9.5, bold=True)
    p2 = cell.add_paragraph()
    p2.paragraph_format.space_after = Pt(0)
    r2 = p2.add_run(text)
    _set_font(r2, size=9.5, color=RGBColor(0x3A, 0x40, 0x48))
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def footer_pages():
    footer = sec.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    run._r.append(fld)


footer_pages()

# ── 封面 ─────────────────────────────────────────────────────
for _ in range(4):
    doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.LEFT
r = p.add_run("CoFlow")
_set_font(r, size=14, bold=True, color=ACCENT)

p = doc.add_paragraph()
r = p.add_run("使用指南")
_set_font(r, size=34, bold=True, color=INK)

p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(6)
r = p.add_run("让团队在同一份项目事实上分工、协作、交付")
_set_font(r, size=13, color=MUTED)

for _ in range(10):
    doc.add_paragraph()

meta = [
    ("文档版本", "1.0"),
    ("对应系统版本", "CoFlow v0.1（阶段一至阶段三）"),
    ("编写日期", "2026-11-12"),
    ("适用读者", "项目负责人、开发成员、评审、以及第一次使用系统的同学"),
]
tbl = doc.add_table(rows=0, cols=2)
tbl.style = "Table Grid"
for k, v in meta:
    cells = tbl.add_row().cells
    cells[0].width = Cm(4)
    cells[1].width = Cm(11)
    r = cells[0].paragraphs[0].add_run(k)
    _set_font(r, size=9.5, bold=True, color=MUTED)
    r2 = cells[1].paragraphs[0].add_run(v)
    _set_font(r2, size=9.5)

# ── 目录（静态） ─────────────────────────────────────────────
h1("目录")
toc = [
    ("一", "这是什么", "系统在解决什么问题，以及它不是什么"),
    ("二", "15 分钟上手", "从空数据库到跑通一次完整交付"),
    ("三", "项目管理", "章程、角色、任务状态机、讨论与验收"),
    ("四", "接入 Agent", "配对、授权目录、能力等级、三种执行方式"),
    ("五", "上下文包", "Agent 到底看到了什么，为什么这么裁"),
    ("六", "周报与指标", "每周用哪些数字判断这套流程值不值得用"),
    ("七", "协作与冲突", "工作声明、软锁与独占锁"),
    ("八", "安全与边界", "凭据、越界、已知限制"),
    ("九", "常见问题", "现象、原因、处理"),
]
for num, title, desc in toc:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    r = p.add_run(f"{num}、{title}")
    _set_font(r, size=12, bold=True)
    r2 = p.add_run(f"    {desc}")
    _set_font(r2, size=9.5, color=MUTED)

# ── 一、这是什么 ─────────────────────────────────────────────
h1("这是什么", "一")

h2("1.1  一句话")
para(
    "CoFlow 是一个「多人 + 多 AI Agent」的项目协作工作台：团队在同一空间设定目标、拆分任务、讨论问题，"
    "并把自己电脑上的 AI 工具接进来；平台持续把这些动作沉淀成结构化的事实，"
    "让每个 Agent 在开工前都知道「目标是什么、现在到哪一步、自己负责什么、哪些事不能重复做」。"
)

h2("1.2  它解决什么问题")
para("团队用 AI 干活时，真正卡住的通常不是模型能力，而是下面这几件事：")
table(
    ["断点", "具体表现", "CoFlow 的做法"],
    [
        ["工具孤岛", "每人用不同工具，上下文在各自电脑里", "Agent 通过统一租约领取上下文包"],
        ["信息失真", "进度散落在聊天、代码、文档里", "任务与产物构成当前事实，聊天只是过程"],
        ["目标漂移", "AI 只看到一句指令，看不到总目标", "章程版本化，每次派发都带上"],
        ["协作冲突", "多人同时改同一模块，互相覆盖", "工作声明 + 软锁/独占锁"],
        ["结果难验收", "Agent 说完成了，但没有证据", "完成必须关联产物与验收记录"],
    ],
    widths=[3.2, 6.4, 5.4],
)

h2("1.3  三层结构")
table(
    ["层", "内容", "作用"],
    [
        ["项目事实层", "章程、任务、决策、产物、验收、事件流", "唯一可信的项目状态"],
        ["上下文构建", "按任务裁剪出的上下文包（带 hash 与预算）", "Agent 只看到与它相关的最小必要信息"],
        ["执行通道", "设备、端点、租约、会话、结果回传", "把工作真正派出去，并把证据收回来"],
    ],
    widths=[3.4, 7.6, 4.0],
)

h2("1.4  它不做什么")
bullet("不替代 Git、专业设计软件或企业 IM。")
bullet("不接管你的模型账号，不读取、不保存任何 API Key。")
bullet("不让 Agent 自己把任务标成「已完成」——它只能提交到「待验收」。")
bullet("不做开放式全自动多 Agent 社会。所有派发都由人点击触发。")

# ── 二、15 分钟上手 ─────────────────────────────────────────
h1("15 分钟上手", "二")

h2("2.1  准备工作")
para("需要 Node.js 20 以上，以及一个可用的 PostgreSQL（14 以上）。本项目在 Windows + PostgreSQL 17 上开发。")
code(
    [
        "pnpm install                  # 安装依赖",
        "pnpm db:push                  # 建表",
        "pnpm db:seed                  # 灌入演示数据（可选）",
        "pnpm dev                      # 启动，默认 http://localhost:3000",
    ],
    note="首次建库可参考 scripts/init-db.sql；连接串写在 .env 的 DATABASE_URL 里。",
)

h2("2.2  五步跑通")
para("打开浏览器访问 http://localhost:3000，登录后进入「上手」页面（/start）。五步的状态全部来自系统真实数据：")

table(
    ["步骤", "你要做的", "完成判定"],
    [
        ["1  建一个项目", "填目标、范围、非目标、验收标准", "你所属的项目数 > 0"],
        ["2  连接一台设备", "在目标电脑跑连接器，用配对码授权", "未撤销的设备数 > 0"],
        ["3  授权目录", "在 /agent 给端点指定可读写的目录", "端点的 allowedPaths 非空"],
        ["4  有一个已就绪任务", "建任务并补齐输入与验收标准", "项目里有 READY 及之后状态的任务"],
        ["5  跑通一次交付", "派发 → 领取 → 执行 → 提交 → 验收", "你负责/验收的任务通过验收，或你的设备提交过"],
    ],
    widths=[3.6, 6.4, 5.0],
)

h3("第 2 步的命令")
code(
    [
        "npx coflow-connector login",
        "",
        "# 终端会显示一个形如 ABCD-2345 的配对码",
        "# 在浏览器打开 /agent，输入配对码，点「授权这台设备」",
    ]
)

h3("第 5 步的命令")
code(
    [
        "cd 你的工作目录",
        "coflow pull        # 半自动：把任务包写到 .coflow/task-<id>.md",
        "coflow run         # 自动：直接调用 Agent 执行（需要 AUTO 端点）",
        "coflow submit --summary \"做了什么\" --check \"pnpm test\"",
    ]
)

h2("2.3  常见的卡点")
table(
    ["现象", "原因", "处理"],
    [
        ["任务移不到「已就绪」", "输入材料或验收标准还空着", "补齐后再点「标记就绪」"],
        ["页面上没有「派发」卡片", "任务不是「已就绪」，或项目里没有可用端点", "先移状态；再连设备并授权目录"],
        ["连接器连不上", "本机工具不可调用，或目录未授权", "运行 coflow doctor 看具体缺什么"],
        ["登录后仍是别人的身份", "浏览器残留了旧会话", "点右上角「退出」重新登录"],
    ],
    widths=[4.6, 6.0, 4.4],
)

# ── 三、项目管理 ─────────────────────────────────────────────
h1("项目管理", "三")

h2("3.1  创建项目与章程")
para("创建项目不是建一个群聊，而是写一份机器可读的项目章程。第一步可以选模板：软件小团队、内容创作、"
     "竞赛项目，各自带一份章程与 6 个任务（含依赖关系）；也可以从空白开始。"
     "模板只预填，生成的任务停在「待认领」，负责人与就绪状态仍要人推进。")
para("系统会要求填清这些字段：")
table(
    ["字段", "说明", "示例"],
    [
        ["项目目标", "希望达成的结果，不是动作列表", "完成双人打卡应用首个可用版本"],
        ["目标用户", "为谁解决什么问题", "需要共同记录生活的双人用户"],
        ["交付范围", "本阶段必须包含什么", "打卡、提醒、图片上传、共享"],
        ["非目标", "明确暂不做什么，防止范围漂移", "社区、公开动态、复杂商城"],
        ["硬性约束", "技术、设计、时间或合规约束", "双端适配、粉色主题、不使用 emoji"],
        ["验收标准", "逐条可检查的条件", "核心流程在一周真实使用中无阻断"],
    ],
    widths=[3.2, 6.4, 5.4],
)
callout(
    "章程可以改，但不能偷偷改",
    "修改章程会生成新版本（v1 → v2），旧版本永久保留，并在事件流里留下记录。"
    "进行中的任务会提示需要重新确认上下文——因为目标变了，之前拿到的上下文就过期了。",
)

h2("3.2  角色与权限")
table(
    ["角色", "能做什么", "不能做什么"],
    [
        ["发起人 OWNER", "改目标、改角色、最终验收", "—"],
        ["负责人 LEAD", "拆任务、派发、改阶段、验收", "改成员角色（仅发起人）"],
        ["成员 MEMBER", "建任务、发表讨论、提交产物", "下验收结论、退回"],
        ["评审 REVIEWER", "做验收结论、退回", "改项目目标"],
        ["观察员 OBSERVER", "只读", "任何写入"],
    ],
    widths=[3.4, 7.2, 4.4],
)
para("原则：Agent 的权限不得超过它所属的成员。观察员的端点连租约都领不到。", size=9.5, color=MUTED)

h2("3.3  任务与状态机")
para("任务是协作与授权的最小单元。状态不是随便点的，每一次转换都有前置条件：")
table(
    ["状态", "含义", "进入条件"],
    [
        ["待澄清 CLARIFY", "还缺信息", "新建任务的默认状态"],
        ["待认领 UNCLAIMED", "可以认领了", "输入材料与验收标准都不为空"],
        ["已就绪 READY", "可以开工", "已指定负责人"],
        ["进行中 IN_PROGRESS", "正在做", "人工开始，或 Agent 接受租约"],
        ["待验收 IN_REVIEW", "等结论", "至少一项产物，或填写无产物说明"],
        ["已完成 DONE", "通过验收", "具备验收权的人下结论"],
        ["已阻塞 BLOCKED", "等外部支持", "必须写清原因与所需支持"],
        ["已暂停 / 已取消", "旁路状态", "—"],
    ],
    widths=[3.2, 4.4, 7.4],
)
callout(
    "退回是验收动作，不是撤回",
    "「待验收 → 进行中」只有发起人、负责人、评审能操作。普通成员发现自己交错了，只能标记阻塞或取消，"
    "不能自己把任务退回原状。这条规则在服务端强制，不只是隐藏按钮。",
    tone="warn",
)
para("已完成的任务需要返工时，系统会创建新的修订轮次（revision + 1），原验收记录保留。", size=9.5, color=MUTED)

h2("3.4  讨论与决策")
para("聊天负责交流意图，不代表项目进度。讨论出来的结论需要显式沉淀：")
numbered("在消息右侧点「形成决策」。")
numbered("填写标题、结论、理由、影响范围。")
numbered("发起人或负责人点「确认并写入事实层」。")
para("未确认的提案不会进入 Agent 的上下文——避免把没定论的观点当成指令。", size=9.5, color=MUTED)

h2("3.5  产物与验收")
para("完成必须有证据。验收页采用「标准 — 证据 — 结论」三栏：")
table(
    ["栏", "内容", "来源"],
    [
        ["标准", "逐条验收条件", "任务定义"],
        ["证据", "提交、测试报告、文件、链接", "产物中心"],
        ["结论", "通过 / 补充材料 / 退回", "具备验收权的人"],
    ],
    widths=[3.0, 7.0, 5.0],
)
para("自动检查可以提供证据（例如测试退出码），但不能替人下结论。")

# ── 四、接入 Agent ───────────────────────────────────────────
h1("接入 Agent", "四")

h2("4.1  零密钥接入")
para("成员不需要理解、复制或提交任何模型 API Key。只要本机工具已经能正常使用，就可以把它接到项目里。")
table(
    ["层次", "谁负责", "具体内容"],
    [
        ["工具授权", "原工具自己", "Claude Code 登录没登录、用哪个模型，平台不碰"],
        ["项目授权", "CoFlow", "这个端点能进哪个项目、读哪些任务、写哪些目录"],
    ],
    widths=[3.2, 4.0, 7.8],
)

h2("4.2  配对流程")
numbered("在目标电脑执行 coflow login，终端显示配对码。")
numbered("浏览器打开 /agent，输入配对码，点「授权这台设备」。")
numbered("连接器自动完成配对，令牌保存在本机（权限 0600）。")
para("撤销设备只需在 /agent 点「撤销」。撤销后连接器所有请求返回 401，但你原来的编辑器完全不受影响。")

h2("4.3  授权目录")
para("没有授权目录等于只读。自动执行必须先在边界内：")
bullet("在 /agent 端点那一行点「授权目录」，填绝对路径或相对路径，用逗号分隔。")
bullet("连接器执行前会检查目录是否为空；事后还会用 git 核对有没有越界修改。")
bullet("上下文包里的 denied_paths（.env、*.pem、*.key）即使落在授权目录内也会被拦截。")

h2("4.4  能力等级")
table(
    ["等级", "判定条件", "能做什么"],
    [
        ["自动接入 AUTO", "工具存在、能跑、支持无头调用", "coflow run 全自动执行"],
        ["半自动 SEMI", "装了但跑不动，或该版本无无头能力", "coflow pull + 人工执行 + coflow submit"],
        ["手动 MANUAL", "找不到可调用的工具", "在网页上手动提交产物"],
    ],
    widths=[3.4, 7.0, 4.6],
)
para("检测命令：coflow doctor。加 --update 会把结果同步到服务端，网页上的能力标签与降级原因一起更新。"
     "加 --deep 会真的调用一次模型验证（会花钱，默认关闭）。", size=9.5, color=MUTED)

h2("4.5  三种执行方式")
h3("手动")
para("不接设备也能用完整流程：建任务 → 自己做 → 在网页上提交产物 → 验收。")

h3("半自动（推荐先用这个）")
code(
    [
        "coflow pull                       # 领取任务，上下文包写到 .coflow/task-<id>.md",
        "# 打开任务包，用你习惯的工具把活干完",
        "coflow submit --summary \"...\" --check \"pnpm test\"",
    ]
)

h3("自动")
code(
    [
        "coflow run                        # 领取并直接执行，结束后自动提交",
        "coflow run --timeout 30 --budget 2   # 超时 30 分钟、预算 2 美元",
    ],
    note="自动执行有三道闸：端点能力必须是 AUTO、必须已授权目录、执行后必须通过 git 越界检查。",
)

h2("4.6  命令速查")
table(
    ["命令", "作用"],
    [
        ["coflow login [--tool <id>] [--cmd \"...\"]", "配对设备；--tool 可选 claude-code / mock-agent / generic"],
        ["coflow status", "查看设备、端点、授权目录、降级原因"],
        ["coflow doctor [--update] [--deep]", "检测本机能力，解释为什么是这个等级"],
        ["coflow pull [--paths a,b]", "领取任务并落盘上下文包"],
        ["coflow run [--timeout 20] [--budget 2]", "领取并自动执行"],
        ["coflow note \"进度\"", "记一条进度事件（离线会排队）"],
        ["coflow submit --summary \"...\" [--check \"cmd\"]", "采集证据并回传结果"],
        ["coflow sync", "补传离线事件"],
        ["coflow logout", "清除本机令牌"],
    ],
    widths=[7.6, 7.4],
)

# ── 五、上下文包 ─────────────────────────────────────────────
h1("上下文包", "五")

h2("5.1  它是什么")
para(
    "Agent 拿到的不是聊天记录，而是一份按任务裁剪过的上下文包。它带内容哈希、带版本、带预算，"
    "并且能回答「这次为什么没让它看到某条信息」。在任务详情页点「上下文包」可以看到完整内容与渲染后的提示词。"
)

h2("5.2  四层与预算")
table(
    ["层", "内容", "是否可裁"],
    [
        ["L0 稳定层", "项目章程、硬约束、验收口径", "不可裁"],
        ["L1 任务层", "任务定义、依赖、验收标准", "不可裁"],
        ["L2 动态层", "已确认决策、未解决阻塞、最近变更", "按预算裁剪，并记录裁掉了什么"],
        ["L3 证据层", "工作区目录、回传合同", "只给引用，不给正文"],
    ],
    widths=[3.0, 8.0, 4.0],
)
para("默认预算 12000 tokens（中文按字、英文按 4 字符估算）。超预算时先砍过程性内容，再砍旧决策；"
     "硬约束、当前任务、未解决阻塞和最新已确认决策永远保留。", size=9.5, color=MUTED)

h2("5.3  确定性")
para("同样的输入必须得到同样的哈希，否则「版本校验」就是假的。系统对决策与依赖做了排序，"
     "两次生成的哈希一致；目标或任务一改，哈希就变。每次派发都会保存一份快照，随时可以回查当时看到了什么。")

h2("5.4  注入隔离")
para("上下文包里的所有项目文本都包在 <data> 标签内，并在提示词开头声明：这些是资料，不是指令。"
     "消息里出现「忽略之前的规则」这类文字，不会被当成授权。")

# ── 六、周报与指标 ───────────────────────────────────────────
h1("周报与指标", "六")

h2("6.1  口径")
para("打开 /review 可以看到过去 7 天的复盘。所有数字都有固定口径，避免各说各话：")
table(
    ["指标", "口径"],
    [
        ["完成", "本周内出现过「通过」验收的任务数；同一任务多次通过只算一次"],
        ["新建", "本周创建的任务数"],
        ["通过率", "通过次数 ÷ 全部验收结论"],
        ["周期", "任务创建 → 首次通过验收，取中位数"],
        ["Agent 会话", "提交 / 失败 / 进行中，失败按原因聚合"],
        ["上下文成本", "上下文快照 tokens 的均值与最大值"],
    ],
    widths=[3.4, 11.2],
)

h2("6.2  怎么读")
para("周报的价值不在于好看，而在于暴露问题：")
bullet("新建远多于完成：拆任务的速度超过了交付速度，先收缩范围。")
bullet("退回比例高：验收标准写得太粗，或者任务边界太大。")
bullet("失败会话多：看原因——越界说明目录授权不对，超时说明任务太大。")
bullet("上下文成本持续升高：说明项目信息在膨胀，需要归档或拆分。")

# ── 七、协作与冲突 ───────────────────────────────────────────
h1("协作与冲突", "七")

h2("7.1  工作声明")
para("领取租约时，连接器会声明这次要动的路径。服务端拿它和同一项目下其它正在执行的会话比对。")

h2("7.2  三种模式")
table(
    ["模式", "触发条件", "行为"],
    [
        ["独占锁", "声明了高风险的路径（迁移目录、package.json、schema.prisma、.env 等）", "与正在执行的会话重叠时直接拒绝领取"],
        ["软锁", "声明了普通目录", "允许并行，但双方都会看到重叠提示"],
        ["自由", "没有声明任何路径", "直接放行"],
    ],
    widths=[2.8, 8.0, 4.2],
)
para("项目工作台右侧会列出所有正在执行的会话及其声明的路径，冲突不需要猜。", size=9.5, color=MUTED)

h2("7.3  派发推荐")
para("派发卡片会按「谁更适合现在接这个任务」排序，并逐条给出理由：能力等级、是否空闲、"
     "授权目录是否覆盖任务范围、与执行中会话的路径冲突、近 30 天成功率。最终仍由人点击确认。")

h2("7.4  风险提醒")
para("项目工作台右侧按确定性规则列出风险。规则对所有人一致：同一批数据永远得到同样的告警，"
     "不是模型主观判断哪里有问题。")
table(
    ["规则", "阈值", "级别"],
    [
        ["逾期", "到期日已过；逾期 2 天以上升为高", "中 / 高"],
        ["阻塞停滞", "阻塞超过 3 天", "高"],
        ["待验收堆积", "等待超过 2 天；5 天以上升为高", "中 / 高"],
        ["进行中无更新", "超过 5 天没有变更", "中"],
        ["待澄清", "超过 3 天仍缺输入或验收标准", "低"],
        ["依赖已满足", "前置任务全部完成，任务可以开始", "低（正向提醒）"],
    ],
    widths=[3.2, 8.4, 3.0],
)

# ── 八、安全与边界 ───────────────────────────────────────────
h1("安全与边界", "八")

h2("8.1  凭据")
bullet("模型 API Key 留在原工具的配置或系统安全存储里，CoFlow 不读取、不上传。")
bullet("设备令牌在服务端只存 sha256，即使数据库泄露也拿不到可用令牌。")
bullet("撤销设备只断开协作通道，不影响原工具在本机继续使用。")

h2("8.2  越界")
bullet("执行前：没有授权目录就拒绝自动执行。")
bullet("执行后：用 git status 逐个比对授权目录与黑名单，越界即判定失败、租约作废、任务留在进行中。")
bullet("结论以工作区实际改动为准，不听 Agent 自述。")

h2("8.3  已知限制")
table(
    ["限制", "说明"],
    [
        ["没有实时推送", "租约用长轮询（最长 25 秒），不是 WebSocket"],
        ["没有持续锁", "锁只在领取时判定一次，不做续期"],
        ["没有实时审批", "高风险动作靠目录白名单与事后拒绝，不是执行中弹窗"],
        ["没有文件上传", "产物是可定位的引用：提交号、路径、链接"],
        ["登录只有验证码", "没有密码、找回密码、多因素"],
    ],
    widths=[3.6, 11.0],
)

# ── 九、常见问题 ─────────────────────────────────────────────
h1("常见问题", "九")

table(
    ["现象", "原因", "处理"],
    [
        ["coflow doctor 显示 SEMI", "工具装了但跑不动，或缺无头旗标", "按 doctor 的提示修；修好后 --update 同步"],
        ["领取任务返回 409", "任务已有未结束的租约，或路径独占冲突", "等对方结束，或换不重叠的声明"],
        ["提交返回 session_stale", "心跳超过 5 分钟", "重新领取任务"],
        ["上下文哈希对不上", "目标或任务在派发后被改过", "重新生成上下文，不要沿用旧的"],
        ["401 unauthorized", "设备被撤销，或令牌文件丢失", "重新 coflow login"],
        ["开发服务器报 Jest worker 错误", "长时间热更新后残留状态", "停止服务，删除 .next，重新 pnpm dev"],
    ],
    widths=[4.4, 6.2, 4.0],
)

# ── 附录 ─────────────────────────────────────────────────────
h1("附录 A  事件类型")
table(
    ["事件", "触发时机"],
    [
        ["project.created / charter.updated", "建项目、改章程（生成新版本）"],
        ["task.created / task.status_changed / task.blocked", "任务生命周期"],
        ["decision.confirmed", "决策确认，进入事实层"],
        ["artifact.submitted", "产物提交"],
        ["review.completed", "验收结论"],
        ["agent.lease_offered / agent.session_started", "派发与开工"],
        ["agent.progress", "Agent 进程性事件（离线会排队补传）"],
        ["agent.session_ended", "会话结束（提交 / 失败 / 超时 / 越界）"],
        ["permission.changed", "角色或权限变化"],
    ],
    widths=[8.4, 6.2],
)

h1("附录 B  术语表")
table(
    ["术语", "含义"],
    [
        ["项目事实层", "由已确认的目标、任务、决策、产物、验收与事件构成的可信数据层"],
        ["事件", "对一次已发生动作的标准化、可追溯记录，不可修改"],
        ["上下文包", "为特定任务筛选出的最小必要项目资料，带哈希与预算"],
        ["租约", "有时效、可撤销、绑定上下文版本的一次执行授权"],
        ["会话", "一次具体的执行过程，靠心跳维持"],
        ["工作声明", "执行前声明本次要动的路径范围"],
        ["端点", "某个成员电脑上一个可连接的工具实例"],
        ["能力降级", "工具无法自动执行时，回退到半自动或手动"],
    ],
    widths=[3.6, 11.0],
)

# ── 结尾 ─────────────────────────────────────────────────────
doc.add_page_break()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("这套系统的价值不在功能多少，而在两件事：\n同一份事实，以及每一次交付都留得下证据。")
_set_font(r, size=11, color=MUTED)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
doc.save(OUT)
print("saved:", OUT)
