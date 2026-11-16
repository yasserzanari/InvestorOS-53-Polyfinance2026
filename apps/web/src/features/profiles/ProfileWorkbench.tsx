import { useEffect } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { FieldKey, Profile } from "./profile-model";
import type { WorkspaceTab } from "./profile-api";
import { demoGoalsTab } from "./profile-demo-data";
import { ProfileDetailTabs } from "./ProfileDetailTabs";
import "./profile-workbench.css";
import "./profile-detail-tabs.css";

export function ProfileWorkbench({
  accountId,
  profile,
  onChange,
  onConfirm,
  onDiscuss,
  tabs,
  onTab,
  busy,
  memory,
  expanded,
  onExpand,
  requestedView,
  onErase,
  onSituation,
}: {
  onSituation: (fields: Partial<NonNullable<Profile["situation"]>>) => void;
  onErase: () => void;
  accountId: string;
  profile: Profile;
  onChange: (key: FieldKey, value: string) => void;
  onConfirm: () => void;
  onDiscuss: (s: string) => void;
  tabs: WorkspaceTab[];
  onTab: (tab: WorkspaceTab, syncSummary?: boolean) => void;
  busy: boolean;
  memory: { status: string; ready: boolean; reload: () => void };
  expanded: boolean;
  onExpand: () => void;
  requestedView?: string;
}) {
  useEffect(() => {
    const existing = tabs.find((tab) => tab.id === "profile-objectives");
    if (memory.ready && existing) {
      try {
        const doc = JSON.parse(existing.content);
        if (
          doc.goals.some((goal: { anchorYear?: number }) => !goal.anchorYear)
        ) {
          onTab(
            {
              ...existing,
              content: JSON.stringify({
                ...doc,
                goals: doc.goals.map((goal: object) => ({
                  ...goal,
                  anchorYear: new Date().getFullYear(),
                })),
              }),
            },
            false,
          );
        }
      } catch {
        /* Invalid documents are rejected by the memory API. */
      }
    }
    if (
      profile.origins.objective === "Informations effacées" ||
      !memory.ready ||
      tabs.length >= 12 ||
      tabs.some((tab) => tab.id === "profile-objectives")
    )
      return;
    onTab(demoGoalsTab(accountId), false);
  }, [accountId, memory.ready, tabs, onTab]);

  return (
    <div className="pb-workbench" data-profile-workbench>
      <header className="pb-heading">
        <div>
          <span className="pb-eyebrow">ESPACE INVESTISSEUR · DÉMO</span>
          <h2>
            {accountId[0].toUpperCase() + accountId.slice(1)}
            <span>Votre contexte, vos décisions</span>
          </h2>
        </div>
        <button
          type="button"
          onClick={onExpand}
          title={expanded ? "Afficher le chat" : "Agrandir le panneau"}
          aria-label={expanded ? "Afficher le chat" : "Agrandir le panneau"}
        >
          {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </header>
      <div className="pb-body pdt-workbench-body">
        <ProfileDetailTabs
          accountId={accountId}
          profile={profile}
          onChange={onChange}
          onConfirm={onConfirm}
          onDiscuss={onDiscuss}
          busy={busy}
          tabs={tabs}
          onTab={onTab}
          requestedView={requestedView}
          onErase={onErase}
          onSituation={onSituation}
          memory={memory}
        />
      </div>
      <footer className="pb-footer">
        <span>
          <i />
          {memory.status}
        </span>
        <span>Persona fictive · situation financière facultative</span>
      </footer>
    </div>
  );
}
