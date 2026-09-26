import type { Dimensions } from "./types";

export function uid(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function fmtDims(d: Dimensions): string {
  return `${d.width}×${d.height}×${d.length}mm`;
}

export function dimsValid(d: Dimensions): boolean {
  return d.width > 0 && d.height > 0 && d.length > 0;
}

export function sameDims(a: Dimensions, b: Dimensions): boolean {
  return a.width === b.width && a.height === b.height && a.length === b.length;
}

export function dimDelta(old: Dimensions, next: Dimensions) {
  return [
    { key: "宽", from: old.width, to: next.width },
    { key: "高", from: old.height, to: next.height },
    { key: "长", from: old.length, to: next.length },
  ];
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
