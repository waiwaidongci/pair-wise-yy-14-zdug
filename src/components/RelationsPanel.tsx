import { useMemo, useState } from "react";
import { useSurvey } from "../store";
import {
  SEVERITY_COLOR,
  type Component,
  type MemberRole,
} from "../types";
import { fmtDims } from "../utils";
import { Badge, BuildingSelect, EmptyState } from "./ui";

const W = 940;
const H = 600;

const ROLE_Y: Record<MemberRole, number> = {
  柱: 470,
  枋: 350,
  梁: 250,
  斗拱: 160,
  檩: 80,
  其他: 540,
};

interface NodePos {
  id: string;
  x: number;
  y: number;
}

export default function RelationsPanel() {
  const { committed, findComponent, pendingChangeFor } = useSurvey();
  const [building, setBuilding] = useState(committed.buildings[0]?.id ?? "all");
  const [selected, setSelected] = useState<string | null>(null);

  const nodes = useMemo(
    () =>
      committed.components.filter(
        (c) => c.buildingId === building && c.status !== "draft"
      ),
    [committed.components, building]
  );

  // 同一构件部位横向均布
  const positions = useMemo(() => {
    const byRole = new Map<MemberRole, Component[]>();
    nodes.forEach((c) => {
      const list = byRole.get(c.role) ?? [];
      list.push(c);
      byRole.set(c.role, list);
    });
    const pos = new Map<string, NodePos>();
    const pad = 120;
    byRole.forEach((list, role) => {
      list.forEach((c, i) => {
        const x =
          list.length === 1
            ? W / 2
            : pad + (i * (W - pad * 2)) / (list.length - 1);
        pos.set(c.id, { id: c.id, x, y: ROLE_Y[role] });
      });
    });
    return pos;
  }, [nodes]);

  // 无向边去重
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const list: { a: Component; b: Component }[] = [];
    nodes.forEach((c) => {
      c.connectsTo.forEach((otherId) => {
        const other = findComponent(otherId);
        if (!other || other.buildingId !== building || other.status === "draft") return;
        const key = [c.id, otherId].sort().join("::");
        if (seen.has(key)) return;
        seen.add(key);
        list.push({ a: c, b: other });
      });
    });
    return list;
  }, [nodes, findComponent, building]);

  const selectedComp = selected ? findComponent(selected) : null;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>构件关系视图</p>
          <h2>单栋建筑 · 榫卯连接关系</h2>
        </div>
        <BuildingSelect value={building} onChange={setBuilding} allowAll />
      </div>

      {nodes.length === 0 ? (
        <EmptyState text="该建筑还没有进入复核流程的构件" />
      ) : (
        <div className="map-stage relations">
          <svg viewBox={`0 0 ${W} ${H}`} className="map-svg">
            {ROLE_LABELS.map(([role, label]) => (
              <g key={role}>
                <line x1="40" y1={ROLE_Y[role] + 34} x2={W - 40} y2={ROLE_Y[role] + 34}
                  stroke="#eef2f7" strokeWidth="1" />
                <text x="46" y={ROLE_Y[role] - 26} className="lane-label">{label}层</text>
              </g>
            ))}

            {edges.map(({ a, b }, i) => {
              const pa = positions.get(a.id)!;
              const pb = positions.get(b.id)!;
              const midX = (pa.x + pb.x) / 2;
              const midY = (pa.y + pb.y) / 2;
              return (
                <g key={i} className="edge">
                  <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} />
                  <g className="edge-label" transform={`translate(${midX},${midY})`}>
                    <rect x="-30" y="-12" width="60" height="20" rx="10" />
                    <text textAnchor="middle" y="2">{a.tenon}</text>
                  </g>
                </g>
              );
            })}

            {nodes.map((c) => {
              const p = positions.get(c.id)!;
              const isSel = selected === c.id;
              const connected =
                selectedComp?.connectsTo.includes(c.id) ||
                (c.id !== selected && selectedComp && c.connectsTo.includes(selectedComp.id));
              const pending = pendingChangeFor(c.id);
              return (
                <g
                  key={c.id}
                  transform={`translate(${p.x},${p.y})`}
                  className={`node ${isSel ? "selected" : ""} ${connected ? "connected" : ""}`}
                  onClick={() => setSelected(isSel ? null : c.id)}
                >
                  <rect x="-58" y="-24" width="116" height="48" rx="8" />
                  <text className="node-code" textAnchor="middle" y="-4">{c.code}</text>
                  <text className="node-dim" textAnchor="middle" y="14">
                    {c.dimensions.length}mm
                  </text>
                  {c.damages.length > 0 && (
                    <circle
                      className="node-damage"
                      cx="50"
                      cy="-18"
                      r="9"
                      fill={SEVERITY_COLOR[
                        c.damages.some((d) => d.severity === "severe")
                          ? "severe"
                          : c.damages.some((d) => d.severity === "medium")
                            ? "medium"
                            : "minor"
                      ]}
                    >
                      <title>{`${c.damages.length} 处病害`}</title>
                    </circle>
                  )}
                  {c.damages.length > 0 && (
                    <text x="50" y="-14" textAnchor="middle" className="node-damage-num">
                      {c.damages.length}
                    </text>
                  )}
                  {pending && (
                    <g transform="translate(-58,-30)">
                      <rect width="16" height="16" rx="3" className="pending-flag" />
                      <text x="8" y="12" textAnchor="middle" className="pending-flag-text">变</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {selectedComp ? (
        <div className="rel-detail">
          <div>
            <b>{selectedComp.code} {selectedComp.name}</b>
            <span>{selectedComp.role} · {selectedComp.woodSpecies} · {selectedComp.tenon}</span>
          </div>
          <div>
            <small>当前正式尺寸</small>
            <strong>{fmtDims(selectedComp.dimensions)}</strong>
            {pendingChangeFor(selectedComp.id) && (
              <Badge tone="warn">
                待批：{fmtDims(pendingChangeFor(selectedComp.id)!.newDimensions)}
              </Badge>
            )}
          </div>
          <div>
            <small>榫接构件</small>
            <p>
              {selectedComp.connectsTo.length === 0
                ? "未登记连接关系"
                : selectedComp.connectsTo
                    .map((id) => findComponent(id))
                    .filter(Boolean)
                    .map((c) => `${c!.code} ${c!.name}`)
                    .join("、")}
            </p>
          </div>
        </div>
      ) : (
        <p className="rail-hint">
          连线表示榫卯连接，标签为连接榫卯类型；节点上标注当前正式长度，变更批准后同步显示新值。
        </p>
      )}
    </section>
  );
}

const ROLE_LABELS: [MemberRole, string][] = [
  ["檩", "檩"],
  ["斗拱", "斗拱"],
  ["梁", "梁架"],
  ["枋", "枋"],
  ["柱", "柱网"],
];
