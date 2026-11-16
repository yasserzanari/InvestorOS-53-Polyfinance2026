import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  UserRound,
  Database,
  Activity,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CircleHelp,
  Clock3,
  GraduationCap,
  Info,
  Landmark,
  Leaf,
  LockKeyhole,
  Pencil,
  SlidersHorizontal,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import {
  fieldLabels,
  fieldOrder,
  type FieldKey,
  type Profile,
} from "./profile-model";
import { isProfileFieldMissing } from "./profile-consistency";
import { goalsFromTab, type DemoSituation } from "./profile-demo-data";
import type { WorkspaceTab } from "./profile-api";
import "./profile-detail-tabs.css";
import { ProfileObjectives } from "./ProfileObjectives";
import { ProfileAdvancedTabs } from "./ProfileAdvancedTabs";

export type ProfileDetailTabId =
  "overview" | "objectives" | "situation" | "risk" | "preferences" | "memory";
const sectionTabs: {
  id: ProfileDetailTabId;
  label: string;
  icon: typeof Target;
}[] = [
  { id: "overview", label: "Aperçu", icon: BookOpen },
  { id: "objectives", label: "Objectifs", icon: Target },
  { id: "situation", label: "Situation", icon: UserRound },
  { id: "risk", label: "Risque", icon: Activity },
  { id: "preferences", label: "Préférences", icon: SlidersHorizontal },
  { id: "memory", label: "Mémoire", icon: Database },
];

function completion(profile: Profile) {
  return fieldOrder.filter((key) => !isProfileFieldMissing(profile[key]))
    .length;
}

function ProfileField({
  field,
  profile,
  onChange,
  compact = false,
}: {
  field: FieldKey;
  profile: Profile;
  onChange: (key: FieldKey, value: string) => void;
  compact?: boolean;
}) {
  const missing = isProfileFieldMissing(profile[field]);
  return (
    <label
      className={`pdt-field${missing ? " is-missing" : ""}${compact ? " is-compact" : ""}`}
    >
      <span className="pdt-field-label">
        {fieldLabels[field]}
        {missing ? <small>À préciser</small> : <Check size={15} />}
      </span>
      <textarea
        aria-label={fieldLabels[field]}
        value={profile[field]}
        onChange={(event) => onChange(field, event.currentTarget.value)}
        rows={compact ? 2 : 3}
      />
      <span className="pdt-field-origin">
        {profile.origins[field] || "Déclaration de la personne"}
      </span>
    </label>
  );
}

function SituationPanel({
  situation,
  onSituation,
  busy,
}: {
  situation: DemoSituation;
  onSituation: (fields: Partial<DemoSituation>) => void;
  busy: boolean;
}) {
  const rows = [
    {
      label: "Revenu et stabilité",
      key: "incomeRange",
      value: situation.incomeRange,
      icon: BriefcaseBusiness,
    },
    {
      label: "Réserve de liquidités",
      key: "liquidities",
      value: situation.liquidities,
      icon: WalletCards,
    },
    {
      label: "Actifs financiers",
      key: "financialAssets",
      value: situation.financialAssets,
      icon: Landmark,
    },
    {
      label: "Dettes et levier",
      key: "obligations",
      value: situation.obligations,
      icon: Activity,
    },
    {
      label: "Contexte personnel pertinent",
      key: "personalContext",
      value: situation.personalContext,
      icon: Info,
    },
  ];
  return (
    <>
      <section className="pdt-optional-banner">
        <span className="pdt-icon-tile">
          <LockKeyhole size={19} />
        </span>
        <div>
          <strong>Facultatif — vous pouvez passer cette section</strong>
          <p>
            Dans cette démonstration, aucun renseignement financier n’est
            nécessaire pour parcourir le profil. Les valeurs visibles sont
            fictives.
          </p>
        </div>
        <span className="pdt-optional-pill">Non obligatoire ici</span>
      </section>
      <section className="pdt-panel">
        <header className="pdt-section-heading">
          <div>
            <span className="pdt-icon-tile">
              <BriefcaseBusiness size={19} />
            </span>
            <div>
              <h3>Situation financière et personnelle</h3>
              <p>Exemples synthétiques, sans données réelles de client.</p>
            </div>
          </div>
          <span className="pdt-demo-badge">Persona fictive</span>
        </header>
        <div className="pdt-situation-grid">
          {rows.map(({ key, label, value, icon: Icon }) => (
            <article className="pdt-situation-card" key={label}>
              <span className="pdt-small-icon">
                <Icon size={17} />
              </span>
              <div>
                <strong>{label}</strong>
                <textarea
                  aria-label={label}
                  disabled={busy}
                  maxLength={500}
                  rows={2}
                  value={value ?? ""}
                  onChange={(e) => onSituation({ [key]: e.target.value })}
                />
              </div>
              <span className="pdt-optional-label">Facultatif</span>
            </article>
          ))}
        </div>
        <p className="pdt-legal-note">
          Pour une activité réglementée, les renseignements à recueillir
          dépendent du service offert et des obligations applicables. Cette
          maquette n’établit pas de convenance et ne constitue pas un avis
          juridique.
        </p>
      </section>
    </>
  );
}

export function ProfileDetailTabs({
  accountId,
  profile,
  onChange,
  onConfirm,
  onDiscuss,
  busy,
  tabs,
  onTab,
  requestedView,
  onErase,
  memory,
  onSituation,
}: {
  accountId: string;
  profile: Profile;
  onChange: (key: FieldKey, value: string) => void;
  onConfirm: () => void;
  onDiscuss: (prompt: string) => void;
  busy: boolean;
  onSituation: (fields: Partial<DemoSituation>) => void;
  onErase: () => void;
  memory: { status: string; reload: () => void };
  tabs: WorkspaceTab[];
  onTab: (tab: WorkspaceTab) => void;
  requestedView?: string;
}) {
  const [view, setView] = useState<ProfileDetailTabId>("overview");
  const total = completion(profile);
  const goalTab = tabs.find((tab) => tab.id === "profile-objectives");
  const storedGoals = goalsFromTab(goalTab, accountId);
  const goals = storedGoals;
  const primary = goals.find((goal) => goal.role === "Principal");
  const goalConflict =
    primary &&
    ((profile.objective &&
      profile.objective !== (primary.description || primary.title)) ||
      (profile.horizon &&
        profile.horizon !==
          (primary.horizonLabel ||
            (primary.horizonYears
              ? `${primary.horizonYears} ans`
              : "À préciser"))));
  const canEditGoals = Boolean(goalTab) || tabs.length < 12;
  const situation = (profile.situation ?? {}) as DemoSituation;
  const missing = fieldOrder.filter((key) =>
    isProfileFieldMissing(profile[key]),
  );
  const profileName =
    accountId === "mateo"
      ? "Mateo"
      : accountId === "amira"
        ? "Amira"
        : "Robert";
  const handledRequest = useRef("");
  useEffect(() => {
    if (!requestedView || handledRequest.current === requestedView) return;
    const requested = requestedView.split(":")[0];
    const aliases: Record<string, ProfileDetailTabId> = {
      profile: "overview",
      overview: "overview",
      objectives: "objectives",
      situation: "situation",
      risk: "risk",
      preferences: "preferences",
      alignment: "risk",
      comparison: "objectives",
      scenarios: "objectives",
      evidence: "memory",
      memory: "memory",
    };
    const next = aliases[requested];
    if (!next) return;
    setView(next);
    handledRequest.current = requestedView;
  }, [requestedView]);

  return (
    <div className="pdt-root" data-profile-detail-tab={view}>
      <nav
        className="pdt-tabs"
        role="tablist"
        aria-label="Sections du profil investisseur"
      >
        {sectionTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`pdt-tab-${id}`}
            aria-controls="pdt-panel"
            aria-selected={view === id}
            onClick={() => setView(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === "situation" && <i aria-label="Facultatif" />}
          </button>
        ))}
      </nav>
      <div
        className="pdt-content"
        id="pdt-panel"
        role="tabpanel"
        aria-labelledby={`pdt-tab-${view}`}
        aria-busy={busy}
      >
        {goalConflict && (
          <div className="pdt-missing">
            <Info size={18} />
            <p>
              Le projet principal et l’aperçu diffèrent. Précisez le projet à
              conserver avant de les harmoniser.
            </p>
            <button
              type="button"
              className="pdt-button"
              disabled={busy}
              onClick={() =>
                onDiscuss(
                  "Lis get_profile_details et aide-moi à clarifier les différences entre mon projet principal et mon objectif ou horizon général. Demande quelle déclaration conserver avant toute modification.",
                )
              }
            >
              Clarifier avec l’assistant
            </button>
          </div>
        )}
        {view === "overview" && (
          <>
            <section className="pdt-hero">
              <div className="pdt-hero-main">
                <span className="pdt-icon-tile pdt-large">
                  <Landmark size={22} />
                </span>
                <div>
                  <p className="pdt-eyebrow">
                    PERSONA DE DÉMONSTRATION · DONNÉES FICTIVES
                  </p>
                  <h2>Profil investisseur — {profileName}</h2>
                  <p>
                    Les réponses restent modifiables; les renseignements
                    inconnus ne sont pas déduits.
                  </p>
                </div>
                <button
                  type="button"
                  className="pdt-button"
                  disabled={busy}
                  onClick={() =>
                    onDiscuss(
                      "Aide-moi à revoir mon profil investisseur. Ne déduis aucune information inconnue et demande confirmation avant d’enregistrer une nouvelle déclaration.",
                    )
                  }
                >
                  <Pencil size={15} />
                  Modifier avec l’assistant
                </button>
              </div>
              <div className="pdt-completion">
                <div
                  className="pdt-progress-ring"
                  style={
                    {
                      "--pdt-progress": `${(total / fieldOrder.length) * 100}%`,
                    } as React.CSSProperties
                  }
                >
                  <strong>
                    {total}
                    <small>/{fieldOrder.length}</small>
                  </strong>
                </div>
                <div>
                  <strong>
                    {total === fieldOrder.length
                      ? "Votre contexte est renseigné"
                      : "Profil en construction"}
                  </strong>
                  <p>
                    {missing.length
                      ? `${missing.length} élément${missing.length > 1 ? "s" : ""} à préciser`
                      : "Les éléments connus sont renseignés"}
                  </p>
                  <button
                    type="button"
                    className="pdt-confirm-button"
                    disabled={busy || profile.confirmed}
                    onClick={onConfirm}
                  >
                    {profile.confirmed ? (
                      <>
                        <BadgeCheck size={13} />
                        Confirmé par vous
                      </>
                    ) : (
                      <>
                        <Check size={13} />
                        Confirmer mes réponses
                      </>
                    )}
                  </button>
                </div>
                <div className="pdt-status-chips">
                  {sectionTabs.map(({ id, label, icon: Icon }) => (
                    <span
                      key={id}
                      className={id === "situation" ? "is-optional" : ""}
                    >
                      <Icon size={13} />
                      {label}
                      {id === "situation" ? " · facultatif" : ""}
                    </span>
                  ))}
                </div>
              </div>
            </section>
            <div className="pdt-overview-grid">
              <section className="pdt-panel">
                <header className="pdt-section-heading">
                  <div>
                    <span className="pdt-icon-tile">
                      <Target size={19} />
                    </span>
                    <div>
                      <h3>Objectifs et horizon</h3>
                      <p>Ce que la personne souhaite accomplir.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pdt-link-button"
                    onClick={() => setView("objectives")}
                  >
                    Voir les objectifs
                    <ArrowRight size={14} />
                  </button>
                </header>
                <p className="pdt-summary-copy">{profile.objective}</p>
                <div className="pdt-inline-facts">
                  <span>
                    <Clock3 size={15} />
                    <strong>Horizon</strong>
                    {profile.horizon}
                  </span>
                  <span>
                    <Target size={15} />
                    <strong>Projets</strong>
                    {goals.length} exemples
                  </span>
                </div>
              </section>
              <section className="pdt-panel">
                <header className="pdt-section-heading">
                  <div>
                    <span className="pdt-icon-tile">
                      <Activity size={19} />
                    </span>
                    <div>
                      <h3>Repères de risque</h3>
                      <p>Deux notions distinctes.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pdt-link-button"
                    onClick={() => setView("risk")}
                  >
                    Voir le détail
                    <ArrowRight size={14} />
                  </button>
                </header>
                <div className="pdt-fact-row">
                  <span>Tolérance aux fluctuations</span>
                  <strong>{profile.riskTolerance}</strong>
                </div>
                <div className="pdt-fact-row">
                  <span>Capacité de perte</span>
                  <strong>{profile.lossCapacity}</strong>
                </div>
              </section>
              <section className="pdt-panel">
                <header className="pdt-section-heading">
                  <div>
                    <span className="pdt-icon-tile">
                      <Leaf size={19} />
                    </span>
                    <div>
                      <h3>Préférences déclarées</h3>
                      <p>Ne sont pas des critères vérifiés.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pdt-link-button"
                    onClick={() => setView("preferences")}
                  >
                    Voir le détail
                    <ArrowRight size={14} />
                  </button>
                </header>
                <p className="pdt-summary-copy">{profile.preferences}</p>
                <div className="pdt-inline-facts">
                  <span>
                    <GraduationCap size={15} />
                    <strong>Connaissances</strong>
                    {profile.knowledge}
                  </span>
                </div>
              </section>
            </div>
            <section className="pdt-missing">
              <span className="pdt-small-icon">
                <CircleHelp size={17} />
              </span>
              <div>
                <strong>À préciser avec la personne</strong>
                <p>
                  {missing.length
                    ? missing.map((key) => fieldLabels[key]).join(" · ")
                    : "Aucune rubrique obligatoire à compléter."}
                </p>
              </div>
              <span className="pdt-optional-pill">
                Aucune pression à compléter
              </span>
            </section>
          </>
        )}

        {view === "objectives" && (
          <ProfileObjectives
            goals={goals}
            busy={busy || !canEditGoals}
            onSave={(next) =>
              onTab({
                ...(goalTab ?? {
                  id: "profile-objectives",
                  title: "Objectifs du profil",
                  kind: "profile" as const,
                  content: "",
                }),
                content: JSON.stringify({
                  schema: 1,
                  persona: accountId,
                  goals: next,
                }),
              })
            }
          />
        )}

        {view === "situation" && (
          <SituationPanel
            situation={situation}
            onSituation={onSituation}
            busy={busy}
          />
        )}

        {(["risk", "preferences", "memory"] as string[]).includes(view) && (
          <ProfileAdvancedTabs
            view={view}
            profile={profile}
            onChange={onChange}
            onDiscuss={onDiscuss}
            busy={busy}
            tabs={tabs}
            onTab={onTab}
            onErase={onErase}
            onSituation={onSituation}
            memory={memory}
          />
        )}
      </div>
    </div>
  );
}
