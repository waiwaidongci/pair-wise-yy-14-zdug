import { useEffect, useState, type ReactNode } from "react";
import { useSurvey } from "../store";
import { STATUS_LABEL, type ReviewStatus } from "../types";
import { uid } from "../utils";

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warn" | "danger" | "ok" | "muted";
}) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export function BuildingSelect({
  value,
  onChange,
  allowAll = false,
}: {
  value: string; // buildingId 或 "all"
  onChange: (id: string) => void;
  allowAll?: boolean;
}) {
  const { committed } = useSurvey();
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowAll && <option value="all">全部建筑</option>}
      {committed.buildings.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 620,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: `min(${width}px, calc(100vw - 32px))` }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Toast ----------

interface ToastItem {
  id: string;
  text: string;
  tone: "info" | "success" | "danger";
}

let pushExternal: ((text: string, tone?: ToastItem["tone"]) => void) | null = null;

export function toast(text: string, tone: ToastItem["tone"] = "info") {
  pushExternal?.(text, tone);
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushExternal = (text, tone = "info") => {
      const id = uid("toast");
      setItems((prev) => [...prev, { id, text, tone }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    };
    return () => {
      pushExternal = null;
    };
  }, []);

  return (
    <div className="toast-host">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty">— {text} —</div>;
}
