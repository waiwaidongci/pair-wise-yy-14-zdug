import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type {
  Building,
  ChangeDraft,
  ChangeRequest,
  CommittedState,
  Component,
  DraftState,
  LogEntry,
  Role,
} from "./types";
import { buildSeed } from "./seed";
import { sameDims, uid } from "./utils";

const COMMITTED_KEY = "mugou.committed.v1";
const DRAFT_KEY = "mugou.drafts.v1";
const ROLE_KEY = "mugou.role.v1";

// ---------- Actions ----------

export type Action =
  | { type: "ADD_BUILDING"; name: string }
  | { type: "SAVE_DRAFT_COMPONENT"; component: Component }
  | { type: "DELETE_DRAFT_COMPONENT"; id: string }
  | { type: "SUBMIT_COMPONENT"; id: string }
  | { type: "APPROVE_COMPONENT"; id: string }
  | { type: "REJECT_COMPONENT"; id: string; note: string }
  | { type: "SAVE_CHANGE_DRAFT"; draft: ChangeDraft }
  | { type: "DELETE_CHANGE_DRAFT"; componentId: string }
  | { type: "SUBMIT_CHANGE"; draft: ChangeDraft }
  | { type: "APPROVE_CHANGE"; id: string; note?: string }
  | { type: "REJECT_CHANGE"; id: string; note: string }
  | { type: "RESET" };

interface AppState {
  committed: CommittedState;
  drafts: DraftState;
}

// ---------- 初始数据 / 持久化 ----------

function freshSeed(): AppState {
  const { committed, drafts } = buildSeed();
  return { committed, drafts };
}

function load(): AppState {
  let base = freshSeed();
  try {
    const rawC = localStorage.getItem(COMMITTED_KEY);
    const rawD = localStorage.getItem(DRAFT_KEY);
    if (rawC) {
      const parsed = JSON.parse(rawC) as CommittedState;
      base.committed = {
        buildings: parsed.buildings ?? base.committed.buildings,
        components: parsed.components ?? base.committed.components,
        changes: parsed.changes ?? base.committed.changes,
        logs: parsed.logs ?? [],
      };
    }
    if (rawD) {
      const parsed = JSON.parse(rawD) as DraftState;
      base.drafts = {
        components: parsed.components ?? [],
        changeDrafts: parsed.changeDrafts ?? [],
      };
    }
  } catch {
    // 数据损坏时回落到样例，但不写入，避免覆盖
  }
  return reconcile(base);
}

/**
 * 重新打开页面时的对账：
 * - 已复核（in_review / approved）构件以正式记录为准，草稿里若残留同 id 构件一律丢弃；
 * - 已被复核结论裁决的变更草稿一律丢弃（批准/驳回结论不可被草稿覆盖）；
 * - 未提交草稿对应的构件若已不存在，同样丢弃。
 * 即：正式数据永远优先于草稿。
 */
function reconcile(state: AppState): AppState {
  const officialIds = new Set(state.committed.components.map((c) => c.id));
  const decidedComponentIds = new Set(
    state.committed.changes
      .filter((ch) => ch.status !== "pending")
      .map((ch) => ch.componentId)
  );

  const draftComponents = state.drafts.components.filter(
    (d) => !officialIds.has(d.id) && d.status === "draft"
  );
  const changeDrafts = state.drafts.changeDrafts.filter(
    (d) =>
      officialIds.has(d.componentId) &&
      !decidedComponentIds.has(d.componentId) &&
      // 构件上已存在待审批变更时，不再保留游离草稿
      !state.committed.changes.some(
        (ch) =>
          ch.componentId === d.componentId && ch.status === "pending"
      )
  );

  return {
    committed: state.committed,
    drafts: { components: draftComponents, changeDrafts },
  };
}

// ---------- 辅助 ----------

function log(state: CommittedState, text: string, tone: LogEntry["tone"] = "info"): LogEntry[] {
  const entry: LogEntry = { id: uid("log"), at: Date.now(), text, tone };
  return [entry, ...state.logs].slice(0, 60);
}

function updateComponent(list: Component[], id: string, patch: Partial<Component>): Component[] {
  return list.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

function buildingName(state: CommittedState, id: string): string {
  return state.buildings.find((b) => b.id === id)?.name ?? "未知建筑";
}

// ---------- Reducer ----------

function reducer(state: AppState, action: Action): AppState {
  let committed = state.committed;
  let drafts = state.drafts;

  switch (action.type) {
    case "ADD_BUILDING": {
      const name = action.name.trim();
      if (!name) return state;
      if (committed.buildings.some((b) => b.name === name)) return state;
      const building: Building = { id: uid("b"), name };
      committed = {
        ...committed,
        buildings: [...committed.buildings, building],
        logs: log(committed, `新增建筑「${name}」`),
      };
      return { committed, drafts };
    }

    case "SAVE_DRAFT_COMPONENT": {
      const c = { ...action.component, status: "draft" as const };
      const exists = drafts.components.some((d) => d.id === c.id);
      const components = exists
        ? drafts.components.map((d) => (d.id === c.id ? c : d))
        : [...drafts.components, c];
      drafts = { ...drafts, components };
      return { committed, drafts };
    }

    case "DELETE_DRAFT_COMPONENT": {
      drafts = {
        ...drafts,
        components: drafts.components.filter((c) => c.id !== action.id),
      };
      return { committed, drafts };
    }

    case "SUBMIT_COMPONENT": {
      const draft = drafts.components.find((c) => c.id === action.id);
      if (!draft) return state;
      const component: Component = {
        ...draft,
        status: "in_review",
        rejectNote: undefined,
        submittedAt: Date.now(),
      };
      committed = {
        ...committed,
        components: [...committed.components, component],
        logs: log(
          committed,
          `测量员提交构件「${component.code} ${component.name}」复核（${buildingName(
            committed,
            component.buildingId
          )}）`,
          "info"
        ),
      };
      drafts = {
        ...drafts,
        components: drafts.components.filter((c) => c.id !== action.id),
      };
      return { committed, drafts };
    }

    case "APPROVE_COMPONENT": {
      const target = committed.components.find((c) => c.id === action.id);
      if (!target || target.status !== "in_review") return state;
      committed = {
        ...committed,
        components: updateComponent(committed.components, action.id, {
          status: "approved",
          approvedAt: Date.now(),
          rejectNote: undefined,
        }),
        logs: log(committed, `复核通过构件「${target.code} ${target.name}」`, "success"),
      };
      return { committed, drafts };
    }

    case "REJECT_COMPONENT": {
      const target = committed.components.find((c) => c.id === action.id);
      if (!target || target.status !== "in_review") return state;
      // 驳回：构件退回草稿区继续编辑，正式记录保持原状
      const returned: Component = {
        ...target,
        status: "draft",
        rejectNote: action.note,
        submittedAt: undefined,
        approvedAt: undefined,
      };
      committed = {
        ...committed,
        components: committed.components.filter((c) => c.id !== action.id),
        logs: log(
          committed,
          `复核驳回构件「${target.code} ${target.name}」：${action.note}`,
          "danger"
        ),
      };
      drafts = {
        ...drafts,
        components: [...drafts.components, returned],
      };
      return { committed, drafts };
    }

    case "SAVE_CHANGE_DRAFT": {
      const rest = drafts.changeDrafts.filter(
        (d) => d.componentId !== action.draft.componentId
      );
      drafts = {
        ...drafts,
        changeDrafts: [...rest, { ...action.draft, savedAt: Date.now() }],
      };
      return { committed, drafts };
    }

    case "DELETE_CHANGE_DRAFT": {
      drafts = {
        ...drafts,
        changeDrafts: drafts.changeDrafts.filter(
          (d) => d.componentId !== action.componentId
        ),
      };
      return { committed, drafts };
    }

    case "SUBMIT_CHANGE": {
      const { draft } = action;
      const target = committed.components.find((c) => c.id === draft.componentId);
      if (!target || target.status !== "approved") return state;
      if (sameDims(target.dimensions, draft.newDimensions)) return state;
      // 同一构件只允许一条待审批变更
      if (
        committed.changes.some(
          (ch) => ch.componentId === target.id && ch.status === "pending"
        )
      ) {
        return state;
      }
      const req: ChangeRequest = {
        id: uid("ch"),
        componentId: target.id,
        oldDimensions: target.dimensions,
        newDimensions: draft.newDimensions,
        reason: draft.reason,
        status: "pending",
        createdAt: Date.now(),
      };
      committed = {
        ...committed,
        changes: [req, ...committed.changes],
        logs: log(
          committed,
          `测量员就「${target.code} ${target.name}」提交尺寸变更申请，等待复核`,
          "info"
        ),
      };
      drafts = {
        ...drafts,
        changeDrafts: drafts.changeDrafts.filter(
          (d) => d.componentId !== target.id
        ),
      };
      return { committed, drafts };
    }

    case "APPROVE_CHANGE": {
      const req = committed.changes.find((c) => c.id === action.id);
      if (!req || req.status !== "pending") return state;
      const target = committed.components.find((c) => c.id === req.componentId);
      if (!target) return state;
      // 批准：以新值为准同步尺寸记录表 / 病害标记图 / 构件关系视图（同一数据源）
      committed = {
        ...committed,
        changes: committed.changes.map((ch) =>
          ch.id === req.id
            ? { ...ch, status: "approved", decidedAt: Date.now(), note: action.note }
            : ch
        ),
        components: updateComponent(committed.components, target.id, {
          dimensions: req.newDimensions,
        }),
        logs: log(
          committed,
          `批准「${target.code} ${target.name}」尺寸变更，正式记录已采用新尺寸`,
          "success"
        ),
      };
      // 结论生效后清掉同构件残留变更草稿，草稿不得覆盖已复核结论
      drafts = {
        ...drafts,
        changeDrafts: drafts.changeDrafts.filter((d) => d.componentId !== target.id),
      };
      return { committed, drafts };
    }

    case "REJECT_CHANGE": {
      const req = committed.changes.find((c) => c.id === action.id);
      if (!req || req.status !== "pending") return state;
      const target = committed.components.find((c) => c.id === req.componentId);
      committed = {
        ...committed,
        changes: committed.changes.map((ch) =>
          ch.id === req.id
            ? { ...ch, status: "rejected", decidedAt: Date.now(), note: action.note }
            : ch
        ),
        logs: log(
          committed,
          `驳回「${target ? target.code : req.componentId}」尺寸变更：${
            action.note
          }，继续使用原尺寸`,
          "danger"
        ),
      };
      // 驳回不修改构件尺寸（原记录继续有效），仅清理该构件的未提交草稿
      drafts = {
        ...drafts,
        changeDrafts: drafts.changeDrafts.filter(
          (d) => d.componentId !== req.componentId
        ),
      };
      return { committed, drafts };
    }

    case "RESET":
      return freshSeed();

    default:
      return state;
  }
}

// ---------- Context ----------

interface SurveyContextValue {
  committed: CommittedState;
  drafts: DraftState;
  dispatch: React.Dispatch<Action>;
  role: Role;
  setRole: (r: Role) => void;
  savedAt: number | null;
  findComponent: (id: string) => Component | undefined;
  allComponents: Component[]; // 正式构件 + 草稿构件
  pendingChangeFor: (componentId: string) => ChangeRequest | undefined;
  changeDraftFor: (componentId: string) => ChangeDraft | undefined;
}

const SurveyContext = createContext<SurveyContextValue | null>(null);

export function SurveyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [role, setRoleState] = useStateRole();
  const savedAtRef = useRef<number | null>(null);
  const [savedAt, setSavedAt] = useSavedTick();

  // 草稿与正式数据都持久化：未提交草稿关闭后仍在；已复核内容独立保存
  useEffect(() => {
    localStorage.setItem(COMMITTED_KEY, JSON.stringify(state.committed));
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state.drafts));
    savedAtRef.current = Date.now();
    setSavedAt(savedAtRef.current);
  }, [state, setSavedAt]);

  const value = useMemo<SurveyContextValue>(() => {
    const officialMap = new Map(state.committed.components.map((c) => [c.id, c]));
    return {
      committed: state.committed,
      drafts: state.drafts,
      dispatch,
      role,
      setRole: setRoleState,
      savedAt,
      findComponent: (id) => officialMap.get(id),
      allComponents: [...state.committed.components, ...state.drafts.components],
      pendingChangeFor: (componentId) =>
        state.committed.changes.find(
          (ch) => ch.componentId === componentId && ch.status === "pending"
        ),
      changeDraftFor: (componentId) =>
        state.drafts.changeDrafts.find((d) => d.componentId === componentId),
    };
  }, [state, role, savedAt, setRoleState]);

  return <SurveyContext.Provider value={value}>{children}</SurveyContext.Provider>;
}

export function useSurvey(): SurveyContextValue {
  const ctx = useContext(SurveyContext);
  if (!ctx) throw new Error("useSurvey 必须在 SurveyProvider 内使用");
  return ctx;
}

// 角色持久化
function useStateRole(): [Role, (r: Role) => void] {
  const [role, setRole] = usePersistentState<Role>(ROLE_KEY, "surveyor", (v) =>
    v === "reviewer" ? "reviewer" : "surveyor"
  );
  return [role, setRole];
}

// 保存指示时间戳
function useSavedTick(): [number | null, (n: number) => void] {
  return useState<number | null>(null);
}

function usePersistentState<T>(
  key: string,
  initial: T,
  normalize: (v: unknown) => T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : normalize(JSON.parse(raw));
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}
