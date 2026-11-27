import Link from "next/link";

export const metadata = { title: "隐私说明 · CoFlow" };

export default function PrivacyPage() {
  return (
    <main className="cf-scope mx-auto max-w-[780px] px-6 py-8">
      <div className="font-mono-tabular text-[10.5px] font-semibold tracking-widest text-[var(--cf-primary)]">
        PRIVACY
      </div>
      <h1 className="mt-1 text-[22px] font-bold text-[var(--cf-text-primary)]">隐私说明</h1>
      <p className="mt-1 text-[12px] text-[var(--cf-text-tertiary)]">
        最后更新：2026-11-14　适用于 CoFlow 项目事实层（本服务）
      </p>

      <div className="mt-5 space-y-5 text-[13px] leading-[1.75] text-[var(--cf-text-secondary)]">
        <section>
          <h2 className="text-[14px] font-semibold text-[var(--cf-text-primary)]">一、我们收集什么</h2>
          <p className="mt-1">
            登录邮箱：用于发送一次性验证码并标识账号，不要求昵称、手机号或单位信息。
            你创建的项目内容：项目章程、任务、讨论消息、决策、产物引用与验收记录，这些是你主动录入的数据。
            安全相关信息：登录会话的浏览器标识、IP 地址、登录与最近活跃时间，用于识别异常登录和撤销设备，不做画像分析。
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-semibold text-[var(--cf-text-primary)]">二、我们不收集什么</h2>
          <p className="mt-1">
            本服务不读取、不保存你在本机 AI 工具中配置的模型 API Key，也不读取你的本地文件内容。
            接入 Agent 时只登记工具类型、版本与能力等级；执行过程中上传的是你或你的工具主动提交的产物引用（提交号、文件路径或链接），不是整个目录。
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-semibold text-[var(--cf-text-primary)]">三、保存多久</h2>
          <p className="mt-1">
            登录验证码 10 分钟后失效，使用一次即作废。登录会话默认 30 天，可在「账号与安全」页面随时撤销。
            过程类事件（讨论消息、Agent 进度）按保留策略定期清理；已确认的决策、产物与验收记录长期保留，因为它们是项目的交付依据。
            删除项目时，该项目下的任务、讨论、决策、产物与事件记录一并删除，不可恢复。
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-semibold text-[var(--cf-text-primary)]">四、谁能看到你的数据</h2>
          <p className="mt-1">
            只有被你加入项目的人能看到该项目的内容。未加入的人访问项目地址会得到 404。
            项目发起人可以调整成员与角色；观察员只能查看，不能修改。
            平台维护人员仅在排查故障时接触数据库，不用于其他用途。
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-semibold text-[var(--cf-text-primary)]">五、你的权利</h2>
          <p className="mt-1">
            你可以随时：在「账号与安全」撤销任一登录会话或全部其他设备；在项目设置中删除自己发起的项目；
            在「Agent 连接」撤销已接入的设备。如需删除整个账号或导出数据，请通过登录邮箱联系维护人员处理。
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-semibold text-[var(--cf-text-primary)]">六、第三方服务</h2>
          <p className="mt-1">
            为发送登录验证码，我们会把收件邮箱与验证码内容交由邮件服务商投递；除此之外不向任何第三方共享你的项目数据。
            本服务运行在云服务器上，数据存储于该服务器及其数据库。
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-semibold text-[var(--cf-text-primary)]">七、变更</h2>
          <p className="mt-1">
            本说明如有更新，会在本页标注日期。涉及收集范围的实质变化，会在登录页提示。
          </p>
        </section>
      </div>

      <Link
        href="/login"
        className="mt-8 inline-flex h-[30px] items-center text-[12.5px] text-[var(--cf-primary)] hover:underline"
      >
        ← 返回登录
      </Link>
    </main>
  );
}
