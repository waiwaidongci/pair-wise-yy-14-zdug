import { useState } from "react";
import { useSurvey } from "../store";
import type { ChangeRequest, Component } from "../types";
import { dimDelta, fmtDims, fmtTime } from "../utils";
import { Badge, EmptyState, Modal, StatusBadge, toast } from "./ui";

export default function ReviewPanel() {
  const { role, committed } = useSurvey();
  const pendingComponents = committed.components.filter((c) => c.status === "in_review");
  const pendingChanges = committed.changes.filter((ch) => ch.status === "pending");
  const decidedChanges = committed.changes.filter((ch) => ch.status !== "pending");

  if (role !== "reviewer") {
    return (
      <section className="panel">
        <div className="heading">
          <div>
            <p>复核待办</p>
            <h2>复核人工作台</h2>
          </div>
        </div>
        <EmptyState text="当前为测量员视角，请在右上角切换为「复核人」处理待办" />
      </section>
    );
  }

  return (
    <div className="review-stack">
      <section className="panel">
        <div className="heading">
          <div>
            <p>待办 · 一</p>
            <h2>构件复核（{pendingComponents.length}）</h2>
          </div>
          <Badge tone="warn">{pendingComponents.length} 待处理</Badge>
        </div>
        {pendingComponents.length === 0 ? (
          <EmptyState text="没有待复核的构件" />
        ) : (
          <div className="review-cards">
            {pendingComponents.map((c) => (
              <ComponentReviewCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>待办 · 二</p>
            <h2>尺寸变更审批（{pendingChanges.length}）</h2>
          </div>
          <Badge tone="warn">{pendingChanges.length} 待对照</Badge>
        </div>
        <div className="notice muted">
          批准后尺寸记录表、病害标记图、构件关系视图同步采用新值；驳回则正式记录继续使用旧尺寸。
        </div>
        {pendingChanges.length === 0 ? (
          <EmptyState text="没有待审批的尺寸变更" />
        ) : (
          <div className="review-cards">
            {pendingChanges.map((ch) => (
              <ChangeReviewCard key={ch.id} ch={ch} />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>历史结论</p>
            <h2>已裁决的尺寸变更</h2>
          </div>
        </div>
        {decidedChanges.length === 0 ? (
          <EmptyState text="还没有审批结论" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>构件</th>
                  <th>旧尺寸</th>
                  <th>申请新尺寸</th>
                  <th>结论</th>
                  <th>意见 / 时间</th>
                </tr>
              </thead>
              <tbody>
                {decidedChanges.map((ch) => {
                  const comp = committed.components.find((c) => c.id === ch.componentId);
                  return (
                    <tr key={ch.id}>
                      <td>{comp ? `${comp.code} ${comp.name}` : ch.componentId}</td>
                      <td className={ch.status === "rejected" ? "strike-keep" : ""}>
                        {fmtDims(ch.oldDimensions)}
                      </td>
                      <td>{fmtDims(ch.newDimensions)}</td>
                      <td>
                        <Badge tone={ch.status === "approved" ? "ok" : "danger"}>
                          {ch.status === "approved" ? "已采用新值" : "驳回·沿用原值"}
                        </Badge>
                      </td>
                      <td>
                        {ch.note || "—"}
                        <small className="role-line">{fmtTime(ch.decidedAt ?? 0)}</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ComponentReviewCard({ c }: { c: Component }) {
  const { dispatch, committed } = useSurvey();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const buildingName = committed.buildings.find((b) => b.id === c.buildingId)?.name;

  function approve() {
    dispatch({ type: "APPROVE_COMPONENT", id: c.id });
    toast(`构件「${c.code}」复核通过`, "success");
  }
  function reject() {
    if (!note.trim()) {
      toast("驳回需填写意见，方便测量员修改", "danger");
      return;
    }
    dispatch({ type: "REJECT_COMPONENT", id: c.id, note: note.trim() });
    toast(`构件「${c.code}」已驳回并退回草稿`, "danger");
    setRejectOpen(false);
  }

  return (
    <article className="review-card">
      <div className="review-card-head">
        <div>
          <b>{c.code}</b> <span>{c.name}</span>
          <StatusBadge status={c.status} />
        </div>
        <small>{buildingName} · 提交于 {fmtTime(c.submittedAt ?? c.createdAt)}</small>
      </div>
      <div className="review-grid">
        <div><small>木材 / 榫卯</small><p>{c.woodSpecies} · {c.tenon}（{c.role}）</p></div>
        <div><small>截面尺寸</small><p>{fmtDims(c.dimensions)}</p></div>
        <div><small>变形情况</small><p>{c.deformation || "无"}</p></div>
        <div><small>修缮建议</small><p>{c.repair || "无"}</p></div>
        <div className="span2">
          <small>病害（{c.damages.length}）</small>
          {c.damages.length === 0 ? (
            <p>无</p>
          ) : (
            <ul className="compact-damages">
              {c.damages.map((d) => (
                <li key={d.id}>
                  {d.part || "未标注位置"}·{d.kind}
                  {d.note ? `：${d.note}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="span2">
          <small>榫卯连接</small>
          <p>
            {c.connectsTo
              .map((id) => committed.components.find((x) => x.id === id))
              .filter(Boolean)
              .map((x) => x!.code)
              .join("、") || "未登记"}
          </p>
        </div>
      </div>
      <div className="review-actions">
        <button className="primary" onClick={approve}>复核通过</button>
        <button className="danger-btn" onClick={() => setRejectOpen(true)}>驳回并退回草稿</button>
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={`驳回构件 · ${c.code}`}
        footer={
          <>
            <button className="ghost-btn" onClick={() => setRejectOpen(false)}>取消</button>
            <button className="danger-btn" onClick={reject}>确认驳回</button>
          </>
        }
      >
        <label className="stack-label">
          <span>驳回意见（退回草稿后，测量员会看到该意见）</span>
          <textarea
            rows={3}
            value={note}
            placeholder="如：柱长与现场明显不符，请复测；病害缺少柱身检查记录"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </Modal>
    </article>
  );
}

function ChangeReviewCard({ ch }: { ch: ChangeRequest }) {
  const { dispatch, findComponent } = useSurvey();
  const comp = findComponent(ch.componentId);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [note, setNote] = useState("");

  function approve() {
    dispatch({ type: "APPROVE_CHANGE", id: ch.id, note: note.trim() || undefined });
    toast("已批准，正式尺寸及各视图同步采用新值", "success");
    setApproveOpen(false);
  }
  function reject() {
    if (!note.trim()) {
      toast("驳回需填写意见", "danger");
      return;
    }
    dispatch({ type: "REJECT_CHANGE", id: ch.id, note: note.trim() });
    toast("已驳回，继续使用原尺寸记录", "danger");
    setRejectOpen(false);
  }

  const deltas = dimDelta(ch.oldDimensions, ch.newDimensions);

  return (
    <article className="review-card change-card">
      <div className="review-card-head">
        <div>
          <b>{comp?.code ?? ch.componentId}</b> <span>{comp?.name}</span>
          <Badge tone="warn">尺寸变更待审批</Badge>
        </div>
        <small>测量员提交于 {fmtTime(ch.createdAt)}</small>
      </div>

      <p className="change-reason">变更原因：{ch.reason}</p>

      <div className="oldnew-compare">
        <div className="dim-col old">
          <small>旧尺寸（当前正式）</small>
          <strong>{fmtDims(ch.oldDimensions)}</strong>
        </div>
        <div className="dim-arrow">对照</div>
        <div className="dim-col new">
          <small>新尺寸（拟采用）</small>
          <strong>{fmtDims(ch.newDimensions)}</strong>
        </div>
      </div>

      <table className="delta-table">
        <thead>
          <tr><th>项</th><th>旧</th><th>新</th><th>差值</th></tr>
        </thead>
        <tbody>
          {deltas.map((d) => {
            const diff = d.to - d.from;
            return (
              <tr key={d.key} className={diff !== 0 ? "changed" : ""}>
                <td>{d.key}</td>
                <td className="num">{d.from}</td>
                <td className="num">{d.to}</td>
                <td>{diff === 0 ? "不变" : `${diff > 0 ? "+" : ""}${diff}mm`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="review-actions">
        <button className="primary" onClick={() => setApproveOpen(true)}>批准 · 采用新尺寸</button>
        <button className="danger-btn" onClick={() => setRejectOpen(true)}>驳回 · 沿用原尺寸</button>
      </div>

      <DecisionModal
        open={approveOpen}
        title={`批准尺寸变更 · ${comp?.code ?? ""}`}
        confirmText="确认批准并同步各视图"
        confirmClass="primary"
        note={note}
        setNote={setNote}
        notePlaceholder="可填写批准意见（可选）"
        onClose={() => setApproveOpen(false)}
        onConfirm={approve}
      />
      <DecisionModal
        open={rejectOpen}
        title={`驳回尺寸变更 · ${comp?.code ?? ""}`}
        confirmText="确认驳回，继续使用原尺寸"
        confirmClass="danger-btn"
        note={note}
        setNote={setNote}
        notePlaceholder="驳回原因，如：复测数据与相邻构件关系矛盾，请重新核对"
        onClose={() => setRejectOpen(false)}
        onConfirm={reject}
      />
    </article>
  );
}

function DecisionModal({
  open,
  title,
  confirmText,
  confirmClass,
  note,
  setNote,
  notePlaceholder,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  confirmText: string;
  confirmClass: string;
  note: string;
  setNote: (s: string) => void;
  notePlaceholder: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="ghost-btn" onClick={onClose}>取消</button>
          <button className={confirmClass} onClick={onConfirm}>{confirmText}</button>
        </>
      }
    >
      <label className="stack-label">
        <span>复核意见</span>
        <textarea
          rows={3}
          value={note}
          placeholder={notePlaceholder}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
    </Modal>
  );
}
