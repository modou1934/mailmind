import { generateJsonWithGemini, hasGeminiCredentials } from "./gemini.js";

const TOPIC_RULES = [
  { id: "pec", keywords: ["pec", "posta certificata", "notifica legale", "ricevuta di accettazione"] },
  { id: "burocrazia", keywords: ["agenzia entrate", "inps", "comune", "ministero", "protocollo", "f24", "tribut"] },
  { id: "payment", keywords: ["fattura", "fatture", "invoice", "billing", "pagamento", "payment", "ricevuta", "bonifico"] },
  { id: "meeting", keywords: ["riunione", "meeting", "calendar", "calendario", "invito", "availability", "disponibil", "call", "zoom", "teams", "meet"] },
  { id: "contract", keywords: ["contratto", "agreement", "nda", "firma", "signature", "signed copy"] },
  { id: "orders", keywords: ["ordine", "ordini", "tracking", "shipment", "delivery", "spedizione"] },
  { id: "submission", keywords: ["submission", "invio", "ricezione pratica", "conferma invio", "modulo"] },
  { id: "accounts", keywords: ["password", "security", "login", "accesso", "2fa", "otp", "verification"] },
  { id: "toolAlert", keywords: ["alert", "incident", "downtime", "monitor", "status page", "outage"] },
  { id: "comment", keywords: ["commento", "comment", "mention", "ha commentato", "review request"] },
  { id: "newsletter", keywords: ["newsletter", "digest", "unsubscribe", "weekly recap"] },
  { id: "promotion", keywords: ["promo", "promozione", "offerta", "sconto", "discount", "deal"] },
  { id: "coldOutreach", keywords: ["proposta commerciale", "partnership", "quick call", "demo", "free trial", "sales"] },
  { id: "event", keywords: ["evento", "webinar", "conference", "summit"] },
  { id: "notetaker", keywords: ["notetaker", "trascrizione", "transcript", "action items"] },
];

const IMPORTANT_TOPICS = new Set([
  "pec",
  "burocrazia",
  "payment",
  "meeting",
  "contract",
  "orders",
  "submission",
  "accounts",
  "comment",
  "toolAlert",
]);

const AUTOMATED_SENDER_HINTS = [
  "noreply",
  "no-reply",
  "notification",
  "notifications",
  "billing",
  "support",
  "alerts",
  "calendar",
  "agenda",
  "system",
];

const STRONG_MARKETING_HINTS = [
  "offerta",
  "promo",
  "discount",
  "free trial",
  "webinar",
  "demo",
  "partnership",
  "sales",
  "upgrade",
  "limited time",
];

const NEWSLETTER_HINTS = ["newsletter", "digest", "unsubscribe"];

const BROADCAST_HINTS = [
  "unsubscribe",
  "annulla la sottoscrizione",
  "manage preferences",
  "gestisci le impostazioni email",
  "manage your subscriptions",
  "privacy policy",
  "informativa sulla privacy",
  "terms",
  "termini",
  "download our app",
  "download the app",
  "download the app",
  "view post",
  "view messages",
  "watch more",
  "hourly updates",
  "new post",
  "job alert",
  "daily credits",
  "new videos",
  "you missed messages",
  "security alert",
  "verification code",
  "codice di sicurezza",
  "do not reply",
];

const DIRECT_REPLY_HINTS = [
  "let me know",
  "please reply",
  "please confirm",
  "could you",
  "can you",
  "would you",
  "what do you think",
  "what are you curious about",
  "which option",
  "when are you available",
  "are you available",
  "fammi sapere",
  "mi fai sapere",
  "potresti",
  "puoi",
  "confermi",
];

function normalizeText(parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function countKeywordMatches(text, keywords) {
  return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
}

function senderLooksAutomated(email = "") {
  const normalized = email.toLowerCase();
  return AUTOMATED_SENDER_HINTS.some((hint) => normalized.includes(hint));
}

function looksLikeBroadcastContent(text) {
  const broadcastHits = countKeywordMatches(text, BROADCAST_HINTS);
  return broadcastHits >= 2 || text.includes("unsubscribe");
}

function looksLikeDirectReplyRequest(text) {
  return hasKeyword(text, DIRECT_REPLY_HINTS) || (text.includes("?") && !looksLikeBroadcastContent(text));
}

function detectTopicMatch(text) {
  return TOPIC_RULES.find((rule) => hasKeyword(text, rule.keywords)) || null;
}

function exposeTopicLabel(topicMatch, settings) {
  if (!topicMatch || !settings.topicLabels) {
    return "";
  }

  if (settings.topicStates?.[topicMatch.id] === false) {
    return "";
  }

  return topicMatch.id;
}

function isMarketingThread({ text, topicId, automated, needsReply, settings }) {
  const strongMarketing = hasKeyword(text, STRONG_MARKETING_HINTS);
  const newsletterLike = hasKeyword(text, NEWSLETTER_HINTS) || topicId === "newsletter";
  const coldOutreach = topicId === "coldOutreach" || strongMarketing;

  switch (settings.marketingFilter) {
    case "obvious":
      return coldOutreach;
    case "cold_unknown":
      return coldOutreach || (automated && !needsReply && newsletterLike);
    case "cold_newsletter":
      return coldOutreach || newsletterLike;
    case "all":
      return !needsReply && !IMPORTANT_TOPICS.has(topicId || "") && (automated || coldOutreach || newsletterLike);
    default:
      return coldOutreach || newsletterLike;
  }
}

function deriveInboxAction(category, settings) {
  if (["notification", "followUp", "marketing"].includes(category) && settings.moveOut?.[category]) {
    return "move_out";
  }

  if (["todo", "fyi"].includes(category) && settings.keepIn?.[category]) {
    return "keep_inbox";
  }

  return "keep_default";
}

function clampConfidence(value) {
  return Math.max(0.55, Math.min(0.98, Number(value.toFixed(2))));
}

function heuristicClassification(thread, settings) {
  const text = normalizeText([thread.subject, thread.snippet, thread.from_name, thread.from_email]);
  const automated = senderLooksAutomated(thread.from_email);
  const topicMatch = detectTopicMatch(text);
  const topicLabel = exposeTopicLabel(topicMatch, settings);
  const topicId = topicMatch?.id || "";
  const broadcast = looksLikeBroadcastContent(text);
  const directReply = looksLikeDirectReplyRequest(text);

  let category = "fyi";
  let reason = "Thread informativo mantenuto visibile.";
  let confidence = 0.66;

  if (!settings.enableCategorization) {
    category = thread.needs_reply ? "todo" : "fyi";
    reason = "Categorizzazione disabilitata; il thread resta nel flusso principale.";
    confidence = thread.needs_reply ? 0.72 : 0.6;
  } else if (isMarketingThread({
    text,
    topicId,
    automated,
    needsReply: Boolean(thread.needs_reply),
    settings,
  })) {
    category = "marketing";
    reason = "Contenuto promozionale o outreach rilevato.";
    confidence = topicId === "coldOutreach" ? 0.95 : 0.87;
  } else if (automated || broadcast || ["accounts", "toolAlert", "newsletter", "notetaker"].includes(topicId)) {
    category = "notification";
    reason = topicId
      ? `Aggiornamento automatizzato classificato come ${topicId}.`
      : "Contenuto broadcast o notifica di sistema.";
    confidence = topicId ? 0.9 : 0.84;
  } else if (thread.needs_reply && directReply) {
    category = "todo";
    reason = topicId
      ? `Richiede risposta e contiene segnali del topic ${topicId}.`
      : "Richiede una risposta del proprietario della casella.";
    confidence = topicId ? 0.92 : 0.79;
  } else if (IMPORTANT_TOPICS.has(topicId)) {
    category = "fyi";
    reason = `Thread importante classificato come ${topicId}.`;
    confidence = 0.83;
  } else if (thread.needs_reply) {
    category = "fyi";
    reason = "Thread da leggere ma senza richiesta esplicita di risposta.";
    confidence = 0.74;
  }

  return {
    category,
    topicLabel,
    inboxAction: deriveInboxAction(category, settings),
    reason,
    confidence: clampConfidence(confidence),
  };
}

function applyClassificationGuard(thread, settings, classification) {
  const text = normalizeText([
    thread.subject,
    thread.snippet,
    thread.from_name,
    thread.from_email,
    classification?.reason || "",
  ]);
  const automated = senderLooksAutomated(thread.from_email);
  const broadcast = looksLikeBroadcastContent(text);
  const directReply = looksLikeDirectReplyRequest(text);
  const topicId = classification?.topicLabel || detectTopicMatch(text)?.id || "";
  const newsletterLike = hasKeyword(text, NEWSLETTER_HINTS) || topicId === "newsletter";
  const strongMarketing = hasKeyword(text, STRONG_MARKETING_HINTS);

  if (classification.category === "todo") {
    if (newsletterLike || strongMarketing) {
      return {
        ...classification,
        category: "marketing",
        inboxAction: deriveInboxAction("marketing", settings),
        reason: "Contenuto promozionale o newsletter: niente risposta automatica.",
        confidence: clampConfidence(Math.max(classification.confidence || 0.8, 0.86)),
      };
    }

    if ((automated || broadcast || ["toolAlert", "accounts", "newsletter", "event"].includes(topicId)) && !directReply) {
      return {
        ...classification,
        category: "notification",
        inboxAction: deriveInboxAction("notification", settings),
        reason: "Broadcast o notifica operativa: non richiede risposta automatica.",
        confidence: clampConfidence(Math.max(classification.confidence || 0.8, 0.84)),
      };
    }
  }

  if (classification.category !== "marketing" && (newsletterLike || strongMarketing) && !directReply) {
    return {
      ...classification,
      category: "marketing",
      inboxAction: deriveInboxAction("marketing", settings),
      reason: "Contenuto promozionale o outreach rilevato.",
      confidence: clampConfidence(Math.max(classification.confidence || 0.8, 0.86)),
    };
  }

  if (classification.category === "fyi" && (automated || broadcast) && ["toolAlert", "accounts"].includes(topicId)) {
    return {
      ...classification,
      category: "notification",
      inboxAction: deriveInboxAction("notification", settings),
      reason: "Aggiornamento operativo o di sicurezza, meglio come notifica.",
      confidence: clampConfidence(Math.max(classification.confidence || 0.8, 0.84)),
    };
  }

  return classification;
}

function allowedTopicLabels(settings) {
  return TOPIC_RULES
    .map((rule) => rule.id)
    .filter((topicId) => settings.topicLabels && settings.topicStates?.[topicId] !== false);
}

function validateAiClassification(payload, settings) {
  const allowedCategories = new Set(["todo", "fyi", "notification", "marketing"]);
  const allowedTopics = new Set(allowedTopicLabels(settings));
  const category = allowedCategories.has(payload?.category) ? payload.category : "fyi";
  const topicLabel = allowedTopics.has(payload?.topicLabel) ? payload.topicLabel : "";
  const confidence = clampConfidence(Number(payload?.confidence || 0.72));
  const reason = String(payload?.reason || "Classificazione AI applicata.").trim().slice(0, 280) || "Classificazione AI applicata.";

  return {
    category,
    topicLabel,
    inboxAction: deriveInboxAction(category, settings),
    reason,
    confidence,
  };
}

async function classifyThreadsWithGemini(threads, settings) {
  const enabledTopics = allowedTopicLabels(settings);
  const prompt = [
    "Classifica questi thread email per una inbox AI.",
    "Restituisci solo JSON valido.",
    "Formato richiesto:",
    '[{"id":"thread-id","category":"todo|fyi|notification|marketing","topicLabel":"","reason":"","confidence":0.0}]',
    "",
    "Regole:",
    "- todo = richiede risposta o azione del proprietario della mailbox.",
    "- fyi = importante ma non richiede risposta immediata.",
    "- notification = aggiornamento automatico, operativo o informativo.",
    "- marketing = newsletter, promozione, cold outreach, sales.",
    "- topicLabel deve essere vuoto oppure uno dei topic consentiti.",
    "- reason deve essere breve, concreta, in italiano.",
    "- confidence deve essere tra 0 e 1.",
    "",
    `Topic consentiti: ${enabledTopics.join(", ") || "(nessuno)"}`,
    "",
    "Threads:",
    ...threads.map((thread) => [
      `id: ${thread.id}`,
      `subject: ${thread.subject || ""}`,
      `from_name: ${thread.from_name || ""}`,
      `from_email: ${thread.from_email || ""}`,
      `snippet: ${thread.snippet || ""}`,
      `needs_reply: ${Boolean(thread.needs_reply)}`,
      `status: ${thread.status || ""}`,
      `category_attuale: ${thread.category || ""}`,
      "---",
    ].join("\n")),
  ].join("\n");

  const response = await generateJsonWithGemini({
    model: process.env.GEMINI_CLASSIFICATION_MODEL || "gemini-2.0-flash-lite",
    systemInstruction: "Sei un classificatore email rigoroso per un prodotto SaaS di inbox management. Non aggiungere testo fuori dal JSON.",
    prompt,
    temperature: 0.1,
    maxOutputTokens: Math.max(300, threads.length * 120),
  });

  const items = Array.isArray(response.json)
    ? response.json
    : Array.isArray(response.json?.items)
      ? response.json.items
      : [];

  return new Map(
    items
      .filter((item) => item?.id)
      .map((item) => [String(item.id), validateAiClassification(item, settings)]),
  );
}

export async function classifyMailThreads(threads, settings) {
  const fallbackMap = new Map(
    threads.map((thread) => {
      const fallback = heuristicClassification(thread, settings);
      return [thread.id, applyClassificationGuard(thread, settings, fallback)];
    }),
  );
  if (!settings.enableCategorization || !hasGeminiCredentials() || threads.length === 0) {
    return fallbackMap;
  }

  try {
    const aiMap = await classifyThreadsWithGemini(threads, settings);
    return new Map(
      threads.map((thread) => {
        const aiClassification = aiMap.get(thread.id);
        const guarded = aiClassification
          ? applyClassificationGuard(thread, settings, aiClassification)
          : fallbackMap.get(thread.id);
        return [thread.id, guarded];
      }),
    );
  } catch {
    return fallbackMap;
  }
}

export async function classifyMailThread(thread, settings) {
  const batch = await classifyMailThreads([thread], settings);
  return batch.get(thread.id) || heuristicClassification(thread, settings);
}
