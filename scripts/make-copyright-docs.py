# -*- coding: utf-8 -*-
"""
生成软件著作权登记的两份核心材料：
  1. 源代码文档（前后各 30 页，共 60 页，每页 50 行）
  2. 用户手册（含真实界面截图）
输出到 D:\\作业\\提交东西\\
运行：python scripts/make-copyright-docs.py
"""
import os
import re
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = r"D:\CoFlow"
OUT = r"D:\作业\提交东西"
SHOTS = os.path.join(OUT, "_shots")

SOFT_NAME = "CoFlow 项目事实层"
VERSION = "V1.0"
AUTHOR = "贾晨宇"
DATE_CN = "2026年11月13日"
FONT_CN = "宋体"
FONT_MONO = "Consolas"

# ── 通用工具 ────────────────────────────────────────────────────────────────


def set_run_font(run, name, size, bold=False, color=None, mono=False):
    run.font.name = FONT_MONO if mono else name
    run.font.size = Pt(size)
    run.bold = bold
    if color:
        run.font.color.rgb = color
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)


def page_header(section, text):
    p = section.header.paragraphs[0]
    p.text = ""
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    set_run_font(r, FONT_CN, 9, color=RGBColor(0x44, 0x40, 0x3C))
    pPr = p._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "4")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "999999")
    pbdr.append(bottom)
    pPr.append(pbdr)


def page_footer(section):
    p = section.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run._r.append(OxmlElement("w:fldSimple"))
    run._r[-1].set(qn("w:instr"), "PAGE")
    set_run_font(run, FONT_CN, 9)


def set_exact_spacing(p, pts):
    p.paragraph_format.line_spacing = Pt(pts)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)


# ── 一、源代码文档 ──────────────────────────────────────────────────────────

FILE_ORDER = [
    ("prisma/schema.prisma", "数据模型定义：项目、成员、任务、决策、产物、验收、事件流、Agent 租约与会话"),
    ("prisma/seed.ts", "演示数据初始化脚本"),
    ("src/lib/db.ts", "数据库连接单例"),
    ("src/lib/auth.ts", "账号会话与项目角色权限判定"),
    ("src/lib/task-state.ts", "任务状态机与进度计算"),
    ("src/lib/constants.ts", "状态、角色、产物类型等枚举的中文标签与语义色"),
    ("src/lib/events.ts", "事件流写入与事件摘要"),
    ("src/lib/context.ts", "上下文包构建：分层、预算裁剪、内容哈希"),
    ("src/lib/context-data.ts", "上下文包的数据装配"),
    ("src/lib/locks.ts", "工作声明与独占锁、软锁判定"),
    ("src/lib/dispatch.ts", "派发推荐评分与理由生成"),
    ("src/lib/dispatch-data.ts", "派发推荐的数据装配"),
    ("src/lib/risks.ts", "项目风险规则：逾期、阻塞停滞、待验收堆积等"),
    ("src/lib/weekly.ts", "周报指标汇总与事实性叙述生成"),
    ("src/lib/weekly-data.ts", "周报数据装配"),
    ("src/lib/onboarding.ts", "上手流程步骤判定"),
    ("src/lib/templates.ts", "项目模板：章程与任务清单预置"),
    ("src/lib/ds-map.ts", "业务枚举到设计系统组件的映射"),
    ("src/lib/pairing.ts", "设备配对码生成与校验"),
    ("src/lib/rate-limit.ts", "接口频次限制"),
    ("src/lib/device-auth.ts", "设备令牌鉴权"),
    ("src/lib/mailer.ts", "登录验证码邮件发送"),
    ("src/components/ds.tsx", "设计系统组件库：状态徽标、优先级、角色、能力等级、卡片、进度条等"),
    ("src/components/ui.tsx", "通用界面基础组件"),
    ("src/components/app-header.tsx", "全局顶栏"),
    ("src/components/top-nav.tsx", "顶部导航"),
    ("src/components/project-nav.tsx", "项目内导航"),
    ("src/components/conversation.tsx", "项目频道对话与形成决策"),
    ("src/components/task-panels.tsx", "任务状态变更、产物提交、验收面板"),
    ("src/components/task-edit.tsx", "任务定义编辑"),
    ("src/components/task-create-dialog.tsx", "新建任务弹窗"),
    ("src/components/dispatch-lease.tsx", "派发卡片与推荐理由"),
    ("src/components/context-panels.tsx", "上下文包快照保存"),
    ("src/components/agent-panels.tsx", "设备配对与端点授权"),
    ("src/components/project-settings-panels.tsx", "章程修订、阶段切换、角色调整"),
    ("src/components/new-project-wizard.tsx", "新建项目五步向导"),
    ("src/components/login-form.tsx", "登录表单"),
    ("src/components/decision-actions.tsx", "决策确认"),
    ("src/components/copy-button.tsx", "复制按钮"),
    ("src/app/layout.tsx", "全局布局"),
    ("src/app/page.tsx", "项目大厅页面"),
    ("src/app/login/page.tsx", "登录页面"),
    ("src/app/agent/page.tsx", "Agent 连接页面"),
    ("src/app/review/page.tsx", "周报页面"),
    ("src/app/start/page.tsx", "上手流程页面"),
    ("src/app/docs/protocol/page.tsx", "事件协议说明页面"),
    ("src/app/projects/new/page.tsx", "新建项目页面"),
    ("src/app/projects/[projectId]/layout.tsx", "项目布局与侧栏"),
    ("src/app/projects/[projectId]/page.tsx", "项目工作台页面"),
    ("src/app/projects/[projectId]/tasks/page.tsx", "任务看板页面"),
    ("src/app/projects/[projectId]/tasks/[taskId]/page.tsx", "任务详情页面"),
    ("src/app/projects/[projectId]/tasks/[taskId]/context/page.tsx", "上下文包预览页面"),
    ("src/app/projects/[projectId]/artifacts/page.tsx", "产物与验收页面"),
    ("src/app/projects/[projectId]/timeline/page.tsx", "决策与时间线页面"),
    ("src/app/projects/[projectId]/settings/page.tsx", "项目设置页面"),
    ("src/app/actions/auth.ts", "登录、登出、验证码服务端动作"),
    ("src/app/actions/projects.ts", "项目创建、章程修订、阶段与角色变更"),
    ("src/app/actions/tasks.ts", "任务创建、更新、状态流转"),
    ("src/app/actions/artifacts.ts", "产物提交"),
    ("src/app/actions/reviews.ts", "人工验收"),
    ("src/app/actions/decisions.ts", "决策提案与确认"),
    ("src/app/actions/messages.ts", "频道消息"),
    ("src/app/actions/context.ts", "上下文快照保存"),
    ("src/app/api/device/pair/start/route.ts", "设备配对：发起"),
    ("src/app/api/device/pair/token/route.ts", "设备配对：换取令牌"),
    ("src/app/api/device/pair/approve/route.ts", "设备配对：人工授权"),
    ("src/app/api/device/me/route.ts", "设备与端点信息"),
    ("src/app/api/devices/[id]/route.ts", "撤销设备"),
    ("src/app/api/endpoints/[id]/route.ts", "端点目录授权与能力上报"),
    ("src/app/api/tasks/[id]/lease/route.ts", "任务派发：生成租约与上下文快照"),
    ("src/app/api/leases/pending/route.ts", "连接器领取租约"),
    ("src/app/api/leases/[id]/accept/route.ts", "接受租约并建立会话"),
    ("src/app/api/sessions/[id]/heartbeat/route.ts", "会话心跳"),
    ("src/app/api/sessions/[id]/events/route.ts", "批量事件回传（幂等）"),
    ("src/app/api/sessions/[id]/result/route.ts", "执行结果回传"),
    ("src/app/api/sessions/[id]/fail/route.ts", "会话失败收尾"),
    ("connector/bin/coflow.mjs", "连接器命令行入口"),
    ("connector/src/cli.mjs", "连接器命令实现：登录、领取、执行、回传、同步"),
    ("connector/src/adapters.mjs", "工具适配器注册表"),
    ("connector/src/probe.mjs", "本机工具能力探测"),
    ("connector/src/evidence.mjs", "git 证据采集与检查命令执行"),
    ("connector/src/outbox.mjs", "本地事件队列与补传"),
    ("connector/src/api.mjs", "接口客户端"),
    ("connector/src/config.mjs", "本机配置存取"),
    ("connector/src/render.mjs", "上下文包渲染为任务文件"),
    ("connector/tools/mock-agent.mjs", "协议验证用的命令行工具替身"),
    ("src/app/actions/session.ts", "开发环境身份切换（仅本地演示）"),
]

BANNER = [
    "// ============================================================",
    f"// 软件名称：{SOFT_NAME}",
    f"// 软件版本：{VERSION}",
    f"// 开发作者：{AUTHOR}",
    f"// 完成日期：{DATE_CN}",
    "// 开发工具：Next.js 16、TypeScript、Prisma、PostgreSQL",
    "// 运行环境：Windows 10/11，Node.js 20 及以上，PostgreSQL 14 及以上",
    "// 功能概述：面向 2—8 人小团队的多人多 Agent 项目协作工作台，提供项目章程、",
    "//           任务状态机、决策与验收、上下文包构建、Agent 设备接入与任务执行",
    "//           等能力，使人与各自的 AI 工具在同一份项目事实上协作。",
    "// ============================================================",
    "",
]


def file_header(path, desc):
    return [
        "// ============================================================",
        f"// 文件名：{path}",
        f"// 功能说明：{desc}",
        f"// 作者：{AUTHOR}　　开发日期：2026-11-12　　版本：{VERSION}",
        "// ============================================================",
        "",
    ]


def strip_comments(lines):
    """去掉代码注释（保留文件头与软件头这类由生成器添加的说明块）。"""
    out = []
    in_block = False
    for raw in lines:
        line = raw
        i = 0
        res = []
        quote = None
        while i < len(line):
            ch = line[i]
            if in_block:
                j = line.find("*/", i)
                if j == -1:
                    i = len(line)
                    break
                in_block = False
                i = j + 2
                continue
            if quote:
                res.append(ch)
                if ch == "\\":
                    if i + 1 < len(line):
                        res.append(line[i + 1])
                        i += 2
                        continue
                if ch == quote:
                    quote = None
                i += 1
                continue
            if ch in "\"'`":
                quote = ch
                res.append(ch)
                i += 1
                continue
            if ch == "/" and i + 1 < len(line) and line[i + 1] == "/":
                i = len(line)
                break
            if ch == "/" and i + 1 < len(line) and line[i + 1] == "*":
                in_block = True
                i += 2
                continue
            res.append(ch)
            i += 1
        cleaned = "".join(res).rstrip()
        if cleaned.strip():
            out.append(cleaned)
    return out


def read_source(path):
    try:
        with open(os.path.join(ROOT, path), "r", encoding="utf-8") as f:
            return f.read().replace("\t", "    ").splitlines()
    except Exception:
        return [f"// （文件 {path} 读取失败）"]


def build_source_lines():
    lines = list(BANNER)
    for path, desc in FILE_ORDER:
        if not os.path.exists(os.path.join(ROOT, path)):
            continue
        lines.extend(file_header(path, desc))
        lines.extend(strip_comments(read_source(path)))
    # 去掉空行：登记要求每页不少于 50 行，空行不计入
    return [l for l in lines if l.strip()]


def make_source_doc():
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.top_margin = sec.bottom_margin = Cm(1.5)
    sec.left_margin = sec.right_margin = Cm(1.5)
    page_header(sec, f"{SOFT_NAME}　{VERSION}　源程序")
    page_footer(sec)

    style = doc.styles["Normal"]
    style.font.name = FONT_MONO
    style.font.size = Pt(8.5)
    style.element.rPr.rFonts.set(qn("w:eastAsia"), FONT_MONO)

    all_lines = build_source_lines()
    total = len(all_lines)
    half = 50 * 30  # 1500 行

    if total <= half * 2:
        first, last = all_lines, []
    else:
        first = all_lines[:half]
        # 尾部 30 页：从一个距文末 1500—1550 行的文件头开始，
        # 保证末页以完整文件头开头且不少于 50 行。
        headers = [i for i, l in enumerate(all_lines) if l.startswith("// 文件名：")]
        # 选一个靠近文末、且其后仍有 50—120 行的文件头，作为第 60 页的首行
        cand = [i for i in headers if 50 <= total - i <= 120 and i >= 1450]
        if cand:
            h = max(cand)
            last = all_lines[max(0, h - 1 - 1450):]
        else:
            last = all_lines[-half:]

    pages = [first[i:i + 50] for i in range(0, len(first), 50)]
    if last:
        tail_pages = [last[i:i + 50] for i in range(0, 1450, 50)]
        tail_pages.append(last[1450:])
        pages += [p for p in tail_pages if p]

    for pi, chunk in enumerate(pages):
        for li, line in enumerate(chunk):
            p = doc.add_paragraph()
            set_exact_spacing(p, 13)
            r = p.add_run(line if line.strip() else " ")
            set_run_font(r, FONT_MONO, 8.5, mono=True)
        if pi != len(pages) - 1:
            br = doc.add_paragraph()
            br.add_run().add_break(WD_BREAK.PAGE)

    out = os.path.join(OUT, "CoFlow-源代码文档.docx")
    doc.save(out)
    return out, total, len(pages)


# ── 二、用户手册 ────────────────────────────────────────────────────────────


def add_heading(doc, text, size=16, space_before=14):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run(text)
    set_run_font(r, FONT_CN, size, bold=True)
    return p


def add_para(doc, text, size=10.5, bold=False, indent=0, space_after=3):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.05
    if indent:
        p.paragraph_format.left_indent = Cm(indent)
    r = p.add_run(text)
    set_run_font(r, FONT_CN, size, bold=bold)
    return p


def add_steps(doc, items):
    for i, t in enumerate(items, 1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.6)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.05
        r = p.add_run(f"（{i}）{t}")
        set_run_font(r, FONT_CN, 10.5)


def add_bullets(doc, items):
    for t in items:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.6)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.05
        r = p.add_run(f"· {t}")
        set_run_font(r, FONT_CN, 10.5)


def add_figure(doc, image, caption, width_cm=11.5):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(image, width=Cm(width_cm))
    c = doc.add_paragraph()
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    c.paragraph_format.space_after = Pt(6)
    r = c.add_run(caption)
    set_run_font(r, FONT_CN, 9, color=RGBColor(0x55, 0x55, 0x55))


def page_break(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)



SECTIONS = [
    {
        "title": "3.1  项目大厅",
        "paras": [
            "登录后第一页是项目大厅，所有项目都在这里。顶部四个数字：项目总数、进行中的任务、等着验收的任务、被卡住的任务。这四个数是实时算的，不是估的；取消掉的任务不算在里面。",
            "数字下面是项目卡片。左上角是代号和阶段，阶段有定义、开发、联调、验收、归档五种，底色各不相同，扫一眼就能分出哪个项目跑到哪一步了。卡片中间是项目名和目标摘要。摘要取的是章程里的目标字段，代表团队当初定下的方向，不是最近几条聊天里冒出来的想法。",
            "进度条按任务权重和验收状态算，只有人验收通过的任务才计入，AI 自己报的完成度不算。进度条下面三格是进行中、待验收、阻塞的数量。阻塞数大于零时那一格变红。",
            "卡片底部是成员头像和最近活动时间，鼠标移上去卡片会抬一下。点进去就是项目工作台。如果账号还没有项目，或者有项目但没绑定并授权 Agent，页面顶部会出现一条上手引导，点开始进十五分钟流程。",
            "卡片上的数字都来自任务表的实时统计。进行中是已经开工的，待验收是交了产物等着人拍板的，阻塞是写明原因正在等外部支持的。三个数的区别在责任方：进行中归执行人，待验收归评审，阻塞往往要项目外面的人来解决。哪一项涨得快，瓶颈就挪到了谁身上。项目多到一屏放不下时，先看阶段和阻塞数，归档的不必再看。点卡片右上角的「项目设置」可以直接进设置页，不用先进工作台再找入口。",
                    "顶部的四个数字随操作即时变化，不需要手动刷新。",
        ],
        "shot": "01-hall.png",
        "caption": "图 1  项目大厅",
    },
    {
        "title": "3.2  新建项目向导",
        "paras": [
            "新建项目分五步。做成向导而不是一张长表单，是因为每一步填的东西决定了后面能干什么：名称和代号决定编号，目标和范围决定上下文包里有什么，验收标准决定任务能不能被判完成。",
            "第一步填项目名称、代号、一句话说明。代号是两到六位大写字母或数字，会出现在事件编号和产物引用里，建完最好别再改。这一步还能选模板：软件小团队、内容创作、竞赛项目，选哪个都会预填章程和任务清单，也可以从空白开始。",
            "第二、三步填目标和范围、验收标准。目标那块包括项目目标、目标用户、交付范围、非目标、硬性约束，它们会跟着上下文包一起发给 Agent，用来划边界。验收标准要一条条写，能检查，验收页会把它们原样列出来给人对照证据。选了模板的话，第三步显示模板要生成的里程碑和任务，替掉原来的首个里程碑输入框。",
            "第四步是成员和角色。发起人固定是当前用户，其他人从账号列表里勾，再指定负责人、成员、评审或者观察员。角色管的是能不能写，不是称呼：评审能下验收结论，负责人能拆任务、派任务，观察员只能看，没权限的按钮根本不会出现。",
            "第五步把这次要写进去的东西列一遍：项目、章程版本、成员、模板任务、事件。确认之后一个事务写完，不会出现项目建好了、章程没写进去的半成品。模板生成的任务都停在待认领，得有人指定负责人再推到已就绪。模板只把定义写清楚，不替人决定谁干。",
            "向导允许随时回退改前面的步骤，已经填的内容不会丢。模板只是起点：选软件小团队会带出六个任务和三个里程碑，选内容创作或竞赛项目同理，填完之后每一处都可以改。项目代号如果与已有项目重复，系统会自动加序号，不会因为一个代号卡住创建。创建完成后会跳转到新项目的工作台，左栏可以直接看到章程 v1 的内容。",
                    "如果只是想先看看效果，选空白项目、随便填个名字也能建，之后在设置里补齐章程即可。",
        ],
        "shot": "02-wizard.png",
        "caption": "图 2  新建项目向导（模板选择）",
    },
    {
        "title": "3.3  项目工作台",
        "paras": [
            "项目工作台分三栏。左边是方向，回答这个项目要去哪；中间是过程，记录大家在聊什么；右边是行动，列出此刻等着人处理的事。三块分开摆，是为了不让讨论看起来像进度。",
            "左栏是当前生效的章程：版本号、目标、交付范围、非目标、硬性约束、验收口径。往下是里程碑，每个显示名称、进度和任务数；再往下是成员，头像、姓名、角色。章程改过之后版本号会变，读者一眼知道自己在看第几版。",
            "中栏是项目频道，默认 general。消息按类型分开显示：一般讨论带头像和正文，系统事件是居中的灰字，决策提案和产物提交各有标记，阻塞求助标红，Agent 的阶段汇报会弱化，不跟人的发言混在一起。在任意一条讨论上点形成决策，填标题、结论、理由、影响范围，这条消息就变成一份待确认的提案。",
            "右栏信息最密。最上面是风险，分高、中、低三级：逾期的、长期阻塞的、堆着没验收的、很久没动的，还有前置任务已完成、可以开始的。右上角给高、中两级的总数。往下是需要处理，列待确认的决策、待验收的任务和阻塞的事。再往下是正在跑的 Agent 会话、已确认的决策、最新产物、端点状态。最底下是最后同步时间。断线了不会装成实时。",
            "观察员进这一页，输入框不可用，确认按钮不出现。权限在服务端就拦住了，界面只是照实显示。",
            "三栏的宽度是固定的，内容多的时候各自滚动，不会把旁边的栏挤变形。风险区的条目可以点进去，直接跳到对应任务。决策提案在右栏出现时，只有发起人和负责人看得到确认按钮，其他人看到的是提案内容本身。消息流默认显示最近的记录，往上滚可以看更早的讨论。Agent 的阶段性汇报默认弱化显示，失败、阻塞和越权请求会单独提示，不会被正常汇报盖住。",
                    "频道里的消息按时间正序排，最新的一条在最下面，输入框固定在底部。",
        ],
        "shot": "03-workbench.png",
        "caption": "图 3  项目工作台（三栏布局）",
    },
    {
        "title": "3.4  任务看板",
        "paras": [
            "看板按状态分六列：待澄清、待认领、已就绪、进行中、待验收、已完成。列头是状态徽标和数量，列底是这一列的权重合计。权重合计不只是一个数字，它表示这个状态上压了多少工作量。",
            "状态不能随便拖。待澄清要补齐输入材料和验收标准才能进待认领；待认领要指定负责人才能进已就绪；进行中至少要交一样产物，或者写清楚为什么没有产物，才能进待验收；待验收只有有验收权的人能判通过或退回。这些条件由服务端执行，界面只是把当下能做的动作摆出来。",
            "任务卡上有优先级、返工轮次、截止日、标题、负责人，以及产物数和依赖数。优先级分四档，返工轮次表示这个任务被重新打开过几次，依赖数表示前面还有几件没做完的事。点卡片进任务详情。",
            "顶上的旁路状态单独列出已阻塞、已暂停、已取消的任务，阻塞的会带原因，在这一层就能看出哪些在等外部配合。右上角新建任务，弹窗里要填名称、负责人、优先级、权重、里程碑、截止日、说明、输入材料、工作范围、非工作范围、验收标准。缺输入或缺验收标准的任务会停在待澄清。这是有意拦住的，免得没边界的任务被派出去。",
            "六列并排时会横向滚动，一次能看到四到五列。列头的数字和列底的权重合计是同一批任务的不同侧面：一个是件数，一个是工作量，件数多不一定工作量大。看板不提供拖拽改状态，状态必须从任务详情里按规则推进，这样做是为了让每一次变更都留下说明和记录。新建任务的弹窗里，负责人可以先留空，等任务定义清楚之后再指定。",
                    "把任务从一列推到下一列之后，卡片会立刻换位置，数量与权重合计同步更新。",
        ],
        "shot": "04-board.png",
        "caption": "图 4  任务看板（六种状态）",
    },
    {
        "title": "3.5  任务详情与验收",
        "paras": [
            "任务详情页是一个任务的全部事实，也是所有能做的操作。顶部是标题、状态、优先级、里程碑，加上负责人、验收人、截止日、权重。下面是任务定义：说明、输入材料、工作范围、非工作范围、验收标准。验收标准用浅底标出来，后面验收就靠它。",
            "右侧是状态机面板。上面显示当前状态，中间一个变更说明输入框，下面按规则列出能点的动作。比如任务在待澄清，只有补齐了输入和验收标准，才会出现“输入齐备”；在进行中，可以提交验收，也可以标阻塞或者取消。每次换状态都写一条事件，任务版本号加一。",
            "执行过程中在提交产物区录证据。产物类型有代码提交、构建包、文档、设计稿、图片、数据表、测试报告、外部链接和说明，录的时候要写清楚位置：提交号、文件路径或者链接。口头说完成不算数。真没有产物，可以提交一条无产物说明，把原因写明白。",
            "任务到待验收、当前用户又有验收权时，页面出现验收结论面板：通过、补充材料、退回三个选项，要求对照验收标准逐条写结论，还可以补充意见。提交后生成一条验收记录，任务要么完成，要么退回进行中。自动检查能给证据，不能替人下结论。",
            "任务在已就绪时，右侧出现派发卡片。卡片列出项目里能用的 Agent 端点，按“现在谁更合适”排序并给出理由：能不能自动跑、闲不闲、授权目录覆不覆盖任务范围、跟正在跑的会话有没有路径重叠。派发不等于开工。连接器领了租约，任务才进进行中；派出去的任务照样只能交到待验收。",
            "已完成的任务要返工，可以重新打开回到进行中。系统生成新的返工轮次，原来的验收记录留着，不覆盖掉。",
            "任务定义可以随时修改，保存后版本号加一。如果两个人在不同页面同时改同一个任务，后提交的一方会收到版本冲突的提示，需要刷新后重新修改，而不是把对方的改动覆盖掉。验收记录按时间倒序排列，包含结论、逐条说明、评审人和时间。一个任务经历多次退回时，这些记录会连起来显示，能看出每次退回卡在哪一条标准上。",
                    "任务定义的每一次修改都会留下版本记录，出问题可以对照当时的定义回看。",
        ],
        "shot": "05-task.png",
        "caption": "图 5  任务详情与状态机面板",
    },
    {
        "title": "3.6  上下文包预览",
        "paras": [
            "上下文包是 Agent 开工前拿到的那份资料。它和聊天记录不是一回事：聊天是过程，上下文包是按任务挑过、裁过、带版本的事实。这一页给人看，派发的时候到底给了 AI 什么，为什么这么裁。",
            "资料分四层。L0 是章程，管方向；L1 是任务本身，管这次要做什么；这两层标着不可裁剪，裁了 AI 就没依据。L2 是已确认的决策、没解决的阻塞、最近的变更，超预算先从这里砍。L3 是工作区目录、禁止访问的路径和回传合同，不塞产物正文。",
            "右栏是预算：当前 tokens 和上限的比值。中文按字算，英文按字符折，是个估算值。超了会写清楚哪一层砍了几条、为什么砍。",
            "每次派发算一个内容哈希，同样的输入必然得到同样的哈希。内容一变哈希就变，所以能拿它判断之前发出去的上下文过没过期。页面还能保存快照，记下某个 Agent 某次看到的全部内容，只增不改。",
            "最下面是渲染好的提示词，可以整段复制走。里面的项目文本都包在 data 标签里，开头写明这是资料不是指令。聊天里有人写“忽略之前的规则”，也不会被当成授权。",
            "四层的顺序是固定的，组装时先放章程和任务，再按预算放决策、阻塞和最近变更，最后挂上工作区和回传合同。预算用完时，先丢最近的过程记录，再丢较早的决策；硬性约束、当前任务、未解决的阻塞和最新确认的决策永远保留。页面上的裁剪记录会写明丢了哪一层、丢了多少条，看的人不必猜。",
                    "快照列表按版本号倒序排，最新的在最上面，点开可以看到当次生成的内容。",
        ],
        "shot": "06-context.png",
        "caption": "图 6  上下文包预览（四层结构与预算）",
    },
    {
        "title": "3.7  产物与验收",
        "paras": [
            "这一页集中处理等着验收的任务，顺便把项目里的产物汇总在一起。用的是标准、证据、结论三栏。分三栏的原因很实际：完成状态可不可信，就看这三样对不对得上。",
            "上面的待验收区，一个任务一张卡。左栏是验收标准，一条条列着；中栏是提交的产物，带位置和版本；右栏说明还没验收，给一个进任务详情的入口。评审在这儿先看证据齐不齐，再进去逐条写结论。",
            "已完成区列通过验收的任务：几个产物、验收几次、最后验收时间。验收次数单独列出来有用。一个任务要是反复退回，多半是验收标准写模糊了。",
            "最下面是产物清单，一张表：类型、名称、位置、版本、来源任务、提交人、时间。产物都是能定位的引用，提交号、路径或者链接，不是一段没法核对的文字。这样验收结论事后还查得到。",
            "待验收卡片是按任务更新时间倒序排的，刚提交的排在最前面。如果一张卡片上的证据明显不够，评审可以先去任务详情写下退回意见，不必等所有材料齐了再处理。产物清单支持按来源任务追溯：点任务标题可以跳到该任务，看它当时的验收结论和产物版本，避免只看到一份孤立的文件。",
                    "待验收区为空时页面会直说没有待验收任务，不会用一张空表格占位。",
        ],
        "shot": "07-artifacts.png",
        "caption": "图 7  产物与验收（标准—证据—结论）",
    },
    {
        "title": "3.8  决策与时间线",
        "paras": [
            "这一页回答两件事：为什么这么做，之前发生过什么。前者在决策记录里，后者在事件流里。分开摆，是因为结论和过程不是一回事，混在一起就分不清哪条算数。",
            "决策卡上有状态、标题、结论、理由、备选方案、影响范围、决策人、版本号。状态三种：提案、已确认、已被替代。只有已确认的会进 AI 的上下文。旧决策被新决策替代后会淡下去，但还在列表里，标着被谁取代，免得 AI 同时读到两条打架的指令。",
            "右边是事件时间线，倒序排：任务状态变更、产物提交、决策确认、阻塞、会话开始和结束都在里面。每条有标题、操作人、一句话摘要、事件类型和时间。操作人可以是某个成员，也可能是一次 Agent 会话或者系统，写法上区分得开。",
            "事件流不能改，要更正就追加一条新事件。代价是记录会一直长，换来的是能回放：任何时候都能看清楚某个时刻的项目状态是怎么来的。",
            "决策列表按状态排序，提案在前，已确认居中，已被替代的排在后面并淡化。同一主题的新决策会关联旧决策，形成一条替代链，追溯时可以看到这条结论被改过几次、每次为什么改。事件流默认只显示关键事件，任务内部的普通进度不会刷屏；需要细看某一个任务时，可以从任务详情页看它自己的事件记录。",
                    "事件流里的时间精确到分钟，跨天的记录会按日期分组显示。",
        ],
        "shot": "08-timeline.png",
        "caption": "图 8  决策与时间线",
    },
    {
        "title": "3.9  项目设置",
        "paras": [
            "设置页管四件事：项目信息、章程版本、成员角色、数据保留策略。不常开，但每次开都涉及改边界，所以多数操作要发起人或者负责人才能做。",
            "项目信息里能改当前阶段，五个取值：定义、开发、联调、验收、归档。阶段会出现在项目卡和上下文包里。改完点应用才生效，会写一条事件。",
            "章程区显示当前版本的全部字段和版本历史。点修订章程展开表单，本次变更说明是必填的，保存后生成新版本，不覆盖旧的。改章程有实际影响：进行中的任务要重新确认上下文，Agent 拉上下文时也会看到新版本号，不会照着过期的目标继续做。",
            "成员与角色区显示账号、角色和权限说明。发起人能改别人的角色，但不能取消自己的发起人身份，项目至少要留一位。数据与保留策略那一块是说明性质的：事件全量保留，日志短保留，密钥不读，云端和本地删除分开授权。",
            "阶段切换没有强制的先后顺序，可以从开发直接跳到归档，但每次切换都会写一条事件，事后能看出项目是什么时候进入下一阶段的。章程修订保存后，页面会显示新版本号，版本历史里多出一行，写明这次改了什么。成员角色的调整对已存在的任务没有影响，只影响后续的写入权限。",
                    "修改成员角色会立即生效，对方下次操作时看到的就是新权限。",
        ],
        "shot": "09-settings.png",
        "caption": "图 9  项目设置（章程与角色）",
    },
    {
        "title": "3.10  Agent 连接",
        "paras": [
            "这一页把成员电脑上的 AI 工具接进项目，并管它能碰什么。整个过程不需要成员交任何模型密钥。平台管的是身份和项目授权，工具自己的账号和模型配置仍归工具。",
            "接入靠配对。成员在目标电脑执行连接器的登录命令，终端给出一个 ABCD-2345 形式的配对码，十五分钟有效，只能用一次。回到页面填码、点授权，连接器几秒内完成握手，把令牌存在用户目录。中间不用在浏览器和终端之间倒腾密钥。",
            "授权分两层。工具授权归原工具：登录没有、用哪个模型、配置对不对，平台不读也不传。项目授权归平台：这个端点能进哪个项目、读哪些任务、写哪些目录、回传哪些事件。撤销设备只断第二层，原工具照常能用。",
            "设备列表有设备名、系统、在线状态、配对时间和撤销。每台设备下面挂若干端点，每个显示工具名和版本、能力等级、绑定的项目、最后心跳。能力等级是接入时探测出来的，分自动、半自动、手动。后两档会同时显示降级原因，比如这个版本不支持无头调用。",
            "端点的授权目录决定它能读写哪些路径。一个目录都没授权时，端点等于只读，系统不会让它自动执行。授权之后，连接器执行前后都会核对实际改动落没落在范围内。越界的判失败、中断回传，任务留在进行中等人工处理。",
            "配对码只能用一次，过期或被使用后需要重新生成。设备列表按配对时间倒序排，最近接入的在最上面。端点的能力等级可以重新检测：工具升级或配置修好之后，执行一次检测并同步，等级会从半自动变成自动，不必重新配对。撤销设备不会删除已有的历史会话记录，那些记录仍然可以在任务详情和时间线里查到。",
                    "连接器掉线后端点会显示为离线，重新连上会自动恢复在线状态。",
        ],
        "shot": "10-agent.png",
        "caption": "图 10  Agent 连接与端点授权",
    },
    {
        "title": "3.11  周报",
        "paras": [
            "周报是最近七天的实际活动，用来判断现在这套协作方式有没有用，不是拿来对外展示的。每个数字的口径都定死了，免得不同的人看同一份数据得出不同结论。",
            "上面的叙述由数据生成：几个项目、新建多少、完成多少、验收几次、通过率多少、Agent 会话提交和失败各几次、从建任务到通过验收的中位数、上下文平均花多少 tokens。它只是把数字翻译成人话，不加推测。",
            "下面是五个指标卡和两张七天图。卡片是完成、新建、通过率、会话数、上下文成本；两张图分别是每天新建和每天通过验收的任务数，横轴日期，纵轴数量，能看出活是堆在某几天还是摊得比较匀。再下面是按项目拆的表：新建、完成、退回、完成率。",
            "最下面两块用来暴露问题。卡住的地方列当前阻塞的任务和它们缺什么；Agent 失败原因按超时、越界修改、输出解析不了、报错等聚合计次。这一周一点活动都没有的话，页面会直说没有活动，不摆一排零，也不编数据。",
            "周报只统计最近七天，不累积历史，也不做同比环比。通过率的分母是本周所有的验收结论，包括退回和补充材料，所以它反映的是这一周验收的质量，不是任务本身的难度。上下文成本按每次派发保存的快照计算，没有派发就没有这一项。按项目拆分的表格只列出本周有活动的项目，其余项目不出现在表里。",
                    "图表上的每一根柱子都对应一个自然日，跨周的数据不做累计。",
        ],
        "shot": "11-review.png",
        "caption": "图 11  周报（这一周发生了什么）",
    },
    {
        "title": "3.12  上手流程",
        "paras": [
            "上手页把第一次使用拆成五步：建项目、连设备、授权目录、有一个已就绪的任务、跑通一次完整交付。顺序跟系统里的依赖一致，跳过哪一步，后面都接不上。",
            "每一步的完成状态是系统按真实数据判的，不是自己勾的。它会查：账号名下有项目没有、有没有未撤销的设备、有没有端点授权了目录、项目里有没有已就绪及之后状态的任务、有没有跟你相关的通过验收记录，或者你设备提交成功的会话。",
            "每一步写了预计耗时、要做什么、为什么需要这一步，需要的时候直接给可复制的命令。第一次用最容易卡住的地方往往不是概念，是不知道终端里该敲什么。",
            "五步走完，页面提示闭环已经跑通，并给一个去周报的入口，让人看第一周的数据。底下还列了几条常见卡点的排查方法：连接器调不动先跑能力检测，任务推不动先看输入和验收标准补没补。",
            "五个步骤之间没有强制顺序，但后面的步骤依赖前面的结果：没有项目就建不了任务，没有端点就派不出去，没有已就绪的任务就跑不通交付。任何一步做完，页面会立刻更新进度，不需要手动刷新。全部完成之后，引导条不会消失，它会变成一条完成提示，直到账号所属的项目有了新的活动。",
                    "已经完成的步骤仍然可以点进去复习，不会因为进度满了而锁住。",
        ],
        "shot": "12-start.png",
        "caption": "图 12  15 分钟上手流程",
    },
]

OVERVIEW = [
    "CoFlow 项目事实层是一款多人、多 Agent 的项目协作工作台，面向二到八人的小团队。团队在这里写目标、拆任务、讨论、交产物、做验收；成员电脑上的 AI 工具通过本地连接器接进来，领任务、拿上下文、回结果。它要解决的情形很具体：一个人用这款 AI 工具，另一个人用另一款，两边的 AI 都不知道对方在做什么。",
    "它和普通协作工具最大的不同，是把事实和消息分开。群聊里说的话只是过程记录；只有被确认的决策、带证据的产物、人给出的验收结论，才进项目事实层。AI 不能自己把任务标成完成，它最多提交到待验收，过不过由人定。界面上的信息也照这个分：过程放一处，事实放一处，待办放一处。",
    "系统里有几个反复出现的名词。项目章程记录目标、目标用户、交付范围、非目标、硬性约束和验收标准，带版本号，改了就是新版本，旧的留着。任务是协作与授权的最小单元，从待澄清一路走到已完成，中间还有个已阻塞、已暂停、已取消的旁路，每次换状态都有前置条件。决策是讨论里形成的结论，必须有人确认才生效，没确认的提案不进 AI 的上下文。产物是提交号、文件、测试报告、设计稿这类能定位的东西，说完成了就得拿得出来。",
    "为了让 AI 真的能参与，系统还有上下文包、Agent 端点、租约和会话。上下文包是按任务裁过的资料，分四层，带哈希和 token 预算，裁掉了什么会记下来。Agent 端点是成员电脑上一个可连接的工具实例，接进来时会探测它能不能自动跑，分自动、半自动、手动三档。租约是一次有时效、能撤销的执行授权，会话是这次执行本身，两者都绑着上下文版本，防止 AI 拿着旧信息干活。",
    "数据这一层用事件记录加当前状态。每一次状态变更、决策确认、产物提交、验收结论，先写进不可变的事件流，再据此更新任务、看板、上下文这些读模型。事件流记录发生过什么，读模型回答现在是什么状态，两者在同一个事务里落库。每次派发还会存一份上下文快照，记下某个 Agent 当时看到的东西，事后有争议可以回去核对。",
    "这套系统的规模是按小团队设计的。一个人也能用，但它的价值在有人分工、有人验收的时候才显出来；团队越大，章程和验收标准写得清不清楚，差别越明显。",
    "角色决定的是写入权限，不是头衔。发起人能改目标和成员角色，也握着最终验收；负责人拆任务、派任务、做验收；成员建任务、发言、交产物；评审只做验收结论；观察员只能看，与其权限不符的按钮直接不显示，不会变灰。",
]

INSTALL = [
    "系统分两部分跑：Web 协作端负责项目事实层、任务和验收的全部逻辑，本地连接器负责在成员电脑上连 AI 工具和授权目录。服务端在一台机器上部署一次就行，其他成员用浏览器访问，不用各自再装一遍。",
    "运行环境是 Windows 10 或 Windows 11 的 64 位系统，Node.js 20 及以上，PostgreSQL 14 及以上，浏览器用 Chrome 或 Edge。安装时先在项目目录装依赖，然后建专用的数据库和账号，把连接串写进根目录的环境变量文件，再执行建表命令。演示数据可按需写入，正式用不写也行。",
    "服务起来后，浏览器访问本机地址就是登录页。用邮箱验证码登录，六位数字，十分钟有效，只能用一次，第一次登录的邮箱会自动建号。开发环境没配邮件服务时，验证码会直接显示在页面上，方便本地调试；生产环境必须配，否则登录会明确报错，不会出现提示已发送却收不到的情况。",
    "要让本机的 AI 工具接进来，在目标电脑执行连接器的登录命令，拿到配对码后去 Agent 连接页授权。连接器是出站连接，不开本机入站端口；它只认本机装了什么工具、什么版本，不读模型密钥。装完可以通过访问登录页、看演示项目、跑测试脚本验证环境，页面提示数据库未连接，就说明连接串或者数据库服务有问题。",
    "安装时最常碰到三个问题：端口占用、数据库权限、中文路径。启动提示端口被占用，多半是上一次的服务没退干净，换端口或者结束占用进程都行；建表报权限不足，通常是数据库账号对目标 schema 没有建表权限，找管理员授权；部署路径带中文时，个别命令行工具解析不了，放在纯英文目录下更稳。",
    "如果只是试用，把演示数据写在库里最省事，能直接看到任务、决策、产物和验收都长什么样；确认要用之后，再清空演示数据、按真实项目重建。",
    "目录按职责分。数据模型和演示数据在 prisma，状态机、上下文包、权限、风险、周报这些核心逻辑在 src/lib，页面路由和接口在 src/app，界面组件和设计系统在 src/components，本地连接器单独放在 connector，测试和文档生成脚本在 scripts。改一个功能时，要读的范围是有限的。",
]

FAQ = [
    (
        "任务无法移动到已就绪",
        "多半是缺输入材料或验收标准，或者没指定负责人。状态机要求这三样齐了才放行。补齐任务定义，再从右侧状态机面板推进。三样都填了还推不动，就看当前账号在项目里的角色有没有写入权限。",
    ),
    (
        "页面上没有出现派发卡片",
        "派发卡片只在任务处于已就绪、并且项目里有可用端点时出现。先去 Agent 连接页完成设备配对和目录授权。端点显示为半自动或手动也能派发，只是领取和执行需要人参与，跑不了全自动。",
    ),
    (
        "连接器提示端点为半自动",
        "说明本机工具不支持无头调用，系统按实际能力降了级，没有装成能自动跑。这时该用领取任务包、人工执行、再回传结果的方式。确认工具本身有无头能力，可以重跑一次能力检测再同步到服务端。",
    ),
    (
        "提交验收时提示上下文过期",
        "通常是章程或者任务定义在派发之后改过。系统要求 AI 按最新上下文工作，旧会话不能拿旧内容交结果。重新领取任务刷新上下文，或者由负责人确认这次改动不影响当前工作再处理。",
    ),
    (
        "撤销设备之后原工具是否受影响",
        "不受影响。撤销只断本系统和这台设备之间的协作通道，连接器后续请求会被拒，但原工具的登录状态、模型配置、本地文件都照常能用。要重新接入，按配对流程再登一次。",
    ),
    (
        "周报显示本周没有活动",
        "最近七天没建任务、没交产物、没做验收。先去上手页看看五步走完没有。项目本身停了，周报如实说出来，这本来就是它该干的事。",
    ),
]

NOTES = [
    "平台不读取、不保存本机的模型 API Key。工具授权归原工具，平台只管项目授权：这个端点能进哪个项目、读写哪些目录、回传哪些事件。连接器上传前会把本地路径相对化，不会把用户的绝对路径写进项目日志。",
    "任务完成状态必须由有验收权的人作出，自动检查只能给证据。Agent 的权限不超过所属成员，还可以再收窄；观察员对应的端点领不到任务。章程修改生成新版本，旧版本永久保留，进行中的任务在目标变更后要重新确认上下文。",
    "详细的过程事件按项目设置定期清理，关键决策和验收记录长期保存。本手册写的功能以本版本实际提供的界面为准，后续版本可能调整界面细节，项目事实层的核心规则不会变。",
]


def make_manual():
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.top_margin = sec.bottom_margin = Cm(2.2)
    sec.left_margin = sec.right_margin = Cm(2.4)
    page_header(sec, f"{SOFT_NAME}　{VERSION}　用户手册")
    page_footer(sec)

    style = doc.styles["Normal"]
    style.font.name = FONT_CN
    style.font.size = Pt(10.5)
    style.element.rPr.rFonts.set(qn("w:eastAsia"), FONT_CN)

    # 封面
    for _ in range(5):
        doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(SOFT_NAME)
    set_run_font(r, FONT_CN, 30, bold=True)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    r = p.add_run("用 户 手 册")
    set_run_font(r, FONT_CN, 22, bold=True)

    for _ in range(6):
        doc.add_paragraph()

    info = [
        ("软件名称", SOFT_NAME),
        ("软件版本", VERSION),
        ("开发作者", AUTHOR),
        ("编制日期", DATE_CN),
        ("文档类型", "用户手册（使用方法说明）"),
        ("适用对象", "项目负责人、团队成员、评审人员及首次使用本系统的用户"),
    ]
    for k, v in info:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(f"{k}：{v}")
        set_run_font(r, FONT_CN, 12)

    page_break(doc)

    # 目录
    add_heading(doc, "目　录", 18, 0)
    toc = [
        "一、软件概述",
        "二、安装与启动",
        "三、功能与操作说明",
        "　　3.1 项目大厅　　3.2 新建项目向导　　3.3 项目工作台",
        "　　3.4 任务看板　　3.5 任务详情与验收　　3.6 上下文包预览",
        "　　3.7 产物与验收　　3.8 决策与时间线　　3.9 项目设置",
        "　　3.10 Agent 连接　　3.11 周报　　3.12 上手流程",
        "四、常见问题",
        "五、注意事项",
    ]
    for t in toc:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        r = p.add_run(t)
        set_run_font(r, FONT_CN, 11.5)
    page_break(doc)

    # 一、概述
    add_heading(doc, "一、软件概述", 16, 0)
    for t in OVERVIEW:
        add_para(doc, t, space_after=6)

    page_break(doc)

    # 二、安装与启动
    add_heading(doc, "二、安装与启动", 16, 0)
    for t in INSTALL:
        add_para(doc, t, space_after=6)

    page_break(doc)

    # 三、功能与操作说明
    add_heading(doc, "三、功能与操作说明", 16, 0)
    add_para(
        doc,
        "本章按功能模块逐一说明界面的组成与操作方法。所有截图均取自系统实际运行界面，图中数据为演示项目的数据，正式使用时这些位置显示的是贵方项目的信息。",
        space_after=8,
    )

    for i, s in enumerate(SECTIONS):
        if i > 0:
            page_break(doc)
        add_heading(doc, s["title"], 14, 0)
        for t in s["paras"]:
            add_para(doc, t, space_after=6)
        img = os.path.join(SHOTS, s["shot"])
        if os.path.exists(img):
            add_figure(doc, img, s["caption"])

    # 四、常见问题
    page_break(doc)
    add_heading(doc, "四、常见问题", 16, 0)
    for q, a in FAQ:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(f"问：{q}")
        set_run_font(r, FONT_CN, 10.5, bold=True)
        p2 = doc.add_paragraph()
        p2.paragraph_format.space_after = Pt(8)
        p2.paragraph_format.line_spacing = 1.05
        r2 = p2.add_run(f"答：{a}")
        set_run_font(r2, FONT_CN, 10.5)

    # 五、注意事项
    add_heading(doc, "五、注意事项", 16)
    for t in NOTES:
        add_para(doc, t, space_after=6)

    out = os.path.join(OUT, "CoFlow-用户手册.docx")
    doc.save(out)
    return out


if __name__ == "__main__":
    src, total, pages = make_source_doc()
    man = make_manual()
    print("source:", src, "lines:", total, "pages:", pages)
    print("manual:", man)
