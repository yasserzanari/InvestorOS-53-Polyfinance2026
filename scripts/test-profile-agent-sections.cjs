// Browser -> actual Python tool handlers -> workspace events -> persisted memory.
// API persistence and Bedrock transport are isolated fixtures; no AWS writes.
const { chromium } = require("playwright");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox"],
  });
  try {
    const p = await browser.newPage({
      viewport: { width: 1586, height: 1050 },
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    let memory = { revision: 0, profile: null, tabs: [], sources: [] };
    let writes = 0;
    const requests = [];
    await p.addInitScript(() =>
      localStorage.setItem("investoros.demo.active-account.v1", "mateo"),
    );
    await p.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (!url.pathname.includes("/v1/")) return route.continue();
      const json = (data) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (url.pathname.endsWith("/profiles/status"))
        return json({ configured: true, chatTransport: "stream" });
      if (url.pathname.includes("/memory/")) {
        if (request.method() === "PUT") {
          const body = request.postDataJSON();
          assert.equal(body.expectedRevision, memory.revision);
          memory = { ...body, revision: memory.revision + 1 };
          writes++;
        }
        return json(memory);
      }
      if (url.pathname.includes("/conversations/"))
        return json(request.method() === "GET" ? { conversations: [] } : {});
      if (url.pathname.endsWith("/profiles/chat")) {
        const body = request.postDataJSON();
        requests.push(body);
        const result = spawnSync(
          process.env.PROFILE_TEST_PYTHON || "python3",
          ["scripts/test-profile-tool-stream.py"],
          { input: JSON.stringify(body), encoding: "utf8" },
        );
        assert.equal(result.status, 0, result.stderr);
        return route.fulfill({
          status: 200,
          contentType: "application/x-ndjson",
          body: result.stdout,
        });
      }
      return json({});
    });
    await p.goto(
      `${process.env.PROFILE_WEB_URL || "http://127.0.0.1:5185"}/app/profiles`,
    );
    const wait = async (check) => {
      await assert.doesNotReject(async () => {
        for (let i = 0; i < 100; i++) {
          if (check()) return;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw Error("Persistence deadline exceeded");
      });
    };
    await wait(() => writes > 0);
    const notes = memory.profile.preferences;
    const send = async (text) => {
      const input = p.getByPlaceholder("Posez votre question…", {
        exact: true,
      });
      await input.fill(text);
      await input.press("Enter");
    };
    await send("Enregistre ma situation fictive.");
    await wait(
      () =>
        memory.profile?.situation?.incomeRange === "Stable, revenus fictifs",
    );
    await p
      .getByLabel("Revenu et stabilité", { exact: true })
      .fill("Revenu corrigé manuellement, fictif");
    await wait(
      () =>
        memory.profile.situation.incomeRange ===
        "Revenu corrigé manuellement, fictif",
    );
    await send("Enregistre mes préférences fictives.");
    await wait(() =>
      memory.tabs.some(
        (t) =>
          t.id === "profile-controls" &&
          JSON.parse(t.content).esg === "Exclusions",
      ),
    );
    assert.equal(
      requests.at(-1).situation.incomeRange,
      "Revenu corrigé manuellement, fictif",
    );
    assert.equal(memory.profile.preferences, notes);
    await send("Enregistre mon projet fictif de 12 ans.");
    await wait(() => memory.profile.horizon === "12 ans");
    assert.equal(memory.profile.objective, "Croissance diversifiée fictive");
    await p.getByRole("heading", { name: /Projet déclaré au chat/ }).waitFor();
    await p.reload();
    await p.getByRole("tab", { name: "Risque", exact: true }).click();
    assert.equal(
      await p.getByLabel("Objectifs et horizon", { exact: true }).inputValue(),
      "12 ans",
    );
    await p
      .getByLabel("Objectifs et horizon", { exact: true })
      .fill("5 à 10 ans");
    await wait(() => memory.profile.horizon === "5 à 10 ans");
    let main = JSON.parse(
      memory.tabs.find((t) => t.id === "profile-objectives").content,
    ).goals[0];
    assert.equal(main.horizonYears, null);
    assert.equal(main.horizonLabel, "5 à 10 ans");
    await p.getByRole("tab", { name: "Préférences", exact: true }).click();
    assert.equal(
      await p
        .getByRole("radio", { name: "Exclusions Écarter certains secteurs" })
        .isChecked(),
      true,
    );
    await p.getByRole("tab", { name: "Mémoire", exact: true }).click();
    await p
      .getByText("Conversation avec l’assistant", { exact: true })
      .first()
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: all typed section tools -> UI -> memory -> reload; optional situation context; ESG notes; qualitative horizon; provenance.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
