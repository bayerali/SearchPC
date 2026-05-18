import type { DB, Activity } from "./types";

const STORAGE_KEY = "produktions-dashboard:v1";

function defaultActivities(): Activity[] {
  // MO Start (id 1, green) + 7 children
  // MO Ende  (id 2, red)   + 9 children
  const acts: Activity[] = [
    { id: 1, name: "MO Start", color: "green", sortOrder: 0, parentId: null },
    { id: 2, name: "MO Ende", color: "red", sortOrder: 1, parentId: null },
    // MO Start children
    { id: 3, name: "Abnahme", color: "blue", sortOrder: 0, parentId: 1 },
    { id: 4, name: "SFA IDE", color: "orange", sortOrder: 1, parentId: 1 },
    { id: 5, name: "IDE vor Start", color: "purple", sortOrder: 2, parentId: 1 },
    { id: 6, name: "Klebestelle durchfahren", color: "green", sortOrder: 3, parentId: 1 },
    { id: 7, name: "Leer Blister Prüfung", color: "blue", sortOrder: 4, parentId: 1 },
    { id: 8, name: "Kamera Test", color: "orange", sortOrder: 5, parentId: 1 },
    { id: 9, name: "ZP Zufuhr auf", color: "purple", sortOrder: 6, parentId: 1 },
    // MO Ende children
    { id: 10, name: "ZP Zufürung schließen", color: "red", sortOrder: 0, parentId: 2 },
    { id: 11, name: "Blister Strang leerfahren", color: "orange", sortOrder: 1, parentId: 2 },
    { id: 12, name: "Blister Maschine stoppen", color: "red", sortOrder: 2, parentId: 2 },
    { id: 13, name: "Saugband hochfahren und entleeren", color: "orange", sortOrder: 3, parentId: 2 },
    { id: 14, name: "Chargeblöcke ausbauen", color: "purple", sortOrder: 4, parentId: 2 },
    { id: 15, name: "OR + UR ausmessen, Restmenge auf Beleg", color: "blue", sortOrder: 5, parentId: 2 },
    { id: 16, name: "OR+UR, MO-Data-Report, Linienkennzeichnung zum Vorarbeiter", color: "blue", sortOrder: 6, parentId: 2 },
    { id: 17, name: "ZP Wanne auswiegen", color: "purple", sortOrder: 7, parentId: 2 },
    { id: 18, name: "Pas X bearebeitung", color: "green", sortOrder: 8, parentId: 2 },
  ];
  return acts;
}

function defaultDB(): DB {
  return {
    activities: defaultActivities(),
    shifts: [],
    nextId: 1000,
  };
}

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDB();
    const parsed = JSON.parse(raw) as DB;
    // sanity-check structure
    if (!parsed.activities || !parsed.shifts) return defaultDB();
    if (typeof parsed.nextId !== "number") parsed.nextId = 1000;
    // Migrate: fix typo "Lenienkennzeichnung" -> "Linienkennzeichnung"
    parsed.activities.forEach((a) => {
      if (a.name && a.name.includes("Lenienkennzeichnung")) {
        a.name = a.name.replace(/Lenienkennzeichnung/g, "Linienkennzeichnung");
      }
    });
    parsed.shifts.forEach((s) => {
      s.shiftActivities?.forEach((sa) => {
        if (sa.nameSnapshot && sa.nameSnapshot.includes("Lenienkennzeichnung")) {
          sa.nameSnapshot = sa.nameSnapshot.replace(/Lenienkennzeichnung/g, "Linienkennzeichnung");
        }
      });
    });
    return parsed;
  } catch {
    return defaultDB();
  }
}

export function saveDB(db: DB) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error("Could not save:", e);
  }
}

export function newId(db: DB): number {
  db.nextId += 1;
  return db.nextId;
}

export function resetDB(): DB {
  const fresh = defaultDB();
  saveDB(fresh);
  return fresh;
}
