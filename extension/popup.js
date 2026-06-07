const SOURCES = {
  live: "https://vtuber-live.net/live?filter=vspo",
  scheduled: "https://vtuber-live.net/live_schedule?filter=vspo"
};

const STORAGE_KEY = "selectedMemberIds";

const state = {
  view: "live",
  live: [],
  scheduled: [],
  selectedMemberIds: new Set(VSPO_DEFAULT_MEMBER_IDS),
  loading: false
};

const list = document.querySelector("#streamList");
const message = document.querySelector("#message");
const updatedAt = document.querySelector("#updatedAt");
const refreshButton = document.querySelector("#refreshButton");
const optionsButton = document.querySelector("#optionsButton");
const tabs = [...document.querySelectorAll(".tab")];

refreshButton.addEventListener("click", () => refresh());
optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.view = tab.dataset.view;
    tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    render();
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    state.selectedMemberIds = new Set(changes[STORAGE_KEY].newValue || VSPO_DEFAULT_MEMBER_IDS);
    refresh();
  }
});

refresh();

async function refresh() {
  setLoading(true);

  try {
    state.selectedMemberIds = new Set(await getSelectedMemberIds());
    const [liveHtml, scheduledHtml] = await Promise.all([
      fetchText(SOURCES.live),
      fetchText(SOURCES.scheduled)
    ]);

    const liveItems = parseStreams(liveHtml, "live").filter((item) => item.isLive);
    const scheduledItems = parseStreams(scheduledHtml, "scheduled").filter((item) => !item.isLive);

    state.live = liveItems.filter(shouldShowStream);
    state.scheduled = scheduledItems.filter(shouldShowStream).slice(0, 20);
    updateActionBadge(state.live.length);
    updatedAt.textContent = `${new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date())} \u66f4\u65b0`;
    render();
  } catch (error) {
    showMessage("\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u66f4\u65b0\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
    console.error(error);
  } finally {
    setLoading(false);
  }
}

async function getSelectedMemberIds() {
  const values = await chrome.storage.local.get({ [STORAGE_KEY]: VSPO_DEFAULT_MEMBER_IDS });
  return Array.isArray(values[STORAGE_KEY]) ? values[STORAGE_KEY] : VSPO_DEFAULT_MEMBER_IDS;
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return response.text();
}

function parseStreams(html, status) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll(".main_body .v_r.v_rect_l")]
    .map((card) => parseCard(card, status))
    .filter(Boolean);
}

function parseCard(card, status) {
  const id = getVideoId(card);
  const channelId = getChannelId(card);
  if (!id || !channelId) return null;

  const titleLink = card.querySelector(".v_title");
  const channelLink = card.querySelector(".c_title");
  const thumb = card.querySelector(".v_img img:not(.ls_now)");
  const concurrent = card.querySelector(".v_ccnt")?.textContent.trim() || "";
  const dateText = [...card.childNodes]
    .map((node) => node.textContent?.trim() || "")
    .find((text) => /^\d{4}\/\d{2}\/\d{2}/.test(text)) || "";
  const startsAt = parseStartDate(dateText);
  const isLive = status === "live" && Boolean(card.querySelector(".ls_now"));

  return {
    id,
    channelId,
    status,
    isLive,
    title: clean(titleLink?.getAttribute("title") || titleLink?.textContent || "Untitled"),
    member: clean(channelLink?.getAttribute("title") || channelLink?.textContent || "VSPO!"),
    thumbnail: thumb?.src || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    meta: clean([concurrent, formatRelativeTime(startsAt) || dateText].filter(Boolean).join(" / ")),
    url: `https://www.youtube.com/watch?v=${id}`
  };
}

function getVideoId(card) {
  const classId = [...card.classList]
    .map((name) => name.match(/^vr-([A-Za-z0-9_-]{11})$/)?.[1])
    .find(Boolean);
  if (classId) return classId;

  const imageId = card.querySelector("img[src*='i.ytimg.com/vi/']")?.src.match(/\/vi\/([A-Za-z0-9_-]{11})\//)?.[1];
  return imageId || null;
}

function getChannelId(card) {
  const href = card.querySelector(".c_title[href*='/channel/']")?.getAttribute("href") || "";
  return href.match(/\/channel\/(UC[\w-]+)/)?.[1] || null;
}

function clean(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseStartDate(value) {
  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})\([^)]*\)\s+(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

function formatRelativeTime(date) {
  if (!date || Number.isNaN(date.getTime())) return "";

  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);
  const absMinutes = Math.abs(diffMinutes);
  const suffix = diffMinutes >= 0 ? "\u524d" : "\u5f8c";

  if (absMinutes < 1) return diffMinutes >= 0 ? "\u305f\u3060\u3044\u307e\u958b\u59cb" : "\u307e\u3082\u306a\u304f";
  if (absMinutes < 60) return `${absMinutes}\u5206${suffix}`;

  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  if (hours < 24) {
    return minutes > 0 ? `${hours}\u6642\u9593${minutes}\u5206${suffix}` : `${hours}\u6642\u9593${suffix}`;
  }

  const days = Math.floor(hours / 24);
  return `${days}\u65e5${suffix}`;
}

function shouldShowStream(item) {
  return !isFreeChat(item) && state.selectedMemberIds.has(item.channelId);
}

function isFreeChat(item) {
  return /free\s*chat|\u30d5\u30ea\u30fc\s*\u30c1\u30e3\u30c3\u30c8|\u30d5\u30ea\u30c1\u30e3/i.test(`${item.title} ${item.member}`);
}

function render() {
  const items = state[state.view];
  list.replaceChildren();

  if (!items.length) {
    showMessage(state.view === "live" ? "\u73fe\u5728\u914d\u4fe1\u4e2d\u306e\u67a0\u306f\u3042\u308a\u307e\u305b\u3093\u3002" : "\u8868\u793a\u3067\u304d\u308b\u4e88\u5b9a\u67a0\u304c\u3042\u308a\u307e\u305b\u3093\u3002");
    return;
  }

  message.hidden = true;
  items.forEach((item) => list.appendChild(createCard(item)));
}

function createCard(item) {
  const card = document.createElement("a");
  card.className = "stream-card";
  card.href = item.url;
  card.target = "_blank";
  card.rel = "noreferrer";

  const badgeLabel = item.isLive ? "LIVE" : "\u4e88\u5b9a";
  card.innerHTML = `
    <div class="thumb">
      <img src="${escapeHtml(item.thumbnail)}" alt="">
      <span class="badge ${item.isLive ? "" : "scheduled"}">${badgeLabel}</span>
    </div>
    <div class="stream-body">
      <div class="member">${escapeHtml(item.member)}</div>
      <p class="title">${escapeHtml(item.title)}</p>
      <div class="meta">${escapeHtml(item.meta)}</div>
    </div>
  `;

  return card;
}

function updateActionBadge(count) {
  chrome.runtime.sendMessage({ type: "SET_LIVE_BADGE", count }).catch(() => {});
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
  list.replaceChildren();
}

function setLoading(loading) {
  state.loading = loading;
  refreshButton.disabled = loading;
  if (loading) showMessage("\u8aad\u307f\u8fbc\u307f\u4e2d...");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}
