import { useEffect, useMemo, useState } from "react";
import { useSurvey } from "../store";
import {
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  STATUS_LABEL,
  TENON_TYPES,
  type ChangeDraft,
  type Component,
  type Dimensions,
  type ReviewStatus,
} from "../types";
import { dimDelta, dimsValid, fmtDims, fmtTime, sameDims } from "../utils";
import {
  Badge,
  BuildingSelect,
  EmptyState,
  Modal,
  StatusBadge,
  toast,
} from "./ui";

export default function InventoryPanel({
  onOpenReview,
}: {
  onOpenReview: () => void;
}) {
  const { committed, drafts, role, pendingChangeFor } = useSurvey();
  const [building, setBuilding] = useState(committed.buildings[0]?.id ?? "all");
  const [tenon, setTenon] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const all = [...committed.components, ...drafts.components];
    return all
      .filter((c) => c.buildingId === building)
      .filter((c) => (tenon === "all" ? true : c.tenon === tenon))
      .filter((c) => (statusFilter === "all" ? true : c.status === statusFilter))
      .filter((c) => {
        const q = query.trim();
        if (!q) return true;
        return (
          c.code.includes(q) || c.name.includes(q) || c.woodSpecies.includes(q)
        );
      });
  }, [committed.components, drafts.components, building, tenon, statusFilter, query]);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>构件清单</p>
          <h2>按建筑连续登记的全部构件</h2>
        </div>
        <div className="filter-bar">
          <BuildingSelect value={building} onChange={setBuilding} />
          <input
            className="search"
            placeholder="搜索编号 / 名称 / 木材"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="chips filter-chips">
        <button
          className={tenon === "all" ? "on" : ""}
          onClick={() => setTenon("all")}
        >
          全部榫卯
        </button>
        {TENON_TYPES.map((t) => (
          <button key={t} className={tenon === t ? "on" : ""} onClick={() => setTenon(t)}>
            {t}
          </button>
        ))}
        <span className="chip-divider" />
        {(["all", "draft", "in_review", "approved"] as const).map((s) => (
          <button
            key={s}
            className={statusFilter === s ? "on subtle" : "subtle"}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "全部状态" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>构件编号</th>
              <th>名称 / 部位</th>
              <th>木材</th>
              <th>榫卯</th>
              <th>截面尺寸</th>
              <th>病害</th>
              <th>状态</th>
              <th>{role === "surveyor" ? "操作" : "说明"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <ComponentRow key={c.id} c={c} onOpenReview={onOpenReview} />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text="当前筛选条件下没有构件" />}
      </div>
      <p className="rail-hint">
        提示：尺寸记录表 / 病害标记图 / 构件关系视图均只呈现进入复核流程的构件；草稿不会出现在正式视图中。
      </p>
    </section>
  );
}

function ComponentRow({
  c,
  onOpenReview,
}: {
  c: Component;
  onOpenReview: () => void;
}) {
  const { role, pendingChangeFor, changeDraftFor, dispatch } = useSurvey();
  const pending = pendingChangeFor(c.id);
  const changeDraft = changeDraftFor(c.id);
  const [dialog, setDialog] = useState(false);

  return (
    <tr className={c.status === "draft" ? "row-draft" : ""}>
      <td>
        <b>{c.code || "—"}</b>
        {c.rejectNote && <em className="reject-flag">驳回：{c.rejectNote}</em>}
      </td>
      <td>
        {c.name}
        <small className="role-line">{c.role}</small>
      </td>
      <td>{c.woodSpecies || "—"}</td>
      <td>{c.tenon}</td>
      <td>
        {dimsValid(c.dimensions) ? fmtDims(c.dimensions) : <Badge tone="muted">待补尺寸</Badge>}
        {pending && (
          <div className="pending-line">
            <Badge tone="warn">变更待批</Badge>
            <small>新 {fmtDims(pending.newDimensions)}</small>
          </div>
        )}
      </td>
      <td>
        <div className="disease-cell">
          {c.damages.length === 0 ? (
            <span className="muted-text">无</span>
          ) : (
            c.damages.map((d) => (
              <span key={d.id} className="dotline">
                <i
                  className="severity-dot"
                  style={{ background: SEVERITY_COLOR[d.severity] }}
                />
                {d.part || "未标注位置"}·{d.kind}·{SEVERITY_LABEL[d.severity]}
              </span>
            ))
          )}
        </div>
      </td>
      <td>
        <StatusBadge status={c.status} />
      </td>
      <td>
        {c.status === "approved" && role === "surveyor" && (
          <div className="row-actions">
            <button
              className="ghost-btn sm"
              onClick={() => setDialog(true)}
              disabled={Boolean(pending)}
              title={pending ? "已有一条待审批变更" : "申请修改尺寸"}
            >
              {pending ? "变更审批中" : changeDraft ? "继续填写变更草稿" : "申请尺寸变更"}
            </button>
          </div>
        )}
        {c.status === "approved" && role === "reviewer" && (
          <button className="ghost-btn sm" onClick={onOpenReview}>
            {pending ? "前往审批变更" : "尺寸已定稿"}
          </button>
        )}
        {c.status === "in_review" && role === "reviewer" && (
          <button className="ghost-btn sm" onClick={onOpenReview}>
            前往复核
          </button>
        )}
        {c.status === "in_review" && role === "surveyor" && (
          <Badge tone="warn">等待复核人处理</Badge>
        )}
        {c.status === "draft" && <Badge tone="muted">在「连续登记」中编辑</Badge>}
      </td>

      {dialog && (
        <ChangeRequestDialog
          component={c}
          onClose={() => setDialog(false)}
          dispatch={dispatch}
        />
      )}
    </tr>
  );
}

function ChangeRequestDialog({
  component,
  onClose,
  dispatch,
}: {
  component: Component;
  onClose: () => void;
  dispatch: ReturnType<typeof useSurvey>["dispatch"];
}) {
  const { changeDraftFor, pendingChangeFor } = useSurvey();
  const existingDraft = changeDraftFor(component.id);
  const alreadyPending = Boolean(pendingChangeFor(component.id));

  const [next, setNext] = useState<Dimensions>(
    () => existingDraft?.newDimensions ?? { ...component.dimensions }
  );
  const [reason, setReason] = useState(existingDraft?.reason ?? "");
  const [flash, setFlash] = useState(false);

  // 自动保留未提交变更草稿：关闭页面/弹窗再打开仍在，且不动正式尺寸
  useEffect(() => {
    if (alreadyPending) return;
    const meaningful = !sameDims(next, component.dimensions) || reason.trim() !== "";
    if (meaningful) {
      dispatch({
        type: "SAVE_CHANGE_DRAFT",
        draft: {
          componentId: component.id,
          newDimensions: next,
          reason,
          savedAt: Date.now(),
        },
      });
      setFlash(true);
      const tm = window.setTimeout(() => setFlash(false), 1000);
      return () => window.clearTimeout(tm);
    }
  }, [next, reason, alreadyPending]); // eslint-disable-line react-hooks/exhaustive-deps

  function saveDraft() {
    if (sameDims(next, component.dimensions) && !reason.trim()) {
      // 没有实质内容则清理
      dispatch({ type: "DELETE_CHANGE_DRAFT", componentId: component.id });
    } else {
      const draft: ChangeDraft = {
        componentId: component.id,
        newDimensions: next,
        reason,
        savedAt: Date.now(),
      };
      dispatch({ type: "SAVE_CHANGE_DRAFT", draft });
    }
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1000);
  }

  function submit() {
    if (sameDims(next, component.dimensions)) {
      toast("新尺寸与当前尺寸一致，无需提交", "danger");
      return;
    }
    if (!dimsValid(next)) {
      toast("新尺寸的宽/高/长均须大于 0", "danger");
      return;
    }
    if (!reason.trim()) {
      toast("请填写变更原因，供复核人对照", "danger");
      return;
    }
    dispatch({
      type: "SUBMIT_CHANGE",
      draft: { componentId: component.id, newDimensions: next, reason, savedAt: Date.now() },
    });
    toast("变更申请已提交，等待复核人对照新旧尺寸", "success");
    onClose();
  }

  const deltas = dimDelta(component.dimensions, next);

  return (
    <Modal
      open
      onClose={onClose}
      title={`尺寸变更申请 · ${component.code} ${component.name}`}
      footer={
        <>
          {flash && <span className="save-flash">变更草稿已保留（关闭页面也在）</span>}
          <button className="ghost-btn" onClick={saveDraft} disabled={alreadyPending}>
            暂存草稿
          </button>
          <button className="primary" onClick={submit} disabled={alreadyPending}>
            提交变更申请
          </button>
        </>
      }
    >
      {alreadyPending && (
        <div className="notice warn">该构件已有一条待审批的变更，复核通过/驳回前不能重复提交。</div>
      )}
      <div className="dim-compare">
        <div className="dim-col old">
          <small>当前正式尺寸（旧）</small>
          <strong>{fmtDims(component.dimensions)}</strong>
          <p>已复核采用值，批准前正式视图保持此值</p>
        </div>
        <div className="dim-arrow">→</div>
        <div className="dim-col new">
          <small>拟变更为（新）</small>
          <div className="dims-row compact">
            {(
              [
                ["width", "宽"],
                ["height", "高"],
                ["length", "长"],
              ] as [keyof Dimensions, string][]
            ).map(([k, label]) => (
              <label key={k}>
                <span>{label}</span>
                <input
                  type="number"
                  min={0}
                  value={next[k] || ""}
                  onChange={(e) =>
                    setNext((d) => ({ ...d, [k]: Number(e.target.value) }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <table className="delta-table">
        <thead>
          <tr>
            <th>项</th>
            <th>旧值</th>
            <th>新值</th>
            <th>差值</th>
          </tr>
        </thead>
        <tbody>
          {deltas.map((d) => {
            const diff = d.to - d.from;
            return (
              <tr key={d.key} className={diff === 0 ? "" : "changed"}>
                <td>{d.key}</td>
                <td>{d.from}</td>
                <td>{d.to}</td>
                <td>
                  {diff === 0 ? (
                    <span className="muted-text">不变</span>
                  ) : (
                    <Badge tone={diff < 0 ? "warn" : "danger"}>
                      {diff > 0 ? `+${diff}` : diff}mm
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <label className="stack-label">
        <span>变更原因 / 复测说明（复核人对照用）</span>
        <textarea
          rows={3}
          value={reason}
          placeholder="如：现场复测发现端部修整后净长缩短，截面宽补测为 185mm"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {existingDraft && (
        <p className="rail-hint">
          存在未提交草稿，上次暂存于 {fmtTime(existingDraft.savedAt)}；正式尺寸不会被草稿改动。
        </p>
      )}
    </Modal>
  );
}
