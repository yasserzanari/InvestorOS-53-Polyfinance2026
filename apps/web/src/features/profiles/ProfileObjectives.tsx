import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Database,
  Flag,
  House,
  Hourglass,
  Info,
  Pencil,
  Plus,
  Sprout,
  Target,
  Wallet,
} from "lucide-react";
import type { DemoGoal } from "./profile-demo-data";
import "./profile-objectives.css";
const goalIcon = (goal: DemoGoal) =>
  /immobili|maison|résidence/i.test(goal.title)
    ? House
    : goal.role === "Principal"
      ? Sprout
      : Wallet;
export function ProfileObjectives({
  goals,
  busy,
  onSave,
}: {
  goals: DemoGoal[];
  busy: boolean;
  onSave: (goals: DemoGoal[]) => void;
}) {
  const [draft, setDraft] = useState<DemoGoal | null>(null);
  const year = new Date().getFullYear();
  const max = Math.max(1, ...goals.map((goal) => goal.horizonYears));
  const edit = (goal?: DemoGoal) =>
    setDraft(
      goal
        ? { ...goal }
        : {
            id: crypto.randomUUID(),
            title: "",
            description: "",
            horizonYears: 5,
            role: goals.length ? "Secondaire" : "Principal",
          },
    );
  return (
    <div className="po-root">
      <header className="po-title">
        <span className="po-tile">
          <Target />
        </span>
        <div>
          <h2>Objectifs et échéances</h2>
          <p>
            Vos projets, chacun avec son horizon, ses échéances et ses
            priorités.
          </p>
        </div>
        <button
          type="button"
          onClick={() => edit()}
          disabled={busy || goals.length >= 8}
        >
          <Plus size={18} />
          Ajouter un objectif
        </button>
      </header>
      <div className="po-summary">
        <span className="po-count">{goals.length}</span>
        <div>
          <strong>Projets définis</strong>
          <span>avec horizons distincts</span>
        </div>
        <span className="po-divider" />
        <span className="po-pill">
          <CheckCircle2 size={14} />
          Renseigné dans le profil
        </span>
        <span className="po-summary-help">
          Les montants peuvent être précisés plus tard.
        </span>
      </div>
      {goals.map((goal) => {
        const Icon = goalIcon(goal);
        return (
          <section className="po-project" key={goal.id}>
            <header>
              <span className="po-tile">
                <Icon />
              </span>
              <h3>
                {goal.role === "Principal" ? "Projet principal — " : ""}
                {goal.title}
              </h3>
              <span className="po-pill">{goal.role}</span>
              <button type="button" onClick={() => edit(goal)} disabled={busy}>
                <Pencil size={15} />
                Modifier
              </button>
            </header>
            <div className="po-facts">
              <div>
                <Target />
                <div>
                  <strong>Objectif</strong>
                  <p>{goal.description || "À préciser"}</p>
                </div>
              </div>
              <div>
                <Database />
                <div>
                  <strong>Montant cible</strong>
                  <p>{goal.targetAmount || "À préciser"}</p>
                  <span
                    className={goal.targetAmount ? "po-pill" : "po-unknown"}
                  >
                    {goal.targetAmount ? "Renseigné" : "Facultatif"}
                  </span>
                </div>
              </div>
              <div>
                <CalendarDays />
                <div>
                  <strong>Échéance indicative</strong>
                  <p>{year + goal.horizonYears}</p>
                  <small>Dans {goal.horizonYears} ans</small>
                </div>
              </div>
              <div>
                <Hourglass />
                <div>
                  <strong>Horizon</strong>
                  <p>{goal.horizonYears} ans</p>
                  <span className="po-pill">
                    {goal.horizonYears >= 8
                      ? "Long terme"
                      : goal.horizonYears >= 3
                        ? "Moyen terme"
                        : "Court terme"}
                  </span>
                </div>
              </div>
            </div>
          </section>
        );
      })}
      {!goals.length && (
        <div className="po-summary">
          <Target />
          <p>Ajoutez votre premier projet pour construire sa chronologie.</p>
        </div>
      )}
      {!!goals.length && (
        <section className="po-timeline">
          <header>
            <CalendarDays />
            <h3>Chronologie des projets et retraits planifiés</h3>
          </header>
          <div
            className="po-axis"
            aria-label={`Chronologie indicative de ${year} à ${year + max}`}
          >
            <div className="po-axis-line" />
            <span className="po-today">
              <i />
              Aujourd’hui<small>{year}</small>
            </span>
            {goals.map((goal, index) => {
              const Icon = goalIcon(goal);
              return (
                <div
                  className={`po-milestone ${index > 0 && Math.abs(goal.horizonYears - goals[index-1].horizonYears) < max * .22 ? "po-lower" : ""}`}
                  key={goal.id}
                  style={{ left: `${14 + (goal.horizonYears / max) * 73}%` }}
                >
                  <div className="po-bubble">
                    <strong>{goal.title}</strong>
                    <span>
                      {year + goal.horizonYears} · {goal.horizonYears} ans
                    </span>
                  </div>
                  <span className="po-node">
                    <Icon size={22} />
                  </span>
                </div>
              );
            })}
          </div>
          <p className="po-timeline-caption">
            Échéances indicatives d’après les horizons renseignés, sans
            prévision de rendement.
          </p>
        </section>
      )}
      <aside className="po-note">
        <Info />
        <strong>À savoir</strong>
        <ul>
          <li>
            Chaque projet peut avoir son propre horizon et ses échéances de
            retrait.
          </li>
          <li>
            Les montants et les priorités restent modifiables à tout moment.
          </li>
        </ul>
      </aside>
      {draft && (
        <div className="po-modal-backdrop">
          <form
            className="po-editor"
            role="dialog"
            aria-modal="true"
            aria-label="Modifier un objectif"
            onSubmit={(e) => {
              e.preventDefault();
              const clean = {
                ...draft,
                title: draft.title.trim(),
                description: draft.description.trim(),
              };
              if (!clean.title) return;
              onSave(
                goals.some((g) => g.id === clean.id)
                  ? goals.map((g) => (g.id === clean.id ? clean : g))
                  : [...goals, clean],
              );
              setDraft(null);
            }}
          >
            <h3>
              <Target size={22} />
              {goals.some((g) => g.id === draft.id)
                ? "Modifier le projet"
                : "Ajouter un projet"}
            </h3>
            <label>
              Titre
              <input
                autoFocus
                required
                maxLength={120}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label>
              Objectif
              <textarea
                rows={3}
                maxLength={1000}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <div className="po-editor-row">
              <label>
                <Hourglass size={15} />
                Horizon en années
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={draft.horizonYears}
                  onChange={(e) =>
                    setDraft({ ...draft, horizonYears: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                <Database size={15} />
                Montant cible · facultatif
                <input
                  maxLength={80}
                  placeholder="Ex. 50 000 $"
                  value={draft.targetAmount ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, targetAmount: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              <Flag size={15} />
              Priorité
              <select
                value={draft.role}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    role: e.target.value as DemoGoal["role"],
                  })
                }
              >
                <option>Principal</option>
                <option>Secondaire</option>
              </select>
            </label>
            <footer>
              {goals.some((g) => g.id === draft.id) && (
                <button
                  type="button"
                  className="po-remove"
                  disabled={busy}
                  onClick={() => {
                    onSave(goals.filter((g) => g.id !== draft.id));
                    setDraft(null);
                  }}
                >
                  Supprimer ce projet
                </button>
              )}
              <button type="button" onClick={() => setDraft(null)}>
                Annuler
              </button>
              <button type="submit" disabled={busy}>
                Enregistrer
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
