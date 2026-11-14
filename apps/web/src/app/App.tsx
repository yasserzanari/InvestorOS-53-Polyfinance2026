export function App() {
  return (
    <main className="app-frame">
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="InvestorOS, accueil">InvestorOS</a>
        <span className="environment-label">Espace de préparation</span>
      </header>
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <p className="eyebrow">Polyfinance · Hackathon 2026</p>
          <h1 id="welcome-title">Comprendre avant de décider.</h1>
          <p className="welcome-description">
            L’espace InvestorOS est prêt à accueillir le parcours de profil, l’analyse
            de portefeuille et les explications sourcées.
          </p>
          <p className="connection-state">
            Le frontend est initialisé. Les analyses apparaîtront ici une fois l’API AWS connectée.
          </p>
        </div>
        <div className="orbit" aria-hidden="true"><span /><span /><span /></div>
      </section>
      <footer className="app-footer">Prototype éducatif · Données et analyses simulées</footer>
    </main>
  );
}
