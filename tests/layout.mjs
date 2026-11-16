import puppeteer from "puppeteer-core";

const base = process.env.BASE_URL || "http://127.0.0.1:4173/";
const chrome = process.env.CHROME || "/usr/bin/google-chrome";
const widths = [390, 1280, 1440, 1920];

function attach(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      if (box.right > root.clientWidth + 1 || box.left < -1) {
        offenders.push(`${el.tagName}.${String(el.className).slice(0, 80)} right=${Math.round(box.right)} left=${Math.round(box.left)}`);
      }
      if (offenders.length >= 8) break;
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      offenders,
      screen: document.querySelector("main")?.dataset.screen || "",
      text: document.body.innerText.slice(0, 240),
    };
  });
}

function assertFit(info, label) {
  if (info.scrollWidth > info.clientWidth + 1 || info.offenders.length) {
    throw new Error(`${label} overflow ${info.scrollWidth}>${info.clientWidth} ${info.offenders.join(" | ")}`);
  }
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});

const errors = [];
const page = await browser.newPage();
attach(page, errors);

try {
  for (const width of widths) {
    const height = width < 700 ? 844 : 1000;
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(base, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    let info = await measure(page);
    assertFit(info, `home ${width}`);
    if (!info.text.includes("땡이네 발음 연습")) throw new Error(`home missing Korean at ${width}`);

    await page.goto(`${base}#/lessons/ja`, { waitUntil: "networkidle0" });
    info = await measure(page);
    assertFit(info, `lessons ${width}`);

    await page.goto(`${base}#/practice/ja/ja-1/0`, { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-screen='practice']");
    info = await measure(page);
    assertFit(info, `ja practice ${width}`);
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        gothic: document.fonts.check("400 16px 'Gothic A1'"),
        noto: document.fonts.check("500 28px 'Noto Sans JP'"),
        ruby: document.querySelectorAll("rt").length,
      };
    });
    if (!fonts.gothic || !fonts.noto) throw new Error(`fonts missing at ${width}: ${JSON.stringify(fonts)}`);
    if (!fonts.ruby) throw new Error(`furigana missing at ${width}`);

    await page.goto(`${base}#/practice/en/en-5/0`, { waitUntil: "networkidle0" });
    info = await measure(page);
    assertFit(info, `en practice ${width}`);
    const english = await page.evaluate(() => document.body.innerText);
    if (!english.includes("강세")) throw new Error(`stress note missing at ${width}`);
    const overlap = await page.evaluate(() => {
      const heading = document.querySelector("h1").getBoundingClientRect();
      return { h1Top: heading.top, scrollY: window.scrollY, text: heading.textContent };
    });
    if (overlap.h1Top < 0) {
      throw new Error(`heading clipped at ${width}: ${JSON.stringify(overlap)}`);
    }
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
    await page.goto(`${base}#/stats`, { waitUntil: "networkidle0" });
    info = await measure(page);
    assertFit(info, `stats dark ${width}`);
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (dark !== "rgb(21, 19, 19)") throw new Error(`dark background ${dark} at ${width}`);
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  }

  const fallback = await browser.newPage();
  attach(fallback, errors);
  await fallback.evaluateOnNewDocument(() => {
    for (const name of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      Object.defineProperty(window, name, { configurable: true, get: () => undefined });
    }
  });
  await fallback.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await fallback.goto(`${base}#/practice/ja/ja-1/0`, { waitUntil: "networkidle0" });
  const unsupported = await fallback.evaluate(() => document.body.innerText.includes("음성 인식이 안 돼요"));
  if (!unsupported) throw new Error("fallback banner missing");
  await fallback.click("[data-action='record']");
  await fallback.waitForFunction(() => document.body.innerText.includes("듣고 있어요"));
  await new Promise((resolve) => setTimeout(resolve, 700));
  await fallback.click("[data-action='stop-take']");
  await fallback.waitForSelector("audio");
  await fallback.click("[data-action='rate'][data-score='75']");
  await fallback.waitForFunction(() => document.body.innerText.includes("보통"));
  await fallback.reload({ waitUntil: "networkidle0" });
  const after = await fallback.evaluate(() => ({
    text: document.body.innerText,
    raw: localStorage.getItem("pronounce.progress.v1"),
  }));
  const stored = JSON.parse(after.raw);
  if (stored.sentences["ja-1-01"].bestScore !== 75) throw new Error("best score missing");
  if (stored.sentences["ja-1-01"].attempts.at(-1).source !== "manual") throw new Error("manual attempt missing");
  if (!after.text.includes("보통")) throw new Error("self rating missing after refresh");
  if (stored.version !== 1) throw new Error("version missing");

  const mocked = await browser.newPage();
  attach(mocked, errors);
  await mocked.evaluateOnNewDocument(() => {
    class Rec extends EventTarget {
      start() {
        const item = [{ transcript: "Write the light is red" }];
        item.isFinal = true;
        const event = new Event("result");
        event.results = [item];
        this.dispatchEvent(event);
        this.dispatchEvent(new Event("end"));
      }
      stop() { this.dispatchEvent(new Event("end")); }
      abort() {}
    }
    window.SpeechRecognition = Rec;
  });
  await mocked.setViewport({ width: 1280, height: 800 });
  await mocked.goto(`${base}#/practice/en/en-1/0`, { waitUntil: "networkidle0" });
  await mocked.click("[data-action='speak']");
  await mocked.waitForFunction(() => document.body.innerText.includes("알아들은 말"));
  const diff = await mocked.evaluate(() => document.body.innerText);
  if (!diff.includes("점")) throw new Error("recognition result missing");
  if (!diff.includes("Right")) throw new Error("target word missing from diff");

  const ready = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, active: Boolean(reg.active) };
  });
  if (!ready.active || !ready.scope.endsWith("/")) throw new Error(`service worker not ready ${JSON.stringify(ready)}`);

  if (errors.length) throw new Error(errors.join("\n"));
  console.log("layout ok", ready);
} finally {
  await browser.close();
}
