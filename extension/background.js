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
    const selectedSet = new Set(selectedMemberIds);
    const [youtubeCount, twitchCount] = await Promise.all([
      Promise.resolve(countLiveStreams(html, selectedSet)),
      countTwitchLiveStreams(selectedSet)
    ]);
    setBadge(youtubeCount + twitchCount);
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
    return card.includes("class=\"ls_now\"") && channelId && isSelectedChannel(channelId, selectedMemberIds) && !isFreeChatCard(card);
  }).length;
}

function getChannelId(card) {
  return card.match(/href="\/channel\/(UC[\w-]+)"/)?.[1] || getTwitchLogin(card);
}

function getTwitchLogin(card) {
  const login = card.match(/href="https?:\/\/(?:www\.)?twitch\.tv\/(?!videos\/)([A-Za-z0-9_]+)/)?.[1];
  return login ? login.toLowerCase() : null;
}

function isSelectedChannel(channelId, selectedMemberIds) {
  const memberId = VSPO_CHANNEL_MEMBER_ID_MAP[channelId.toLowerCase()] || channelId;
  return selectedMemberIds.has(memberId);
}

async function countTwitchLiveStreams(selectedMemberIds) {
  const members = VSPO_MEMBERS
    .map((member) => ({
      ...member,
      twitchLogin: (member.ids || []).find((id) => !id.startsWith("UC"))
    }))
    .filter((member) => member.twitchLogin && selectedMemberIds.has(member.id));

  const results = await Promise.allSettled(members.map((member) => isTwitchLive(member.twitchLogin)));
  return results.filter((result) => result.status === "fulfilled" && result.value).length;
}

async function isTwitchLive(login) {
  const response = await fetch(getTwitchThumbnail(login.toLowerCase()), { method: "HEAD", cache: "no-store" });
  if (!response.ok) return false;

  const contentLength = Number(response.headers.get("content-length")) || 0;
  return contentLength > 3000;
}

function getTwitchThumbnail(login) {
  return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-320x180.jpg`;
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
