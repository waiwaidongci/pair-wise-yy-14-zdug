import { useEffect, useMemo, useRef, useState } from "react";
import { useSurvey } from "../store";
import {
  DAMAGE_KINDS,
  MEMBER_ROLES,
  SEVERITY_LABEL,
  TENON_TYPES,
  WOOD_SUGGESTIONS,
  type Component,
  type Damage,
  type Dimensions,
  type MemberRole,
  type Severity,
  type TenonType,
} from "../types";
import { dimsValid, fmtTime, uid } from "../utils";
import { Badge, BuildingSelect, EmptyState, StatusBadge, toast } from "./ui";

const EMPTY_DIMS: Dimensions = { width: 0, height: 0, length: 0 };

function blankComponent(buildingId: string): Component {
  return {
    id: uid("c"),
    code: "",
    name: "",
    buildingId,
    role: "梁",
    woodSpecies: "",
    tenon: "燕尾榫",
    dimensions: { ...EMPTY_DIMS },
    damages: [],
    deformation: "",
    repair: "",
    connectsTo: [],
    status: "draft",
    createdAt: Date.now(),
  };
}

function isMeaningful(c: Component): boolean {
  return Boolean(c.code.trim() || c.name.trim() || c.repair.trim() || c.woodSpecies.trim());
}

export default function RegisterPanel() {
  const { committed, drafts, role, dispatch } = useSurvey();
  const [buildingId, setBuildingId] = useState(committed.buildings[0]?.id ?? "all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newBuilding, setNewBuilding] = useState("");
  const [showAddBuilding, setShowAddBuilding] = useState(false);

  const buildingDrafts = drafts.components.filter((c) => c.buildingId === buildingId);
  const editing = drafts.components.find((c) => c.id === editingId) ?? null;
  const readonly = role === "reviewer";

  // 建筑被切换/删除后纠正选择
  useEffect(() => {
    if (!committed.buildings.some((b) => b.id === buildingId)) {
      setBuildingId(committed.buildings[0]?.id ?? "all");
    }
  }, [committed.buildings, buildingId]);

  function addBuilding() {
    const name = newBuilding.trim();
    if (!name) return;
    dispatch({ type: "ADD_BUILDING", name });
    setNewBuilding("");
    setShowAddBuilding(false);
    toast(`已新增建筑「${name}」，可在下拉中选择`, "success");
  }

  return (
    <div className="register-layout">
      <aside className="panel draft-rail">
        <div className="heading">
          <div>
            <p>连续登记</p>
            <h2>未提交草稿</h2>
          </div>
          <Badge tone="warn">{buildingDrafts.length}</Badge>
        </div>
        <div className="building-picker">
          <BuildingSelect value={buildingId} onChange={setBuildingId} />
          <button
            className="ghost-btn"
            onClick={() => setShowAddBuilding((v) => !v)}
            title="新增建筑"
          >
            + 建筑
          </button>
        </div>
        {showAddBuilding && (
          <div className="inline-add">
            <input
              placeholder="输入建筑名称，如 西配殿"
              value={newBuilding}
              onChange={(e) => setNewBuilding(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBuilding()}
            />
            <button className="primary sm" onClick={addBuilding}>
              添加
            </button>
          </div>
        )}

        <div className="draft-list">
          <button
            className={`draft-card new ${editingId === null ? "active" : ""}`}
            onClick={() => setEditingId(null)}
          >
            <b>＋</b>
            <span>新登记一个构件</span>
          </button>
          {buildingDrafts.length === 0 && (
            <EmptyState text="本建筑暂无未提交草稿，内容会自动保留" />
          )}
          {buildingDrafts.map((d) => (
            <div
              key={d.id}
              className={`draft-card ${editingId === d.id ? "active" : ""}`}
              onClick={() => setEditingId(d.id)}
            >
              <div className="draft-main">
                <b>{d.code || "未命名构件"}</b>
                <span>{d.name || "尚未填写名称"}</span>
                {d.rejectNote && <em className="reject-flag">上次驳回：{d.rejectNote}</em>}
              </div>
              <div className="draft-meta">
                <StatusBadge status="draft" />
                <small>{fmtTime(d.createdAt)}</small>
              </div>
              {!readonly && (
                <button
                  className="icon-btn danger"
                  title="放弃草稿"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "DELETE_DRAFT_COMPONENT", id: d.id });
                    if (editingId === d.id) setEditingId(null);
                    toast("已放弃该草稿");
                  }}
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="rail-hint">
          草稿与已复核记录分开保存；关闭页面再打开仍在此处，且不会覆盖已复核内容。
        </p>
      </aside>

      <ComponentForm
        key={editingId ?? `new-${buildingId}`}
        buildingId={buildingId}
        initial={editing}
        readonly={readonly}
        onSubmitted={() => setEditingId(null)}
      />
    </div>
  );
}

function ComponentForm({
  buildingId,
  initial,
  readonly,
  onSubmitted,
}: {
  buildingId: string;
  initial: Component | null;
  readonly: boolean;
  onSubmitted: () => void;
}) {
  const { committed, drafts, dispatch } = useSurvey();
  const idRef = useRef<string>(initial?.id ?? uid("c"));
  const submittedRef = useRef(false);
  const [form, setForm] = useState<Component>(
    () => initial ?? blankComponent(buildingId)
  );
  const [savedFlash, setSavedFlash] = useState(false);

  const set = <K extends keyof Component>(key: K, value: Component[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // 自动保存草稿：任一字段变化即写入独立草稿区，保证关闭后仍在。
  // 提交后由父组件切换表单（key 重挂载），此实例不再回写草稿。
  useEffect(() => {
    if (submittedRef.current) return;
    const c = { ...form, id: idRef.current, buildingId, status: "draft" as const };
    const exists = drafts.components.some((d) => d.id === c.id);
    if (isMeaningful(c)) {
      dispatch({ type: "SAVE_DRAFT_COMPONENT", component: c });
      setSavedFlash(true);
      const tm = window.setTimeout(() => setSavedFlash(false), 900);
      return () => window.clearTimeout(tm);
    }
    // 仅清理当前编辑过程中产生、又被清空的空草稿；样例/他人草稿不动
    if (exists && !initial) {
      dispatch({ type: "DELETE_DRAFT_COMPONENT", id: c.id });
    }
  }, [form, buildingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 同建筑可榫卯连接的其他构件（正式构件 + 草稿）
  const connectable = useMemo(() => {
    return [...committed.components, ...drafts.components].filter(
      (c) => c.buildingId === buildingId && c.id !== idRef.current
    );
  }, [committed.components, drafts.components, buildingId]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!form.code.trim()) e.push("构件编号");
    if (!form.name.trim()) e.push("构件名称");
    if (!form.woodSpecies.trim()) e.push("木材种类");
    if (!dimsValid(form.dimensions)) e.push("有效的截面尺寸（宽/高/长均大于 0）");
    return e;
  }, [form]);

  function submit() {
    if (errors.length) {
      toast(`还需填写：${errors.join("、")}`, "danger");
      return;
    }
    // 保证最新内容已落草稿，再提交进入待复核
    dispatch({
      type: "SAVE_DRAFT_COMPONENT",
      component: { ...form, id: idRef.current, buildingId, status: "draft" },
    });
    submittedRef.current = true;
    dispatch({ type: "SUBMIT_COMPONENT", id: idRef.current });
    toast(`构件「${form.code}」已提交复核`, "success");
    onSubmitted();
  }

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>专业字段</p>
          <h2>{initial ? "编辑草稿构件" : "新登记构件"}</h2>
        </div>
        <div className="heading-actions">
          {savedFlash && <span className="save-flash">草稿已自动保存</span>}
          {!readonly && (
            <button className="primary" onClick={submit}>
              提交复核
            </button>
          )}
        </div>
      </div>

      {readonly && (
        <div className="notice muted">当前为复核人视角，登记由测量员完成。</div>
      )}
      {initial?.rejectNote && (
        <div className="notice danger">
          复核驳回意见：{initial.rejectNote}。请修改后重新提交。
        </div>
      )}

      <fieldset disabled={readonly} className="form-fieldset">
        <div className="field-grid">
          <label>
            <span>建筑名称</span>
            <BuildingSelect
              value={form.buildingId}
              onChange={(v) => set("buildingId", v)}
            />
          </label>
          <label>
            <span>构件编号 *</span>
            <input
              value={form.code}
              placeholder="如 梁架A-03"
              onChange={(e) => set("code", e.target.value)}
            />
          </label>
          <label>
            <span>构件名称 *</span>
            <input
              value={form.name}
              placeholder="如 东三架梁"
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label>
            <span>构件部位</span>
            <select
              className="select"
              value={form.role}
              onChange={(e) => set("role", e.target.value as MemberRole)}
            >
              {MEMBER_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            <span>木材种类 *</span>
            <input
              list="wood-list"
              value={form.woodSpecies}
              placeholder="如 楠木"
              onChange={(e) => set("woodSpecies", e.target.value)}
            />
            <datalist id="wood-list">
              {WOOD_SUGGESTIONS.map((w) => (
                <option key={w} value={w} />
              ))}
            </datalist>
          </label>
          <label>
            <span>榫卯类型</span>
            <select
              className="select"
              value={form.tenon}
              onChange={(e) => set("tenon", e.target.value as TenonType)}
            >
              {TENON_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="sub-head">
          <h3>截面尺寸（mm）</h3>
          <small>宽 × 高 × 长</small>
        </div>
        <div className="dims-row">
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
                value={form.dimensions[k] || ""}
                placeholder="0"
                onChange={(e) =>
                  set("dimensions", {
                    ...form.dimensions,
                    [k]: Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
        </div>

        <DamageEditor
          damages={form.damages}
          onChange={(damages) => set("damages", damages)}
        />

        <div className="field-grid">
          <label>
            <span>变形情况</span>
            <textarea
              rows={2}
              value={form.deformation}
              placeholder="如 端部下沉 6mm"
              onChange={(e) => set("deformation", e.target.value)}
            />
          </label>
          <label>
            <span>修缮建议</span>
            <textarea
              rows={2}
              value={form.repair}
              placeholder="如 端部箍铁加固，持续监测"
              onChange={(e) => set("repair", e.target.value)}
            />
          </label>
        </div>

        <div className="sub-head">
          <h3>榫卯连接关系</h3>
          <small>勾选本构件与哪些构件榫接（用于关系视图）</small>
        </div>
        <div className="connect-pick">
          {connectable.length === 0 && <EmptyState text="本建筑暂无可连接的其他构件" />}
          {connectable.map((c) => (
            <label key={c.id} className="check-chip">
              <input
                type="checkbox"
                checked={form.connectsTo.includes(c.id)}
                onChange={(e) =>
                  set(
                    "connectsTo",
                    e.target.checked
                      ? [...form.connectsTo, c.id]
                      : form.connectsTo.filter((x) => x !== c.id)
                  )
                }
              />
              <span>
                {c.code || "未命名"} · {c.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

function DamageEditor({
  damages,
  onChange,
}: {
  damages: Damage[];
  onChange: (d: Damage[]) => void;
}) {
  function add() {
    onChange([
      ...damages,
      { id: uid("dmg"), part: "", kind: "开裂", severity: "minor", note: "" },
    ]);
  }
  function patch(id: string, p: Partial<Damage>) {
    onChange(damages.map((d) => (d.id === id ? { ...d, ...p } : d)));
  }
  return (
    <div className="damage-editor">
      <div className="sub-head">
        <h3>病害位置与情况</h3>
        <button type="button" className="ghost-btn sm" onClick={add}>
          + 添加病害
        </button>
      </div>
      {damages.length === 0 && <EmptyState text="暂无病害记录，可点击右上角添加" />}
      <div className="damage-rows">
        {damages.map((d) => (
          <div key={d.id} className="damage-row">
            <input
              placeholder="病害位置，如 东端端部 / 柱脚"
              value={d.part}
              onChange={(e) => patch(d.id, { part: e.target.value })}
            />
            <select
              className="select"
              value={d.kind}
              onChange={(e) => patch(d.id, { kind: e.target.value })}
            >
              {DAMAGE_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <select
              className="select"
              value={d.severity}
              onChange={(e) => patch(d.id, { severity: e.target.value as Severity })}
            >
              {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
            <input
              placeholder="病害描述（可选）"
              value={d.note}
              onChange={(e) => patch(d.id, { note: e.target.value })}
            />
            <button
              type="button"
              className="icon-btn danger"
              onClick={() => onChange(damages.filter((x) => x.id !== d.id))}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
