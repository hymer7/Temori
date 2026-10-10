import Link from "next/link";
import styles from "./page.module.css";

const steps = [
  ["01", "先有一个属于小组的空间", "用群号找到队友，在同一个地方交流和发起任务。"],
  ["02", "把要做的事讲清楚", "大任务写明目标与参考资料；需要分工时，再用 Issue 拆开。"],
  ["03", "提交成果，留下修改过程", "交文档、链接或文件，让反馈对应到具体版本。"],
  ["04", "由负责人完成最终验收", "群主或其指定的验收负责人确认最终成果，明确什么时候算完成。"],
];

function Brand({ small = false }: { small?: boolean }) {
  return <span className={styles.brand}>
    <span className={styles.brandMark} aria-hidden="true"><i /><i /><i /><i /></span>
    <span className={small ? styles.brandNameSmall : styles.brandName}>Temori</span>
  </span>;
}

function ProductPreview() {
  return <div className={styles.previewShell} aria-label="Temori 大任务页面的界面示意">
    <p className={styles.previewCaption}><span />产品界面示意</p>
    <div className={styles.previewWindow}>
      <div className={styles.previewTopbar}><Brand small /><span>小组工作台 <b aria-hidden="true">↗</b></span></div>
      <div className={styles.previewWorkspace}>
        <aside className={styles.previewSidebar} aria-hidden="true">
          <span className={styles.previewGroupIcon}>城</span>
          <strong>城市观察小组</strong>
          <hr />
          <span>概览</span><span>群聊</span><span className={styles.previewSideActive}>大任务 <b>2</b></span><span>成员</span>
        </aside>
        <div className={styles.previewMain}>
          <p className={styles.previewBreadcrumb}>大任务 <span>/</span> 课程展示</p>
          <div className={styles.previewTitleRow}>
            <div><small>社会学课程 · 期末作业</small><h2>城市更新调研展示</h2></div>
            <span className={styles.previewStatus}>进行中</span>
          </div>
          <p className={styles.previewSummary}>整理访谈资料，完成展示文稿与 10 分钟课堂汇报。</p>
          <div className={styles.trail} aria-label="成果轨迹：任务说明、Issue、成果提交、最终验收">
            <div className={styles.trailDone}><span>✓</span><div><strong>任务说明</strong><small>目标已明确</small></div></div>
            <div className={styles.trailCurrent}><span>02</span><div><strong>Issue 分工</strong><small>2 项进行中</small></div></div>
            <div><span>03</span><div><strong>成果提交</strong><small>等待审阅</small></div></div>
            <div><span>04</span><div><strong>最终验收</strong><small>由群主确认</small></div></div>
          </div>
          <div className={styles.previewColumns}>
            <div className={styles.previewPanel}>
              <div className={styles.previewPanelHeading}><strong>进行中的 Issue</strong><span>查看全部 →</span></div>
              <div className={styles.previewIssue}><b>#02</b><span>整理访谈结论</span><small>进行中</small></div>
              <div className={styles.previewIssue}><b>#03</b><span>制作展示页</span><small>待处理</small></div>
            </div>
            <div className={styles.previewPanel}>
              <div className={styles.previewPanelHeading}><strong>最近的成果</strong><span>版本记录 →</span></div>
              <div className={styles.previewFile}><span>PDF</span><div><strong>访谈摘要</strong><small>第 2 版 · 等待审阅</small></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

export default function Home() {
  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" aria-label="Temori 首页"><Brand /></Link>
      <nav className={styles.nav} aria-label="主要导航"><a href="#workflow">协作方式</a><Link href="/login">进入 Temori <span aria-hidden="true">↗</span></Link></nav>
    </div></header>
    <main>
      <section className={styles.hero} aria-labelledby="hero-title"><div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span />给一起做事的学生团队</p>
          <h1 id="hero-title">让小组的<span>每一步</span><br />都有下文。</h1>
          <p className={styles.heroDescription}>聊天里说过的分工、反复修改的文件、等待确认的最终成果，都值得有个清楚的去处。</p>
          <div className={styles.heroActions}><Link className={styles.primaryButton} href="/login">开始使用 Temori <span aria-hidden="true">↗</span></Link><a className={styles.textLink} href="#workflow">看看怎么协作 <span aria-hidden="true">↓</span></a></div>
          <p className={styles.heroNote}>网页端优先 · 适合课程小组与学生团队</p>
        </div>
        <ProductPreview />
      </div></section>
      <section className={styles.workflow} id="workflow" aria-labelledby="workflow-title"><div className={styles.sectionInner}>
        <div className={styles.sectionIntro}><p className={styles.sectionEyebrow}>一条清楚的协作路径</p><h2 id="workflow-title">从提出任务，到真的完成。</h2><p>需要细分时认真分工，事情简单时直接提交。流程跟着任务走。</p></div>
        <ol className={styles.stepGrid}>{steps.map(([number, title, description]) => <li className={styles.stepCard} key={number}><span className={styles.stepNumber}>{number}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
      </div></section>
      <section className={styles.closing} aria-labelledby="closing-title"><div className={styles.closingInner}>
        <div><p className={styles.sectionEyebrow}>Temori · 学生团队协作空间</p><h2 id="closing-title">下一次组队，从一个清楚的任务开始。</h2></div>
        <Link className={styles.closingButton} href="/login">进入 Temori <span aria-hidden="true">↗</span></Link>
      </div></section>
    </main>
    <footer className={styles.footer}><Brand small /><p>正在打磨的网页版本，让小组协作有迹可循。</p></footer>
  </div>;
}
