import { useMemo, useState } from "react";
import { useSurvey } from "../store";
import {
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  type ChangeRequest,
  type Component,
  type Damage,
  type MemberRole,
} from "../types";
import { fmtDims } from "../utils";
import { Badge, BuildingSelect, EmptyState, StatusBadge } from "./ui";

interface Box {
  id: string;
  x: number; // 左上角
  y: number;
  w: number;
  h: number;
  vertical: boolean;
}

const VB_W = 920;
const VB_H = 560;

/** 各水平构件所在车道的 y（自上而下：檩→斗拱→梁→枋），柱为竖向通高 */
const LANE_Y: Record<string, number> = {
  檩: 78,
  斗拱: 158,
  梁: 236,
  枋: 316,
  其他: 404,
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function DiseaseMapPanel() {
  const { committed, pendingChangeFor } = useSurvey();
  const [building, setBuilding] = useState(committed.buildings[0]?.id ?? "all");
  const [selected, setSelected] = useState<string | null>(null);

  const official = useMemo(
    () =>
      committed.components.filter(
        (c) => c.buildingId === building && c.status !== "draft"
      ),
    [committed.components, building]
  );

  const { boxes, columnXs } = useMemo(() => buildLayout(official), [official]);
  const boxMap = useMemo(() => new Map(boxes.map((b) => [b.id, b])), [boxes]);

  const selectedComp = official.find((c) => c.id === selected) ?? null;
  const pendingForSelected = selectedComp ? pendingChangeFor(selectedComp.id) : undefined;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>病害标记图</p>
          <h2>木构架立面示意 · 点击构件查看病害</h2>
        </div>
        <BuildingSelect value={building} onChange={setBuilding} allowAll />
      </div>

      <div className="legend">
        <span><i className="severity-dot" style={{ background: SEVERITY_COLOR.minor }} />轻微</span>
        <span><i className="severity-dot" style={{ background: SEVERITY_COLOR.medium }} />中等</span>
        <span><i className="severity-dot" style={{ background: SEVERITY_COLOR.severe }} />严重</span>
        <span className="legend-pending"><i className="pending-mark" />尺寸变更待批</span>
      </div>

      {official.length === 0 ? (
        <EmptyState text="该建筑还没有进入复核流程的构件，无法绘制标记图" />
      ) : (
        <div className="map-stage">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="map-svg" role="img">
            {/* 地面与柱础 */}
            <line x1="40" y1="470" x2="880" y2="470" stroke="#94a3b8" strokeWidth="3" />
            {columnXs.map((x, i) => (
              <rect key={`base-${i}`} x={x - 26} y={470} width={52} height={12} rx={2} fill="#cbd5e1" />
            ))}

            {official.map((c) => {
              const box = boxMap.get(c.id);
              if (!box) return null;
              const pending = pendingChangeFor(c.id);
              return (
                <g
                  key={c.id}
                  className={`member ${selected === c.id ? "selected" : ""} ${
                    pending ? "has-pending" : ""
                  }`}
                  onClick={() => setSelected(c.id)}
                >
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    rx={3}
                    className="member-rect"
                    strokeDasharray={pending ? "6 4" : undefined}
                  />
                  {pending && <text x={box.x + box.w - 8} y={box.y - 6} className="pending-tag">变</text>}
                  {box.w > 70 && (
                    <text
                      x={box.x + box.w / 2}
                      y={box.vertical ? box.y + 16 : box.y + box.h / 2 + 4}
                      className="member-code"
                    >
                      {c.code}
                    </text>
                  )}
                  {c.damages.map((d, i) => (
                    <Dot key={d.id} box={box} damage={d} index={i} />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {selectedComp ? (
        <MemberDetail
          c={selectedComp}
          pending={pendingForSelected}
          onClose={() => setSelected(null)}
        />
      ) : (
        <p className="rail-hint">
          构件外形按正式截面尺寸绘制；变更批准后图形按新尺寸重绘，驳回则保持原尺寸。草稿构件不进入本图。
        </p>
      )}
    </section>
  );
}

function Dot({ box, damage, index }: { box: Box; damage: Damage; index: number }) {
  const p = dotPosition(box, damage.part, index);
  return (
    <g className="disease-dot">
      <circle cx={p.x} cy={p.y} r={8} fill={SEVERITY_COLOR[damage.severity]} stroke="#fff" strokeWidth={2}>
        <title>{`${damage.part || "未标注位置"} · ${damage.kind} · ${SEVERITY_LABEL[damage.severity]}`}</title>
      </circle>
    </g>
  );
}

function dotPosition(box: Box, part: string, index: number): { x: number; y: number } {
  const text = part || "";
  const jitter = index % 2 === 0 ? 0 : 14;
  if (box.vertical) {
    // 柱：柱脚→下，柱顶/顶→上，其余在柱身中部偏移
    if (text.includes("脚")) return { x: box.x + box.w / 2, y: box.y + box.h - 12 };
    if (text.includes("顶") || text.includes("上端"))
      return { x: box.x + box.w / 2, y: box.y + 12 };
    return { x: box.x + box.w / 2 + (index % 2 === 0 ? -2 : 2), y: box.y + box.h * 0.45 + jitter };
  }
  // 水平构件：东端/左端→左，西端/右端→右，中段/中→中
  const leftish = text.includes("东") || text.includes("左端");
  const rightish = text.includes("西") || text.includes("右端");
  const cx = leftish
    ? box.x + 14
    : rightish
      ? box.x + box.w - 14
      : box.x + box.w / 2;
  const cy = box.y + box.h / 2 + (index % 2 === 0 ? -2 : 3);
  return { x: cx, y: cy };
}

function buildLayout(members: Component[]): { boxes: Box[]; columnXs: number[] } {
  const columns = members.filter((m) => m.role === "柱");
  const others = members.filter((m) => m.role !== "柱");

  // 柱水平均布
  const leftBound = 100;
  const rightBound = VB_W - 100;
  const columnXs = columns.map((_, i) =>
    columns.length === 1
      ? (leftBound + rightBound) / 2
      : leftBound + (i * (rightBound - leftBound)) / (columns.length - 1)
  );

  const boxes: Box[] = [];

  columns.forEach((c, i) => {
    const w = clamp(c.dimensions.width / 8, 16, 42);
    const h = clamp(c.dimensions.length / 9, 210, 350);
    const cx = columnXs[i];
    boxes.push({
      id: c.id,
      x: cx - w / 2,
      y: 470 - h,
      w,
      h,
      vertical: true,
    });
  });

  // 水平构件按车道排布，每行最多 4 个，避免完全重叠
  const laneCounters: Record<string, number> = {};
  others.forEach((c) => {
    const lane: MemberRole = LANE_Y[c.role] !== undefined ? c.role : "其他";
    const idx = laneCounters[lane] ?? 0;
    laneCounters[lane] = idx + 1;

    const w = clamp(c.dimensions.length / 5, 90, 340);
    const h = lane === "斗拱" ? clamp(c.dimensions.height / 2, 22, 46) : clamp(c.dimensions.height / 6, 9, 26);
    const perRow = 3;
    const col = idx % perRow;
    const row = Math.floor(idx / perRow);
    const slotW = (VB_W - 160) / perRow;
    const cx = 80 + slotW * col + slotW / 2;
    const y = LANE_Y[lane] + row * 44 - (lane === "斗拱" ? 0 : 0);

    boxes.push({ id: c.id, x: cx - w / 2, y, w, h, vertical: false });
  });

  return { boxes, columnXs };
}

function MemberDetail({
  c,
  pending,
  onClose,
}: {
  c: Component;
  pending?: ChangeRequest;
  onClose: () => void;
}) {
  return (
    <div className="member-detail">
      <div className="detail-head">
        <div>
          <b>{c.code}</b>
          <span>{c.name} · {c.role} · {c.woodSpecies} · {c.tenon}</span>
        </div>
        <div className="detail-head-right">
          <StatusBadge status={c.status} />
          <button className="icon-btn" onClick={onClose}>收起</button>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <small>当前正式尺寸</small>
          <strong>{fmtDims(c.dimensions)}</strong>
          {pending && (
            <div className="pending-dims">
              <Badge tone="warn">待批新尺寸</Badge>
              <span>{fmtDims(pending.newDimensions)}</span>
            </div>
          )}
        </div>
        <div>
          <small>变形情况</small>
          <p>{c.deformation || "无记录"}</p>
        </div>
        <div className="detail-damages">
          <small>病害（{c.damages.length}）</small>
          {c.damages.length === 0 ? (
            <p>无</p>
          ) : (
            <ul>
              {c.damages.map((d) => (
                <li key={d.id}>
                  <i className="severity-dot" style={{ background: SEVERITY_COLOR[d.severity] }} />
                  <b>{d.part || "未标注位置"}·{d.kind}·{SEVERITY_LABEL[d.severity]}</b>
                  {d.note && <span>{d.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <small>修缮建议</small>
          <p>{c.repair || "暂无"}</p>
        </div>
      </div>
    </div>
  );
}
