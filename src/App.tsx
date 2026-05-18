import { useEffect, useMemo, useRef, useState } from "react";
import { loadDB, saveDB, newId, resetDB } from "./storage";
import { COLOR_OPTIONS, colorHex } from "./colors";
import type { DB, Activity, Shift, ShiftActivity } from "./types";

/* ----------------------------------------------------------------------------
   Tiny hash router (no dependency)
   Routes:
     #/             -> Shifts list
     #/shift/:id    -> Shift detail
     #/activities   -> Activities admin
---------------------------------------------------------------------------- */
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

function navigate(path: string) {
  window.location.hash = path;
}

/* ----------------------------------------------------------------------------
   Shared formatting
---------------------------------------------------------------------------- */
const SHIFT_LABEL: Record<string, string> = {
  Frueh: "Frühschicht",
  Spaet: "Spätschicht",
  Nacht: "Nachtschicht",
};

function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${h}:${m}:${s}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/* ----------------------------------------------------------------------------
   Top nav
---------------------------------------------------------------------------- */
function Nav({ active }: { active: "shifts" | "activities" }) {
  return (
    <header className="nav">
      <div className="nav-brand">
        <span className="nav-brand-logo">P</span>
        <span>Produktions Dashboard</span>
      </div>
      <div className="nav-links">
        <button
          className={"nav-link " + (active === "shifts" ? "active" : "")}
          onClick={() => navigate("/")}
        >
          Schichten
        </button>
        <button
          className={"nav-link " + (active === "activities" ? "active" : "")}
          onClick={() => navigate("/activities")}
        >
          Aktivitäten
        </button>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------------------
   Shifts list page
---------------------------------------------------------------------------- */
function ShiftsPage({
  db,
  setDB,
}: {
  db: DB;
  setDB: (d: DB) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [shiftType, setShiftType] = useState<"Frueh" | "Spaet" | "Nacht">("Frueh");
  const [operator, setOperator] = useState("");

  const sortedShifts = useMemo(
    () => [...db.shifts].sort((a, b) => b.createdAt - a.createdAt),
    [db.shifts]
  );

  const startShift = (e: React.FormEvent) => {
    e.preventDefault();
    const op = operator.trim();
    if (!op) {
      alert("Bitte die CWID eingeben.");
      return;
    }
    const next: DB = { ...db };
    const id = newId(next);
    const shift: Shift = {
      id,
      date,
      shiftType,
      operator: op,
      createdAt: Date.now(),
      shiftActivities: [],
      completions: [],
    };
    next.shifts = [shift, ...next.shifts];
    setDB(next);
    setOperator("");
    navigate(`/shift/${id}`);
  };

  const deleteShift = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Diese Schicht und alle Erledigt-Einträge wirklich löschen?")) return;
    const next: DB = { ...db, shifts: db.shifts.filter((s) => s.id !== id) };
    setDB(next);
  };

  return (
    <>
      <Nav active="shifts" />
      <main className="main">
        <div className="card">
          <h2 className="card-title">Neue Schicht starten</h2>
          <p className="card-subtitle">
            Wähle Datum, Schicht-Typ und gib deinen Namen ein. Anschließend
            kannst du die Aktivitäten dieser Schicht auswählen.
          </p>
          <form
            onSubmit={startShift}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr auto",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div className="field">
              <label className="label">Datum</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">Schicht</label>
              <select
                className="select"
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as any)}
              >
                <option value="Frueh">Frühschicht</option>
                <option value="Spaet">Spätschicht</option>
                <option value="Nacht">Nachtschicht</option>
              </select>
            </div>
            <div className="field">
              <label className="label">CWID</label>
              <input
                className="input"
                placeholder="z. B. AB12345"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Schicht starten →
            </button>
          </form>
        </div>

        <h3
          style={{
            margin: "24px 0 12px",
            fontSize: 14,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
          }}
        >
          Vergangene Schichten ({sortedShifts.length})
        </h3>

        {sortedShifts.length === 0 ? (
          <div className="card empty">
            Noch keine Schichten. Starte oben deine erste Schicht.
          </div>
        ) : (
          sortedShifts.map((s) => {
            const doneCount = countLeafDone(s);
            const totalCount = countLeafTotal(s);
            return (
              <div
                key={s.id}
                className="shift-item"
                onClick={() => navigate(`/shift/${s.id}`)}
              >
                <div className="shift-meta">
                  <span className="shift-date">{formatDate(s.date)}</span>
                  <span className="shift-sub">
                    {s.operator} ·{" "}
                    {totalCount > 0
                      ? `${doneCount} / ${totalCount} erledigt`
                      : "noch keine Aktivitäten gewählt"}
                  </span>
                </div>
                <span className="shift-pill">{SHIFT_LABEL[s.shiftType]}</span>
                <button
                  className="btn-danger"
                  title="Schicht löschen"
                  onClick={(e) => deleteShift(s.id, e)}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </main>
    </>
  );
}

/* ----------------------------------------------------------------------------
   Helper: count "leaf" tasks (parent w/o children + all children)
---------------------------------------------------------------------------- */
function countLeafTotal(s: Shift): number {
  const childParents = new Set(
    s.shiftActivities
      .filter((sa) => sa.parentIdSnapshot != null)
      .map((sa) => sa.parentIdSnapshot)
  );
  return s.shiftActivities.filter((sa) => {
    if (sa.parentIdSnapshot != null) return true;
    return !childParents.has(sa.activityId);
  }).length;
}

function countLeafDone(s: Shift): number {
  const childParents = new Set(
    s.shiftActivities
      .filter((sa) => sa.parentIdSnapshot != null)
      .map((sa) => sa.parentIdSnapshot)
  );
  const leafIds = s.shiftActivities
    .filter((sa) =>
      sa.parentIdSnapshot != null ? true : !childParents.has(sa.activityId)
    )
    .map((sa) => sa.id);
  const doneSet = new Set(s.completions.map((c) => c.shiftActivityId));
  return leafIds.filter((id) => doneSet.has(id)).length;
}

/* ----------------------------------------------------------------------------
   Shift detail page
---------------------------------------------------------------------------- */
function ShiftDetailPage({
  db,
  setDB,
  shiftId,
}: {
  db: DB;
  setDB: (d: DB) => void;
  shiftId: number;
}) {
  const shift = db.shifts.find((s) => s.id === shiftId);
  const [showImages, setShowImages] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(
    shift && shift.shiftActivities.length > 0 ? 2 : 1
  );
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  if (!shift) {
    return (
      <>
        <Nav active="shifts" />
        <main className="main">
          <div className="card empty">
            Schicht nicht gefunden.{" "}
            <a onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              Zurück zur Übersicht
            </a>
          </div>
        </main>
      </>
    );
  }

  const parents = useMemo(
    () =>
      db.activities
        .filter((a) => a.parentId == null)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [db.activities]
  );
  const childrenByParent = useMemo(() => {
    const m = new Map<number, Activity[]>();
    db.activities.forEach((a) => {
      if (a.parentId != null) {
        const arr = m.get(a.parentId) || [];
        arr.push(a);
        m.set(a.parentId, arr);
      }
    });
    for (const arr of m.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder);
    return m;
  }, [db.activities]);

  const selectedIds = useMemo(
    () => new Set(shift.shiftActivities.map((sa) => sa.activityId)),
    [shift.shiftActivities]
  );

  const shiftParents = useMemo(
    () => shift.shiftActivities.filter((sa) => sa.parentIdSnapshot == null),
    [shift.shiftActivities]
  );
  const shiftChildrenByParent = useMemo(() => {
    const m = new Map<number, ShiftActivity[]>();
    shift.shiftActivities.forEach((sa) => {
      if (sa.parentIdSnapshot != null) {
        const arr = m.get(sa.parentIdSnapshot) || [];
        arr.push(sa);
        m.set(sa.parentIdSnapshot, arr);
      }
    });
    return m;
  }, [shift.shiftActivities]);

  const completionsBySa = useMemo(() => {
    const m = new Map<number, typeof shift.completions>();
    shift.completions.forEach((c) => {
      const arr = m.get(c.shiftActivityId) || [];
      arr.push(c);
      m.set(c.shiftActivityId, arr);
    });
    return m;
  }, [shift.completions]);

  const totalCount = countLeafTotal(shift);
  const doneCount = countLeafDone(shift);
  const missed = Math.max(0, totalCount - doneCount);
  const rate = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  /* --- Mutations --- */
  const updateShift = (mut: (s: Shift) => Shift) => {
    const next: DB = {
      ...db,
      shifts: db.shifts.map((s) => (s.id === shiftId ? mut(s) : s)),
    };
    setDB(next);
  };

  const setSelection = (activityIds: number[]) => {
    const desired = new Set(activityIds);
    updateShift((s) => {
      const next = { ...s };
      // Remove ones no longer selected (and their completions)
      const removedSaIds = new Set(
        s.shiftActivities
          .filter((sa) => !desired.has(sa.activityId))
          .map((sa) => sa.id)
      );
      next.shiftActivities = s.shiftActivities.filter((sa) =>
        desired.has(sa.activityId)
      );
      next.completions = s.completions.filter(
        (c) => !removedSaIds.has(c.shiftActivityId)
      );
      // Add new selections (preserve master activity order)
      const existing = new Set(next.shiftActivities.map((sa) => sa.activityId));
      const ordered: number[] = [];
      const masterById = new Map(db.activities.map((a) => [a.id, a]));
      // Walk parents -> children to produce a stable order
      parents.forEach((p) => {
        ordered.push(p.id);
        (childrenByParent.get(p.id) || []).forEach((c) => ordered.push(c.id));
      });
      const newDB = { ...db };
      ordered.forEach((actId) => {
        if (existing.has(actId)) return;
        if (!desired.has(actId)) return;
        const a = masterById.get(actId);
        if (!a) return;
        const id = newId(newDB);
        next.shiftActivities.push({
          id,
          activityId: actId,
          nameSnapshot: a.name,
          colorSnapshot: a.color,
          parentIdSnapshot: a.parentId,
        });
      });
      // persist nextId
      db.nextId = newDB.nextId;
      return next;
    });
  };

  const toggleActivity = (activityId: number) => {
    const next = new Set(selectedIds);
    if (next.has(activityId)) next.delete(activityId);
    else next.add(activityId);
    setSelection(Array.from(next));
  };

  const toggleParentGroup = (parentId: number) => {
    const kids = childrenByParent.get(parentId) || [];
    const next = new Set(selectedIds);
    const allKidsSelected = kids.length > 0 && kids.every((k) => next.has(k.id));
    if (next.has(parentId) || allKidsSelected) {
      next.delete(parentId);
      kids.forEach((k) => next.delete(k.id));
    } else {
      next.add(parentId);
      kids.forEach((k) => next.add(k.id));
    }
    setSelection(Array.from(next));
  };

  const addCompletion = (sa: ShiftActivity, file: File | null) => {
    if (file && !file.type.startsWith("image/")) {
      alert("Bitte ein Bild (JPG/PNG) auswählen.");
      return;
    }
    const submit = (imageData: string | null) => {
      updateShift((s) => {
        const next = { ...s };
        const newDB = { ...db };
        const id = newId(newDB);
        next.completions = [
          ...s.completions,
          { id, shiftActivityId: sa.id, timestamp: Date.now(), imageData },
        ];
        db.nextId = newDB.nextId;
        return next;
      });
    };
    if (file) {
      const reader = new FileReader();
      reader.onload = () => submit(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      submit(null);
    }
    const inp = fileInputs.current[sa.id];
    if (inp) inp.value = "";
  };

  const deleteCompletion = (id: number) => {
    updateShift((s) => ({
      ...s,
      completions: s.completions.filter((c) => c.id !== id),
    }));
  };

  /* --- Render helpers --- */
  const renderTaskCard = (sa: ShiftActivity) => {
    const logs = completionsBySa.get(sa.id) || [];
    const hex = colorHex(sa.colorSnapshot);
    return (
      <div
        key={sa.id}
        className="task-card"
        style={{ borderLeft: `4px solid ${hex}` }}
      >
        <div className="task-header">
          <span className="dot dot-lg" style={{ background: hex }} />
          <span className="task-name">{sa.nameSnapshot}</span>
          {logs.length > 0 ? (
            <span className="badge badge-success" style={{ background: hex }}>
              ✓ {logs.length}× erledigt
            </span>
          ) : (
            <span className="badge badge-outline">Offen</span>
          )}
          <span className="spacer" />
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            ref={(el) => {
              fileInputs.current[sa.id] = el;
            }}
            id={`file-${sa.id}`}
          />
          <button
            className="btn btn-sm"
            type="button"
            onClick={() => fileInputs.current[sa.id]?.click()}
          >
            📷 Bild
          </button>
          <button
            className="btn btn-sm"
            style={{ background: hex, borderColor: hex, color: "white" }}
            onClick={() => {
              const file = fileInputs.current[sa.id]?.files?.[0] || null;
              addCompletion(sa, file);
            }}
          >
            ✓ Erledigt
          </button>
        </div>
        {logs.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {[...logs].reverse().map((log) => (
              <div key={log.id} className="log-row">
                {showImages && log.imageData && (
                  <img
                    src={log.imageData}
                    alt="Nachweis"
                    className="log-thumb"
                    onClick={() => setLightbox(log.imageData)}
                  />
                )}
                <span className="log-time" style={{ color: hex }}>
                  {formatDateTime(log.timestamp)}
                </span>
                <span className="spacer" />
                <button
                  className="btn-danger"
                  title="Eintrag löschen"
                  onClick={() => deleteCompletion(log.id)}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Nav active="shifts" />
      <main className="main">
        {/* Header */}
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="btn-ghost btn-sm" onClick={() => navigate("/")}>
            ← Zurück
          </button>
          <span className="spacer" />
          {step === 2 && (
            <label className="switch">
              <input
                type="checkbox"
                checked={showImages}
                onChange={(e) => setShowImages(e.target.checked)}
              />
              <span className="switch-track">
                <span className="switch-thumb" />
              </span>
              Bilder anzeigen
            </label>
          )}
        </div>

        {/* Step indicator */}
        <div className="row" style={{ marginBottom: 16, gap: 8 }}>
          <span
            className="step-pill"
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: step === 1 ? "var(--bayer)" : "var(--surface-2)",
              color: step === 1 ? "#000" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            1. Aktivitäten
          </span>
          <span style={{ color: "var(--text-muted)" }}>→</span>
          <span
            className="step-pill"
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: step === 2 ? "var(--bayer)" : "var(--surface-2)",
              color: step === 2 ? "#000" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            2. Durchführung
          </span>
        </div>

        <div className="card">
          <h2 className="card-title">
            {shift.operator} · {SHIFT_LABEL[shift.shiftType]}
          </h2>
          <p className="card-subtitle">{formatDate(shift.date)}</p>

          <div className="grid grid-3">
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: "var(--bayer)" }}>
                {doneCount}
              </div>
              <div className="kpi-label">Erledigt</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value" style={{ color: "var(--danger)" }}>
                {missed}
              </div>
              <div className="kpi-label">Offen</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{rate}%</div>
              <div className="kpi-label">Quote</div>
            </div>
          </div>
        </div>

        {/* Selection */}
        {step === 1 && (
        <div className="card">
          <h3 className="card-title">Aktivitäten dieser Schicht</h3>
          <p className="card-subtitle">
            Wähle die Aktivitäten, die in dieser Schicht durchgeführt werden.
          </p>
          {db.activities.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>
              Keine Aktivitäten in der Stammliste.{" "}
              <a onClick={() => navigate("/activities")} style={{ cursor: "pointer" }}>
                Jetzt hinzufügen.
              </a>
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {parents.map((p) => {
                const kids = childrenByParent.get(p.id) || [];
                const parentChecked = selectedIds.has(p.id);
                const someKid = kids.some((k) => selectedIds.has(k.id));
                const allKids = kids.length > 0 && kids.every((k) => selectedIds.has(k.id));
                const hex = colorHex(p.color);
                const highlight = parentChecked || someKid;
                return (
                  <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label
                      className="pick parent"
                      style={
                        highlight
                          ? { borderColor: hex, background: hex + "1a" }
                          : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        checked={kids.length > 0 ? allKids : parentChecked}
                        onChange={() =>
                          kids.length > 0 ? toggleParentGroup(p.id) : toggleActivity(p.id)
                        }
                      />
                      <span className="dot dot-lg" style={{ background: hex }} />
                      <span className="pick-group-name">{p.name}</span>
                      {kids.length > 0 && (
                        <span className="pick-count">
                          {kids.filter((k) => selectedIds.has(k.id)).length}/{kids.length} ausgewählt
                        </span>
                      )}
                    </label>
                    {kids.length > 0 && (
                      <div
                        className="grid grid-2"
                        style={{ paddingLeft: 24 }}
                      >
                        {kids.map((c) => {
                          const checked = selectedIds.has(c.id);
                          const chex = colorHex(c.color);
                          return (
                            <label
                              key={c.id}
                              className="pick"
                              style={
                                checked
                                  ? { borderColor: chex, background: chex + "1a" }
                                  : undefined
                              }
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleActivity(c.id)}
                              />
                              <span className="dot" style={{ background: chex }} />
                              <span style={{ fontSize: 14 }}>{c.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* Weiter button after selection */}
        {step === 1 && (
          <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
            <button
              className="btn btn-primary"
              disabled={shift.shiftActivities.length === 0}
              onClick={() => setStep(2)}
            >
              Weiter zur Durchführung →
            </button>
          </div>
        )}

        {/* Durchführung grouped by parent */}
        {step === 2 && shift.shiftActivities.length > 0 && (
          <>
            <h3
              style={{
                margin: "24px 0 12px",
                fontSize: 14,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
              }}
            >
              Durchführung
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {shiftParents.map((parentSa) => {
                const kids = shiftChildrenByParent.get(parentSa.activityId) || [];
                const hex = colorHex(parentSa.colorSnapshot);
                if (kids.length === 0) {
                  return renderTaskCard(parentSa);
                }
                const doneInGroup = kids.filter(
                  (k) => (completionsBySa.get(k.id)?.length || 0) > 0
                ).length;
                return (
                  <div key={parentSa.id}>
                    <div
                      className="group-header"
                      style={{ borderColor: hex, background: hex + "1a" }}
                    >
                      <span className="dot dot-lg" style={{ background: hex }} />
                      <span>{parentSa.nameSnapshot}</span>
                      <span className="spacer" />
                      <span
                        className="badge badge-outline"
                        style={{ borderColor: hex, color: hex }}
                      >
                        {doneInGroup}/{kids.length} erledigt
                      </span>
                    </div>
                    <div className="group-body" style={{ borderLeftColor: hex + "55" }}>
                      {kids.map((k) => renderTaskCard(k))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 1 && shift.shiftActivities.length === 0 && db.activities.length > 0 && (
          <div className="card empty">
            Wähle oben die Aktivitäten für diese Schicht aus.
          </div>
        )}

        {step === 2 && (
          <div className="row" style={{ marginTop: 24, justifyContent: "flex-start" }}>
            <button className="btn-ghost btn-sm" onClick={() => setStep(1)}>
              ← Auswahl bearbeiten
            </button>
          </div>
        )}
      </main>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" aria-label="Schließen">✕</button>
          <img src={lightbox} alt="Vollbild" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------------------
   Activities admin page
---------------------------------------------------------------------------- */
function ActivitiesPage({
  db,
  setDB,
}: {
  db: DB;
  setDB: (d: DB) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("green");
  const [parentSel, setParentSel] = useState<string>("__top__"); // "__top__" or parentId
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const parents = useMemo(
    () =>
      db.activities
        .filter((a) => a.parentId == null)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [db.activities]
  );
  const childrenByParent = useMemo(() => {
    const m = new Map<number, Activity[]>();
    db.activities.forEach((a) => {
      if (a.parentId != null) {
        const arr = m.get(a.parentId) || [];
        arr.push(a);
        m.set(a.parentId, arr);
      }
    });
    for (const arr of m.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder);
    return m;
  }, [db.activities]);

  const addActivity = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (db.activities.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Eine Aktivität mit diesem Namen existiert schon.");
      return;
    }
    const next: DB = { ...db, activities: [...db.activities] };
    const id = newId(next);
    const parentId = parentSel === "__top__" ? null : Number(parentSel);
    // sort_order = max(sort_order in its sibling group) + 1
    const siblings = next.activities.filter((a) => a.parentId === parentId);
    const sortOrder =
      siblings.length === 0
        ? 0
        : Math.max(...siblings.map((s) => s.sortOrder)) + 1;
    next.activities.push({ id, name: trimmed, color, sortOrder, parentId });
    setDB(next);
    setName("");
  };

  const updateActivity = (id: number, patch: Partial<Activity>) => {
    const next: DB = {
      ...db,
      activities: db.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    };
    setDB(next);
  };

  const deleteActivity = (a: Activity) => {
    const kids = childrenByParent.get(a.id) || [];
    const warning =
      a.parentId == null && kids.length > 0
        ? `\n\nAchtung: ${kids.length} Unterpunkt(e) werden ebenfalls gelöscht.`
        : "";
    if (
      !confirm(
        `"${a.name}" wirklich löschen?${warning}\n\nBestehende Schichten behalten ihre Einträge.`
      )
    )
      return;
    const removeIds = new Set<number>([a.id, ...kids.map((k) => k.id)]);
    const next: DB = {
      ...db,
      activities: db.activities.filter((x) => !removeIds.has(x.id)),
    };
    setDB(next);
  };

  const moveInGroup = (group: Activity[], idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= group.length) return;
    const reordered = [...group];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    // Re-assign sortOrder within group
    const idToSortOrder = new Map<number, number>();
    reordered.forEach((a, i) => idToSortOrder.set(a.id, i));
    const next: DB = {
      ...db,
      activities: db.activities.map((a) =>
        idToSortOrder.has(a.id)
          ? { ...a, sortOrder: idToSortOrder.get(a.id)! }
          : a
      ),
    };
    setDB(next);
  };

  const toggleCollapse = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetAll = () => {
    if (
      !confirm(
        "Alle Daten löschen und Stammliste zurücksetzen?\n\nDies löscht ALLE Schichten, Aktivitäten und Erledigt-Einträge."
      )
    )
      return;
    setDB(resetDB());
  };

  const renderRow = (a: Activity, idx: number, group: Activity[], isChild: boolean) => {
    const kids = childrenByParent.get(a.id) || [];
    return (
      <div
        key={a.id}
        className={"activity-row" + (isChild ? " child" : "")}
        style={{ borderLeftColor: colorHex(a.color) }}
      >
        {!isChild ? (
          <button
            className="btn-ghost btn-sm"
            onClick={() => toggleCollapse(a.id)}
            title={collapsed.has(a.id) ? "Aufklappen" : "Zuklappen"}
            style={{ padding: "2px 6px" }}
          >
            {collapsed.has(a.id) ? "▶" : "▼"}
          </button>
        ) : (
          <span className="drag-handle">⋮⋮</span>
        )}
        <input
          className="input-bare"
          value={a.name}
          onChange={(e) => updateActivity(a.id, { name: e.target.value })}
        />
        {!isChild && (
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {kids.length} Unterpunkte
          </span>
        )}
        <select
          className="select"
          value={a.color}
          style={{ width: 130 }}
          onChange={(e) => updateActivity(a.id, { color: e.target.value })}
        >
          {COLOR_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          className="btn-ghost"
          onClick={() => moveInGroup(group, idx, -1)}
          disabled={idx === 0}
          title="Hoch"
        >
          ↑
        </button>
        <button
          className="btn-ghost"
          onClick={() => moveInGroup(group, idx, 1)}
          disabled={idx === group.length - 1}
          title="Runter"
        >
          ↓
        </button>
        <button
          className="btn-danger"
          onClick={() => deleteActivity(a)}
          title="Löschen"
        >
          🗑
        </button>
      </div>
    );
  };

  return (
    <>
      <Nav active="activities" />
      <main className="main">
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <div>
              <h2 className="card-title">Aktivitäten verwalten</h2>
              <p className="card-subtitle">
                Stammliste der Aktivitäten. Eltern-Gruppen (z. B. MO Start, MO Ende)
                gruppieren Unterpunkte. Änderungen werden sofort lokal gespeichert.
              </p>
            </div>
            <span className="spacer" />
            <button className="btn btn-sm" onClick={resetAll} title="Alle Daten zurücksetzen">
              ⟲ Zurücksetzen
            </button>
          </div>
          <form
            onSubmit={addActivity}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 180px 180px auto",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div className="field">
              <label className="label">Name</label>
              <input
                className="input"
                placeholder="z.B. Reinigung Bandsystem"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">Gruppe</label>
              <select
                className="select"
                value={parentSel}
                onChange={(e) => setParentSel(e.target.value)}
              >
                <option value="__top__">Eltern (oben)</option>
                {parents.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    ↳ {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Farbe</label>
              <select
                className="select"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              >
                {COLOR_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary">
              + Hinzufügen
            </button>
          </form>
        </div>

        {db.activities.length === 0 ? (
          <div className="card empty">
            Noch keine Aktivitäten. Füge oben deine erste hinzu.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {parents.map((p, pIdx) => {
              const kids = childrenByParent.get(p.id) || [];
              const isCollapsed = collapsed.has(p.id);
              return (
                <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {renderRow(p, pIdx, parents, false)}
                  {!isCollapsed &&
                    kids.length > 0 &&
                    kids.map((k, kIdx) => renderRow(k, kIdx, kids, true))}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

/* ----------------------------------------------------------------------------
   App root: load DB once, autosave on every change, route by hash
---------------------------------------------------------------------------- */
export default function App() {
  const [db, setDBState] = useState<DB>(() => loadDB());
  const hash = useHashRoute();

  const setDB = (next: DB) => {
    setDBState(next);
    saveDB(next);
  };

  // routing
  if (hash.startsWith("#/shift/")) {
    const id = Number(hash.replace("#/shift/", ""));
    return <ShiftDetailPage db={db} setDB={setDB} shiftId={id} />;
  }
  if (hash.startsWith("#/activities")) {
    return <ActivitiesPage db={db} setDB={setDB} />;
  }
  return <ShiftsPage db={db} setDB={setDB} />;
}
