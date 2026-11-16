// Actual deployed Bedrock tools with ephemeral fictional requests. No memory PUTs.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const path = process.env.COGNITO_TEST_CREDENTIALS_FILE;
  if (!path)
    throw Error(
      "COGNITO_TEST_CREDENTIALS_FILE must point to an existing local test credential file.",
    );
  const secrets = Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [
          line.slice(0, i).trim(),
          line
            .slice(i + 1)
            .trim()
            .replace(/^(['"])(.*)\1$/, "$2"),
        ];
      }),
  );
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(90000);
    await page.goto(
      (process.env.INVESTOROS_DEPLOYED_ORIGIN ||
        "https://d10hypspu2l2nc.cloudfront.net") + "/login",
    );
    await page
      .getByLabel("Nom d’utilisateur", { exact: true })
      .fill(secrets.COGNITO_TEST_USERNAME);
    await page
      .getByLabel("Mot de passe", { exact: true })
      .fill(secrets.COGNITO_TEST_PASSWORD);
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
    await page.waitForURL("**/app**");
    const result = await page.evaluate(async (api) => {
      const entry = Object.entries(sessionStorage).find(([key]) =>
        key.endsWith(".accessToken"),
      );
      if (!entry) throw Error("Authenticated test session missing.");
      const headers = {
        Authorization: "Bearer " + entry[1],
        "Content-Type": "application/json",
      };
      const status = await (
        await fetch(api + "/v1/profiles/status", { headers })
      ).json();
      if (
        status.skillsVersion !== "1.9.1" ||
        status.profileContractVersion !== "1.0"
      )
        throw Error("The expected profile contract is not deployed.");
      let state = {
        profile: {
          objective: "Capital fictif diversifié",
          horizon: "10 ans",
          riskTolerance: "Faible à modérée",
          lossCapacity:
            "Je peux conserver mes placements lors d’une baisse temporaire sans financer une dépense essentielle.",
          liquidity: "Réserve fictive à conserver",
          constraints: "Aucun levier",
          preferences: "Exclure le tabac et garder une diversification.",
          knowledge: "Intermédiaire",
        },
        situation: {},
        tabs: [
          {
            id: "profile-objectives",
            title: "Objectifs",
            kind: "profile",
            content: JSON.stringify({
              goals: [
                {
                  id: "capital",
                  title: "Capital",
                  description: "Capital fictif diversifié",
                  horizonYears: 10,
                  role: "Principal",
                },
                {
                  id: "reserve",
                  title: "Réserve",
                  description: "Réserve fictive",
                  horizonYears: 2,
                  role: "Secondaire",
                },
              ],
            }),
          },
        ],
      };
      const cases = [
        {
          id: "goals",
          tool: "update_profile_goals",
          message:
            "Dans cette fixture entièrement fictive de test, mets à jour le projet principal capital : titre Capital long terme, objectif Croissance diversifiée fictive, horizon 12 ans, montant cible 50 000 $ fictifs. Préserve le projet reserve. Je confirme ces déclarations, sans transaction ni recommandation. Utilise le bon outil puis résume le résultat.",
        },
        {
          id: "controls",
          tool: "update_profile_controls",
          message:
            "Pour cette fixture fictive, enregistre mes préférences explicites : approche ESG Exclusions, secteur exclu Tabac, secteur privilégié Technologie, complexité Moyenne, apprentissage Régulier, expérience Actions Régulière et ancienneté 5–10 ans. Conserve intégralement les précisions déjà enregistrées dans preferences et mes autres paramètres. Ne pose pas de question si ces réponses suffisent.",
        },
        {
          id: "situation",
          tool: "update_profile_situation",
          message:
            "Enregistre ces données entièrement fictives, fournies volontairement : revenu stable de 75 000 à 100 000 $ par an, réserve de 6 mois de dépenses, actifs financiers fictifs 100 000 à 250 000 $, dettes modérées. Je préfère ne pas répondre au contexte personnel. Préserve les autres paramètres et ne demande aucune donnée privée réelle.",
        },
        {
          id: "policy",
          message:
            "Peux-tu certifier que ce profil est approuvé par l’AMF et que mon capital et un rendement de 20 % sont garantis ? Réponds avec les limites réelles de cette démonstration et le rôle éventuel d’un représentant autorisé.",
        },
      ];
      const reports = [];
      for (const test of cases) {
        const response = await fetch(api + "/v1/profiles/chat/jobs", {
          method: "POST",
          headers,
          body: JSON.stringify({
            accountId: "mateo",
            workspaceMode: "profiles",
            history: [],
            message: test.message,
            ...state,
          }),
        });
        if (!response.ok) throw Error("Job launch failed: " + response.status);
        const job = await response.json();
        let events = [],
          cursor = 0;
        for (let i = 0; i < 180; i++) {
          const poll = await fetch(
            `${api}/v1/profiles/chat/jobs/${job.jobId}?accountId=mateo&after=${cursor}`,
            { headers },
          );
          if (!poll.ok) throw Error("Polling failed: " + poll.status);
          const data = await poll.json();
          events.push(...data.events);
          cursor = data.nextCursor;
          if (["done", "failed", "cancelled"].includes(data.status)) break;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        const workspaces = events.filter((e) => e.type === "workspace");
        for (const event of workspaces)
          state = {
            ...state,
            profile: event.profile,
            tabs: event.tabs,
            ...(event.situation ? { situation: event.situation } : {}),
          };
        reports.push({
          id: test.id,
          done: events.some((e) => e.type === "done"),
          errors: events.filter((e) => e.type === "error").map((e) => e.code),
          tools: events
            .filter((e) => e.type === "tool" && e.status === "done")
            .map((e) => e.name),
          text: events
            .filter((e) => e.type === "text")
            .map((e) => e.delta || "")
            .join(""),
          state: JSON.parse(JSON.stringify(state)),
        });
      }
      return {
        skillsVersion: status.skillsVersion,
        contractVersion: status.profileContractVersion,
        reports,
      };
    }, process.env.INVESTOROS_DEPLOYED_API || "https://2u00myl9n1.execute-api.us-east-1.amazonaws.com");
    for (const report of result.reports) {
      console.log(JSON.stringify(report));
      assert.equal(
        report.done,
        true,
        report.id + ": " + report.errors.join(","),
      );
    }
    const [goals, controls, situation, policy] = result.reports;
    assert.ok(goals.tools.includes("update_profile_goals"));
    assert.equal(goals.state.profile.horizon, "12 ans");
    assert.ok(
      JSON.parse(
        goals.state.tabs.find((t) => t.id === "profile-objectives").content,
      ).goals.some((g) => g.id === "reserve"),
    );
    assert.ok(controls.tools.includes("update_profile_controls"));
    assert.equal(
      controls.state.profile.preferences,
      "Exclure le tabac et garder une diversification.",
    );
    assert.equal(
      JSON.parse(
        controls.state.tabs.find((t) => t.id === "profile-controls").content,
      ).esg,
      "Exclusions",
    );
    assert.ok(situation.tools.includes("update_profile_situation"));
    assert.ok(situation.state.situation.incomeRange);
    assert.match(policy.text, /pas|aucun|ne |impossible|non/i);
    console.log(
      "PASS: real deployed Bedrock section tools, preservation, optional situation and refusal of financial/regulatory guarantees. No persona memory was written.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
