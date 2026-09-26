// 木结构测绘领域模型

export type Role = "surveyor" | "reviewer"; // 测量员 / 复核人

export type TabKey =
  | "register"
  | "inventory"
  | "dimensions"
  | "disease"
  | "relations"
  | "review";

/** 构件部位（用于病害标记图与关系视图排布） */
export type MemberRole = "柱" | "梁" | "枋" | "檩" | "斗拱" | "其他";
export const MEMBER_ROLES: MemberRole[] = ["柱", "梁", "枋", "檩", "斗拱", "其他"];

export type TenonType = "燕尾榫" | "透榫" | "半榫" | "箍头榫";
export const TENON_TYPES: TenonType[] = ["燕尾榫", "透榫", "半榫", "箍头榫"];

export const WOOD_SUGGESTIONS = ["楠木", "杉木", "松木", "柏木", "樟木"];

/** 构件复核状态：草稿 -> 待复核 -> 已复核（驳回回到草稿） */
export type ReviewStatus = "draft" | "in_review" | "approved";

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "草稿",
  in_review: "待复核",
  approved: "已复核",
};

export type Severity = "minor" | "medium" | "severe";
export const SEVERITY_LABEL: Record<Severity, string> = {
  minor: "轻微",
  medium: "中等",
  severe: "严重",
};
export const SEVERITY_COLOR: Record<Severity, string> = {
  minor: "#0f766e",
  medium: "#b45309",
  severe: "#b91c1c",
};

export const DAMAGE_KINDS = ["开裂", "糟朽", "虫蛀", "变形", "缺损", "其他"];

/** 截面尺寸，单位 mm */
export interface Dimensions {
  width: number;
  height: number;
  length: number;
}

export interface Damage {
  id: string;
  part: string; // 病害位置，如「东端端部」「柱脚」
  kind: string; // 病害类型
  severity: Severity;
  note: string;
}

export interface Building {
  id: string;
  name: string;
}

export interface Component {
  id: string;
  code: string; // 构件编号
  name: string; // 构件名称
  buildingId: string;
  role: MemberRole;
  woodSpecies: string; // 木材种类
  tenon: TenonType; // 榫卯类型
  dimensions: Dimensions; // 截面尺寸
  damages: Damage[]; // 病害
  deformation: string; // 变形情况
  repair: string; // 修缮建议
  connectsTo: string[]; // 榫卯连接的其他构件 id
  status: ReviewStatus;
  rejectNote?: string; // 最近一次复核驳回意见
  createdAt: number;
  submittedAt?: number;
  approvedAt?: number;
}

export type ChangeStatus = "pending" | "approved" | "rejected";

/** 尺寸变更申请：复核通过后才会写回构件尺寸 */
export interface ChangeRequest {
  id: string;
  componentId: string;
  oldDimensions: Dimensions;
  newDimensions: Dimensions;
  reason: string;
  status: ChangeStatus;
  createdAt: number;
  decidedAt?: number;
  note?: string; // 复核意见
}

/** 未提交的变更草稿（关闭页面后保留，不影响正式尺寸） */
export interface ChangeDraft {
  componentId: string;
  newDimensions: Dimensions;
  reason: string;
  savedAt: number;
}

export interface LogEntry {
  id: string;
  at: number;
  text: string;
  tone: "info" | "success" | "danger";
}

/** 已复核数据：建筑 + 进入复核流程的构件 + 变更申请 + 台账日志 */
export interface CommittedState {
  buildings: Building[];
  components: Component[];
  changes: ChangeRequest[];
  logs: LogEntry[];
}

/** 草稿数据：与已复核数据分开存放，任何情况下都不覆盖已复核内容 */
export interface DraftState {
  components: Component[]; // 均为 status=draft 的新登记构件
  changeDrafts: ChangeDraft[]; // 未提交的尺寸变更草稿
}

export type { Building as BuildingType };
