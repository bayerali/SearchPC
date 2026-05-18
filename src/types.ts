export type Activity = {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  parentId: number | null;
};

export type Completion = {
  id: number;
  shiftActivityId: number;
  timestamp: number;
  imageData: string | null;
};

// A "shiftActivity" snapshots an activity at the moment it's selected for a shift.
export type ShiftActivity = {
  id: number;
  activityId: number;
  nameSnapshot: string;
  colorSnapshot: string;
  parentIdSnapshot: number | null;
};

export type Shift = {
  id: number;
  date: string; // YYYY-MM-DD
  shiftType: "Frueh" | "Spaet" | "Nacht";
  operator: string;
  createdAt: number;
  shiftActivities: ShiftActivity[];
  completions: Completion[];
};

export type DB = {
  activities: Activity[];
  shifts: Shift[];
  nextId: number;
};
