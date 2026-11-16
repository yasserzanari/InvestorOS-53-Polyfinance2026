import { useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, CircleHelp } from "lucide-react";
import { analysisTourSlides } from "./analysis-tour-content";

export function AnalysisProductTour() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = useReducedMotion();
  const active = analysisTourSlides[activeIndex];
  const moveTo = (nextIndex: number) => {
    setDirection(nextIndex > activeIndex ? 1 : -1);
    setActiveIndex((nextIndex + analysisTourSlides.length) % analysisTourSlides.length);
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextIndex = activeIndex;
    if (event.key === "ArrowRight") nextIndex = (activeIndex + 1) % analysisTourSlides.length;
    else if (event.key === "ArrowLeft") nextIndex = (activeIndex - 1 + analysisTourSlides.length) % analysisTourSlides.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = analysisTourSlides.length - 1;
    else return;
    event.preventDefault();
    moveTo(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section id="analyse" className="profile-tour analysis-tour" aria-labelledby="analysis-tour-title">
      <div className="profile-tour__inner">
        <header className="profile-tour__intro">
          <div>
            <h2 id="analysis-tour-title">Pourquoi une action a-t-elle baissé&nbsp;?</h2>
          </div>
          <p>Un exemple dans InvestorOS : explorer le recul de NVIDIA, examiner les annonces proches et remonter aux sources utilisées.</p>
        </header>

        <div className="profile-tour__tabs" role="tablist" aria-label="Étapes de l’analyse d’une baisse de NVIDIA">
          {analysisTourSlides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              id={`analysis-tour-tab-${slide.id}`}
              role="tab"
              aria-selected={index === activeIndex}
              aria-controls="analysis-tour-panel"
              tabIndex={index === activeIndex ? 0 : -1}
              ref={element => { tabRefs.current[index] = element; }}
              onClick={() => moveTo(index)}
              onKeyDown={handleTabKeyDown}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>{slide.label}
            </button>
          ))}
        </div>

        <div id="analysis-tour-panel" className="profile-tour__panel" role="tabpanel" aria-labelledby={`analysis-tour-tab-${active.id}`}>
          <div className="profile-tour__explanation" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={reduced ? false : { opacity: 0, x: direction * 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: direction * -18 }}
                transition={{ duration: reduced ? 0 : 0.24, ease: "easeOut" }}
              >
                <span className="profile-tour__step">ÉTAPE {String(activeIndex + 1).padStart(2, "0")} / {String(analysisTourSlides.length).padStart(2, "0")}</span>
                <h3>{active.title}</h3>
                <p>{active.description}</p>
                <div className="profile-tour__note"><CircleHelp size={17} aria-hidden="true" /><span>{active.note}</span></div>
              </motion.div>
            </AnimatePresence>

            <div className="profile-tour__controls">
              <button type="button" onClick={() => moveTo(activeIndex - 1)} aria-label="Afficher l’étape précédente"><ArrowLeft size={17} aria-hidden="true" /></button>
              <div className="profile-tour__progress" aria-label={`Étape ${activeIndex + 1} sur ${analysisTourSlides.length}`}>
                {analysisTourSlides.map((slide, index) => <button key={slide.id} type="button" aria-label={`Afficher ${slide.label}`} aria-current={index === activeIndex ? "step" : undefined} onClick={() => moveTo(index)} />)}
              </div>
              <button type="button" onClick={() => moveTo(activeIndex + 1)} aria-label="Afficher l’étape suivante"><ArrowRight size={17} aria-hidden="true" /></button>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.figure
              key={active.id}
              className="profile-tour__screen"
              initial={reduced ? false : { opacity: 0, x: direction * 24, scale: 0.99 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0, x: direction * -24, scale: 0.99 }}
              transition={{ duration: reduced ? 0 : 0.3, ease: "easeOut" }}
            >
              <div className="profile-tour__screen-bar" aria-hidden="true"><span /><span /><span />InvestorOS · Analyse · {active.label}</div>
              <img src={active.image} alt={active.alt} />
              <figcaption>{active.caption}</figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        <p className="profile-tour__disclaimer">Exemple de démonstration NVDA · les annonces et les variations rapprochées donnent du contexte, pas une preuve de causalité.</p>
      </div>
    </section>
  );
}
