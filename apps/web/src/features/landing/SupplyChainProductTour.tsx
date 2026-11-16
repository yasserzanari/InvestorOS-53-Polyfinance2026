import { useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, CircleHelp } from "lucide-react";
import { supplyChainTourSlides } from "./supply-chain-tour-content";

export function SupplyChainProductTour() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = useReducedMotion();
  const active = supplyChainTourSlides[activeIndex];
  const moveTo = (nextIndex: number) => {
    setDirection(nextIndex > activeIndex ? 1 : -1);
    setActiveIndex((nextIndex + supplyChainTourSlides.length) % supplyChainTourSlides.length);
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextIndex = activeIndex;
    if (event.key === "ArrowRight") nextIndex = (activeIndex + 1) % supplyChainTourSlides.length;
    else if (event.key === "ArrowLeft") nextIndex = (activeIndex - 1 + supplyChainTourSlides.length) % supplyChainTourSlides.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = supplyChainTourSlides.length - 1;
    else return;
    event.preventDefault();
    moveTo(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section id="chaine-approvisionnement" className="profile-tour supply-chain-tour" aria-labelledby="supply-chain-tour-title">
      <div className="profile-tour__inner">
        <header className="profile-tour__intro">
          <div>
            <h2 id="supply-chain-tour-title">Explorer la chaîne d’approvisionnement.</h2>
          </div>
          <p>Un exemple autour de NVIDIA : examiner les fournisseurs documentés, leurs rôles, les informations publiées et les risques cités.</p>
        </header>

        <div className="profile-tour__tabs" role="tablist" aria-label="Vues de la chaîne d’approvisionnement NVIDIA">
          {supplyChainTourSlides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              id={`supply-chain-tour-tab-${slide.id}`}
              role="tab"
              aria-selected={index === activeIndex}
              aria-controls="supply-chain-tour-panel"
              tabIndex={index === activeIndex ? 0 : -1}
              ref={element => { tabRefs.current[index] = element; }}
              onClick={() => moveTo(index)}
              onKeyDown={handleTabKeyDown}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>{slide.label}
            </button>
          ))}
        </div>

        <div id="supply-chain-tour-panel" className="profile-tour__panel" role="tabpanel" aria-labelledby={`supply-chain-tour-tab-${active.id}`}>
          <div className="profile-tour__explanation" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={reduced ? false : { opacity: 0, x: direction * 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: direction * -18 }}
                transition={{ duration: reduced ? 0 : 0.24, ease: "easeOut" }}
              >
                <span className="profile-tour__step">VUE {String(activeIndex + 1).padStart(2, "0")} / {String(supplyChainTourSlides.length).padStart(2, "0")}</span>
                <h3>{active.title}</h3>
                <p>{active.description}</p>
                <div className="profile-tour__note"><CircleHelp size={17} aria-hidden="true" /><span>{active.note}</span></div>
              </motion.div>
            </AnimatePresence>

            <div className="profile-tour__controls">
              <button type="button" onClick={() => moveTo(activeIndex - 1)} aria-label="Afficher la vue précédente"><ArrowLeft size={17} aria-hidden="true" /></button>
              <div className="profile-tour__progress" aria-label={`Vue ${activeIndex + 1} sur ${supplyChainTourSlides.length}`}>
                {supplyChainTourSlides.map((slide, index) => <button key={slide.id} type="button" aria-label={`Afficher ${slide.label}`} aria-current={index === activeIndex ? "step" : undefined} onClick={() => moveTo(index)} />)}
              </div>
              <button type="button" onClick={() => moveTo(activeIndex + 1)} aria-label="Afficher la vue suivante"><ArrowRight size={17} aria-hidden="true" /></button>
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
              <div className="profile-tour__screen-bar" aria-hidden="true"><span /><span /><span />InvestorOS · Chaîne d’approvisionnement · {active.label}</div>
              <img src={active.image} alt={active.alt} />
              <figcaption>{active.caption}</figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        <p className="profile-tour__disclaimer">Exemple de démonstration NVIDIA · relations issues de documents, couverture partielle · les lignes ne représentent pas des volumes ou des routes physiques.</p>
      </div>
    </section>
  );
}
