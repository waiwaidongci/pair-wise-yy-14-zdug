import { useMemo, useState } from "react";
import { useSurvey } from "../store";
import type { ChangeStatus } from "../types";
import { dimDelta, fmtTime } from "../utils";
import { Badge, BuildingSelect, EmptyState } from "./ui";

const CHANGE_LABEL: Record<ChangeStatus, string> = {
  pending: "待审批",
  approved: "已批准",
  rejected: "已驳回",
};
const CHANGE_TONE: Record<ChangeStatus, "warn" | "ok" | "danger"> = {
  pending: "warn",
  approved: "ok",
  rejected: "danger",
};

export default function DimensionsPanel() {
  const { committed } = useSurvey();
  const [building, setBuilding] = useState(committed.buildings[0]?.id ?? "all");

  const components = useMemo(
    () =>
      committed.components
        .filter((c) => c.buildingId === building)
        .sort((a, b) => (b.approvedAt ?? b.submittedAt ?? 0) - (a.approvedAt ?? a.submittedAt ?? 0)),
    [committed.components, building]
  );

  // 以构件 id 取最近一条变更（已批准即代表当前正式值的来源）
  const lastChangeByComp = useMemo(() => {
    const map = new Map<string, (typeof committed.changes)[number]>();
    for (const ch of committed.changes) {
      const cur = map.get(ch.componentId);
      if (!cur || ch.createdAt > cur.createdAt) map.set(ch.componentId, ch);
    }
    return map;
  }, [committed.changes]);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>尺寸记录表</p>
          <h2>正式截面尺寸与变更结论</h2>
        </div>
        <BuildingSelect value={building} onChange={setBuilding} allowAll />
      </div>

      <div className="notice muted">
        批准变更后，本表（以及病害标记图、构件关系视图）统一采用新尺寸；驳回则继续显示原记录。
      </div>

      <div className="table-wrap">
        <table className="data-table dim-table">
          <thead>
            <tr>
              <th>构件编号</th>
              <th>部位</th>
              <th>宽(mm)</th>
              <th>高(mm)</th>
              <th>长(mm)</th>
              <th>旧尺寸 / 对照</th>
              <th>变更结论</th>
            </tr>
          </thead>
          <tbody>
            {components.map((c) => {
              const ch = lastChangeByComp.get(c.id);
              return (
                <tr key={c.id}>
                  <td>
                    <b>{c.code}</b>
                    <small className="role-line">{c.name}</small>
                  </td>
                  <td>{c.role}</td>
                  <td className="num">{c.dimensions.width}</td>
                  <td className="num">{c.dimensions.height}</td>
                  <td className="num">{c.dimensions.length}</td>
                  <td>
                    {ch ? (
                      <OldVsCurrent
                        current={c.dimensions}
                        old={ch.oldDimensions}
                        adopted={ch.status === "approved"}
                      />
                    ) : (
                      <span className="muted-text">原始记录</span>
                    )}
                  </td>
                  <td>
                    {ch ? (
                      <div className="change-conclusion">
                        <Badge tone={CHANGE_TONE[ch.status]}>{CHANGE_LABEL[ch.status]}</Badge>
                        <small>{fmtTime(ch.decidedAt ?? ch.createdAt)}</small>
                        {ch.note && <em className="note-line">「{ch.note}」</em>}
                      </div>
                    ) : (
                      <span className="muted-text">无变更</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {components.length === 0 && <EmptyState text="该建筑还没有进入复核流程的构件" />}
      </div>
    </section>
  );
}

function OldVsCurrent({
  current,
  old,
  adopted,
}: {
  current: { width: number; height: number; length: number };
  old: { width: number; height: number; length: number };
  adopted: boolean;
}) {
  const deltas = dimDelta(old, current);
  return (
    <div className="old-cells">
      <span className={adopted ? "old-dim" : "muted-text"}>
        {old.width}×{old.height}×{old.length}
        {!adopted && "（沿用中）"}
      </span>
      <span className="delta-chips">
        {adopted &&
          deltas.map((d) =>
            d.to === d.from ? null : (
              <Badge key={d.key} tone="muted">
                {d.key} {d.from}→{d.to}
              </Badge>
            )
          )}
      </span>
    </div>
  );
}
