export const COLOR_OPTIONS = [
  { value: "green", label: "Grün", hex: "#66B512" },
  { value: "blue", label: "Blau", hex: "#3b82f6" },
  { value: "orange", label: "Orange", hex: "#f97316" },
  { value: "purple", label: "Lila", hex: "#a855f7" },
  { value: "red", label: "Rot", hex: "#ef4444" },
  { value: "teal", label: "Türkis", hex: "#14b8a6" },
  { value: "pink", label: "Pink", hex: "#ec4899" },
  { value: "yellow", label: "Gelb", hex: "#eab308" },
];

export function colorHex(value: string): string {
  return COLOR_OPTIONS.find((c) => c.value === value)?.hex || "#66B512";
}
