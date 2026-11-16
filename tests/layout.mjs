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
    if (!info.text.includes("발음 연습")) throw new Error(`home missing Korean at ${width}`);

    await page.click("a.track-card");
    await page.waitForSelector("[data-screen='track']");
    info = await measure(page);
    assertFit(info, `track ${width}`);

    await page.click("a.lesson");
    await page.waitForSelector("[data-screen='practice']");
    info = await measure(page);
    assertFit(info, `ja practice ${width}`);
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        pretendard: document.fonts.check("400 16px 'Pretendard Variable'"),
        noto: document.fonts.check("400 32px 'Noto Sans JP'"),
        ruby: document.querySelectorAll("rt").length,
      };
    });
    if (!fonts.pretendard || !fonts.noto) throw new Error(`fonts missing at ${width}: ${JSON.stringify(fonts)}`);
    if (!fonts.ruby) throw new Error(`furigana missing at ${width}`);

    await page.goto(`${base}#/practice/en/en-5/0`, { waitUntil: "networkidle0" });
    info = await measure(page);
    assertFit(info, `en practice ${width}`);
    const english = await page.evaluate(() => document.body.innerText);
    if (!english.includes("강세")) throw new Error(`stress note missing at ${width}`);
    const overlap = await page.evaluate(() => {
      const header = document.querySelector(".site-header").getBoundingClientRect();
      const heading = document.querySelector("h1").getBoundingClientRect();
      return { headerBottom: header.bottom, h1Top: heading.top, scrollY: window.scrollY };
    });
    if (overlap.h1Top < overlap.headerBottom - 1) {
      throw new Error(`heading under header at ${width}: ${JSON.stringify(overlap)}`);
    }
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
  const unsupported = await fallback.evaluate(() => document.body.innerText.includes("자동으로 받아 적지 못합니다"));
  if (!unsupported) throw new Error("fallback banner missing");
  await fallback.click("[data-action='record']");
  await fallback.waitForFunction(() => document.body.innerText.includes("녹음 중"));
  await new Promise((resolve) => setTimeout(resolve, 700));
  await fallback.click("[data-action='stop-record']");
  await fallback.waitForSelector("audio");
  await fallback.click("[data-action='rate'][data-score='100']");
  await fallback.waitForFunction(() => document.body.innerText.includes("100점"));
  await fallback.reload({ waitUntil: "networkidle0" });
  const after = await fallback.evaluate(() => ({
    text: document.body.innerText,
    raw: localStorage.getItem("pronounce.progress.v1"),
  }));
  if (!after.text.includes("스스로")) throw new Error("manual rating did not survive refresh");
  const stored = JSON.parse(after.raw);
  if (stored.sentences["ja-1-01"].bestScore !== 100) throw new Error("best score missing");
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
  await mocked.waitForFunction(() => document.body.innerText.includes("다시 볼 곳"));
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
