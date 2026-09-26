import type { CommittedState, DraftState } from "./types";
import { uid } from "./utils";

const now = Date.now();
const t = (minutesAgo: number) => now - minutesAgo * 60_000;

export function buildSeed(): { committed: CommittedState; drafts: DraftState } {
  const b1 = { id: "b_zhd", name: "正殿（东配殿）" };
  const b2 = { id: "b_xwd", name: "西配殿" };

  const c1 = {
    id: "c_lj03",
    code: "梁架A-03",
    name: "东三架梁",
    buildingId: b1.id,
    role: "梁" as const,
    woodSpecies: "楠木",
    tenon: "透榫" as const,
    dimensions: { width: 180, height: 240, length: 3200 },
    damages: [
      {
        id: uid("d"),
        part: "东端端部",
        kind: "开裂",
        severity: "medium" as const,
        note: "顺纹裂缝长约 220mm，暂未贯通",
      },
    ],
    deformation: "端部略有下沉，挠度 6mm",
    repair: "端部箍铁加固，持续监测挠度",
    connectsTo: ["c_zz01", "c_zz02"],
    status: "approved" as const,
    createdAt: t(120),
    submittedAt: t(100),
    approvedAt: t(90),
  };

  const c2 = {
    id: "c_zz01",
    code: "柱网C-12",
    name: "前檐东角金柱",
    buildingId: b1.id,
    role: "柱" as const,
    woodSpecies: "楠木",
    tenon: "燕尾榫" as const,
    dimensions: { width: 320, height: 320, length: 3600 },
    damages: [
      {
        id: uid("d"),
        part: "柱脚",
        kind: "糟朽",
        severity: "severe" as const,
        note: "柱脚糟朽高度约 180mm，含水率偏高",
      },
    ],
    deformation: "柱身基本竖直，向东倾斜 8mm",
    repair: "建议局部墩接，更换糟朽段并做防腐",
    connectsTo: ["c_lj03", "c_jl05"],
    status: "approved" as const,
    createdAt: t(110),
    submittedAt: t(95),
    approvedAt: t(85),
  };

  const c3 = {
    id: "c_dg07",
    code: "斗拱D-07",
    name: "前檐平身科斗拱",
    buildingId: b1.id,
    role: "斗拱" as const,
    woodSpecies: "杉木",
    tenon: "半榫" as const,
    dimensions: { width: 90, height: 120, length: 640 },
    damages: [
      {
        id: uid("d"),
        part: "拱身",
        kind: "变形",
        severity: "minor" as const,
        note: "拱身轻微外闪，斗欹略有磨损",
      },
    ],
    deformation: "整体轻微外闪 3mm",
    repair: "继续监测，暂不落架",
    connectsTo: ["c_lj03"],
    status: "approved" as const,
    createdAt: t(105),
    submittedAt: t(92),
    approvedAt: t(82),
  };

  // 待复核构件：演示现场组刚提交
  const c4 = {
    id: "c_fz02",
    code: "枋件B-02",
    name: "前檐穿插枋",
    buildingId: b1.id,
    role: "枋" as const,
    woodSpecies: "松木",
    tenon: "箍头榫" as const,
    dimensions: { width: 140, height: 180, length: 2800 },
    damages: [
      {
        id: uid("d"),
        part: "中段下沿",
        kind: "缺损",
        severity: "medium" as const,
        note: "下沿局部缺损，边缘朽蚀",
      },
    ],
    deformation: "无明显变形",
    repair: "剔除朽蚀层后补配同质木料",
    connectsTo: ["c_zz01", "c_zz02"],
    status: "in_review" as const,
    createdAt: t(40),
    submittedAt: t(20),
  };

  // 待审批的尺寸变更：演示「新旧尺寸对照」
  const change1 = {
    id: "ch_01",
    componentId: "c_lj03",
    oldDimensions: { width: 180, height: 240, length: 3200 },
    newDimensions: { width: 185, height: 240, length: 3180 },
    reason: "现场复测发现东端端部裂缝修整后净长缩短，截面宽补测为 185mm",
    status: "pending" as const,
    createdAt: t(15),
  };

  const committed: CommittedState = {
    buildings: [b1, b2],
    components: [c1, c2, c3, c4],
    changes: [change1],
    logs: [],
  };

  // 未提交草稿：演示关闭页面后重新打开仍保留
  const draftComponent = {
    id: "c_draft01",
    code: "檩条E-05",
    name: "前檐檐檩（草稿）",
    buildingId: b1.id,
    role: "檩" as const,
    woodSpecies: "杉木",
    tenon: "半榫" as const,
    dimensions: { width: 0, height: 0, length: 0 },
    damages: [],
    deformation: "",
    repair: "",
    connectsTo: [],
    status: "draft" as const,
    createdAt: t(5),
  };

  const drafts: DraftState = {
    components: [draftComponent],
    changeDrafts: [],
  };

  return { committed, drafts };
}
