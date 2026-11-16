const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox"],
  });
  const p = await b.newPage({ viewport: { width: 1586, height: 992 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  let memory = { revision: 0, profile: null, tabs: [], sources: [] };
  await p.addInitScript(() =>
    localStorage.setItem("investoros.demo.active-account.v1", "mateo"),
  );
  await p.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (!u.pathname.includes("/v1/")) return r.continue();
    let data = {};
    if (u.pathname.includes("/memory/")) {
      if (r.request().method() === "PUT") {
        const body = r.request().postDataJSON();
        memory = { ...body, revision: body.expectedRevision + 1 };
      }
      data = memory;
    } else if (u.pathname.includes("/status")) data = { configured: true };
    else if (u.pathname.includes("/conversations"))
      data = { conversations: [] };
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await p.goto(
    `${process.env.PROFILE_WEB_URL || "http://127.0.0.1:5185"}/app/profiles`,
  );
  await p.getByRole("tab", { name: "Risque", exact: true }).click();
  await p.getByRole("radio", { name: /Élevée — J’accepte/ }).check();
  await p.waitForTimeout(950);
  assert.equal(memory.profile.riskTolerance, "Élevée");
  await p.getByRole("tab", { name: "Préférences", exact: true }).click();
  await p.getByRole("radio", { name: /Intermédiaire — Connaissance/ }).check();
  await p
    .getByRole("radio", { name: "Impact Rechercher un impact mesurable" })
    .check();
  await p.waitForTimeout(950);
  assert.equal(memory.profile.knowledge, "Intermédiaire");
  assert.equal(memory.profile.preferences, "Impact");
  await p.getByRole("tab", { name: "Mémoire", exact: true }).click();
  await p.getByRole("button", { name: "Tout effacer", exact: true }).click();
  await p
    .getByRole("button", { name: "Confirmer l’effacement", exact: true })
    .click();
  await p.waitForTimeout(950);
  assert.equal(memory.profile.objective, "");
  assert.equal(memory.profile.riskTolerance, "");
  assert.equal(
    memory.tabs.some((t) => t.id === "profile-controls"),
    false,
  );
  assert.deepEqual(
    JSON.parse(memory.tabs.find((t) => t.id === "profile-objectives").content)
      .goals,
    [],
  );
  await p.reload();
  await p.getByRole("tab", { name: "Mémoire", exact: true }).click();
  await p.waitForTimeout(900);
  assert.equal(memory.profile.objective, "");
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: risk/preferences persistence, erase and reload without demo restoration.",
  );
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
