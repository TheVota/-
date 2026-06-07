importScripts("members.js");

const LIVE_URL = "https://vtuber-live.net/live?filter=vspo";
const REFRESH_ALARM = "refresh-live-count";
const REFRESH_MINUTES = 3;
const STORAGE_KEY = "selectedMemberIds";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_MINUTES });
  refreshLiveBadge();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_MINUTES });
  refreshLiveBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    refreshLiveBadge();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "SET_LIVE_BADGE") {
    setBadge(Number(message.count) || 0);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    refreshLiveBadge();
  }
});

async function refreshLiveBadge() {
  try {
    const [response, selectedMemberIds] = await Promise.all([
      fetch(LIVE_URL, { cache: "no-store" }),
      getSelectedMemberIds()
    ]);
    if (!response.ok) {
      throw new Error(`live count fetch failed: ${response.status}`);
    }

    const html = await response.text();
    setBadge(countLiveStreams(html, new Set(selectedMemberIds)));
  } catch (error) {
    console.error(error);
    setBadge(null);
  }
}

async function getSelectedMemberIds() {
  const values = await chrome.storage.local.get({ [STORAGE_KEY]: VSPO_DEFAULT_MEMBER_IDS });
  return Array.isArray(values[STORAGE_KEY]) ? values[STORAGE_KEY] : VSPO_DEFAULT_MEMBER_IDS;
}

function countLiveStreams(html, selectedMemberIds) {
  const main = html.match(/<div class="main_body"[\s\S]*?<\/div>\s*<\/div>\s*<div class="footer_area">/)?.[0] || html;
  const cards = main.match(/<div class="v_r v_rect_l[\s\S]*?(?=<div class="v_r v_rect_l|<div class="cl footer_pager"|<div class="main_title"|$)/g) || [];
  return cards.filter((card) => {
    const channelId = getChannelId(card);
    return card.includes("class=\"ls_now\"") && channelId && selectedMemberIds.has(channelId) && !isFreeChatCard(card);
  }).length;
}

function getChannelId(card) {
  return card.match(/href="\/channel\/(UC[\w-]+)"/)?.[1] || null;
}

function isFreeChatCard(card) {
  const text = card
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return /free\s*chat|\u30d5\u30ea\u30fc\s*\u30c1\u30e3\u30c3\u30c8|\u30d5\u30ea\u30c1\u30e3/i.test(text);
}

function setBadge(count) {
  chrome.action.setBadgeBackgroundColor({ color: "#5e7ae3" });
  chrome.action.setBadgeTextColor?.({ color: "#FFFFFF" });
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setTitle({
    title: count === null ? "Unofficial VSPO Live Status" : `Unofficial VSPO Live Status - \u914d\u4fe1\u4e2d ${count}\u4ef6`
  });
}
