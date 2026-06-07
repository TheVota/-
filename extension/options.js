const STORAGE_KEY = "selectedMemberIds";

const jpMembers = document.querySelector("#jpMembers");
const enMembers = document.querySelector("#enMembers");
const jpCount = document.querySelector("#jpCount");
const enCount = document.querySelector("#enCount");
const status = document.querySelector("#status");
const selectAll = document.querySelector("#selectAll");
const clearAll = document.querySelector("#clearAll");

let selectedMemberIds = new Set(VSPO_DEFAULT_MEMBER_IDS);
let saveTimer = null;

init();

async function init() {
  selectedMemberIds = new Set(await getSelectedMemberIds());
  renderMembers();
  updateCounts();

  selectAll.addEventListener("click", () => {
    selectedMemberIds = new Set(VSPO_DEFAULT_MEMBER_IDS);
    syncChecks();
    save();
  });

  clearAll.addEventListener("click", () => {
    selectedMemberIds = new Set();
    syncChecks();
    save();
  });
}

async function getSelectedMemberIds() {
  const values = await chrome.storage.local.get({ [STORAGE_KEY]: VSPO_DEFAULT_MEMBER_IDS });
  return Array.isArray(values[STORAGE_KEY]) ? values[STORAGE_KEY] : VSPO_DEFAULT_MEMBER_IDS;
}

function renderMembers() {
  jpMembers.replaceChildren(...createOptions("JP"));
  enMembers.replaceChildren(...createOptions("EN"));
}

function createOptions(group) {
  return VSPO_MEMBERS
    .filter((member) => member.group === group)
    .map((member) => {
      const label = document.createElement("label");
      label.className = "member-option";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = member.id;
      input.checked = selectedMemberIds.has(member.id);
      input.addEventListener("change", () => {
        if (input.checked) {
          selectedMemberIds.add(member.id);
        } else {
          selectedMemberIds.delete(member.id);
        }
        save();
      });

      const name = document.createElement("span");
      name.textContent = member.name;

      label.append(input, name);
      return label;
    });
}

function syncChecks() {
  document.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.checked = selectedMemberIds.has(input.value);
  });
}

function updateCounts() {
  const jpTotal = VSPO_MEMBERS.filter((member) => member.group === "JP").length;
  const enTotal = VSPO_MEMBERS.filter((member) => member.group === "EN").length;
  const jpSelected = VSPO_MEMBERS.filter((member) => member.group === "JP" && selectedMemberIds.has(member.id)).length;
  const enSelected = VSPO_MEMBERS.filter((member) => member.group === "EN" && selectedMemberIds.has(member.id)).length;
  jpCount.textContent = `${jpSelected}/${jpTotal}`;
  enCount.textContent = `${enSelected}/${enTotal}`;
}

function save() {
  clearTimeout(saveTimer);
  updateCounts();
  status.textContent = "\u4fdd\u5b58\u4e2d...";
  saveTimer = setTimeout(async () => {
    await chrome.storage.local.set({ [STORAGE_KEY]: [...selectedMemberIds] });
    status.textContent = "\u4fdd\u5b58\u3057\u307e\u3057\u305f";
  }, 120);
}
