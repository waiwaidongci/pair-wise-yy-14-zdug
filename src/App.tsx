import { useMemo, useState } from "react";
import { SurveyProvider, useSurvey } from "./store";
import { fmtTime } from "./utils";
import RegisterPanel from "./components/RegisterPanel";
import InventoryPanel from "./components/InventoryPanel";
import DimensionsPanel from "./components/DimensionsPanel";
import DiseaseMapPanel from "./components/DiseaseMapPanel";
import RelationsPanel from "./components/RelationsPanel";
import ReviewPanel from "./components/ReviewPanel";
import { Badge, ToastHost } from "./components/ui";
import type { TabKey } from "./types";
import "./styles.css";

const TABS: { key: TabKey; label: string; for: "all" | "reviewer" }[] = [
  { key: "register", label: "连续登记", for: "all" },
  { key: "inventory", label: "构件清单", for: "all" },
  { key: "dimensions", label: "尺寸记录表", for: "all" },
  { key: "disease", label: "病害标记图", for: "all" },
  { key: "relations", label: "构件关系视图", for: "all" },
  { key: "review", label: "复核待办", for: "reviewer" },
];

function Shell() {
  const { committed, drafts, role, setRole, savedAt, dispatch } = useSurvey();
  const [tab, setTab] = useState<TabKey>("register");
  const [showLog, setShowLog] = useState(false);

  const metrics = useMemo(() => {
    const official = committed.components.filter((c) => c.status !== "draft");
    const diseaseCount = official.reduce((n, c) => n + c.damages.length, 0);
    const tenonKinds = new Set(official.map((c) => c.tenon)).size;
    const pending =
      committed.components.filter((c) => c.status === "in_review").length +
      committed.changes.filter((ch) => ch.status === "pending").length;
    return [
      { label: "正式构件", value: official.length, hint: `草稿 ${drafts.components.length}` },
      { label: "病害点", value: diseaseCount, hint: "正式构件统计" },
      { label: "榫卯类型", value: tenonKinds, hint: "已出现种类" },
      { label: "待处理", value: pending, hint: "待复核+待审批" },
    ];
  }, [committed, drafts]);

  const pendingReviewCount =
    committed.components.filter((c) => c.status === "in_review").length +
    committed.changes.filter((ch) => ch.status === "pending").length;

  return (
    <main className="app">
      <section className="hero app-hero">
        <div className="hero-top">
          <p>hxyfront-62013 · 古建筑木结构测绘现场系统</p>
          <div className="role-switch">
            <button
              className={role === "surveyor" ? "on" : ""}
              onClick={() => setRole("surveyor")}
            >
              测量员
            </button>
            <button
              className={role === "reviewer" ? "on" : ""}
              onClick={() => setRole("reviewer")}
            >
              复核人
            </button>
          </div>
        </div>
        <h1>木结构榫卯构件测绘</h1>
        <span>
          按建筑连续登记构件、病害与修缮建议；构件复核通过后，测量员可提交尺寸变更申请，复核人对照新旧尺寸批准，尺寸记录表、病害标记图、构件关系视图同步采用新值，驳回则沿用原记录。
        </span>
        <div className="hero-tools">
          <span className="save-state">
            {savedAt ? `草稿与台账已自动保存 · ${fmtTime(savedAt)}` : "正在加载本地数据…"}
          </span>
          <button className="ghost-btn sm" onClick={() => setShowLog(true)}>
            操作台账
          </button>
          <button
            className="ghost-btn sm"
            onClick={() => {
              if (window.confirm("重置为演示样例数据？当前本地登记内容将被清除。")) {
                dispatch({ type: "RESET" });
                setTab("register");
              }
            }}
          >
            重置演示
          </button>
        </div>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
            <em>{m.hint}</em>
          </article>
        ))}
      </section>

      <nav className="tabs">
        {TABS.map((t) =>
          t.for === "reviewer" ? (
            <button
              key={t.key}
              className={tab === t.key ? "on" : ""}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {pendingReviewCount > 0 && <i className="tab-count">{pendingReviewCount}</i>}
            </button>
          ) : (
            <button
              key={t.key}
              className={tab === t.key ? "on" : ""}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key === "register" && drafts.components.length > 0 && (
                <i className="tab-count draft-count">{drafts.components.length}</i>
              )}
            </button>
          )
        )}
      </nav>

      <div className="tab-body">
        {tab === "register" && <RegisterPanel />}
        {tab === "inventory" && <InventoryPanel onOpenReview={() => setTab("review")} />}
        {tab === "dimensions" && <DimensionsPanel />}
        {tab === "disease" && <DiseaseMapPanel />}
        {tab === "relations" && <RelationsPanel />}
        {tab === "review" && <ReviewPanel />}
      </div>

      {showLog && <LogDrawer onClose={() => setShowLog(false)} />}
      <ToastHost />
    </main>
  );
}

function LogDrawer({ onClose }: { onClose: () => void }) {
  const { committed } = useSurvey();
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="log-drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>操作台账（已复核数据留痕）</h3>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        {committed.logs.length === 0 ? (
          <p className="rail-hint">提交、复核、批准与驳回操作会记录在这里。</p>
        ) : (
          <ul className="log-list">
            {committed.logs.map((l) => (
              <li key={l.id} className={l.tone}>
                <time>{fmtTime(l.at)}</time>
                <span>{l.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SurveyProvider>
      <Shell />
    </SurveyProvider>
  );
}
