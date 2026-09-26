import { useEffect, useMemo, useState } from "react";
import "./styles.css";

type Role = "surveyor" | "reviewer";
type Severity = "低" | "中" | "高";
type RecordStatus = "pending" | "reviewed" | "rejected";
type RequestStatus = "pending" | "approved" | "rejected";
type DraftKind = "create" | "change" | "resubmit";

interface Dimensions {
  width: number;
  height: number;
  length: number;
}

interface Defect {
  id: string;
  kind: string;
  location: string;
  x: number;
  y: number;
  severity: Severity;
  deformation: string;
  advice: string;
}

interface ComponentValues {
  building: string;
  code: string;
  name: string;
  wood: string;
  joint: string;
  dimensions: Dimensions;
  defects: Defect[];
  repairAdvice: string;
  connections: string[];
}

interface ComponentRecord extends ComponentValues {
  id: string;
  status: RecordStatus;
  createdAt: number;
  submittedAt?: number;
  reviewedAt?: number;
  reviewNote?: string;
  note?: string;
}

interface ChangeRequest {
  id: string;
  componentId: string;
  status: RequestStatus;
  submittedAt: number;
  reviewedAt?: number;
  note: string;
  reviewerNote?: string;
  oldValues: ComponentValues;
  proposed: ComponentValues;
}

interface DefectDraft {
  id: string;
  kind: string;
  location: string;
  x: string;
  y: string;
  severity: Severity | "";
  deformation: string;
  advice: string;
}

interface DraftState {
  kind: DraftKind;
  componentId?: string;
  building: string;
  code: string;
  name: string;
  wood: string;
  joint: string;
  width: string;
  height: string;
  length: string;
  defects: DefectDraft[];
  repairAdvice: string;
  connections: string;
  note: string;
  savedAt?: number;
}

interface WorkflowState {
  records: ComponentRecord[];
  requests: ChangeRequest[];
}

const WORKFLOW_KEY = "timber-survey-workflow-v1";
const DRAFT_KEY = "timber-survey-draft-v1";

const JOINT_TYPES = ["燕尾榫", "透榫", "半榫", "箍头榫", "银锭榫", "馒头榫"];
const DEFECT_TYPES = ["开裂", "糟朽", "变形", "虫蛀", "风化", "松动"];
const SEVERITIES: Severity[] = ["低", "中", "高"];

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyDefect(): DefectDraft {
  return {
    id: uid("def"),
    kind: "",
    location: "",
    x: "",
    y: "",
    severity: "",
    deformation: "",
    advice: "",
  };
}

function makeCreateDraft(building: string): DraftState {
  return {
    kind: "create",
    building,
    code: "",
    name: "",
    wood: "",
    joint: "",
    width: "",
    height: "",
    length: "",
    defects: [emptyDefect()],
    repairAdvice: "",
    connections: "",
    note: "",
  };
}

function seedWorkflow(): WorkflowState {
  const now = Date.now();

  const l01Values: ComponentValues = {
    building: "大雄宝殿",
    code: "L-01",
    name: "五架梁",
    wood: "楠木",
    joint: "透榫",
    dimensions: { width: 320, height: 220, length: 4200 },
    defects: [
      {
        id: "def-l01-1",
        kind: "开裂",
        location: "梁端东侧榫颈",
        x: 18,
        y: 38,
        severity: "中",
        deformation: "顺纹裂纹长180mm",
        advice: "环氧腻子嵌补后碳纤维加固",
      },
    ],
    repairAdvice: "端部卸力修补，每年潮季复查",
    connections: ["Z-01"],
  };

  const z01Values: ComponentValues = {
    building: "大雄宝殿",
    code: "Z-01",
    name: "金柱",
    wood: "柏木",
    joint: "箍头榫",
    dimensions: { width: 280, height: 280, length: 3600 },
    defects: [
      {
        id: "def-z01-1",
        kind: "糟朽",
        location: "柱脚东南侧",
        x: 52,
        y: 84,
        severity: "高",
        deformation: "柱脚径向收缩6mm",
        advice: "局部墩接并补做防腐",
      },
    ],
    repairAdvice: "墩接后监测柱脚含水率",
    connections: ["L-01", "D-01"],
  };

  const d01Values: ComponentValues = {
    building: "大雄宝殿",
    code: "D-01",
    name: "平身科斗拱",
    wood: "樟木",
    joint: "半榫",
    dimensions: { width: 120, height: 100, length: 650 },
    defects: [
      {
        id: "def-d01-1",
        kind: "变形",
        location: "拱瓣东侧",
        x: 76,
        y: 26,
        severity: "低",
        deformation: "拱瓣偏移3mm",
        advice: "继续监测",
      },
    ],
    repairAdvice: "暂不修缮，列入季度观测",
    connections: ["Z-01"],
  };

  const b02Values: ComponentValues = {
    building: "大雄宝殿",
    code: "B-02",
    name: "抱头梁",
    wood: "松木",
    joint: "燕尾榫",
    dimensions: { width: 180, height: 160, length: 2200 },
    defects: [
      {
        id: "def-b02-1",
        kind: "风化",
        location: "梁背表层",
        x: 31,
        y: 58,
        severity: "低",
        deformation: "表层起毛，无明显挠曲",
        advice: "清扫后做防腐封护",
      },
    ],
    repairAdvice: "复核编号后补刷防虫药剂",
    connections: ["L-01"],
  };

  const gz01Values: ComponentValues = {
    building: "观音阁",
    code: "G-Z01",
    name: "老檐柱",
    wood: "榆木",
    joint: "箍头榫",
    dimensions: { width: 260, height: 260, length: 3200 },
    defects: [
      {
        id: "def-gz01-1",
        kind: "风化",
        location: "柱身北侧",
        x: 45,
        y: 55,
        severity: "低",
        deformation: "表面风化深1mm",
        advice: "打磨后封护",
      },
    ],
    repairAdvice: "保持通风，年度复查",
    connections: ["G-L01"],
  };

  const gl01Values: ComponentValues = {
    building: "观音阁",
    code: "G-L01",
    name: "三架梁",
    wood: "楠木",
    joint: "透榫",
    dimensions: { width: 220, height: 180, length: 2800 },
    defects: [
      {
        id: "def-gl01-1",
        kind: "松动",
        location: "西端榫头",
        x: 70,
        y: 30,
        severity: "中",
        deformation: "榫卯间隙4mm",
        advice: "背楔矫正",
      },
    ],
    repairAdvice: "结合屋面检修同步背楔",
    connections: ["G-Z01"],
  };

  const records: ComponentRecord[] = [
    {
      ...clone(l01Values),
      id: "rec-L01",
      status: "reviewed",
      createdAt: now - 20 * day,
      submittedAt: now - 19 * day,
      reviewedAt: now - 18 * day,
    },
    {
      ...clone(z01Values),
      id: "rec-Z01",
      status: "reviewed",
      createdAt: now - 19 * day,
      submittedAt: now - 18 * day,
      reviewedAt: now - 17 * day,
    },
    {
      ...clone(d01Values),
      id: "rec-D01",
      status: "reviewed",
      createdAt: now - 18 * day,
      submittedAt: now - 17 * day,
      reviewedAt: now - 16 * day,
    },
    {
      ...clone(b02Values),
      id: "rec-B02",
      status: "pending",
      createdAt: now - 3 * hour,
      submittedAt: now - 3 * hour,
    },
    {
      ...clone(gz01Values),
      id: "rec-GZ01",
      status: "reviewed",
      createdAt: now - 12 * day,
      submittedAt: now - 11 * day,
      reviewedAt: now - 10 * day,
    },
    {
      ...clone(gl01Values),
      id: "rec-GL01",
      status: "reviewed",
      createdAt: now - 11 * day,
      submittedAt: now - 10 * day,
      reviewedAt: now - 9 * day,
    },
  ];

  const l01Proposal: ComponentValues = {
    ...clone(l01Values),
    dimensions: { width: 326, height: 214, length: 4195 },
    defects: [
      {
        ...l01Values.defects[0],
        severity: "高",
        deformation: "顺纹裂纹长260mm，梁身挠曲5mm",
        advice: "压力注胶并加钢箍",
      },
    ],
    repairAdvice: "先支顶卸荷，压力注胶后加钢箍；每季度监测",
    connections: ["Z-01", "D-01"],
  };

  const requests: ChangeRequest[] = [
    {
      id: "chg-L01",
      componentId: "rec-L01",
      status: "pending",
      submittedAt: now - 2 * hour,
      note: "复测梁端榫颈，裂纹延伸且受潮后截面尺寸有变化。",
      oldValues: clone(l01Values),
      proposed: l01Proposal,
    },
  ];

  return { records, requests };
}

function loadWorkflow(): WorkflowState {
  try {
    const raw = localStorage.getItem(WORKFLOW_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkflowState;
      if (Array.isArray(parsed.records) && Array.isArray(parsed.requests)) {
        return parsed;
      }
    }
  } catch {
    // Ignore corrupted local data and fall back to seed data.
  }
  return seedWorkflow();
}

function loadDraft(fallbackBuilding: string): DraftState {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DraftState;
      if (parsed && typeof parsed.kind === "string" && Array.isArray(parsed.defects)) {
        return { ...makeCreateDraft(fallbackBuilding), ...parsed };
      }
    }
  } catch {
    // Ignore corrupted draft and start with an empty draft.
  }
  return makeCreateDraft(fallbackBuilding);
}

function toDefectDraft(defect: Defect): DefectDraft {
  return {
    id: defect.id,
    kind: defect.kind,
    location: defect.location,
    x: String(defect.x),
    y: String(defect.y),
    severity: defect.severity,
    deformation: defect.deformation,
    advice: defect.advice,
  };
}

function draftFromRecord(record: ComponentRecord, kind: DraftKind): DraftState {
  return {
    kind,
    componentId: record.id,
    building: record.building,
    code: record.code,
    name: record.name,
    wood: record.wood,
    joint: record.joint,
    width: String(record.dimensions.width),
    height: String(record.dimensions.height),
    length: String(record.dimensions.length),
    defects: record.defects.map(toDefectDraft),
    repairAdvice: record.repairAdvice,
    connections: record.connections.join("，"),
    note: "",
    savedAt: Date.now(),
  };
}

function recordValues(record: ComponentRecord): ComponentValues {
  return clone({
    building: record.building,
    code: record.code,
    name: record.name,
    wood: record.wood,
    joint: record.joint,
    dimensions: record.dimensions,
    defects: record.defects,
    repairAdvice: record.repairAdvice,
    connections: record.connections,
  });
}

function parseDraft(draft: DraftState):
  | { ok: true; values: ComponentValues; note: string }
  | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const building = draft.building.trim();
  const code = draft.code.trim().toUpperCase();
  const name = draft.name.trim();
  const wood = draft.wood.trim();
  const joint = draft.joint.trim();

  if (!building) errors.push("请填写建筑名称");
  if (!code) errors.push("请填写构件编号");
  if (!name) errors.push("请填写构件名称");
  if (!wood) errors.push("请填写木材种类");
  if (!joint) errors.push("请选择榫卯类型");

  const readDimension = (label: string, raw: string): number => {
    const value = raw.trim();
    const number = Number(value);
    if (!value || !Number.isFinite(number) || number <= 0) {
      errors.push(`${label}必须是大于 0 的数字`);
      return 0;
    }
    return number;
  };

  const width = readDimension("截面宽", draft.width);
  const height = readDimension("截面高", draft.height);
  const length = readDimension("构件长", draft.length);

  const defects: Defect[] = [];
  draft.defects.forEach((defect, index) => {
    const touched = ["kind", "location", "x", "y", "severity", "deformation", "advice"].some((key) => {
      const value = defect[key as keyof DefectDraft];
      return typeof value === "string" && value.trim() !== "";
    });

    if (!touched) return;

    const label = `第 ${index + 1} 条病害`;
    if (!defect.kind.trim()) errors.push(`${label}：请选择病害类型`);
    if (!defect.location.trim()) errors.push(`${label}：请填写病害位置`);
    if (!defect.severity) errors.push(`${label}：请选择病害程度`);

    const readPosition = (name: string, raw: string): number => {
      const value = raw.trim();
      const number = Number(value);
      if (!value || !Number.isFinite(number) || number < 0 || number > 100) {
        errors.push(`${label}：${name}必须是 0 到 100 的数字`);
        return 0;
      }
      return number;
    };

    const x = readPosition("横向位置", defect.x);
    const y = readPosition("纵向位置", defect.y);

    if (defect.kind && defect.location && defect.severity) {
      defects.push({
        id: defect.id,
        kind: defect.kind.trim(),
        location: defect.location.trim(),
        x,
        y,
        severity: defect.severity,
        deformation: defect.deformation.trim(),
        advice: defect.advice.trim(),
      });
    }
  });

  if (draft.kind === "change" && !draft.note.trim()) {
    errors.push("提交变更申请时请填写变更说明");
  }

  if (errors.length > 0) return { ok: false, errors };

  const connections = Array.from(
    new Set(
      draft.connections
        .split(/[,，、;；\s]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
    )
  );

  return {
    ok: true,
    note: draft.note.trim(),
    values: {
      building,
      code,
      name,
      wood,
      joint,
      dimensions: { width, height, length },
      defects,
      repairAdvice: draft.repairAdvice.trim(),
      connections,
    },
  };
}

function draftHasContent(draft: DraftState): boolean {
  const scalars: Array<keyof DraftState> = [
    "code",
    "name",
    "wood",
    "joint",
    "width",
    "height",
    "length",
    "repairAdvice",
    "connections",
    "note",
  ];

  return (
    scalars.some((key) => String(draft[key]).trim() !== "") ||
    draft.defects.some((defect) =>
      ["kind", "location", "x", "y", "severity", "deformation", "advice"].some((key) => {
        const value = defect[key as keyof DefectDraft];
        return typeof value === "string" && value.trim() !== "";
      })
    )
  );
}

function formatDimensions(dimensions: Dimensions): string {
  return `${dimensions.width} × ${dimensions.height} × ${dimensions.length} mm`;
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityColor(severity: Severity): string {
  if (severity === "高") return "#b91c1c";
  if (severity === "中") return "#b45309";
  return "#0f766e";
}

function StatusBadge({ status }: { status: RecordStatus }) {
  const label = {
    pending: "待登记复核",
    reviewed: "已复核",
    rejected: "登记驳回",
  }[status];

  return <span className={`badge badge-${status}`}>{label}</span>;
}

function DefectList({ defects }: { defects: Defect[] }) {
  if (defects.length === 0) return <p className="muted">无病害记录</p>;

  return (
    <ul className="defect-list">
      {defects.map((defect) => (
        <li key={defect.id}>
          <span className="severity-dot" style={{ background: severityColor(defect.severity) }} />
          <div>
            <strong>
              {defect.kind} · {defect.severity}
            </strong>
            <p>{defect.location}</p>
            {defect.deformation && <p>变形：{defect.deformation}</p>}
            {defect.advice && <p>建议：{defect.advice}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ValueTags({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="muted">未登记连接</span>;
  return (
    <div className="tags">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  );
}

function DiseaseMap({ records }: { records: ComponentRecord[] }) {
  const markers = records.flatMap((record) =>
    record.defects.map((defect) => ({ record, defect }))
  );

  return (
    <div className="visual-card">
      <svg className="plan-svg" viewBox="0 0 100 100" role="img" aria-label="病害标记图">
        <rect x="0" y="0" width="100" height="100" rx="2" className="plan-bg" />
        {Array.from({ length: 9 }, (_, index) => (index + 1) * 10).map((point) => (
          <g key={point} className="plan-grid">
            <line x1={point} y1="0" x2={point} y2="100" />
            <line x1="0" y1={point} x2="100" y2={point} />
          </g>
        ))}
        {markers.map(({ record, defect }) => (
          <g key={`${record.id}-${defect.id}`}>
            <circle
              cx={defect.x}
              cy={defect.y}
              r="2.8"
              fill={severityColor(defect.severity)}
              stroke="#ffffff"
              strokeWidth="0.7"
            >
              <title>{`${record.code} ${record.name}｜${defect.kind}｜${defect.location}`}</title>
            </circle>
            <text x={defect.x + 3.6} y={defect.y + 1.1} className="plan-label">
              {record.code}
            </text>
          </g>
        ))}
      </svg>
      <div className="legend">
        {SEVERITIES.map((severity) => (
          <span key={severity}>
            <i style={{ background: severityColor(severity) }} />
            {severity}风险
          </span>
        ))}
        <strong>正式病害点 {markers.length}</strong>
      </div>
      {markers.length === 0 && <p className="empty-note">当前建筑暂无已复核病害点</p>}
    </div>
  );
}

function RelationshipGraph({ records }: { records: ComponentRecord[] }) {
  const positions = new Map<string, { x: number; y: number }>();

  records.forEach((record, index) => {
    const angle =
      records.length === 1 ? -Math.PI / 2 : -Math.PI / 2 + (index * 2 * Math.PI) / records.length;
    const radius = records.length === 1 ? 0 : 36;
    positions.set(record.id, {
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    });
  });

  const edges: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = [];
  records.forEach((record) => {
    record.connections.forEach((code) => {
      const other = records.find((item) => item.code === code);
      if (other && record.id < other.id) {
        const a = positions.get(record.id)!;
        const b = positions.get(other.id)!;
        edges.push({ key: `${record.id}-${other.id}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    });
  });

  const jointColor = (joint: string): string => {
    const colors = ["#854d0e", "#0f766e", "#475569", "#7c3aed", "#b45309", "#0e7490"];
    const index = JOINT_TYPES.indexOf(joint);
    return colors[index >= 0 ? index : joint.length % colors.length];
  };

  return (
    <div className="visual-card">
      <svg className="graph-svg" viewBox="0 0 100 105" role="img" aria-label="构件关系视图">
        {edges.map((edge) => (
          <line
            key={edge.key}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            className="graph-edge"
          />
        ))}
        {records.map((record) => {
          const point = positions.get(record.id)!;
          const radius = Math.max(5.2, Math.min(9, record.dimensions.width / 38));
          return (
            <g key={record.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={radius}
                fill={jointColor(record.joint)}
                className="graph-node"
              >
                <title>{`${record.code} ${record.name}\n${formatDimensions(
                  record.dimensions
                )}\n${record.joint}`}</title>
              </circle>
              <text x={point.x} y={point.y + 1.2} textAnchor="middle" className="graph-code">
                {record.code}
              </text>
              <text x={point.x} y={point.y + radius + 4.2} textAnchor="middle" className="graph-name">
                {record.name}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="graph-legend">
        {records.map((record) => (
          <li key={record.id}>
            <i style={{ background: jointColor(record.joint) }} />
            <strong>{record.code}</strong>
            <span>{formatDimensions(record.dimensions)}</span>
          </li>
        ))}
      </ul>
      {records.length === 0 && <p className="empty-note">当前建筑暂无已复核构件</p>}
    </div>
  );
}

function DiffRow({ label, oldValue, newValue }: { label: string; oldValue: string; newValue: string }) {
  const changed = oldValue !== newValue;
  return (
    <tr className={changed ? "diff-changed" : ""}>
      <th>{label}</th>
      <td>{oldValue || "—"}</td>
      <td className="diff-arrow">{changed ? "→" : "＝"}</td>
      <td>{newValue || "—"}</td>
    </tr>
  );
}

function App() {
  const [role, setRole] = useState<Role>("surveyor");
  const [workflow, setWorkflow] = useState<WorkflowState>(loadWorkflow);
  const [draft, setDraft] = useState<DraftState>(() => loadDraft("大雄宝殿"));
  const [selectedBuilding, setSelectedBuilding] = useState("大雄宝殿");
  const [jointFilter, setJointFilter] = useState("全部");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflow));
    } catch {
      setNotice("正式记录无法写入浏览器存储，请检查存储空间。");
    }
  }, [workflow]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      setNotice("草稿无法自动保存，请检查浏览器存储空间。");
    }
  }, [draft]);

  const { records, requests } = workflow;

  const buildings = useMemo(
    () => Array.from(new Set([...records.map((record) => record.building), draft.building].filter(Boolean))).sort(),
    [records, draft.building]
  );
  const activeBuilding = buildings.includes(selectedBuilding)
    ? selectedBuilding
    : buildings[0] || draft.building;

  const buildingRecords = useMemo(
    () => records.filter((record) => record.building === activeBuilding),
    [records, activeBuilding]
  );

  const jointOptions = useMemo(
    () => ["全部", ...Array.from(new Set(buildingRecords.map((record) => record.joint)))],
    [buildingRecords]
  );

  const statusRank: Record<RecordStatus, number> = { reviewed: 0, pending: 1, rejected: 2 };
  const filteredRecords = useMemo(
    () =>
      buildingRecords
        .filter((record) => jointFilter === "全部" || record.joint === jointFilter)
        .sort((a, b) => statusRank[a.status] - statusRank[b.status] || a.code.localeCompare(b.code)),
    [buildingRecords, jointFilter]
  );

  const reviewedBuildingRecords = useMemo(
    () =>
      buildingRecords
        .filter((record) => record.status === "reviewed")
        .sort((a, b) => a.code.localeCompare(b.code)),
    [buildingRecords]
  );

  const pendingRegistrations = useMemo(
    () => records.filter((record) => record.status === "pending"),
    [records]
  );

  const pendingChanges = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests]
  );

  const pendingChangeMap = useMemo(() => {
    const map = new Map<string, ChangeRequest>();
    pendingChanges.forEach((request) => map.set(request.componentId, request));
    return map;
  }, [pendingChanges]);

  const reviewedCount = records.filter((record) => record.status === "reviewed").length;
  const officialDefectCount = records
    .filter((record) => record.status === "reviewed")
    .reduce((total, record) => total + record.defects.length, 0);

  function updateDraft(patch: Partial<DraftState>) {
    setDraft((previous) => ({ ...previous, ...patch, savedAt: Date.now() }));
    setFormErrors([]);
  }

  function patchDefect(defectId: string, patch: Partial<DefectDraft>) {
    updateDraft({
      defects: draft.defects.map((defect) =>
        defect.id === defectId ? { ...defect, ...patch } : defect
      ),
    });
  }

  function addDefect() {
    updateDraft({ defects: [...draft.defects, emptyDefect()] });
  }

  function removeDefect(defectId: string) {
    updateDraft({ defects: draft.defects.filter((defect) => defect.id !== defectId) });
  }

  function startChange(record: ComponentRecord) {
    if (record.status !== "reviewed") return;
    if (pendingChangeMap.has(record.id)) {
      setNotice(`${record.code} 已有待批变更，复核完成前不能重复提交。`);
      return;
    }
    if (
      draftHasContent(draft) &&
      !window.confirm("当前还有未提交草稿，载入正式值会替换该草稿，是否继续？")
    ) {
      return;
    }
    setDraft(draftFromRecord(record, "change"));
    setRole("surveyor");
    setFormErrors([]);
    setNotice(`已载入 ${record.code} 的正式值。草稿不会改动正式记录，提交后进入变更待办。`);
  }

  function startResubmit(record: ComponentRecord) {
    if (record.status !== "rejected") return;
    if (
      draftHasContent(draft) &&
      !window.confirm("当前还有未提交草稿，载入驳回记录会替换该草稿，是否继续？")
    ) {
      return;
    }
    setDraft(draftFromRecord(record, "resubmit"));
    setRole("surveyor");
    setFormErrors([]);
    setNotice(`已载入 ${record.code} 的驳回内容，修改后可重新提交。`);
  }

  function handleSubmitDraft() {
    const parsed = parseDraft(draft);
    if (!parsed.ok) {
      setFormErrors(parsed.errors);
      return;
    }

    const { values, note } = parsed;
    const now = Date.now();

    if (draft.kind === "create") {
      const duplicated = records.some(
        (record) => record.building === values.building && record.code === values.code
      );
      if (duplicated) {
        setFormErrors([`${values.building} 已存在构件编号 ${values.code}`]);
        return;
      }

      const record: ComponentRecord = {
        ...clone(values),
        id: uid("rec"),
        status: "pending",
        createdAt: now,
        submittedAt: now,
        note: note || undefined,
      };
      setWorkflow((previous) => ({ ...previous, records: [...previous.records, record] }));
      setDraft(makeCreateDraft(values.building));
      setSelectedBuilding(values.building);
      setNotice(`${values.code} 已提交，等待构件登记复核。`);
      setFormErrors([]);
      return;
    }

    const target = records.find((record) => record.id === draft.componentId);
    if (!target) {
      setFormErrors(["草稿关联的构件不存在，草稿未写入正式记录。"]);
      return;
    }

    if (draft.kind === "resubmit") {
      if (target.status !== "rejected") {
        setFormErrors(["该构件当前不是驳回状态，不能重复登记。"]);
        return;
      }
      setWorkflow((previous) => ({
        ...previous,
        records: previous.records.map((record) =>
          record.id === target.id
            ? {
                ...record,
                ...clone(values),
                id: record.id,
                status: "pending",
                submittedAt: now,
                reviewedAt: undefined,
                reviewNote: undefined,
                note: note || target.note,
              }
            : record
        ),
      }));
      setDraft(makeCreateDraft(values.building));
      setSelectedBuilding(values.building);
      setNotice(`${values.code} 已重新提交登记。`);
      setFormErrors([]);
      return;
    }

    if (target.status !== "reviewed") {
      setFormErrors(["构件登记复核通过后才能提交变更申请。"]);
      return;
    }
    if (pendingChangeMap.has(target.id)) {
      setFormErrors(["该构件已有待批变更，请等待复核人处理。"]);
      return;
    }

    const request: ChangeRequest = {
      id: uid("chg"),
      componentId: target.id,
      status: "pending",
      submittedAt: now,
      note,
      oldValues: recordValues(target),
      proposed: clone(values),
    };

    setWorkflow((previous) => ({
      ...previous,
      requests: [...previous.requests, request],
    }));
    setDraft(makeCreateDraft(values.building));
    setSelectedBuilding(values.building);
    setNotice(`${values.code} 的变更申请已提交，正式视图在批准前仍保持原值。`);
    setFormErrors([]);
  }

  function reviewRegistration(record: ComponentRecord, approve: boolean) {
    const note = reviewNotes[record.id]?.trim() || "";
    if (!approve && !note) {
      window.alert("驳回登记时请填写原因，便于测量员修改。");
      return;
    }

    const now = Date.now();
    setWorkflow((previous) => ({
      ...previous,
      records: previous.records.map((item) =>
        item.id === record.id
          ? {
              ...item,
              status: approve ? "reviewed" : "rejected",
              reviewedAt: now,
              reviewNote: note || undefined,
            }
          : item
      ),
    }));
    setNotice(approve ? `${record.code} 已通过登记复核。` : `${record.code} 的登记已驳回。`);
  }

  function reviewChange(request: ChangeRequest, approve: boolean) {
    const target = records.find((record) => record.id === request.componentId);
    if (!target || target.status !== "reviewed") {
      setNotice("申请对应的正式构件不存在或尚未通过登记复核。");
      return;
    }

    const note = reviewNotes[request.id]?.trim() || "";
    if (!approve && !note) {
      window.alert("驳回变更时请填写原因。");
      return;
    }

    const now = Date.now();
    setWorkflow((previous) => ({
      records: approve
        ? previous.records.map((record) =>
            record.id === target.id
              ? {
                  ...record,
                  ...clone(request.proposed),
                  id: record.id,
                  status: "reviewed",
                  reviewedAt: now,
                }
              : record
          )
        : previous.records,
      requests: previous.requests.map((item) =>
        item.id === request.id
          ? {
              ...item,
              status: approve ? "approved" : "rejected",
              reviewedAt: now,
              reviewerNote: note || undefined,
            }
          : item
      ),
    }));
    setNotice(
      approve
        ? `${request.proposed.code} 的新尺寸已批准，尺寸表、病害图和关系视图已同步。`
        : `${request.oldValues.code} 的变更已驳回，正式记录继续使用原尺寸。`
    );
  }

  const draftTitle = {
    create: "新构件连续登记",
    change: "已复核构件变更申请",
    resubmit: "驳回登记修改重报",
  }[draft.kind];

  const processedRequests = requests
    .filter((request) => request.status !== "pending")
    .sort((a, b) => (b.reviewedAt || 0) - (a.reviewedAt || 0));

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62013 · 现场登记 / 复核 / 变更同步</p>
        <h1>古建筑木结构榫卯测绘工作台</h1>
        <span>
          未提交草稿单独自动留存；已复核内容作为正式基线，不会被草稿覆盖。变更批准后，尺寸记录表、病害标记图和构件关系视图同步采用新值，驳回则保留原记录。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>全部登记构件</small>
          <strong>{records.length}</strong>
        </article>
        <article>
          <small>已复核构件</small>
          <strong>{reviewedCount}</strong>
        </article>
        <article>
          <small>正式病害点</small>
          <strong>{officialDefectCount}</strong>
        </article>
        <article>
          <small>待处理事项</small>
          <strong>{pendingRegistrations.length + pendingChanges.length}</strong>
        </article>
      </section>

      <section className="topbar panel">
        <div className="role-toggle" role="group" aria-label="角色切换">
          <button
            className={role === "surveyor" ? "active" : ""}
            onClick={() => setRole("surveyor")}
            type="button"
          >
            测量员
          </button>
          <button
            className={role === "reviewer" ? "active" : ""}
            onClick={() => setRole("reviewer")}
            type="button"
          >
            复核人
          </button>
        </div>
        <div className="save-state">
          <span className="save-dot" />
          草稿库与正式复核库分开保存
        </div>
      </section>

      <section className="building-bar panel">
        <div>
          <span>当前建筑</span>
          <strong>{activeBuilding}</strong>
        </div>
        <div className="building-buttons">
          {buildings.map((building) => (
            <button
              key={building}
              type="button"
              className={building === activeBuilding ? "active" : ""}
              onClick={() => {
                setSelectedBuilding(building);
                setJointFilter("全部");
                setDraft((previous) =>
                  previous.kind === "create" && !draftHasContent(previous)
                    ? makeCreateDraft(building)
                    : previous
                );
              }}
            >
              {building}
            </button>
          ))}
        </div>
      </section>

      <div className="workspace">
        <aside className="panel list-panel">
          <div className="heading compact">
            <div>
              <p>按建筑连续登记</p>
              <h2>构件清单</h2>
            </div>
          </div>

          <div className="chips filter-chips">
            {jointOptions.map((joint) => (
              <button
                key={joint}
                type="button"
                className={jointFilter === joint ? "active" : ""}
                onClick={() => setJointFilter(joint)}
              >
                {joint}
              </button>
            ))}
          </div>

          <div className="record-cards">
            {filteredRecords.map((record) => {
              const pendingChange = pendingChangeMap.get(record.id);
              return (
                <article key={record.id} className="record-card">
                  <div className="record-card-head">
                    <div>
                      <h3>{record.code}</h3>
                      <p>{record.name}</p>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="record-meta">
                    {record.wood} · {record.joint}
                  </p>
                  <p className="record-meta">{formatDimensions(record.dimensions)}</p>
                  <p className="record-meta">病害 {record.defects.length} 处</p>
                  {pendingChange && <p className="pending-note">尺寸变更待批，正式值暂不改变</p>}
                  {record.status === "rejected" && record.reviewNote && (
                    <p className="reject-note">驳回原因：{record.reviewNote}</p>
                  )}
                  {role === "surveyor" && record.status === "reviewed" && (
                    <button type="button" className="full-button" onClick={() => startChange(record)}>
                      发起变更
                    </button>
                  )}
                  {role === "surveyor" && record.status === "rejected" && (
                    <button type="button" className="full-button" onClick={() => startResubmit(record)}>
                      修改后重报
                    </button>
                  )}
                </article>
              );
            })}
            {filteredRecords.length === 0 && <p className="empty-note">当前筛选条件下暂无构件。</p>}
          </div>
        </aside>

        <section className="panel main-panel">
          {role === "surveyor" ? (
            <form
              className="draft-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmitDraft();
              }}
            >
              <div className="heading">
                <div>
                  <p>{draftTitle}</p>
                  <h2>
                    {draft.kind === "create"
                      ? "登记构件、病害和修缮建议"
                      : `对照 ${draft.code} 的正式基线填写新值`}
                  </h2>
                </div>
                <button type="submit" className="primary">
                  {draft.kind === "create" ? "提交登记" : draft.kind === "change" ? "提交变更申请" : "重新提交"}
                </button>
              </div>

              {draftHasContent(draft) && (
                <div className="draft-banner">
                  已恢复未提交草稿{draft.savedAt ? ` · ${new Date(draft.savedAt).toLocaleTimeString()}` : ""}
                  ；草稿仅填入表单，不会覆盖已复核正式值。
                </div>
              )}

              {notice && <div className="notice">{notice}</div>}
              {formErrors.length > 0 && (
                <ul className="error-list">
                  {formErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}

              <div className="form-grid">
                <label>
                  <span>建筑名称</span>
                  <input
                    list="building-options"
                    value={draft.building}
                    disabled={draft.kind !== "create"}
                    onChange={(event) => updateDraft({ building: event.target.value })}
                    placeholder="例如：大雄宝殿"
                  />
                </label>
                <datalist id="building-options">
                  {buildings.map((building) => (
                    <option key={building} value={building} />
                  ))}
                </datalist>

                <label>
                  <span>构件编号</span>
                  <input
                    value={draft.code}
                    disabled={draft.kind !== "create"}
                    onChange={(event) => updateDraft({ code: event.target.value.toUpperCase() })}
                    placeholder="例如：L-01"
                  />
                </label>

                <label>
                  <span>构件名称</span>
                  <input
                    value={draft.name}
                    onChange={(event) => updateDraft({ name: event.target.value })}
                    placeholder="例如：五架梁"
                  />
                </label>

                <label>
                  <span>木材种类</span>
                  <input
                    value={draft.wood}
                    onChange={(event) => updateDraft({ wood: event.target.value })}
                    placeholder="例如：楠木"
                  />
                </label>

                <label>
                  <span>榫卯类型</span>
                  <select value={draft.joint} onChange={(event) => updateDraft({ joint: event.target.value })}>
                    <option value="">请选择</option>
                    {JOINT_TYPES.map((joint) => (
                      <option key={joint} value={joint}>
                        {joint}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>截面宽 mm</span>
                  <input
                    inputMode="decimal"
                    value={draft.width}
                    onChange={(event) => updateDraft({ width: event.target.value })}
                    placeholder="320"
                  />
                </label>

                <label>
                  <span>截面高 mm</span>
                  <input
                    inputMode="decimal"
                    value={draft.height}
                    onChange={(event) => updateDraft({ height: event.target.value })}
                    placeholder="220"
                  />
                </label>

                <label>
                  <span>构件长 mm</span>
                  <input
                    inputMode="decimal"
                    value={draft.length}
                    onChange={(event) => updateDraft({ length: event.target.value })}
                    placeholder="4200"
                  />
                </label>
              </div>

              <section className="defect-editor">
                <div className="subheading">
                  <div>
                    <h3>病害连续登记</h3>
                    <p>横向、纵向位置按 0–100 标记到建筑示意图。</p>
                  </div>
                  <button type="button" onClick={addDefect}>
                    添加病害
                  </button>
                </div>

                <div className="defect-form-list">
                  {draft.defects.map((defect, index) => (
                    <article key={defect.id} className="defect-form-card">
                      <header>
                        <strong>病害 {index + 1}</strong>
                        <button type="button" className="link-danger" onClick={() => removeDefect(defect.id)}>
                          删除
                        </button>
                      </header>
                      <div className="defect-form-grid">
                        <label>
                          <span>类型</span>
                          <input
                            list="defect-options"
                            value={defect.kind}
                            onChange={(event) => patchDefect(defect.id, { kind: event.target.value })}
                            placeholder="开裂"
                          />
                        </label>
                        <datalist id="defect-options">
                          {DEFECT_TYPES.map((type) => (
                            <option key={type} value={type} />
                          ))}
                        </datalist>
                        <label>
                          <span>位置</span>
                          <input
                            value={defect.location}
                            onChange={(event) => patchDefect(defect.id, { location: event.target.value })}
                            placeholder="梁端东侧榫颈"
                          />
                        </label>
                        <label>
                          <span>程度</span>
                          <select
                            value={defect.severity}
                            onChange={(event) =>
                              patchDefect(defect.id, { severity: event.target.value as Severity | "" })
                            }
                          >
                            <option value="">请选择</option>
                            {SEVERITIES.map((severity) => (
                              <option key={severity} value={severity}>
                                {severity}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>横向 X</span>
                          <input
                            inputMode="decimal"
                            value={defect.x}
                            onChange={(event) => patchDefect(defect.id, { x: event.target.value })}
                            placeholder="0–100"
                          />
                        </label>
                        <label>
                          <span>纵向 Y</span>
                          <input
                            inputMode="decimal"
                            value={defect.y}
                            onChange={(event) => patchDefect(defect.id, { y: event.target.value })}
                            placeholder="0–100"
                          />
                        </label>
                        <label className="wide">
                          <span>变形情况</span>
                          <input
                            value={defect.deformation}
                            onChange={(event) => patchDefect(defect.id, { deformation: event.target.value })}
                            placeholder="裂纹长度、挠曲或偏移"
                          />
                        </label>
                        <label className="wide">
                          <span>病害修缮建议</span>
                          <input
                            value={defect.advice}
                            onChange={(event) => patchDefect(defect.id, { advice: event.target.value })}
                            placeholder="注胶、墩接、监测等"
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <div className="form-grid bottom-form">
                <label className="span-2">
                  <span>连接构件编号</span>
                  <input
                    value={draft.connections}
                    onChange={(event) => updateDraft({ connections: event.target.value })}
                    placeholder="用逗号分隔，例如：Z-01，D-01"
                  />
                </label>
                <label className="span-2">
                  <span>综合修缮建议</span>
                  <textarea
                    rows={3}
                    value={draft.repairAdvice}
                    onChange={(event) => updateDraft({ repairAdvice: event.target.value })}
                    placeholder="记录总体修缮原则、监测周期和现场注意事项"
                  />
                </label>
                <label className="span-2">
                  <span>{draft.kind === "change" ? "变更说明（必填）" : "登记备注"}</span>
                  <textarea
                    rows={2}
                    value={draft.note}
                    onChange={(event) => updateDraft({ note: event.target.value })}
                    placeholder={draft.kind === "change" ? "说明复测原因和新旧尺寸差异" : "可填写现场情况"}
                  />
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (!draftHasContent(draft) || window.confirm("清空未提交草稿？此操作只影响草稿库。")) {
                      setDraft(makeCreateDraft(activeBuilding));
                      setFormErrors([]);
                      setNotice("草稿已清空，正式记录不受影响。");
                    }
                  }}
                >
                  清空草稿
                </button>
                <span>{draft.savedAt ? `草稿自动保存于 ${new Date(draft.savedAt).toLocaleTimeString()}` : "草稿会自动保存"}</span>
              </div>
            </form>
          ) : (
            <div className="review-queue">
              <div className="heading">
                <div>
                  <p>复核待办</p>
                  <h2>登记与变更申请</h2>
                </div>
                <span className="todo-count">{pendingRegistrations.length + pendingChanges.length} 项待处理</span>
              </div>

              {notice && <div className="notice">{notice}</div>}

              <section>
                <h3 className="queue-title">构件登记复核（{pendingRegistrations.length}）</h3>
                {pendingRegistrations.length === 0 && <p className="empty-note">暂无待复核登记。</p>}
                {pendingRegistrations.map((record) => (
                  <article key={record.id} className="review-card">
                    <header className="review-head">
                      <div>
                        <h4>
                          {record.building} · {record.code} {record.name}
                        </h4>
                        <p>提交时间：{formatTime(record.submittedAt)}</p>
                      </div>
                      <StatusBadge status={record.status} />
                    </header>
                    <div className="review-grid">
                      <div>
                        <p className="detail-label">构件信息</p>
                        <p>
                          {record.wood} · {record.joint}
                        </p>
                        <p>{formatDimensions(record.dimensions)}</p>
                        <p>连接：{record.connections.join("、") || "无"}</p>
                        {record.note && <p>备注：{record.note}</p>}
                      </div>
                      <div>
                        <p className="detail-label">病害与修缮建议</p>
                        <DefectList defects={record.defects} />
                        <p>{record.repairAdvice || "无综合修缮建议"}</p>
                      </div>
                    </div>
                    <label className="review-note">
                      <span>复核意见（驳回时必填）</span>
                      <textarea
                        rows={2}
                        value={reviewNotes[record.id] || ""}
                        onChange={(event) =>
                          setReviewNotes((previous) => ({ ...previous, [record.id]: event.target.value }))
                        }
                        placeholder="批准可留空；驳回请说明原因"
                      />
                    </label>
                    <div className="review-actions">
                      <button type="button" className="accent" onClick={() => reviewRegistration(record, true)}>
                        批准登记
                      </button>
                      <button type="button" className="danger" onClick={() => reviewRegistration(record, false)}>
                        驳回登记
                      </button>
                    </div>
                  </article>
                ))}
              </section>

              <section>
                <h3 className="queue-title">尺寸变更复核（{pendingChanges.length}）</h3>
                {pendingChanges.length === 0 && <p className="empty-note">暂无待批变更申请。</p>}
                {pendingChanges.map((request) => {
                  const target = records.find((record) => record.id === request.componentId);
                  if (!target) return null;
                  const oldValues = request.oldValues;
                  const newValues = request.proposed;

                  return (
                    <article key={request.id} className="review-card">
                      <header className="review-head">
                        <div>
                          <h4>
                            {oldValues.building} · {oldValues.code} {oldValues.name}
                          </h4>
                          <p>
                            测量员提交：{formatTime(request.submittedAt)} · 当前正式状态：已复核
                          </p>
                        </div>
                        <span className="badge badge-pending">变更待批</span>
                      </header>

                      <p className="change-note">变更说明：{request.note}</p>

                      <div className="table-wrap">
                        <table className="diff-table">
                          <thead>
                            <tr>
                              <th>对照项</th>
                              <th>原正式尺寸/值</th>
                              <th />
                              <th>申请新尺寸/值</th>
                            </tr>
                          </thead>
                          <tbody>
                            <DiffRow label="截面宽 mm" oldValue={String(oldValues.dimensions.width)} newValue={String(newValues.dimensions.width)} />
                            <DiffRow label="截面高 mm" oldValue={String(oldValues.dimensions.height)} newValue={String(newValues.dimensions.height)} />
                            <DiffRow label="构件长 mm" oldValue={String(oldValues.dimensions.length)} newValue={String(newValues.dimensions.length)} />
                            <DiffRow label="构件名称" oldValue={oldValues.name} newValue={newValues.name} />
                            <DiffRow label="木材种类" oldValue={oldValues.wood} newValue={newValues.wood} />
                            <DiffRow label="榫卯类型" oldValue={oldValues.joint} newValue={newValues.joint} />
                            <DiffRow label="修缮建议" oldValue={oldValues.repairAdvice} newValue={newValues.repairAdvice} />
                          </tbody>
                        </table>
                      </div>

                      <div className="defect-diff">
                        <div>
                          <p className="detail-label">原病害（{oldValues.defects.length}）</p>
                          <DefectList defects={oldValues.defects} />
                        </div>
                        <div>
                          <p className="detail-label">新病害（{newValues.defects.length}）</p>
                          <DefectList defects={newValues.defects} />
                        </div>
                      </div>

                      <div className="connection-diff">
                        <div>
                          <p className="detail-label">原构件关系</p>
                          <ValueTags values={oldValues.connections} />
                        </div>
                        <div>
                          <p className="detail-label">新构件关系</p>
                          <ValueTags values={newValues.connections} />
                        </div>
                      </div>

                      <label className="review-note">
                        <span>复核意见（驳回时必填）</span>
                        <textarea
                          rows={2}
                          value={reviewNotes[request.id] || ""}
                          onChange={(event) =>
                            setReviewNotes((previous) => ({ ...previous, [request.id]: event.target.value }))
                          }
                          placeholder="批准后三个正式视图同步；驳回则继续使用原记录"
                        />
                      </label>
                      <div className="review-actions">
                        <button type="button" className="accent" onClick={() => reviewChange(request, true)}>
                          批准并同步新值
                        </button>
                        <button type="button" className="danger" onClick={() => reviewChange(request, false)}>
                          驳回，保留原值
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>

              <details className="history">
                <summary>已处理变更（{processedRequests.length}）</summary>
                {processedRequests.length === 0 ? (
                  <p className="muted">暂无处理记录</p>
                ) : (
                  <ul>
                    {processedRequests.map((request) => (
                      <li key={request.id}>
                        <span className={`badge badge-${request.status}`}>
                          {request.status === "approved" ? "已批准" : "已驳回"}
                        </span>
                        <strong>
                          {request.proposed.building} · {request.proposed.code}
                        </strong>
                        <span>{formatTime(request.reviewedAt)}</span>
                        {request.reviewerNote && <p>意见：{request.reviewerNote}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </div>
          )}
        </section>
      </div>

      <section className="panel official-panel">
        <div className="heading">
          <div>
            <p>正式尺寸记录表 · {activeBuilding}</p>
            <h2>复核基线与待批状态</h2>
          </div>
        </div>
        <p className="panel-tip">
          待批变更不会提前改动此表；批准后新尺寸立即同步到下表、病害标记图和构件关系视图，驳回则继续显示原值。
        </p>
        <div className="table-wrap">
          <table className="records-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>名称</th>
                <th>木材</th>
                <th>榫卯</th>
                <th>截面宽</th>
                <th>截面高</th>
                <th>构件长</th>
                <th>病害</th>
                <th>修缮建议</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const pendingChange = pendingChangeMap.get(record.id);
                const official = record.status === "reviewed";
                return (
                  <tr key={record.id} className={official ? "" : "non-official-row"}>
                    <td>{record.code}</td>
                    <td>{record.name}</td>
                    <td>{record.wood}</td>
                    <td>{record.joint}</td>
                    <td>
                      {record.dimensions.width}
                      {pendingChange && (
                        <span className="pending-dim"> → {pendingChange.proposed.dimensions.width}</span>
                      )}
                    </td>
                    <td>
                      {record.dimensions.height}
                      {pendingChange && (
                        <span className="pending-dim"> → {pendingChange.proposed.dimensions.height}</span>
                      )}
                    </td>
                    <td>
                      {record.dimensions.length}
                      {pendingChange && (
                        <span className="pending-dim"> → {pendingChange.proposed.dimensions.length}</span>
                      )}
                    </td>
                    <td>{record.defects.length}</td>
                    <td className="advice-cell">{record.repairAdvice || "—"}</td>
                    <td>
                      <StatusBadge status={record.status} />
                      {pendingChange && <span className="inline-warn">变更待批</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="visual-grid">
        <section className="panel">
          <div className="heading compact">
            <div>
              <p>正式病害标记图 · {activeBuilding}</p>
              <h2>仅显示已复核病害</h2>
            </div>
          </div>
          <DiseaseMap records={reviewedBuildingRecords} />
        </section>

        <section className="panel">
          <div className="heading compact">
            <div>
              <p>构件关系视图 · {activeBuilding}</p>
              <h2>批准后关系和尺寸同步</h2>
            </div>
          </div>
          <RelationshipGraph records={reviewedBuildingRecords} />
        </section>
      </div>
    </main>
  );
}

export default App;
