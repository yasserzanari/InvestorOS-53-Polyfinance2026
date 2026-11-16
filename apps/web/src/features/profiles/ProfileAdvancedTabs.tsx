import { useState, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Database,
  Download,
  GraduationCap,
  HelpCircle,
  Info,
  Layers,
  Leaf,
  LockKeyhole,
  MessageSquare,
  Pencil,
  RefreshCw,
  Scale,
  Shield,
  SlidersHorizontal,
  Sprout,
  Target,
  Trash2,
  X,
  Plus,
} from "lucide-react";
import {
  fieldLabels,
  fieldOrder,
  type FieldKey,
  type Profile,
} from "./profile-model";
import type { WorkspaceTab } from "./profile-api";
import "./profile-advanced-tabs.css";

type Props = {
  view: string;
  profile: Profile;
  onChange: (key: FieldKey, value: string) => void;
  onDiscuss: (s: string) => void;
  busy: boolean;
  tabs: WorkspaceTab[];
  onTab: (tab: WorkspaceTab) => void;
  onErase: () => void;
  memory: { status: string; reload: () => void };
};
type Values = Record<string, string>;
const productNames = [
  "Actions",
  "Obligations",
  "Fonds (OPC)",
  "ETF (trackers)",
  "Crypto-actifs",
  "Options",
];
function Card({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  icon: typeof Shield;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`pat-card ${className}`}>
      <h3>
        <Icon size={21} />
        {title}
      </h3>
      {children}
    </section>
  );
}
function Radios({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; detail?: string }[];
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="pat-radio-list" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label
          key={option.value}
          className={value === option.value ? "selected" : ""}
        >
          <input
            type="radio"
            name={label}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>
            <strong>{option.value}</strong>
            {option.detail && <> — {option.detail}</>}
          </span>
        </label>
      ))}
    </div>
  );
}
const toleranceOptions = [
  {
    value: "Faible",
    detail:
      "Les baisses me mettent mal à l’aise; je chercherais à réduire mon exposition.",
  },
  {
    value: "Modérée",
    detail: "Je peux supporter une baisse temporaire malgré l’inconfort.",
  },
  {
    value: "Élevée",
    detail: "J’accepte les fluctuations dans le cadre de ma stratégie.",
  },
  { value: "À préciser" },
];
const questions = [
  "Quel est votre horizon pour chacun de vos objectifs ?",
  "Avez-vous des besoins de retraits réguliers ou probables ?",
  "Comment qualifier la stabilité de vos revenus ?",
  "Disposez-vous de liquidités pour faire face à un imprévu ?",
];
const quadrants = [
  {
    name: "Prudent et résilient",
    icon: Scale,
    tone: "blue",
    detail: "Volonté faible et capacité élevée.",
  },
  {
    name: "Dynamique et solide",
    icon: ArrowUpRight,
    tone: "green",
    detail: "Volonté élevée et capacité élevée.",
  },
  {
    name: "Prudent et contraint",
    icon: Shield,
    tone: "purple",
    detail: "Volonté faible et capacité faible.",
  },
  {
    name: "Volontaire et plus fragile",
    icon: Sprout,
    tone: "cyan",
    detail: "Volonté élevée et capacité faible.",
  },
];
export function ProfileAdvancedTabs({
  view,
  profile,
  onChange,
  onDiscuss,
  busy,
  tabs,
  onTab,
  onErase,
  memory,
}: Props) {
  const [erasing, setErasing] = useState(false);
  const [sector, setSector] = useState("");
  const [adding, setAdding] = useState<string | false>(false);
  const stored = tabs.find((tab) => tab.id === "profile-controls");
  let values: Values = {};
  try {
    values = JSON.parse(stored?.content ?? "{}");
  } catch {
    /* Older workspace content can be unstructured. */
  }
  const set = (key: string, value: string) => {
    if (busy) return;
    onTab({
      id: "profile-controls",
      title: "Détails du profil",
      kind: "profile",
      content: JSON.stringify({ ...values, [key]: value }),
    });
  };
  const get = (key: string) => values[key] ?? "";
  const select = (
    key: string,
    label: string,
    options: string[],
    current?: string,
    change?: (v: string) => void,
  ) => (
    <label className="pat-select">
      <span>{label}</span>
      <select
        aria-label={label}
        disabled={busy}
        value={current ?? get(key)}
        onChange={(e) =>
          change ? change(e.target.value) : set(key, e.target.value)
        }
      >
        <option value="">À préciser</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
  const choices = (key: string, label: string, options: string[]) => (
    <div className="pat-segment">
      <span>{label}</span>
      <div role="group" aria-label={label}>
        {options.map((option) => (
          <button
            type="button"
            disabled={busy}
            key={option}
            aria-pressed={get(key) === option}
            onClick={() => set(key, option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
  const suggest = (prompt: string) => onDiscuss(prompt);
  const toggleSector = (key: string, item: string) => {
    const current = get(key).split("|").filter(Boolean);
    set(
      key,
      current.includes(item)
        ? current.filter((v) => v !== item).join("|")
        : [...current, item].join("|"),
    );
  };
  const exportProfile = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              profile,
              details: values,
              objectives: tabs.find((tab) => tab.id === "profile-objectives")
                ?.content,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "mon-profil-investisseur.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="pat-root">
      <fieldset disabled={busy} className="pat-fieldset">
        {view === "risk" && (
          <>
            <header className="pat-title">
              <Shield />
              <div>
                <h2>Profil de risque</h2>
                <p>
                  Votre volonté et votre capacité, deux dimensions distinctes.
                </p>
              </div>
            </header>
            <div className="pat-grid">
              <Card title="Tolérance aux fluctuations" icon={Activity}>
                <p>
                  Votre confort face aux variations de vos investissements, y
                  compris aux baisses temporaires.
                </p>
                <div className="pat-hint">
                  <HelpCircle size={17} />
                  Comment réagiriez-vous à une baisse de 10 %, 20 % ou 30 % ?
                </div>
                <Radios
                  label="Tolérance aux fluctuations"
                  options={toleranceOptions}
                  value={profile.riskTolerance}
                  onChange={(v) => onChange("riskTolerance", v)}
                />
              </Card>
              <Card title="Capacité à absorber une perte" icon={Database}>
                <p>
                  Les pertes que vous pourriez supporter sans compromettre vos
                  projets ni vos dépenses essentielles.
                </p>
                {select(
                  "capacity",
                  "Capacité de perte",
                  ["Faible", "Modérée", "Élevée", "À préciser"],
                  profile.lossCapacity,
                  (v) => onChange("lossCapacity", v),
                )}
                {select("horizon", "Objectifs et horizon", [
                  "Court terme",
                  "Moyen terme",
                  "Long terme",
                ])}
                {select("withdrawals", "Besoins de retraits", [
                  "Aucun prévu",
                  "Occasionnels",
                  "Réguliers",
                ])}
                {select("available", "Liquidité disponible", [
                  "Faible",
                  "Modérée",
                  "Élevée",
                ])}
                {select("income", "Stabilité des revenus", [
                  "Stable",
                  "Variable",
                  "Incertaine",
                ])}
                {select("debt", "Dettes et engagements", [
                  "Faibles",
                  "Modérés",
                  "Élevés",
                ])}
                <small>Ces précisions sont facultatives.</small>
              </Card>
              <Card
                title="Positionnement de risque (2 dimensions)"
                icon={Layers}
              >
                <p>Une lecture conjointe, sans score unique.</p>
                <div className="pat-position">
                  <div className="pat-chart">
                    <span className="pat-axis-y">Capacité ↑</span>
                    <div className="pat-quadrants">
                      {quadrants.map(({ name, icon: Icon, tone, detail }) => (
                        <button
                          type="button"
                          key={name}
                          className={tone}
                          onClick={() =>
                            suggest(
                              `Explique-moi le positionnement « ${name} » : ${detail} Aide-moi à clarifier mon profil sans déduire mes réponses.`,
                            )
                          }
                        >
                          <Icon size={23} />
                          <strong>{name}</strong>
                        </button>
                      ))}
                    </div>
                    <span className="pat-axis-x">
                      Faible ← Volonté → Élevée
                    </span>
                  </div>
                  <div className="pat-legend">
                    {quadrants.map((q) => (
                      <p key={q.name}>
                        <i className={q.tone} />
                        <span>
                          <strong>{q.name}</strong>
                          {q.detail}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              </Card>
              <Card title="Points à clarifier" icon={MessageSquare}>
                <div className="pat-hint">
                  <Info size={17} />
                  Un écart entre volonté et capacité mérite une discussion sur
                  vos priorités.
                </div>
                <h4>
                  <Target size={17} />
                  Questions pour affiner votre profil
                </h4>
                <div className="pat-questions">
                  {questions.map((question) => (
                    <button
                      type="button"
                      key={question}
                      onClick={() =>
                        suggest(
                          `Aide-moi à répondre à cette question pour mon profil : ${question}`,
                        )
                      }
                    >
                      {question}
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              </Card>
            </div>
            <div className="pat-hint">
              <Info size={18} />
              Ce profil décrit vos réponses actuelles; il ne produit ni
              recommandation ni verdict de convenance.
            </div>
          </>
        )}
        {view === "preferences" && (
          <>
            <header className="pat-title">
              <SlidersHorizontal />
              <div>
                <h2>Connaissances et préférences</h2>
                <p>Vos expériences, vos choix et vos contraintes explicites.</p>
              </div>
            </header>
            <div className="pat-grid">
              <Card title="Connaissance en investissement" icon={GraduationCap}>
                <p>Votre auto-évaluation des produits financiers.</p>
                <Radios
                  label="Connaissance en investissement"
                  options={[
                    {
                      value: "Notions",
                      detail: "Principes généraux, rendement et risques.",
                    },
                    {
                      value: "Intermédiaire",
                      detail: "Connaissance pratique de plusieurs produits.",
                    },
                    {
                      value: "Approfondie",
                      detail:
                        "Produits complexes et construction de portefeuille.",
                    },
                    { value: "À préciser" },
                  ]}
                  value={profile.knowledge}
                  onChange={(v) => onChange("knowledge", v)}
                />
              </Card>
              <Card title="Expérience par type de produit" icon={Activity}>
                <div className="pat-table-scroll">
                  <table className="pat-experience">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Niveau d’expérience</th>
                        <th>Ancienneté</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productNames.map((name, index) => (
                        <tr key={name}>
                          <th>
                            {index === 0 ? (
                              <Activity size={14} />
                            ) : (
                              <Layers size={14} />
                            )}{" "}
                            {name}
                          </th>
                          <td>
                            <div className="pat-inline-radio">
                              {["Aucune", "Limitée", "Régulière"].map(
                                (level) => (
                                  <label key={level}>
                                    <input
                                      type="radio"
                                      name={`experience-${name}`}
                                      checked={
                                        get(`experience-${name}`) === level
                                      }
                                      onChange={() =>
                                        set(`experience-${name}`, level)
                                      }
                                    />
                                    {level}
                                  </label>
                                ),
                              )}
                            </div>
                          </td>
                          <td>
                            <select
                              aria-label={`Ancienneté ${name}`}
                              value={get(`years-${name}`)}
                              onChange={(e) =>
                                set(`years-${name}`, e.target.value)
                              }
                            >
                              <option value="">—</option>
                              {[
                                "Moins d’un an",
                                "1–3 ans",
                                "3–5 ans",
                                "5–10 ans",
                                "10 ans et plus",
                              ].map((year) => (
                                <option key={year}>{year}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card title="Confort et apprentissage" icon={BookOpen}>
                {choices("complexity", "Tolérance à la complexité", [
                  "Faible",
                  "Moyenne",
                  "Élevée",
                ])}
                {choices("learning", "Souhait d’apprentissage", [
                  "Aucun",
                  "Ponctuel",
                  "Régulier",
                ])}
              </Card>
              <Card title="Préférences sectorielles" icon={Layers}>
                {["Secteurs privilégiés", "Secteurs exclus"].map(
                  (label, index) => {
                    const key = index ? "excluded" : "favoured";
                    return (
                      <div className="pat-sectors" key={key}>
                        <strong>
                          {index ? <X size={17} /> : <CheckCircle2 size={17} />}{" "}
                          {label}
                        </strong>
                        <div>
                          {get(key)
                            .split("|")
                            .filter(Boolean)
                            .map((item) => (
                              <button
                                type="button"
                                key={item}
                                onClick={() => toggleSector(key, item)}
                                aria-label={`Retirer ${item}`}
                              >
                                {item}
                                <X size={12} />
                              </button>
                            ))}
                          <button
                            type="button"
                            onClick={() =>
                              setAdding(
                                key === "excluded" ? "excluded" : "favoured",
                              )
                            }
                          >
                            <Plus size={13} />
                            Ajouter
                          </button>
                        </div>
                      </div>
                    );
                  },
                )}
                {adding && (
                  <form
                    className="pat-add"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (sector.trim()) {
                        toggleSector(
                          String(adding),
                          sector.trim().slice(0, 80),
                        );
                        setSector("");
                        setAdding(false);
                      }
                    }}
                  >
                    <input
                      autoFocus
                      aria-label="Nom du secteur"
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      maxLength={80}
                    />
                    <button type="submit">Ajouter</button>
                    <button type="button" onClick={() => setAdding(false)}>
                      Annuler
                    </button>
                  </form>
                )}
              </Card>
              <Card
                title="Contraintes de liquidité ou d’instruments"
                icon={LockKeyhole}
              >
                {select("minimum", "Liquidité minimale", [
                  "Immédiate",
                  "Sous 30 jours",
                  "Sous 90 jours",
                  "Sans contrainte",
                ])}
                <label className="pat-text">
                  <span>Instruments autorisés ou exclus</span>
                  <textarea
                    rows={3}
                    value={profile.constraints}
                    onChange={(e) => onChange("constraints", e.target.value)}
                  />
                </label>
              </Card>
              <Card title="Investissement durable (ESG)" icon={Leaf}>
                <p>
                  Votre approche des critères environnementaux, sociaux et de
                  gouvernance.
                </p>
                <div
                  className="pat-esg"
                  role="radiogroup"
                  aria-label="Approche ESG"
                >
                  {[
                    {
                      name: "Sans préférence",
                      detail: "Aucun critère exprimé",
                    },
                    { name: "Exclusions", detail: "Écarter certains secteurs" },
                    {
                      name: "Best-in-class",
                      detail: "Privilégier les mieux évalués",
                    },
                    {
                      name: "Impact",
                      detail: "Rechercher un impact mesurable",
                    },
                    { name: "À préciser", detail: "En discuter ensemble" },
                  ].map((option) => (
                    <label
                      className={get("esg") === option.name ? "selected" : ""}
                      key={option.name}
                    >
                      <input
                        type="radio"
                        name="esg"
                        checked={get("esg") === option.name}
                        onChange={() => {
                          set("esg", option.name);
                          onChange("preferences", option.name);
                        }}
                      />
                      <strong>{option.name}</strong>
                      <small>{option.detail}</small>
                    </label>
                  ))}
                </div>
                <label className="pat-text">
                  <span>Précisions et autres préférences</span>
                  <textarea
                    rows={2}
                    value={profile.preferences}
                    onChange={(e) => onChange("preferences", e.target.value)}
                  />
                </label>
              </Card>
            </div>
          </>
        )}
        {view === "memory" && (
          <>
            <header className="pat-title">
              <Database />
              <div>
                <h2>Mémoire du profil</h2>
                <p>Vos réponses actuelles et leur origine.</p>
              </div>
            </header>
            <div className="pat-table-scroll pat-memory">
              <table>
                <thead>
                  <tr>
                    <th>Rubrique</th>
                    <th>Valeur actuelle</th>
                    <th>Origine</th>
                    <th>Confirmation</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {fieldOrder.map((key) => (
                    <tr key={key}>
                      <th>{fieldLabels[key]}</th>
                      <td>{profile[key] || "Non renseigné"}</td>
                      <td>{profile.origins[key] || "Non renseignée"}</td>
                      <td>
                        <span
                          className={`pat-pill ${profile.confirmed ? "confirmed" : ""}`}
                        >
                          {!profile[key]
                            ? "Non renseigné"
                            : profile.confirmed
                              ? "Confirmée"
                              : "À confirmer"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="pat-icon-button"
                          type="button"
                          aria-label={`Corriger ${fieldLabels[key]}`}
                          onClick={() =>
                            suggest(
                              `Je souhaite corriger ma réponse : ${fieldLabels[key]}.`,
                            )
                          }
                        >
                          <Pencil size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Card title="Confidentialité et gestion des données" icon={Shield}>
              <p>
                Vous pouvez consulter, exporter, corriger ou effacer les
                informations de ce profil.
              </p>
              <div className="pat-storage">
                <Database size={17} />
                <span>{memory.status}</span>
              </div>
            </Card>
            <div className="pat-actions">
              <button type="button" onClick={memory.reload}>
                <RefreshCw size={17} />
                Recharger
              </button>
              <button type="button" onClick={exportProfile}>
                <Download size={17} />
                Exporter mon profil
              </button>
              <button
                type="button"
                onClick={() =>
                  suggest(
                    "Je souhaite revoir et corriger les informations de mon profil.",
                  )
                }
              >
                <Pencil size={17} />
                Corriger une réponse
              </button>
            </div>
            <div className="pat-danger">
              <div>
                <strong>Effacer les informations de ce profil</strong>
                <p>
                  Supprime les réponses, objectifs et préférences enregistrés.
                  Les conversations restent dans l’historique.
                </p>
              </div>
              <button type="button" onClick={() => setErasing(true)}>
                <Trash2 size={16} />
                Tout effacer
              </button>
            </div>
            {erasing && (
              <div
                className="pat-confirm"
                role="alertdialog"
                aria-label="Confirmer l’effacement du profil"
              >
                <strong>
                  Effacer toutes les informations du profil sélectionné ?
                </strong>
                <p>
                  Les autres profils ne sont pas concernés. Les données de
                  démonstration ne seront pas réinjectées.
                </p>
                <button type="button" onClick={() => setErasing(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onErase();
                    setErasing(false);
                  }}
                >
                  Confirmer l’effacement
                </button>
              </div>
            )}
          </>
        )}
      </fieldset>
    </div>
  );
}
