import { kataToHira, normalizeKana, stripJapanesePunctuation } from "./kana.js";

const WORD = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?/g;

export function alignUnits(target, hyp) {
  const n = target.length;
  const m = hyp.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) dp[i][0] = i;
  for (let j = 0; j <= m; j += 1) dp[0][j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const cost = target[i - 1] === hyp[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && target[i - 1] === hyp[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      ops.push({ type: "equal", target: target[i - 1], hyp: hyp[j - 1] });
      i -= 1;
      j -= 1;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.push({ type: "sub", target: target[i - 1], hyp: hyp[j - 1] });
      i -= 1;
      j -= 1;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ type: "del", target: target[i - 1] });
      i -= 1;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.push({ type: "ins", hyp: hyp[j - 1] });
      j -= 1;
    } else {
      break;
    }
  }
  ops.reverse();
  return { ops, distance: dp[n][m] };
}

export function scoreLabel(score) {
  if (score >= 90) return "아주 좋아요";
  if (score >= 75) return "좋아요";
  if (score >= 60) return "조금만 더";
  return "다시 해 봐요";
}

export function manualLabel(score) {
  if (score >= 90) return "잘함";
  if (score >= 60) return "보통";
  return "다시";
}

function groupPieces(pieces) {
  const grouped = [];
  for (const piece of pieces) {
    if (!piece?.text) continue;
    const status = piece.status || "neutral";
    const last = grouped[grouped.length - 1];
    if (last && last.status === status) last.text += piece.text;
    else grouped.push({ text: piece.text, status });
  }
  return grouped;
}

function problem(status) {
  return status === "bad" || status === "miss";
}

function similarity(matched, targetLen, hypLen) {
  if (targetLen === 0 && hypLen === 0) return 100;
  const denom = targetLen + hypLen;
  if (!denom) return 100;
  return Math.max(0, Math.min(100, Math.round((200 * matched) / denom)));
}

function wordKey(word) {
  return String(word || "").toLowerCase().replace(/’/g, "'");
}

export function splitEnglishDisplay(text) {
  const parts = [];
  const pattern = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?|[^A-Za-z0-9]+/g;
  for (const match of String(text || "").matchAll(pattern)) {
    const raw = match[0];
    if (/[A-Za-z0-9]/.test(raw)) parts.push({ type: "word", raw, key: wordKey(raw) });
    else parts.push({ type: "gap", raw });
  }
  return parts;
}

function englishWords(text) {
  return Array.from(String(text || "").matchAll(WORD)).map((match) => ({
    raw: match[0],
    key: wordKey(match[0]),
  }));
}

function heardKana(text, tokens) {
  let value = kataToHira(String(text ?? "").normalize("NFKC"));
  const replacements = (tokens || [])
    .map((token) => ({
      from: kataToHira(String(token.t ?? "").normalize("NFKC")),
      to: kataToHira(String(token.r ?? token.t ?? "").normalize("NFKC")),
    }))
    .filter((item) => item.from && item.from !== item.to)
    .sort((a, b) => b.from.length - a.from.length);
  for (const item of replacements) value = value.split(item.from).join(item.to);
  return stripJapanesePunctuation(value);
}

function pushHint(list, text) {
  if (!text || list.includes(text)) return;
  list.push(text);
}

function finish(partial) {
  const score = similarity(partial.matched, partial.total, partial.hypLen);
  return {
    score,
    label: scoreLabel(score),
    matched: partial.matched,
    total: partial.total,
    unitName: partial.unitName,
    recognized: partial.recognized,
    targetPieces: partial.targetPieces,
    heardPieces: partial.heardPieces,
    heardJoin: partial.heardJoin,
    compareTarget: groupPieces(partial.compareTarget || partial.targetPieces || []),
    compareHeard: groupPieces((partial.heardPieces || []).filter((piece) => piece.status !== "miss")),
    hints: partial.hints.slice(0, 3),
  };
}

export function evaluateAttempt(sentence, recognizedRaw) {
  if (sentence?.tokens) return evaluateJapanese(sentence, recognizedRaw);
  return evaluateEnglish(sentence, recognizedRaw);
}

function evaluateJapanese(sentence, recognizedRaw) {
  const recognized = String(recognizedRaw ?? "").slice(0, 400);
  const tokens = sentence.tokens || [];
  const targetUnits = [];
  const spans = tokens.map((token, index) => {
    const units = Array.from(normalizeKana(token.r || token.t || ""));
    const start = targetUnits.length;
    targetUnits.push(...units);
    return { index, start, end: targetUnits.length, scored: units.length > 0, token };
  });
  const hypUnits = Array.from(heardKana(recognized, tokens));
  if (!recognized.trim() || hypUnits.length === 0) {
    return finish({
      matched: 0,
      total: targetUnits.length,
      hypLen: hypUnits.length,
      unitName: "글자",
      recognized: recognized.trim(),
      targetPieces: spans.map((span) => pieceFromToken(span.token, span.scored ? "miss" : "neutral")),
      heardPieces: [],
      heardJoin: "",
      hints: ["들은 말이 없습니다. 마이크를 가까이 하고 다시 말해 보세요."],
    });
  }
  const { ops } = alignUnits(targetUnits, hypUnits);
  const targetOk = new Array(targetUnits.length).fill(false);
  const charStatus = new Array(targetUnits.length).fill("miss");
  const heardPieces = [];
  let cursor = 0;
  for (const op of ops) {
    if (op.type === "equal") {
      targetOk[cursor] = true;
      charStatus[cursor] = "ok";
      cursor += 1;
      heardPieces.push({ text: op.hyp, status: "ok" });
    } else if (op.type === "sub") {
      charStatus[cursor] = "bad";
      cursor += 1;
      heardPieces.push({ text: op.hyp, status: "bad" });
    } else if (op.type === "del") {
      charStatus[cursor] = "miss";
      cursor += 1;
    } else if (op.hyp) {
      heardPieces.push({ text: op.hyp, status: "bad" });
    }
  }
  const targetPieces = spans.map((span) => {
    if (!span.scored) return pieceFromToken(span.token, "neutral");
    const flags = charStatus.slice(span.start, span.end);
    let status = "ok";
    if (flags.some((flag) => flag === "bad")) status = "bad";
    else if (flags.some((flag) => flag === "miss")) status = "miss";
    return pieceFromToken(span.token, status);
  });
  const compareTarget = targetUnits.map((text, index) => ({ text, status: charStatus[index] }));
  const matched = targetOk.filter(Boolean).length;
  const hints = [];
  const ratio = targetUnits.length ? matched / targetUnits.length : 0;
  if (ratio < 0.45) {
    pushHint(hints, "들은 말이 목표와 많이 다릅니다. 느리게 한 번 듣고, 짧게 따라 해 보세요.");
    pushHint(hints, sentence.tip);
  } else {
    for (const piece of targetPieces) {
      if (problem(piece.status) && piece.note) pushHint(hints, piece.note);
    }
    const missedChars = targetUnits.filter((char, index) => !targetOk[index]);
    const noted = hints.join(" ");
    if (missedChars.includes("っ") && !noted.includes("っ")) {
      pushHint(hints, "작은 っ이 빠졌거나 약합니다. 한 박자 끊었다가 다음 소리를 조금 세게 말하세요.");
    }
    if (missedChars.includes("ー") && !noted.includes("ー") && !noted.includes("장음")) {
      pushHint(hints, "장음 ー이 짧습니다. 앞 모음을 한 박자 더 끄세요.");
    }
    if (missedChars.includes("ん") && !noted.includes("ん")) {
      pushHint(hints, "ん이 빠졌거나 약합니다. 코로 한 박자 울리고 다음 소리로 넘어가세요.");
    }
    if (!hints.length && targetPieces.some((piece) => problem(piece.status))) pushHint(hints, sentence.tip);
  }
  return finish({
    matched,
    total: targetUnits.length,
    hypLen: hypUnits.length,
    unitName: "글자",
    recognized: recognized.trim(),
    targetPieces,
    compareTarget,
    heardPieces,
    heardJoin: "",
    hints,
  });
}

function pieceFromToken(token, status) {
  const text = token.t || "";
  const reading = token.r || "";
  return {
    text,
    reading,
    status,
    ruby: Boolean(reading) && text !== reading,
    note: token.note || "",
  };
}

function evaluateEnglish(sentence, recognizedRaw) {
  const recognized = String(recognizedRaw ?? "").slice(0, 400);
  const display = splitEnglishDisplay(sentence.text || "");
  const targetWords = display.filter((part) => part.type === "word");
  const hypWords = englishWords(recognized);
  if (!recognized.trim() || hypWords.length === 0) {
    return finish({
      matched: 0,
      total: targetWords.length,
      hypLen: 0,
      unitName: "단어",
      recognized: recognized.trim(),
      targetPieces: display.map((part) => (
        part.type === "word"
          ? { text: part.raw, status: "miss" }
          : { text: part.raw, status: "neutral" }
      )),
      heardPieces: [],
      heardJoin: " ",
      hints: ["들은 말이 없습니다. 마이크를 가까이 하고 다시 말해 보세요."],
    });
  }
  const { ops } = alignUnits(targetWords.map((word) => word.key), hypWords.map((word) => word.key));
  const statuses = [];
  const heardPieces = [];
  let hypIndex = 0;
  for (const op of ops) {
    if (op.type === "equal") {
      statuses.push("ok");
      heardPieces.push({ text: `${hypWords[hypIndex].raw} `, status: "ok" });
      hypIndex += 1;
    } else if (op.type === "sub") {
      statuses.push("bad");
      heardPieces.push({ text: `${hypWords[hypIndex].raw} `, status: "bad" });
      hypIndex += 1;
    } else if (op.type === "del") {
      statuses.push("miss");
    } else {
      heardPieces.push({ text: `${hypWords[hypIndex].raw} `, status: "bad" });
      hypIndex += 1;
    }
  }
  let wordIndex = 0;
  const targetPieces = display.map((part) => {
    if (part.type !== "word") return { text: part.raw, status: "neutral" };
    const status = statuses[wordIndex] || "miss";
    wordIndex += 1;
    return { text: part.raw, status, key: part.key };
  });
  const matched = statuses.filter((status) => status === "ok").length;
  const hints = [];
  const ratio = targetWords.length ? matched / targetWords.length : 0;
  const hintMap = sentence.hints || {};
  if (ratio < 0.45) {
    pushHint(hints, "들은 말이 목표와 많이 다릅니다. 느리게 한 번 듣고, 짧게 따라 해 보세요.");
    pushHint(hints, sentence.tip);
  } else {
    for (const piece of targetPieces) {
      if (problem(piece.status) && piece.key && hintMap[piece.key]) pushHint(hints, hintMap[piece.key]);
    }
    if (!hints.length && targetPieces.some((piece) => problem(piece.status))) pushHint(hints, sentence.tip);
  }
  return finish({
    matched,
    total: targetWords.length,
    hypLen: hypWords.length,
    unitName: "단어",
    recognized: recognized.trim(),
    targetPieces,
    heardPieces,
    heardJoin: " ",
    hints,
  });
}
