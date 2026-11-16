import type { Profile } from "./profile-model";
import type { WorkspaceTab } from "./profile-api";
import type { DemoGoal } from "./profile-demo-data";

export function goalSummary(profile: Profile, goals: DemoGoal[]): Profile {
  const main = goals.find((goal) => goal.role === "Principal");
  return {
    ...profile,
    objective: main ? main.description || main.title : "",
    horizon: main
      ? main.horizonLabel ||
        (main.horizonYears ? `${main.horizonYears} ans` : "À préciser")
      : "",
  };
}
export function syncGeneralGoal(
  tabs: WorkspaceTab[],
  key: string,
  value: string,
): WorkspaceTab[] {
  if (!["objective", "horizon"].includes(key)) return tabs;
  return tabs.map((tab) => {
    if (tab.id !== "profile-objectives") return tab;
    try {
      const doc = JSON.parse(tab.content);
      const goals = (doc.goals as DemoGoal[]).map((goal) => {
        if (goal.role !== "Principal") return goal;
        if (key === "objective") return { ...goal, description: value };
        const match = value.match(/^\s*(\d{1,2})\s*(?:ans?|années?)\s*$/i);
        return match && Number(match[1]) >= 1 && Number(match[1]) <= 50
          ? {
              ...goal,
              horizonLabel: value,
              horizonYears: Number(match[1]),
              anchorYear: new Date().getFullYear(),
              targetDate: undefined,
            }
          : {
              ...goal,
              horizonYears: null,
              horizonLabel: value,
              targetDate: null,
            };
      });
      return { ...tab, content: JSON.stringify({ ...doc, goals }) };
    } catch {
      return tab;
    }
  });
}
export function detailChanges(
  previous: WorkspaceTab[],
  next: WorkspaceTab[],
  origin: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const tab of next.filter((tab) =>
    ["profile-controls", "profile-objectives"].includes(tab.id),
  )) {
    const old = previous.find((item) => item.id === tab.id);
    if (old?.content === tab.content) continue;
    try {
      const after = JSON.parse(tab.content);
      const before = JSON.parse(old?.content ?? "{}");
      if (tab.id === "profile-controls")
        for (const key of Object.keys(after)) {
          if (after[key] !== before[key]) result[key] = origin;
        }
      else result["profile-objectives"] = origin;
    } catch {
      /* A malformed document is rejected by the shared API contract. */
    }
  }
  return result;
}
