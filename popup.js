"use strict";

let receptionPinnedHostTabId = null;
let receptionHostTabIdPromise = null;

async function receptionHostTabId()
{
  if(Number.isInteger(receptionPinnedHostTabId)) return receptionPinnedHostTabId;
  if(!receptionHostTabIdPromise) {
    receptionHostTabIdPromise = chrome.runtime.sendMessage({action:"getReceptionHostTabId"})
      .then(response => Number.isInteger(response?.tabId) ? response.tabId : null)
      .catch(() => null);
  }
  const hostTabId = await receptionHostTabIdPromise;
  if(Number.isInteger(hostTabId)) {
    receptionPinnedHostTabId = hostTabId;
    return hostTabId;
  }
  const [activeTab] = await chrome.tabs.query({active:true, currentWindow:true});
  if(!activeTab?.id) throw new Error("Không tìm thấy tab VNPT HIS đang mở.");
  return activeTab.id;
}

window.addEventListener("message", event => {
  if(event.source !== window.parent) return;
  if(event.data?.type === "receptionHostTabId" && Number.isInteger(event.data.tabId))
    receptionPinnedHostTabId = event.data.tabId;
  else if(event.data?.type === "receptionFloatingMode")
    document.body.classList.toggle("list-compact", event.data.mode === "list-compact");
  else if(event.data?.type === "receptionWorkflowStatus")
    setStatus(String(event.data.text || ""), event.data.status || "");
  else if(event.data?.type === "receptionRunFullAutoHotkey")
    runFullAutoFromHotkey();
  else if(event.data?.type === "receptionFocusFirstEntry")
    focusFirstDataEntry();
  else if(event.data?.type === "receptionRestoreEthnicityFocus") {
    const input = document.getElementById("ethnicity");
    if(input) {
      input.focus({preventScroll:true});
      input.select?.();
    }
  }
  else if(event.data?.type === "receptionRestoreLocationFocus") {
    const input = document.getElementById("location");
    if(input) {
      input.focus({preventScroll:true});
      input.setSelectionRange?.(input.value.length, input.value.length);
    }
  } else if(event.data?.type === "receptionExistingPatientDateRange") {
    const from = document.getElementById("existingPatientFromDate");
    const to = document.getElementById("existingPatientToDate");
    if(from && to) {
      from.value = String(event.data.fromDate || "");
      to.value = formatConfigDateDisplay(todayDateInputValue());
      saveData();
      scheduleExistingPatientPreview();
    }
  }
});

const FIELD_IDS = [
  "fullName",
  "identity",
  "birthDate",
  "gender",
  "premature",
  "ethnicity",
  "contactPhone",
  "guardianName",
  "guardianRelationship",
  "location",
  "addressDetail",
  "companionIdentity",
  "historySelf",
  "historySelfNote",
  "historyFamily",
  "historyFamilyNote",
  "historyTuberculosis",
  "temperature",
  "pulse",
  "respiratoryRate",
  "lengthCm",
  "weightKg",
  "headCircumferenceCm",
  "armCircumferenceMm",
  "autismRisk",
  "vaccinationComplete",
  "runnyNose",
  "stuffyNose",
  "dentalCaries",
  "neonatalTeeth",
  "graspReflex",
  "moroReflex",
  "healthConclusionTuberculosisRisk",
  "healthConclusionProblem",
  "healthConclusionReason",
  "autoOpenHealthAfterSave",
  "autoGenderFromIdentity",
  "autoBirthYearFromIdentity",
  "checkExistingPatient",
  "existingPatientFromDate",
  "existingPatientToDate",
  "admissionReason",
  "fieldDelaySeconds",
  "frequentLocationLimit",
  "capitalizeAddress",
  "addressUppercaseRules",
  "showGuidance",
  "autoAdvanceDataEntry",
  "autoAdvanceFixedLength",
  "dataEntryAdvanceSeconds",
  "phoneToIdentityDelaySeconds",
  "fullAutoHotkey",
  "overwrite"
];

const todayDateInputValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const INITIAL_CHECK_DATE = todayDateInputValue();

const DEFAULT_DATA = {
  fullName: "",
  identity: "",
  birthDate: "",
  gender: "Nam",
  premature: false,
  ethnicity: "Kinh",
  contactPhone: "",
  guardianName: "",
  guardianRelationship: "Mẹ",
  location: "",
  locationDraft: "",
  locationQuery: "",
  locationAutoLocked: false,
  addressDetail: "",
  companionIdentity: "",
  historySelf: false,
  historySelfNote: "",
  historyFamily: false,
  historyFamilyNote: "",
  historyTuberculosis: false,
  temperature: "",
  pulse: "",
  respiratoryRate: "",
  lengthCm: "",
  weightKg: "",
  headCircumferenceCm: "",
  armCircumferenceMm: "",
  autismRisk: false,
  vaccinationComplete: true,
  runnyNose: false,
  stuffyNose: false,
  dentalCaries: false,
  neonatalTeeth: false,
  graspReflex: false,
  moroReflex: false,
  healthConclusionTuberculosisRisk: false,
  healthConclusionProblem: false,
  healthConclusionReason: "",
  autoOpenHealthAfterSave: true,
  autoGenderFromIdentity: false,
  autoBirthYearFromIdentity: false,
  checkExistingPatient: true,
  existingPatientFromDate: INITIAL_CHECK_DATE,
  existingPatientToDate: INITIAL_CHECK_DATE,
  admissionReason: "Khám sức khỏe",
  fieldDelaySeconds: "0.25",
  frequentLocationLimit: "5",
  capitalizeAddress: false,
  addressUppercaseRules: "cc=CC",
  showGuidance: true,
  autoAdvanceDataEntry: false,
  autoAdvanceFixedLength: false,
  dataEntryAdvanceSeconds: "1.5",
  phoneToIdentityDelaySeconds: "2",
  fullAutoHotkey: "Alt+Shift+A",
  overwrite: true
};

const DEFAULTS_VERSION = "2.4.0";
const WORKFLOW_DEFAULTS_VERSION = "3.11.0";
const OPTION_IDS = [
  "premature", "historySelf", "historyFamily", "historyTuberculosis",
  "runnyNose", "stuffyNose", "dentalCaries", "neonatalTeeth",
  "graspReflex", "moroReflex", "autismRisk", "vaccinationComplete",
  "healthConclusionTuberculosisRisk", "healthConclusionProblem",
  "autoOpenHealthAfterSave", "autoGenderFromIdentity", "autoBirthYearFromIdentity",
  "autoAdvanceDataEntry", "autoAdvanceFixedLength", "capitalizeAddress"
];

const DATA_ENTRY_IDS = [
  "fullName", "identity", "birthDate", "gender", "premature", "ethnicity",
  "location", "addressDetail", "guardianName", "guardianRelationship", "contactPhone",
  "companionIdentity", "historySelf", "historySelfNote", "historyFamily", "historyFamilyNote", "historyTuberculosis",
  "temperature", "pulse", "respiratoryRate", "lengthCm", "weightKg",
  "headCircumferenceCm", "armCircumferenceMm", "autismRisk", "vaccinationComplete",
  "runnyNose", "stuffyNose",
  "neonatalTeeth", "dentalCaries", "graspReflex", "moroReflex",
  "healthConclusionTuberculosisRisk", "healthConclusionProblem", "healthConclusionReason"
];

const DEFAULT_ENTRY_VALUES = {
  ethnicity: "Kinh",
  temperature: "37",
  pulse: "92",
  respiratoryRate: "22",
  headCircumferenceCm: "50"
};
const DATA_GUESS_SOURCE_IDS = ["identity", "birthDate", "contactPhone", "companionIdentity", "addressDetail"];
const OPTIONAL_EMPTY_ENTRY_IDS = new Set(["addressDetail"]);

let saveTimer = null;
let dataEntryAdvanceTimer = null;
let existingPatientPreviewTimer = null;
let existingPatientToastTimer = null;
let earlyValidationTimer = null;
let earlyValidationStarted = false;
let earlyValidationRevealAll = false;
const earlyValidationTouched = new Set();
let existingPatientPreviewRevision = 0;
let lastExistingPatientPreviewKey = "";
let lastExistingPatientMatches = [];
let lastExistingPatientPreviewData = null;
let lastExistingPatientPreviewError = "";
let suppressExistingPatientWidgetClick = false;
const composingDataEntry = new WeakSet();
let activeDataGuess = null;

function upperPersonName(value)
{
  return String(value || "").toLocaleUpperCase("vi-VN");
}

function identityGenderInfo(identity)
{
  const digits = String(identity || "").replace(/\D/g, "");
  if(digits.length < 4 || !/^[0-7]$/.test(digits[3])) return null;
  const code = Number(digits[3]);
  return {
    code,
    gender:code % 2 === 0 ? "Nam" : "Nữ",
    centuryStart:1900 + Math.floor(code / 2) * 100
  };
}

function identityBirthYear(identity)
{
  const digits = String(identity || "").replace(/\D/g, "");
  const info = identityGenderInfo(digits);
  if(digits.length !== 12 || !info) return null;
  return info.centuryStart + Number(digits.slice(4, 6));
}

function identityGenderWarning()
{
  const identity = document.getElementById("identity")?.value.replace(/\D/g, "") || "";
  const birthDigits = birthDateDigits(document.getElementById("birthDate")?.value || "");
  const gender = document.getElementById("gender")?.value || "Nam";
  if(identity.length !== 12 || birthDigits.length !== 8) return "";
  const year = Number(birthDigits.slice(4));
  if(year < 1900 || year > 2099) return "";
  const expectedCode = (year >= 2000 ? 2 : 0) + (gender === "Nữ" ? 1 : 0);
  if(Number(identity[3]) !== expectedCode) {
    const range = year >= 2000 ? "2000–2099" : "1900–1999";
    const maleCode = year >= 2000 ? 2 : 0;
    const femaleCode = maleCode + 1;
    return `Cảnh báo: CCCD không khớp năm sinh/giới tính (${range}: Nam ${maleCode}, Nữ ${femaleCode}).`;
  }
  if(identity.slice(4, 6) !== String(year).slice(-2))
    return "Cảnh báo: hai số năm sinh trong CCCD không khớp ngày sinh.";
  return "";
}

function applyGenderFromIdentity()
{
  if(document.getElementById("autoGenderFromIdentity")?.checked !== true) return;
  const info = identityGenderInfo(document.getElementById("identity")?.value);
  if(!info || info.code > 3) return;
  const gender = document.getElementById("gender");
  markAutoAdjusted(gender);
  if(gender.value === info.gender) return;
  gender.value = info.gender;
  gender.dispatchEvent(new Event("input", {bubbles:true}));
  gender.dispatchEvent(new Event("change", {bubbles:true}));
  scheduleExistingPatientPreview();
}

function companionIdentityGenderWarning()
{
  const relationship = document.getElementById("guardianRelationship")?.value || "";
  if(relationship !== "Cha" && relationship !== "Mẹ") return "";
  const identity = document.getElementById("companionIdentity")?.value.replace(/\D/g, "") || "";
  if(identity.length !== 12) return "";
  const info = identityGenderInfo(identity);
  if(!info) return "";
  const expectedGender = relationship === "Cha" ? "Nam" : "Nữ";
  if(info.gender !== expectedGender)
    return `Cảnh báo: CCCD người đi cùng mang giới tính ${info.gender}, không khớp quan hệ ${relationship}.`;
  return "";
}

function titleCasePersonName(value)
{
  return String(value || "").toLocaleLowerCase("vi-VN")
    .replace(/(^|[\s'-])(\p{L})/gu, (_, prefix, letter) => prefix + letter.toLocaleUpperCase("vi-VN"));
}

function capitalizeAddressWords(value)
{
  return String(value || "").replace(/(^|[\s,./'’\-])(\p{L})/gu,
    (_, prefix, letter) => prefix + letter.toLocaleUpperCase("vi-VN"));
}

function escapeRegExp(value)
{
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseAddressUppercaseRules(value)
{
  return String(value || "").split(/[\r\n;]+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^(.+?)(?:\s*(?:->|=>|=|>|:)\s*)(.+)$/);
      return match ? {source:match[1].trim(), replacement:match[2].trim()} : null;
    })
    .filter(rule => rule?.source && rule.replacement)
    .sort((left, right) => right.source.length - left.source.length);
}

function formatAddressValue(value, rulesText, capitalizeWords)
{
  let result = capitalizeWords ? capitalizeAddressWords(value) : String(value || "");
  for(const rule of parseAddressUppercaseRules(rulesText)) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(rule.source)})(?=$|[^\\p{L}\\p{N}])`, "giu");
    result = result.replace(pattern, (_, prefix) => prefix + rule.replacement);
  }
  return result;
}

function syncTodayCheckDate()
{
  const input = document.getElementById("existingPatientToDate");
  const iso = todayDateInputValue();
  if(input) input.value = formatConfigDateDisplay(iso);
  return iso;
}

function formatBirthDateInput(value)
{
  const cleaned = String(value || "").replace(/[^\d/]/g, "").slice(0, 10);
  const short = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if(short) {
    const year = short[3].length === 2 ? `20${short[3]}` : short[3];
    return `${short[1].padStart(2, "0")}/${short[2].padStart(2, "0")}/${year}`;
  }
  const digits = cleaned.replace(/\D/g, "").slice(0, 8);
  if(digits.length === 8)
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  return cleaned;
}

function birthDateDigits(value)
{
  const formatted = formatBirthDateInput(value);
  const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[1]}${match[2]}${match[3]}` : String(value || "").replace(/\D/g, "").slice(0, 8);
}

function birthYearFromIdentity()
{
  if(document.getElementById("autoBirthYearFromIdentity")?.checked !== true) return "";
  const identity = document.getElementById("identity")?.value.replace(/\D/g, "") || "";
  const info = identityGenderInfo(identity);
  if(identity.length < 6 || !info) return "";
  return String(info.centuryStart + Number(identity.slice(4, 6)));
}

function formatBirthDateForCommit(value)
{
  const normal = formatBirthDateInput(value);
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(normal)) return normal;
  const year = birthYearFromIdentity();
  if(!year) return normal;
  const text = String(value || "").trim().replace(/[^\d/]/g, "");
  const short = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if(short) return `${short[1].padStart(2, "0")}/${short[2].padStart(2, "0")}/${year}`;
  const digits = text.replace(/\D/g, "");
  if(/^\d{4}$/.test(digits))
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${year}`;
  return normal;
}

function birthYearWasAutoCompleted(previous, formatted)
{
  if(document.getElementById("autoBirthYearFromIdentity")?.checked !== true) return false;
  const year = birthYearFromIdentity();
  if(!year || !String(formatted || "").endsWith(`/${year}`)) return false;
  const text = String(previous || "").trim();
  return /^\d{4}$/.test(text.replace(/\D/g, "")) || /^\d{1,2}\/\d{1,2}$/.test(text);
}

function validFormattedBirthDate(value)
{
  const formatted = formatBirthDateInput(value);
  const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? formatted : "";
}

function hideDataGuessSuggestion()
{
  const suggestion = document.getElementById("dataGuessSuggestion");
  if(!suggestion) return;
  suggestion.hidden = true;
  suggestion.replaceChildren();
  activeDataGuess = null;
}

function markAutoAdjusted(element)
{
  if(!element) return;
  element.classList.add("auto-adjusted");
}

function positionDataGuessSuggestion(source)
{
  const suggestion = document.getElementById("dataGuessSuggestion");
  if(!suggestion || suggestion.hidden || !source?.isConnected) return;
  const rect = source.getBoundingClientRect();
  const margin = 7;
  const width = Math.min(Math.max(rect.width, 240), Math.max(240, window.innerWidth - margin * 2));
  suggestion.style.width = `${width}px`;
  suggestion.style.left = `${Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))}px`;
  const height = suggestion.offsetHeight;
  const below = rect.bottom + 5;
  suggestion.style.top = `${below + height <= window.innerHeight - margin
    ? below : Math.max(margin, rect.top - height - 5)}px`;
}

function selectDataGuessOption(index)
{
  if(!activeDataGuess?.choices.length) return;
  activeDataGuess.index = (index + activeDataGuess.choices.length) % activeDataGuess.choices.length;
  document.querySelectorAll(".data-guess-action").forEach((button, buttonIndex) => {
    const selected = buttonIndex === activeDataGuess.index;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
}

function handleDataGuessKeydown(event, source)
{
  if(!activeDataGuess || activeDataGuess.source !== source) return false;
  if(event.key === "ArrowDown")
    selectDataGuessOption(activeDataGuess.index + 1);
  else if(event.key === "ArrowUp")
    selectDataGuessOption(activeDataGuess.index - 1);
  else if(event.key === "Enter") {
    const choice = activeDataGuess.choices[activeDataGuess.index];
    if(choice) moveGuessedValue(source, choice.targetId, choice.value);
  } else if(event.key === "Escape")
    hideDataGuessSuggestion();
  else return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}

function moveGuessedValue(source, targetId, value)
{
  const target = document.getElementById(targetId);
  if(!target) return;
  target.value = value;
  if(source !== target) {
    source.value = "";
    source.classList.remove("duplicate-match");
  }
  markAutoAdjusted(target);
  target.dispatchEvent(new InputEvent("input", {bubbles:true, inputType:"insertReplacementText", data:value}));
  target.dispatchEvent(new Event("change", {bubbles:true}));
  // A confirmed suggestion fills another field, but must not let that target's
  // fixed-length auto-advance steal focus from the field the user is editing.
  clearTimeout(dataEntryAdvanceTimer);
  setEarlyValidationMessage(source.id, "", true);
  setEarlyValidationMessage(target.id, "", true);
  hideDataGuessSuggestion();
  source.focus({preventScroll:true});
  source.setSelectionRange?.(source.value.length, source.value.length);
  saveData();
}

function showDataGuessSuggestion(source, message, choices)
{
  const suggestion = document.getElementById("dataGuessSuggestion");
  if(!suggestion) return;
  if(suggestion.parentElement !== document.body) document.body.appendChild(suggestion);
  suggestion.replaceChildren();
  const text = document.createElement("strong");
  text.textContent = message;
  const actions = document.createElement("div");
  actions.className = "data-guess-actions";
  choices.forEach(choice => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "data-guess-action";
    button.tabIndex = -1;
    button.setAttribute("role", "option");
    button.textContent = choice.label;
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => moveGuessedValue(source, choice.targetId, choice.value));
    actions.append(button);
  });
  suggestion.append(text, actions);
  suggestion.hidden = false;
  activeDataGuess = {source, choices, index:0};
  selectDataGuessOption(0);
  requestAnimationFrame(() => positionDataGuessSuggestion(source));
}

function detectDataGuess(source)
{
  const raw = String(source.value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if(!raw) {
    hideDataGuessSuggestion();
    return;
  }

  const formattedDate = validFormattedBirthDate(raw);
  const isCompleteDate = formattedDate && (/^\d{8}$/.test(digits) ||
    /^\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})$/.test(raw));
  if(isCompleteDate) {
    if(source.id === "birthDate") {
      if(source.value !== formattedDate) {
        source.value = formattedDate;
        source.setSelectionRange?.(formattedDate.length, formattedDate.length);
        saveData();
        scheduleExistingPatientPreview();
      }
      hideDataGuessSuggestion();
    } else {
      showDataGuessSuggestion(source, "Dữ liệu này có vẻ là ngày sinh.", [
        {label:"Chuyển vào Ngày sinh", targetId:"birthDate", value:formattedDate}
      ]);
    }
    return;
  }

  if(digits.length === 10) {
    if(source.id === "contactPhone") hideDataGuessSuggestion();
    else showDataGuessSuggestion(source, "Bạn đang nhập số điện thoại?", [
      {label:"Chuyển vào Số điện thoại", targetId:"contactPhone", value:digits}
    ]);
    return;
  }

  if(digits.length === 12) {
    const year = identityBirthYear(digits);
    const age = year == null ? null : new Date().getFullYear() - year;
    if(source.id === "identity" && age != null && age >= 15) {
      showDataGuessSuggestion(source, "CCCD này có vẻ là của người giám hộ.", [
        {label:"Chuyển sang CCCD người giám hộ", targetId:"companionIdentity", value:digits}
      ]);
    } else if(source.id === "companionIdentity" && age != null && age >= 0 && age <= 10) {
      showDataGuessSuggestion(source, "CCCD này có vẻ là của người khám.", [
        {label:"Chuyển sang CCCD người khám", targetId:"identity", value:digits}
      ]);
    } else if(source.id === "identity" || source.id === "companionIdentity") {
      hideDataGuessSuggestion();
    } else {
      showDataGuessSuggestion(source, "Bạn đang nhập CCCD?", [
        {label:"CCCD người khám", targetId:"identity", value:digits},
        {label:"CCCD người giám hộ", targetId:"companionIdentity", value:digits}
      ]);
    }
    return;
  }

  hideDataGuessSuggestion();
}

function parseConfigDateToIso(value)
{
  const text = formatConfigDateDisplay(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso) return text;
  const display = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!display) return "";
  const day = display[1];
  const month = display[2];
  const year = display[3];
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if(date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day))
    return "";
  return `${year}-${month}-${day}`;
}

function formatConfigDateDisplay(value)
{
  const text = String(value || "").replace(/[^\d/-]/g, "").slice(0, 10);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const short = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if(short) {
    const year = short[3].length === 2 ? `20${short[3]}` : short[3];
    return `${short[1].padStart(2, "0")}/${short[2].padStart(2, "0")}/${year}`;
  }
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if(digits.length === 8)
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  return text;
}

function getData()
{
  const rawBirthDate = document.getElementById("birthDate").value.trim();
  const birthDigits = birthDateDigits(rawBirthDate);
  return {
    fullName: upperPersonName(document.getElementById("fullName").value.trim()),
    identity: document.getElementById("identity").value.replace(/\D/g, ""),
    birthDate: birthDigits,
    gender: document.getElementById("gender").value,
    premature: document.getElementById("premature").checked,
    ethnicity: document.getElementById("ethnicity").dataset.selectedLabel ||
      document.getElementById("ethnicity").value.trim() || "Kinh",
    contactPhone: document.getElementById("contactPhone").value.replace(/\D/g, ""),
    guardianName: titleCasePersonName(document.getElementById("guardianName").value.trim()),
    guardianRelationship: document.getElementById("guardianRelationship").value,
    location: document.getElementById("location").dataset.selectedLabel || "",
    locationDraft: document.getElementById("location").value.trim(),
    locationQuery: document.getElementById("location").dataset.query || "",
    locationAutoLocked: document.getElementById("location").dataset.autoLocked === "true",
    addressDetail: formatAddressValue(
      document.getElementById("addressDetail").value.trim(),
      document.getElementById("addressUppercaseRules").value,
      document.getElementById("capitalizeAddress").checked
    ),
    companionIdentity: document.getElementById("companionIdentity").value.replace(/\D/g, ""),
    historySelf: document.getElementById("historySelf").checked,
    historySelfNote: document.getElementById("historySelfNote").value.trim(),
    historyFamily: document.getElementById("historyFamily").checked,
    historyFamilyNote: document.getElementById("historyFamilyNote").value.trim(),
    historyTuberculosis: document.getElementById("historyTuberculosis").checked,
    temperature: document.getElementById("temperature").value.trim(),
    pulse: document.getElementById("pulse").value.trim(),
    respiratoryRate: document.getElementById("respiratoryRate").value.trim(),
    lengthCm: document.getElementById("lengthCm").value.trim(),
    weightKg: document.getElementById("weightKg").value.trim(),
    headCircumferenceCm: document.getElementById("headCircumferenceCm").value.trim(),
    armCircumferenceMm: armCircumferenceValue(document.getElementById("armCircumferenceMm").value),
    autismRisk: document.getElementById("autismRisk").checked,
    vaccinationComplete: document.getElementById("vaccinationComplete").checked,
    runnyNose: document.getElementById("runnyNose").checked,
    stuffyNose: document.getElementById("stuffyNose").checked,
    dentalCaries: document.getElementById("dentalCaries").checked,
    neonatalTeeth: document.getElementById("neonatalTeeth").checked,
    graspReflex: document.getElementById("graspReflex").checked,
    moroReflex: document.getElementById("moroReflex").checked,
    healthConclusionTuberculosisRisk: document.getElementById("healthConclusionTuberculosisRisk").checked,
    healthConclusionProblem: document.getElementById("healthConclusionProblem").checked,
    healthConclusionNormal: !document.getElementById("healthConclusionTuberculosisRisk").checked &&
      !document.getElementById("healthConclusionProblem").checked,
    healthConclusionReason: document.getElementById("healthConclusionReason").value.trim(),
    autoOpenHealthAfterSave: document.getElementById("autoOpenHealthAfterSave").checked,
    autoGenderFromIdentity: document.getElementById("autoGenderFromIdentity").checked,
    autoBirthYearFromIdentity: document.getElementById("autoBirthYearFromIdentity").checked,
    fullAutoWorkflow: false,
    checkExistingPatient: document.getElementById("checkExistingPatient").checked,
    existingPatientFromDate: parseConfigDateToIso(document.getElementById("existingPatientFromDate").value),
    existingPatientToDate: syncTodayCheckDate(),
    admissionReason: document.getElementById("admissionReason").value.trim(),
    fieldDelaySeconds: document.getElementById("fieldDelaySeconds").value,
    frequentLocationLimit: String(Math.min(10, Math.max(1,
      Number.parseInt(document.getElementById("frequentLocationLimit").value, 10) || 5))),
    capitalizeAddress: document.getElementById("capitalizeAddress").checked,
    addressUppercaseRules: document.getElementById("addressUppercaseRules").value,
    showGuidance: document.getElementById("showGuidance").checked,
    autoAdvanceDataEntry: document.getElementById("autoAdvanceDataEntry").checked,
    autoAdvanceFixedLength: document.getElementById("autoAdvanceFixedLength").checked,
    dataEntryAdvanceSeconds: document.getElementById("dataEntryAdvanceSeconds").value,
    phoneToIdentityDelaySeconds: document.getElementById("phoneToIdentityDelaySeconds").value,
    fullAutoHotkey: document.getElementById("fullAutoHotkey").value.trim(),
    overwrite: document.getElementById("overwrite").checked,
    patientType: "Miễn phí",
    receptionReason: "Khám bệnh",
    documentType: "Định danh công dân",
    examRequest: "KSK_TRE_DUOI_6_TUOI - Khám sức khỏe trẻ em dưới 6 tuổi",
    clinicSelection: "first"
  };
}

function setData(data)
{
  const value = {...DEFAULT_DATA, ...(data || {})};
  value.existingPatientToDate = todayDateInputValue();
  if(!String(value.ethnicity || "").trim()) value.ethnicity = "Kinh";
  const legacyDefaults = {temperature:"37", pulse:"92", respiratoryRate:"22", headCircumferenceCm:"50"};
  Object.entries(legacyDefaults).forEach(([id, oldDefault]) => {
    if(String(value[id] ?? "").trim() === oldDefault) value[id] = "";
  });
  FIELD_IDS.forEach(id => {
    const element = document.getElementById(id);
    if(element.type === "checkbox") element.checked = value[id] === true;
    else if(id === "birthDate") element.value = formatBirthDateInput(value[id]);
    else if(id === "existingPatientFromDate" || id === "existingPatientToDate")
      element.value = formatConfigDateDisplay(value[id]);
    else element.value = value[id] ?? "";
  });
  const location = document.getElementById("location");
  location.value = value.location || value.locationDraft || "";
  location.dataset.selectedLabel = value.location || "";
  location.dataset.query = value.locationQuery || "";
  location.dataset.autoLocked = value.locationAutoLocked === true ? "true" : "false";
  location.dataset.autoSelectPending = value.locationAutoLocked === true ? "true" : "false";
  location.dataset.autoCommitted = "false";
  if(value.locationAutoLocked === true) markAutoAdjusted(location);
  const ethnicity = document.getElementById("ethnicity");
  ethnicity.dataset.selectedLabel = String(value.ethnicity || "Kinh");
  ethnicity.value = String(value.ethnicity || "Kinh").replace(/^\d+\s*-\s*/, "") || "Kinh";
  document.getElementById("fullName").value = upperPersonName(document.getElementById("fullName").value);
  document.getElementById("guardianName").value = titleCasePersonName(document.getElementById("guardianName").value);
  document.getElementById("addressDetail").value = formatAddressValue(
    document.getElementById("addressDetail").value,
    value.addressUppercaseRules,
    value.capitalizeAddress
  );
  const reasonPreview = document.getElementById("admissionReasonPreview");
  if(reasonPreview) reasonPreview.textContent = value.admissionReason || "Chưa cấu hình";
  updateGuidanceVisibility();
  updateHistoryNoteVisibility();
  updateHealthConclusionVisibility();
  updateExistingPatientCheckVisibility();
}

function updateExistingPatientCheckVisibility()
{
  const enabled = document.getElementById("checkExistingPatient")?.checked === true;
  document.getElementById("existingPatientCheckOption")?.classList.toggle("is-enabled", enabled);
  document.getElementById("existingPatientFromDate").disabled = !enabled;
  const toDate = document.getElementById("existingPatientToDate");
  toDate.disabled = !enabled;
  toDate.readOnly = true;
  syncTodayCheckDate();
}

function updateHistoryNoteVisibility()
{
  for(const prefix of ["historySelf", "historyFamily"]) {
    const enabled = document.getElementById(prefix)?.checked === true;
    const wrapper = document.getElementById(`${prefix}NoteWrap`);
    if(wrapper) wrapper.hidden = !enabled;
  }
}

function updateHealthConclusionVisibility()
{
  const abnormal = document.getElementById("healthConclusionTuberculosisRisk")?.checked === true ||
    document.getElementById("healthConclusionProblem")?.checked === true;
  const wrapper = document.getElementById("healthConclusionReasonWrap");
  if(wrapper) wrapper.hidden = !abnormal;
  if(!abnormal) setEarlyValidationMessage("healthConclusionReason", "", true);
}

function selectAllInExamGroup(title)
{
  const group = title?.closest(".exam-group");
  const inputs = Array.from(group?.querySelectorAll('.option-grid input[type="checkbox"]') || []);
  const targetChecked = !inputs.length ? false : !inputs.every(input => input.checked);
  inputs.forEach(input => {
    if(input.checked === targetChecked) return;
    input.checked = targetChecked;
    input.dispatchEvent(new Event("input", {bubbles:true}));
    input.dispatchEvent(new Event("change", {bubbles:true}));
  });
  saveData();
}

function updateGuidanceVisibility()
{
  document.body.classList.toggle("guidance-hidden", document.getElementById("showGuidance")?.checked !== true);
}

function saveData()
{
  const preview = document.getElementById("admissionReasonPreview");
  if(preview) preview.textContent = document.getElementById("admissionReason")?.value.trim() || "Chưa cấu hình";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.local.set({receptionAutofillData:getData()}), 120);
}

function dataEntryContainer(element)
{
  return element?.closest(".quick-switch, label") || element;
}

function isVisibleDataEntry(element)
{
  const container = dataEntryContainer(element);
  if(!container || !container.isConnected) return false;
  const style = getComputedStyle(container);
  return style.display !== "none" && style.visibility !== "hidden" && container.getClientRects().length > 0;
}

function focusNextDataEntry(current)
{
  const currentIndex = DATA_ENTRY_IDS.indexOf(current.id);
  if(currentIndex < 0) return;
  const next = DATA_ENTRY_IDS.slice(currentIndex + 1)
    .map(id => document.getElementById(id))
    .find(element => {
      if(!element || element.disabled || !isVisibleDataEntry(element)) return false;
      if(element.id === "gender" && document.getElementById("autoGenderFromIdentity")?.checked === true &&
        identityGenderInfo(document.getElementById("identity")?.value)) return false;
      return true;
    });
  if(!next) {
    document.getElementById("fill")?.focus();
    return;
  }
  document.querySelectorAll(".data-entry-next-focus").forEach(element =>
    element.classList.remove("data-entry-next-focus")
  );
  const container = dataEntryContainer(next);
  next.classList.add("data-entry-next-focus");
  container.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
  next.focus({preventScroll:true});
  if(next.matches('input:not([type="checkbox"]):not([type="radio"])')) next.select?.();
  next.addEventListener("blur", () => next.classList.remove("data-entry-next-focus"), {once:true});
}

function focusFirstDataEntry()
{
  clearTimeout(dataEntryAdvanceTimer);
  const input = document.getElementById("fullName");
  if(!input) return false;
  document.querySelectorAll(".data-entry-next-focus").forEach(element =>
    element.classList.remove("data-entry-next-focus")
  );
  input.classList.add("data-entry-next-focus");
  input.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
  input.focus({preventScroll:true});
  input.select?.();
  input.addEventListener("blur", () => input.classList.remove("data-entry-next-focus"), {once:true});
  return true;
}

function hotkeyFromEvent(event)
{
  const modifierKeys = new Set(["Control", "Alt", "Shift", "Meta"]);
  if(modifierKeys.has(event.key)) return "";
  let key = "";
  if(/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
  else if(/^Digit\d$/.test(event.code)) key = event.code.slice(5);
  else if(/^Numpad\d$/.test(event.code)) key = `Num${event.code.slice(6)}`;
  else key = String(event.key || "").length === 1
    ? String(event.key).toUpperCase()
    : String(event.key || "");
  if(!key) return "";
  const parts = [];
  if(event.ctrlKey) parts.push("Ctrl");
  if(event.altKey) parts.push("Alt");
  if(event.shiftKey) parts.push("Shift");
  if(event.metaKey) parts.push("Meta");
  parts.push(key);
  return parts.join("+");
}

function matchesConfiguredHotkey(event, configured)
{
  return !event.repeat && !!String(configured || "").trim() &&
    hotkeyFromEvent(event).toLocaleLowerCase("en-US") === String(configured).trim().toLocaleLowerCase("en-US");
}

let fullAutoHotkeyStarting = false;

async function runFullAutoFromHotkey()
{
  const button = document.getElementById("fillFullAuto");
  if(!button || button.disabled || fullAutoHotkeyStarting) return;
  fullAutoHotkeyStarting = true;
  setStatus(`Đã nhận phím tắt ${document.getElementById("fullAutoHotkey")?.value || ""}; đang chạy Auto hoàn toàn…`);
  try {
    await fillCurrentTab(true);
  } finally {
    fullAutoHotkeyStarting = false;
  }
}

function handleDataEntryEnter(event, element)
{
  if(event.key !== "Enter" || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
  event.preventDefault();
  clearTimeout(dataEntryAdvanceTimer);

  if(element.id === "birthDate") {
    const previous = element.value;
    const formatted = formatBirthDateForCommit(element.value);
    element.value = formatted;
    if(birthYearWasAutoCompleted(previous, formatted)) markAutoAdjusted(element);
    element.setSelectionRange?.(formatted.length, formatted.length);
  }

  const isTextEntry = element.matches('input:not([type="checkbox"]):not([type="radio"]), textarea');
  if(isTextEntry && !String(element.value || "").trim() && DEFAULT_ENTRY_VALUES[element.id]) {
    element.value = DEFAULT_ENTRY_VALUES[element.id];
    markAutoAdjusted(element);
    element.dispatchEvent(new InputEvent("input", {
      bubbles:true,
      inputType:"insertReplacementText",
      data:element.value
    }));
    if(element.id === "ethnicity") element.dataset.selectedLabel = defaultEthnicityLabel();
    clearTimeout(dataEntryAdvanceTimer);
  }
  let message = "";
  if(isTextEntry && !String(element.value || "").trim() && !OPTIONAL_EMPTY_ENTRY_IDS.has(element.id))
    message = "Chưa nhập thông tin này.";
  else if(EARLY_VALIDATION_IDS.includes(element.id))
    message = earlyValidationMessage(element.id);

  const warningOnly = String(message).startsWith("Cảnh báo:");
  if(message) {
    earlyValidationStarted = true;
    earlyValidationTouched.add(element.id);
    setEarlyValidationMessage(element.id, message, true);
  }
  if(message && !warningOnly) {
    element.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
    element.focus({preventScroll:true});
    return;
  }

  if(!message) setEarlyValidationMessage(element.id, "", true);
  saveData();
  focusNextDataEntry(element);
}

function handleBinarySpace(event, element)
{
  if((event.key !== " " && event.code !== "Space") || event.isComposing ||
    event.ctrlKey || event.altKey || event.metaKey) return;
  const canToggle = element.id === "gender" ||
    (element.id === "guardianRelationship" && ["Cha", "Mẹ"].includes(element.value)) ||
    element.matches('input[type="checkbox"]');
  if(!canToggle) return;
  event.preventDefault();
  clearTimeout(dataEntryAdvanceTimer);
  if(element.id === "gender")
    element.value = element.value === "Nam" ? "Nữ" : "Nam";
  else if(element.id === "guardianRelationship" && ["Cha", "Mẹ"].includes(element.value))
    element.value = element.value === "Cha" ? "Mẹ" : "Cha";
  else if(element.matches('input[type="checkbox"]'))
    element.checked = !element.checked;
  element.dispatchEvent(new Event("input", {bubbles:true}));
  element.dispatchEvent(new Event("change", {bubbles:true}));
}

function armCircumferenceValue(value)
{
  const text = String(value ?? "").trim().replace(/\s+/g, "");
  if(!/^\d+(?:[.,]\d+)?$/.test(text)) return text;
  const numeric = Number(text.replace(",", "."));
  if(Number.isFinite(numeric) && numeric > 0 && numeric < 30)
    return String(Math.round(numeric * 10));
  return text.replace(",", ".");
}

function scheduleDataEntryAdvance(current)
{
  clearTimeout(dataEntryAdvanceTimer);
  if(composingDataEntry.has(current)) return;
  const fixedLengths = {identity:12, birthDate:8, contactPhone:10, companionIdentity:12};
  const fixedLength = fixedLengths[current.id];
  const rawValue = String(current.value || "");
  const shortBirthDateComplete = current.id === "birthDate" &&
    document.getElementById("autoBirthYearFromIdentity")?.checked === true &&
    !!birthYearFromIdentity() && (/^\d{4}$/.test(rawValue.replace(/\D/g, "")) ||
      /^\d{1,2}\/\d{1,2}$/.test(rawValue.trim()));
  const fixedComplete = document.getElementById("autoAdvanceFixedLength")?.checked === true &&
    fixedLength && (String(current.value || "").replace(/\D/g, "").length === fixedLength || shortBirthDateComplete);
  const timedAdvance = document.getElementById("autoAdvanceDataEntry")?.checked === true;
  if(!fixedComplete && !timedAdvance) return;
  if(current.matches('input:not([type="checkbox"]):not([type="radio"]), textarea') && !current.value.trim()) return;
  const seconds = Number(String(document.getElementById("dataEntryAdvanceSeconds")?.value || "1.5").replace(",", "."));
  const configuredDelay = Math.round(Math.min(Math.max(Number.isFinite(seconds) ? seconds : 1.5, .5), 5) * 1000);
  const phoneSeconds = Number(String(document.getElementById("phoneToIdentityDelaySeconds")?.value || "2").replace(",", "."));
  const phoneDelay = Math.round(Math.min(Math.max(Number.isFinite(phoneSeconds) ? phoneSeconds : 2, .2), 10) * 1000);
  // Ten digits can be either a complete phone number or the prefix of a 12-digit CCCD.
  // Keep a grace period so fast typing/pasting CCCD cannot move focus after digit 10.
  const delay = fixedComplete
    ? (current.id === "contactPhone" ? phoneDelay : 120)
    : configuredDelay;
  dataEntryAdvanceTimer = setTimeout(() => {
    // A delayed timer from the previous field must never steal focus after the
    // user has already moved to (and started entering) the next field.
    if(document.activeElement !== current) return;
    if(current.id === "birthDate") {
      const previous = current.value;
      current.value = formatBirthDateForCommit(current.value);
      if(current.value !== previous) {
        if(birthYearWasAutoCompleted(previous, current.value)) markAutoAdjusted(current);
        scheduleExistingPatientPreview();
      }
    }
    if(EARLY_VALIDATION_IDS.includes(current.id)) {
      const message = earlyValidationMessage(current.id);
      const warningOnly = String(message).startsWith("Cảnh báo:");
      if(message && !warningOnly) {
        earlyValidationStarted = true;
        earlyValidationTouched.add(current.id);
        setEarlyValidationMessage(current.id, message, true);
        current.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
        current.focus({preventScroll:true});
        return;
      }
      setEarlyValidationMessage(current.id, "", true);
    }
    saveData();
    focusNextDataEntry(current);
  }, delay);
}

function setStatus(text, type = "")
{
  const status = document.getElementById("status");
  status.textContent = text;
  status.className = type;
}

function hideExistingPatientToast()
{
  clearTimeout(existingPatientToastTimer);
  const toast = document.getElementById("existingPatientToast");
  if(toast) {
    toast.hidden = true;
    toast.replaceChildren();
    toast.className = "existing-patient-toast";
  }
}

function clampExistingPatientWidgetPosition(position)
{
  const widget = document.getElementById("existingPatientWidget");
  const width = widget?.offsetWidth || 36;
  const height = widget?.offsetHeight || 36;
  const padding = 6;
  const left = Number(position?.left);
  const top = Number(position?.top);
  return {
    left:Math.min(Math.max(Number.isFinite(left) ? left : innerWidth - width - 48, padding), Math.max(padding, innerWidth - width - padding)),
    top:Math.min(Math.max(Number.isFinite(top) ? top : 10, padding), Math.max(padding, innerHeight - height - padding))
  };
}

function applyExistingPatientWidgetPosition(position)
{
  const widget = document.getElementById("existingPatientWidget");
  if(!widget) return;
  const next = clampExistingPatientWidgetPosition(position);
  widget.style.left = `${next.left}px`;
  widget.style.top = `${next.top}px`;
  widget.style.right = "auto";
}

function positionExistingPatientToast()
{
  const widget = document.getElementById("existingPatientWidget");
  const toast = document.getElementById("existingPatientToast");
  if(!widget || !toast || toast.hidden) return;
  const widgetRect = widget.getBoundingClientRect();
  const viewportPadding = 8;
  const gap = 8;
  const width = Math.max(220, Math.min(390, innerWidth - viewportPadding * 2));
  toast.style.width = `${width}px`;
  let left = Math.min(Math.max(widgetRect.left, viewportPadding), innerWidth - width - viewportPadding);
  let top = widgetRect.bottom + gap;
  const height = toast.offsetHeight;
  if(top + height > innerHeight - viewportPadding)
    top = Math.max(viewportPadding, widgetRect.top - height - gap);
  toast.style.left = `${left}px`;
  toast.style.top = `${top}px`;
}

function setupExistingPatientWidgetDrag(savedPosition)
{
  const widget = document.getElementById("existingPatientWidget");
  if(!widget) return;
  if(savedPosition && Number.isFinite(Number(savedPosition.left)) && Number.isFinite(Number(savedPosition.top)))
    applyExistingPatientWidgetPosition(savedPosition);

  let drag = null;
  widget.addEventListener("pointerdown", event => {
    const handle = event.target.closest(".existing-patient-indicator, .existing-patient-toast-head");
    if(!handle || event.button !== 0) return;
    const rect = widget.getBoundingClientRect();
    drag = {
      pointerId:event.pointerId,
      startX:event.clientX,
      startY:event.clientY,
      startLeft:rect.left,
      startTop:rect.top,
      moved:false
    };
    handle.setPointerCapture?.(event.pointerId);
    widget.classList.add("is-dragging");
  });
  widget.addEventListener("pointermove", event => {
    if(!drag || event.pointerId !== drag.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if(!drag.moved && Math.hypot(deltaX, deltaY) < 4) return;
    drag.moved = true;
    event.preventDefault();
    applyExistingPatientWidgetPosition({left:drag.startLeft + deltaX, top:drag.startTop + deltaY});
    positionExistingPatientToast();
  });
  const finishDrag = async event => {
    if(!drag || event.pointerId !== drag.pointerId) return;
    const moved = drag.moved;
    drag = null;
    widget.classList.remove("is-dragging");
    if(!moved) return;
    suppressExistingPatientWidgetClick = true;
    const rect = widget.getBoundingClientRect();
    setTimeout(() => { suppressExistingPatientWidgetClick = false; }, 120);
    await chrome.storage.local.set({
      receptionExistingPatientWidgetPosition:{left:Math.round(rect.left), top:Math.round(rect.top)}
    });
  };
  widget.addEventListener("pointerup", finishDrag);
  widget.addEventListener("pointercancel", finishDrag);
  window.addEventListener("resize", () => {
    const rect = widget.getBoundingClientRect();
    applyExistingPatientWidgetPosition({left:rect.left, top:rect.top});
    positionExistingPatientToast();
  });
}

function showExistingPatientCard({title, type = "", details = null, startExpanded = false})
{
  clearTimeout(existingPatientToastTimer);
  const toast = document.getElementById("existingPatientToast");
  toast.className = `existing-patient-toast${type ? ` ${type}` : ""}`;
  toast.replaceChildren();

  const header = document.createElement("button");
  header.type = "button";
  header.className = "existing-patient-toast-head";
  header.setAttribute("aria-expanded", "false");
  const titleNode = document.createElement("span");
  titleNode.className = "existing-patient-toast-title";
  titleNode.textContent = title;
  const arrow = document.createElement("span");
  arrow.className = "existing-patient-toast-arrow";
  arrow.textContent = details ? "Mở rộng" : "";
  header.append(titleNode, arrow);
  toast.appendChild(header);

  let body = null;
  if(details) {
    body = document.createElement("div");
    body.className = "existing-patient-toast-body";
    body.hidden = !startExpanded;
    details(body);
    toast.appendChild(body);
    toast.classList.toggle("is-expanded", startExpanded);
    header.setAttribute("aria-expanded", String(startExpanded));
    arrow.textContent = startExpanded ? "Ẩn" : "Mở rộng";
    header.addEventListener("click", () => {
      if(suppressExistingPatientWidgetClick) return;
      const expanded = body.hidden;
      body.hidden = !expanded;
      toast.classList.toggle("is-expanded", expanded);
      header.setAttribute("aria-expanded", String(expanded));
      arrow.textContent = expanded ? "Ẩn" : "Mở rộng";
      clearTimeout(existingPatientToastTimer);
      requestAnimationFrame(positionExistingPatientToast);
    });
  }

  const close = document.createElement("button");
  close.type = "button";
  close.className = "existing-patient-toast-close";
  close.textContent = "×";
  close.title = "Đóng thông báo";
  close.setAttribute("aria-label", close.title);
  close.addEventListener("click", event => {
    event.stopPropagation();
    hideExistingPatientToast();
  });
  toast.appendChild(close);
  toast.hidden = false;
  requestAnimationFrame(positionExistingPatientToast);
}

function setExistingPatientIndicator(state, title)
{
  const indicator = document.getElementById("existingPatientIndicator");
  if(!indicator) return;
  indicator.className = `existing-patient-indicator is-${state}`;
  indicator.textContent = state === "identity-match" ? "Trùng CCCD" : state === "warning" ? "Trùng hồ sơ" :
    state === "error" ? "Lỗi" : state === "clear" ? "Không trùng" :
    state === "checking" ? "Đang kiểm tra" : "Chưa kiểm tra";
  const retryHint = ["idle", "error", "clear"].includes(state) ? " · Bấm để kiểm tra lại" : "";
  indicator.title = `${title}${retryHint}`;
  indicator.setAttribute("aria-label", `${title}${retryHint}`);
  if(window.self !== window.top) window.parent.postMessage({
    type:"receptionExistingPatientStatus",
    state,
    title,
    matches:lastExistingPatientMatches,
    data:lastExistingPatientPreviewData,
    error:lastExistingPatientPreviewError
  }, "*");
}

function showExistingPatientToast(text, type = "", detailText = "")
{
  showExistingPatientCard({
    title:text,
    type,
    details:detailText ? body => {
      const paragraph = document.createElement("p");
      paragraph.textContent = detailText;
      body.appendChild(paragraph);
    } : null
  });
}

function formatPatientDetailDate(value)
{
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const digits = text.replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}` : text;
}

const EARLY_VALIDATION_IDS = [
  "fullName", "birthDate", "identity", "contactPhone", "companionIdentity",
  "location", "existingPatientFromDate", "existingPatientToDate",
  "temperature", "pulse", "respiratoryRate", "lengthCm", "weightKg",
  "headCircumferenceCm", "armCircumferenceMm"
];

function earlyValidationMessage(id)
{
  const element = document.getElementById(id);
  const value = String(element?.value || "").trim();
  if(id === "fullName") return value ? "" : "Chưa nhập họ tên người khám.";
  if(id === "birthDate") {
    if(!value) return "Chưa nhập ngày sinh.";
    const digits = birthDateDigits(value);
    if(!/^\d{8}$/.test(digits)) return "Ngày sinh chưa đúng định dạng.";
    const day = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const year = Number(digits.slice(4));
    const date = new Date(year, month - 1, day);
    if(date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
      return "Ngày sinh không hợp lệ.";
    const today = new Date();
    const sixthBirthday = new Date(year + 6, month - 1, day);
    if(sixthBirthday <= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
      return "Cảnh báo: trẻ đã đủ 6 tuổi, không còn thuộc nhóm dưới 6 tuổi.";
    return "";
  }
  if(id === "identity") {
    if(!value) return "";
    if(!/^\d{12}$/.test(value.replace(/\D/g, ""))) return "CCCD cần đủ 12 chữ số.";
    return identityGenderWarning();
  }
  if(id === "contactPhone") return !value || /^\d{10}$/.test(value.replace(/\D/g, "")) ? "" : "Số điện thoại cần đủ 10 chữ số.";
  if(id === "companionIdentity") {
    if(!value) return "";
    if(!/^\d{12}$/.test(value.replace(/\D/g, ""))) return "CCCD người đi cùng cần đủ 12 chữ số.";
    return companionIdentityGenderWarning();
  }
  if(id === "location")
    return element.dataset.selectedLabel && element.dataset.selectedLabel === value ? "" : "Chưa chọn Tỉnh/Xã từ danh sách gợi ý.";
  if(id === "existingPatientFromDate" || id === "existingPatientToDate") {
    if(!document.getElementById("checkExistingPatient")?.checked) return "";
    if(!value) return id === "existingPatientFromDate" ? "Chưa nhập Từ ngày." : "Chưa nhập Đến ngày.";
    if(!parseConfigDateToIso(value)) return "Ngày kiểm tra không hợp lệ.";
    const from = parseConfigDateToIso(document.getElementById("existingPatientFromDate").value);
    const to = parseConfigDateToIso(document.getElementById("existingPatientToDate").value);
    if(from && to && from > to) return id === "existingPatientFromDate"
      ? "Từ ngày không được sau Đến ngày." : "Đến ngày không được trước Từ ngày.";
    return "";
  }
  if(["temperature", "pulse", "respiratoryRate", "lengthCm", "weightKg", "headCircumferenceCm", "armCircumferenceMm"].includes(id))
    return !value || /^\d+(?:[.,]\d+)?$/.test(value.replace(/\s+/g, "")) ? "" : "Cần nhập một số hợp lệ.";
  return "";
}

function setEarlyValidationMessage(id, message, force = false)
{
  const element = document.getElementById(id);
  if(!element) return;
  const host = element.closest("label") || element.parentElement;
  let note = host?.querySelector(`:scope > .field-validation-error[data-field="${id}"]`);
  if(!force && document.activeElement === element) message = "";
  const warning = String(message || "").startsWith("Cảnh báo:");
  element.classList.toggle("invalid", !!message && !warning);
  element.classList.toggle("validation-warning", warning);
  element.setAttribute("aria-invalid", String(!!message && !warning));
  if(!message) {
    note?.remove();
    return;
  }
  if(!note) {
    note = document.createElement("span");
    note.className = "field-validation-error";
    note.dataset.field = id;
    host?.appendChild(note);
  }
  note.textContent = message;
  note.classList.toggle("is-warning", warning);
}

function validateFieldsEarly(force = false)
{
  if(!earlyValidationStarted && !force) return;
  EARLY_VALIDATION_IDS.forEach(id => {
    if(force || earlyValidationRevealAll || earlyValidationTouched.has(id))
      setEarlyValidationMessage(id, earlyValidationMessage(id), force);
  });
}

function scheduleEarlyValidation(delay = 350)
{
  clearTimeout(earlyValidationTimer);
  earlyValidationTimer = setTimeout(() => validateFieldsEarly(false), delay);
}

function normalizedIdentity(value)
{
  return String(value || "").replace(/\D/g, "");
}

function markIdentityMatches(matches, data)
{
  const currentIdentity = normalizedIdentity(data?.identity);
  return (matches || []).map(patient => ({
    ...patient,
    identityMatch:currentIdentity.length === 12 &&
      normalizedIdentity(patient?.identity) === currentIdentity
  }));
}

function normalizedComparableText(value)
{
  return String(value || "").normalize("NFC").replace(/\s+/g, " ").trim().toLocaleUpperCase("vi-VN");
}

function updateDuplicateFieldHighlights(matches, data)
{
  document.querySelectorAll(".duplicate-match").forEach(element => element.classList.remove("duplicate-match"));
  if(!matches?.length) return;
  for(const id of ["fullName", "birthDate", "gender"])
    document.getElementById(id)?.classList.add("duplicate-match");
  if(hasIdentityMatch(matches)) document.getElementById("identity")?.classList.add("duplicate-match");
  const currentPhone = String(data?.contactPhone || "").replace(/\D/g, "");
  if(currentPhone && matches.some(patient => String(patient?.guardianPhone || "").replace(/\D/g, "") === currentPhone))
    document.getElementById("contactPhone")?.classList.add("duplicate-match");
  const guardian = normalizedComparableText(data?.guardianName);
  if(guardian && matches.some(patient => normalizedComparableText(patient?.guardianName) === guardian))
    document.getElementById("guardianName")?.classList.add("duplicate-match");
  const ethnicity = normalizedComparableText(String(data?.ethnicity || "").replace(/^\d+\s*-\s*/, ""));
  if(ethnicity && matches.some(patient => normalizedComparableText(patient?.ethnicity) === ethnicity))
    document.getElementById("ethnicity")?.classList.add("duplicate-match");
  const addressDetail = normalizedComparableText(data?.addressDetail);
  if(addressDetail && matches.some(patient => normalizedComparableText(patient?.address).includes(addressDetail)))
    document.getElementById("addressDetail")?.classList.add("duplicate-match");
}

function hasIdentityMatch(matches)
{
  return (matches || []).some(patient => patient.identityMatch === true);
}

function addPatientDetailRow(list, label, value, className = "")
{
  const text = String(value || "").trim();
  if(!text) return;
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = text;
  if(className) {
    term.classList.add(className);
    description.classList.add(className);
  }
  const divider = document.createElement("hr");
  list.append(term, description, divider);
}

function showExistingPatientMatches(matches, data)
{
  const exactIdentity = hasIdentityMatch(matches);
  showExistingPatientCard({
    title:exactIdentity ? "Trùng CCCD" : "Phát hiện trùng",
    type:exactIdentity ? "error" : "warning",
    startExpanded:true,
    details:body => {
      const list = document.createElement("div");
      list.className = "existing-patient-result-list";
      const range = document.createElement("div");
      range.className = "existing-patient-date-range";
      range.textContent = `${formatPatientDetailDate(data.existingPatientFromDate)} – ${formatPatientDetailDate(data.existingPatientToDate)}`;
      body.appendChild(range);
      matches.forEach((patient, index) => {
        const item = document.createElement("details");
        item.className = `existing-patient-result${patient.identityMatch ? " identity-match" : ""}`;
        const summary = document.createElement("summary");
        summary.textContent = `${index + 1}. ${patient.fullName || data.fullName} · ${formatPatientDetailDate(patient.birthDate || data.birthDate)} · ${patient.gender || data.gender}${patient.identityMatch ? " · CCCD TRÙNG" : ""}`;
        const info = document.createElement("dl");
        addPatientDetailRow(info, patient.identityMatch ? "CCCD TRÙNG" : "CCCD", patient.identity,
          patient.identityMatch ? "identity-match-value" : "");
        addPatientDetailRow(info, "Mã bệnh nhân", patient.patientCode);
        addPatientDetailRow(info, "Tiếp nhận ID", patient.tiepNhanId);
        addPatientDetailRow(info, "Ngày tiếp nhận", formatPatientDetailDate(patient.receptionDate));
        addPatientDetailRow(info, "Mã bệnh án", patient.medicalRecordCode);
        addPatientDetailRow(info, "Dân tộc", patient.ethnicity);
        addPatientDetailRow(info, "Địa chỉ", patient.address);
        addPatientDetailRow(info, "Người thân", patient.guardianName);
        addPatientDetailRow(info, "SĐT người thân", patient.guardianPhone);
        addPatientDetailRow(info, "Phòng", patient.roomName);
        if(patient.detailError) addPatientDetailRow(info, "Lỗi lấy chi tiết", patient.detailError);
        item.append(summary, info);
        item.addEventListener("toggle", () => {
          if(item.open) clearTimeout(existingPatientToastTimer);
          requestAnimationFrame(positionExistingPatientToast);
        });
        list.appendChild(item);
      });
      body.appendChild(list);
    }
  });
}

function existingPatientPreviewKey(data)
{
  if(!data.checkExistingPatient || !data.fullName || !/^\d{8}$/.test(data.birthDate) ||
    !data.gender || !data.existingPatientFromDate || !data.existingPatientToDate ||
    data.existingPatientFromDate > data.existingPatientToDate) return "";
  return JSON.stringify([
    data.fullName.trim().toLocaleUpperCase("vi-VN"), data.birthDate, data.gender,
    data.identity, data.existingPatientFromDate, data.existingPatientToDate
  ]);
}

function scheduleExistingPatientPreview(force = false)
{
  clearTimeout(existingPatientPreviewTimer);
  const revision = ++existingPatientPreviewRevision;
  const data = getData();
  const key = existingPatientPreviewKey(data);
  if(force) lastExistingPatientPreviewKey = "";
  if(!key) {
    lastExistingPatientPreviewKey = "";
    lastExistingPatientMatches = [];
    lastExistingPatientPreviewData = null;
    lastExistingPatientPreviewError = "";
    updateDuplicateFieldHighlights([], data);
    hideExistingPatientToast();
    setExistingPatientIndicator("idle", data.checkExistingPatient
      ? "Nhập đủ Tên, Ngày sinh và Giới tính để kiểm tra"
      : "Tùy chọn kiểm tra bệnh nhân đang tắt");
    return;
  }
  if(key === lastExistingPatientPreviewKey) return;
  hideExistingPatientToast();
  updateDuplicateFieldHighlights([], data);
  lastExistingPatientMatches = [];
  lastExistingPatientPreviewData = data;
  lastExistingPatientPreviewError = "";
  setExistingPatientIndicator("checking", "Đang kiểm tra bệnh nhân đã tiếp nhận…");
  existingPatientPreviewTimer = setTimeout(async () => {
    if(revision !== existingPatientPreviewRevision) return;
    lastExistingPatientPreviewKey = key;
    try {
      const response = await messageActiveTab({action:"checkExistingPatientPreview", data});
      if(revision !== existingPatientPreviewRevision) return;
      if(response?.notReception) {
        setExistingPatientIndicator("idle", "Kiểm tra tự động chỉ chạy tại form Tiếp nhận");
        return;
      }
      if(!response?.ok) {
        lastExistingPatientPreviewError = response?.error || "API không phản hồi.";
        setExistingPatientIndicator("error", "Không kiểm tra được bệnh nhân — bấm để xem lỗi");
        return;
      }
      const matches = markIdentityMatches(Array.isArray(response.matches) ? response.matches : [], data);
      lastExistingPatientMatches = matches;
      updateDuplicateFieldHighlights(matches, data);
      if(hasIdentityMatch(matches)) {
        setExistingPatientIndicator("identity-match", "CCCD đã tồn tại trong hồ sơ trùng");
      } else if(matches.length) {
        setExistingPatientIndicator("warning", "Phát hiện trùng");
      } else {
        setExistingPatientIndicator("clear", "Đã kiểm tra: chưa thấy bệnh nhân trùng");
      }
    } catch(error) {
      if(revision === existingPatientPreviewRevision) {
        updateDuplicateFieldHighlights([], data);
        lastExistingPatientPreviewError = error.message;
        setExistingPatientIndicator("error", "Không kiểm tra được bệnh nhân — bấm để xem lỗi");
      }
    }
  }, force ? 0 : 500);
}

function validate(data)
{
  earlyValidationStarted = true;
  earlyValidationRevealAll = true;
  validateFieldsEarly(true);
  const identity = document.getElementById("identity");
  const contactPhone = document.getElementById("contactPhone");
  const birthDate = document.getElementById("birthDate");
  const companionIdentity = document.getElementById("companionIdentity");
  identity.classList.toggle("invalid", !!data.identity && !/^\d{12}$/.test(data.identity));
  contactPhone.classList.toggle("invalid", !!data.contactPhone && !/^\d{10}$/.test(data.contactPhone));
  birthDate.classList.toggle("invalid", !!data.birthDate && !/^\d{8}$/.test(data.birthDate));
  companionIdentity.classList.toggle("invalid", !!data.companionIdentity && !/^\d{12}$/.test(data.companionIdentity));
  if(data.identity && !/^\d{12}$/.test(data.identity)) return "CCCD cần đủ 12 chữ số.";
  if(data.contactPhone && !/^\d{10}$/.test(data.contactPhone)) return "Số điện thoại cần đủ 10 chữ số.";
  if(data.birthDate && !/^\d{8}$/.test(data.birthDate)) return "Ngày sinh cần đủ 8 chữ số theo dạng ddmmyyyy.";
  if(data.companionIdentity && !/^\d{12}$/.test(data.companionIdentity)) return "CCCD người đi cùng trẻ cần đủ 12 chữ số.";
  const abnormalConclusion = data.healthConclusionTuberculosisRisk || data.healthConclusionProblem;
  const conclusionReason = document.getElementById("healthConclusionReason");
  conclusionReason.classList.toggle("invalid", abnormalConclusion && !data.healthConclusionReason);
  if(abnormalConclusion && !data.healthConclusionReason)
    return "Kết luận không bình thường cần nhập Lý do/Ghi rõ.";
  if(data.checkExistingPatient) {
    if(!data.fullName) return "Cần nhập họ tên để kiểm tra bệnh nhân đã tiếp nhận.";
    if(!/^\d{8}$/.test(data.birthDate)) return "Cần nhập ngày sinh đủ 8 số để kiểm tra bệnh nhân đã tiếp nhận.";
    if(!data.existingPatientFromDate || !data.existingPatientToDate)
      return "Hãy chọn đủ Từ ngày và Đến ngày để kiểm tra bệnh nhân.";
    if(data.existingPatientFromDate > data.existingPatientToDate)
      return "Từ ngày kiểm tra không được sau Đến ngày.";
  }
  document.getElementById("admissionReason").classList.toggle("invalid", !data.admissionReason);
  if(!data.admissionReason) return "Hãy cấu hình Lý do vào viện để Auto nhập trường mới.";
  const fieldDelaySeconds = Number(String(data.fieldDelaySeconds || "").replace(",", "."));
  document.getElementById("fieldDelaySeconds").classList.toggle("invalid",
    !Number.isFinite(fieldDelaySeconds) || fieldDelaySeconds < .1 || fieldDelaySeconds > 5);
  if(!Number.isFinite(fieldDelaySeconds) || fieldDelaySeconds < .1 || fieldDelaySeconds > 5)
    return "Thời gian hiển thị mỗi ô khi Autofill cần từ 0,1 đến 5 giây.";
  const dataEntryAdvanceSeconds = Number(String(data.dataEntryAdvanceSeconds || "").replace(",", "."));
  document.getElementById("dataEntryAdvanceSeconds").classList.toggle("invalid",
    !Number.isFinite(dataEntryAdvanceSeconds) || dataEntryAdvanceSeconds < .5 || dataEntryAdvanceSeconds > 5);
  if(!Number.isFinite(dataEntryAdvanceSeconds) || dataEntryAdvanceSeconds < .5 || dataEntryAdvanceSeconds > 5)
    return "Thời gian tự chuyển ô nhập dữ liệu cần từ 0,5 đến 5 giây.";
  const phoneToIdentityDelaySeconds = Number(String(data.phoneToIdentityDelaySeconds || "").replace(",", "."));
  document.getElementById("phoneToIdentityDelaySeconds").classList.toggle("invalid",
    !Number.isFinite(phoneToIdentityDelaySeconds) || phoneToIdentityDelaySeconds < .2 || phoneToIdentityDelaySeconds > 10);
  if(!Number.isFinite(phoneToIdentityDelaySeconds) || phoneToIdentityDelaySeconds < .2 || phoneToIdentityDelaySeconds > 10)
    return "Thời gian chuyển từ SĐT sang CCCD người giám hộ cần từ 0,2 đến 10 giây.";
  const locationInput = document.getElementById("location");
  const locationSelected = !!data.location && locationInput.dataset.selectedLabel === data.location;
  locationInput.classList.toggle("invalid", !locationSelected);
  if(!locationSelected) return "Hãy nhập và chọn Tỉnh/Xã trong danh sách gợi ý.";
  const numericFields = [
    ["temperature", "Nhiệt độ"],
    ["pulse", "Mạch"],
    ["respiratoryRate", "Nhịp thở"],
    ["lengthCm", "Chiều dài"],
    ["weightKg", "Cân nặng"],
    ["headCircumferenceCm", "Vòng đầu"],
    ["armCircumferenceMm", "Chu vi vòng cánh tay"]
  ];
  for(const [id, label] of numericFields) {
    const element = document.getElementById(id);
    const value = String(data[id] || "").replace(/\s+/g, "");
    const invalid = !!value && !/^\d+(?:[.,]\d+)?$/.test(value);
    element.classList.toggle("invalid", invalid);
    if(invalid) return `${label} phải là một số hợp lệ.`;
  }
  return "";
}

async function fullAutoBlockedByIdentityDuplicate(data)
{
  if(data.fullAutoWorkflow !== true || data.checkExistingPatient !== true ||
    normalizedIdentity(data.identity).length !== 12) return false;
  setStatus("Đang rà CCCD trước khi chạy Auto hoàn toàn…");
  const response = await messageActiveTab({action:"checkExistingPatientPreview", data});
  if(response?.notReception) return false;
  if(!response?.ok)
    throw new Error(response?.error || "Không rà được CCCD trước khi chạy Auto hoàn toàn.");
  const matches = markIdentityMatches(Array.isArray(response.matches) ? response.matches : [], data);
  lastExistingPatientPreviewKey = existingPatientPreviewKey(data);
  lastExistingPatientPreviewData = data;
  lastExistingPatientMatches = matches;
  lastExistingPatientPreviewError = "";
  if(hasIdentityMatch(matches)) {
    setExistingPatientIndicator("identity-match", "CCCD đã tồn tại — không thể chạy Auto hoàn toàn");
    showExistingPatientMatches(matches, data);
    setStatus("Đã trùng CCCD. Auto hoàn toàn không được phép chạy.", "error");
    return true;
  }
  setExistingPatientIndicator(matches.length ? "warning" : "clear",
    matches.length ? "Phát hiện hồ sơ cùng tên, ngày sinh và giới tính" : "Không thấy hồ sơ trùng");
  return false;
}

async function fillCurrentTab(fullAuto = false)
{
  const data = {
    ...getData(),
    fullAutoWorkflow:fullAuto === true
  };
  const validationError = validate(data);
  if(validationError) {
    setStatus(validationError, "error");
    return;
  }
  if(fullAuto) {
    const running = await chrome.storage.local.get("receptionFullAutoWorkflow");
    if(running.receptionFullAutoWorkflow?.active === true) {
      setStatus("Vòng Auto trước vẫn đang chạy. Bạn có thể tiếp tục nhập người mới, nhưng chỉ chạy vòng tiếp theo sau khi đã quay về form Tiếp nhận.", "error");
      return;
    }
  }
  try {
    if(await fullAutoBlockedByIdentityDuplicate(data)) return;
  } catch(error) {
    setStatus(error.message, "error");
    return;
  }

  const fillButton = document.getElementById("fill");
  const fullAutoButton = document.getElementById("fillFullAuto");
  fillButton.disabled = true;
  fullAutoButton.disabled = true;
  let completed = false;
  setStatus("Đang điền dữ liệu…");
  await chrome.storage.local.set({receptionAutofillData:data});
  try {
    const tabId = await receptionHostTabId();
    await chrome.tabs.sendMessage(tabId, {action:"hideFloatingDuringFill"}).catch(() => {});
    const response = await chrome.tabs.sendMessage(tabId, {
      action:"fillReceptionForm",
      data
    });
    if(!response?.ok) {
      setStatus(response?.error || "Không tìm thấy form tiếp nhận.", "error");
      return;
    }
    const parts = [`Đã điền ${response.filled.length} trường`];
    if(response.skipped.length) parts.push(`bỏ qua ${response.skipped.length} trường đã có dữ liệu`);
    if(response.failed.length) parts.push(`chưa chọn được: ${response.failed.join(", ")}`);
    if(data.fullAutoWorkflow) {
      const started = await chrome.tabs.sendMessage(tabId, {
        action:"startFullAutoWorkflow",
        data
      });
      if(!started?.ok) {
        setStatus(started?.error || "Không khởi động được Auto hoàn toàn.", "error");
        return;
      }
      await chrome.tabs.sendMessage(tabId, {action:"showFloatingAfterFill"}).catch(() => {});
      focusFirstDataEntry();
      parts.push("Auto đang chạy bằng dữ liệu đã chụp; bạn có thể nhập người kế tiếp ngay trong panel");
    }
    setStatus(parts.join(" · "), response.failed.length ? "error" : "success");
    completed = true;
  } catch(error) {
    setStatus(`${error.message} Hãy tải lại trang sau khi cài extension.`, "error");
  } finally {
    fillButton.disabled = false;
    fullAutoButton.disabled = false;
    if(!completed) messageActiveTab({action:"restoreFloatingAfterFailedFill"}).catch(() => {});
  }
}

const PRESERVED_CONFIG_KEYS = [
  "overwrite", "autoOpenHealthAfterSave", "autoGenderFromIdentity", "autoBirthYearFromIdentity", "checkExistingPatient",
  "existingPatientFromDate", "existingPatientToDate", "fieldDelaySeconds",
  "admissionReason", "frequentLocationLimit", "capitalizeAddress", "addressUppercaseRules", "showGuidance",
  "autoAdvanceDataEntry", "autoAdvanceFixedLength", "dataEntryAdvanceSeconds", "phoneToIdentityDelaySeconds",
  "fullAutoHotkey"
];

function nextPatientData(currentData)
{
  const source = {...DEFAULT_DATA, ...(currentData || {})};
  const preservedConfig = Object.fromEntries(PRESERVED_CONFIG_KEYS.map(key => [key, source[key]]));
  preservedConfig.existingPatientToDate = todayDateInputValue();
  return lockedLocationData({...DEFAULT_DATA, ...preservedConfig});
}

async function clearData()
{
  const currentData = getData();
  currentData.existingPatientFromDate = document.getElementById("existingPatientFromDate").value;
  const clearedData = nextPatientData(currentData);
  clearTimeout(dataEntryAdvanceTimer);
  clearTimeout(existingPatientPreviewTimer);
  existingPatientPreviewRevision += 1;
  lastExistingPatientPreviewKey = "";
  lastExistingPatientMatches = [];
  lastExistingPatientPreviewData = null;
  lastExistingPatientPreviewError = "";
  hideExistingPatientToast();
  setExistingPatientIndicator("idle", "Tùy chọn kiểm tra bệnh nhân đang tắt");
  setData(clearedData);
  clearTimeout(earlyValidationTimer);
  earlyValidationStarted = false;
  earlyValidationRevealAll = false;
  earlyValidationTouched.clear();
  EARLY_VALIDATION_IDS.forEach(id => setEarlyValidationMessage(id, "", true));
  await chrome.storage.local.set({receptionAutofillData:clearedData});
  renderLocationOptions([]);
  renderEthnicityOptions("Kinh");
  document.getElementById("ethnicitySuggestions").hidden = true;
  document.getElementById("ethnicity").setAttribute("aria-expanded", "false");
  setStatus("Đang làm mới dữ liệu…");
  try {
    const response = await messageActiveTab({action:"resetReceptionWorkflow"});
    setStatus(response?.navigated
      ? "Đã làm mới dữ liệu; đang quay về trang nhập thông tin…"
      : "Đã làm mới dữ liệu và giữ nguyên trang nhập hiện tại.", "success");
    if(!response?.navigated) focusFirstDataEntry();
  } catch(error) {
    setStatus(`${error.message} Hãy tự mở lại trang Tiếp nhận.`, "error");
  }
}

let locationSearchTimer = null;
let locationSearchRevision = 0;
let locationActiveIndex = -1;
let locationSuggestionMode = "search";
let locationHistory = [];
let lockedLocationLabel = "";
const LOCATION_RESULTS_IDLE_MS = 350;
const LOCATION_HISTORY_KEY = "receptionLocationHistory";
const LOCATION_LOCK_KEY = "receptionLockedLocation";
let ethnicityOptions = [];
let ethnicityCatalogLoading = null;
let ethnicityActiveIndex = -1;

function defaultEthnicityLabel()
{
  return ethnicityOptions.find(label =>
    label.replace(/^\d+\s*-\s*/, "").trim().toLocaleLowerCase("vi-VN") === "kinh"
  ) || "Kinh";
}

function restoreDefaultEthnicity()
{
  const input = document.getElementById("ethnicity");
  if(!input || input.value.trim()) return false;
  const label = defaultEthnicityLabel();
  input.dataset.selectedLabel = label;
  input.value = "Kinh";
  markAutoAdjusted(input);
  saveData();
  return true;
}

async function messageActiveTab(message)
{
  const tabId = await receptionHostTabId();
  return chrome.tabs.sendMessage(tabId, message);
}

function normalizeLocationHistory(value)
{
  const merged = new Map();
  (Array.isArray(value) ? value : []).forEach((item, index) => {
    const label = String(typeof item === "string" ? item : item?.label || "").replace(/\s+/g, " ").trim();
    if(!label) return;
    const key = label.toLocaleLowerCase("vi-VN");
    const current = merged.get(key) || {label, count:0, lastUsed:0};
    current.count += Math.max(1, Number(typeof item === "string" ? 1 : item?.count) || 1);
    current.lastUsed = Math.max(current.lastUsed, Number(item?.lastUsed) || index);
    merged.set(key, current);
  });
  return [...merged.values()]
    .sort((left, right) => right.count - left.count || right.lastUsed - left.lastUsed || left.label.localeCompare(right.label, "vi"))
    .slice(0, 30);
}

function frequentLocationOptions()
{
  const configured = Number.parseInt(document.getElementById("frequentLocationLimit")?.value, 10);
  const limit = Math.min(10, Math.max(1, Number.isFinite(configured) ? configured : 5));
  const ordered = [...locationHistory];
  const lockedIndex = ordered.findIndex(item => sameLocationLabel(item.label, lockedLocationLabel));
  if(lockedIndex > 0) ordered.unshift(ordered.splice(lockedIndex, 1)[0]);
  return ordered.slice(0, limit).map(item => ({...item}));
}

function sameLocationLabel(left, right)
{
  return !!String(left || "").trim() &&
    String(left || "").trim().localeCompare(String(right || "").trim(), "vi", {sensitivity:"accent"}) === 0;
}

function shortLocationLabel(label)
{
  const parts = String(label || "").split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  const ward = parts.find(part => /^(?:phường|xã|thị\s+trấn)(?:\s|$)/iu.test(part));
  const province = parts.find(part => /^tỉnh(?:\s|$)/iu.test(part)) ||
    [...parts].reverse().find(part => /^thành\s+phố(?:\s|$)/iu.test(part));
  if(ward && province) return `${ward} — ${province}`;
  return ward || province || String(label || "").trim();
}

function lockedLocationData(base)
{
  if(!lockedLocationLabel) return base;
  return {
    ...base,
    location:lockedLocationLabel,
    locationDraft:lockedLocationLabel,
    locationQuery:lockedLocationLabel.split(" - ")[0],
    locationAutoLocked:true
  };
}

function applyLockedLocationToEmptyInput()
{
  if(!lockedLocationLabel) return;
  const input = document.getElementById("location");
  if(!input || input.value.trim()) return;
  input.value = lockedLocationLabel;
  input.dataset.selectedLabel = lockedLocationLabel;
  input.dataset.query = lockedLocationLabel.split(" - ")[0];
  input.dataset.autoLocked = "true";
  input.dataset.autoSelectPending = "true";
  input.dataset.autoCommitted = "false";
  input.classList.remove("invalid");
  markAutoAdjusted(input);
  saveData();
}

async function toggleLockedLocation(label)
{
  lockedLocationLabel = sameLocationLabel(lockedLocationLabel, label) ? "" : String(label || "").trim();
  await chrome.storage.local.set({[LOCATION_LOCK_KEY]:lockedLocationLabel});
  applyLockedLocationToEmptyInput();
  showFrequentLocations();
  setStatus(lockedLocationLabel
    ? `Đã khóa địa chỉ mặc định: ${shortLocationLabel(lockedLocationLabel)}.`
    : "Đã bỏ khóa địa chỉ mặc định.", "success");
}

async function removeLocationSuggestion(label)
{
  const latest = await chrome.storage.local.get([LOCATION_HISTORY_KEY, LOCATION_LOCK_KEY]);
  locationHistory = normalizeLocationHistory(latest[LOCATION_HISTORY_KEY])
    .filter(item => !sameLocationLabel(item.label, label));
  const latestLockedLocation = String(latest[LOCATION_LOCK_KEY] || "").trim();
  const removedLocked = sameLocationLabel(latestLockedLocation, label) ||
    sameLocationLabel(lockedLocationLabel, label);
  lockedLocationLabel = removedLocked ? "" : (latestLockedLocation || lockedLocationLabel);
  await chrome.storage.local.set({
    [LOCATION_HISTORY_KEY]:locationHistory,
    [LOCATION_LOCK_KEY]:lockedLocationLabel
  });
  if(removedLocked) {
    const input = document.getElementById("location");
    input.dataset.autoLocked = "false";
    input.dataset.autoSelectPending = "false";
    input.dataset.autoCommitted = "false";
    saveData();
  }
  showFrequentLocations();
  setStatus(`Đã xóa gợi ý: ${shortLocationLabel(label)}.`, "success");
}

async function applyLockedLocationOnPage()
{
  if(!lockedLocationLabel) return false;
  const focusBeforeApply = document.activeElement;
  try {
    const response = await messageActiveTab({action:"applyLockedLocation", label:lockedLocationLabel});
    if(response?.notReception) return false;
    if(!response?.ok) throw new Error(response?.error || "Không tự điền được địa chỉ đã khóa.");
    const input = document.getElementById("location");
    const selectedLabel = String(response.label || lockedLocationLabel).trim();
    input.value = selectedLabel;
    input.dataset.selectedLabel = selectedLabel;
    input.dataset.query = selectedLabel.split(" - ")[0];
    input.dataset.autoLocked = response.alreadyFilled && !response.locked ? "false" : "true";
    input.dataset.autoCommitted = "true";
    input.classList.remove("invalid");
    markAutoAdjusted(input);
    saveData();
    if(response.autoFilled)
      setStatus(`Đã tự điền địa chỉ đã khóa: ${shortLocationLabel(selectedLabel)}.`, "success");
    return true;
  } finally {
    const currentPanelFocus = document.activeElement;
    const restoreTarget = currentPanelFocus && currentPanelFocus !== document.body
      ? currentPanelFocus
      : focusBeforeApply;
    if(restoreTarget && restoreTarget !== document.body)
      requestAnimationFrame(() => restoreTarget.focus?.({preventScroll:true}));
  }
}

async function rememberLocation(label)
{
  const normalizedLabel = String(label || "").replace(/\s+/g, " ").trim();
  if(!normalizedLabel) return;
  const latest = await chrome.storage.local.get(LOCATION_HISTORY_KEY);
  locationHistory = normalizeLocationHistory(latest[LOCATION_HISTORY_KEY]);
  const key = normalizedLabel.toLocaleLowerCase("vi-VN");
  const existing = locationHistory.find(item => item.label.toLocaleLowerCase("vi-VN") === key);
  if(existing) {
    existing.count += 1;
    existing.lastUsed = Date.now();
  } else {
    locationHistory.push({label:normalizedLabel, count:1, lastUsed:Date.now()});
  }
  locationHistory = normalizeLocationHistory(locationHistory);
  await chrome.storage.local.set({[LOCATION_HISTORY_KEY]:locationHistory});
}

function showFrequentLocations()
{
  const options = frequentLocationOptions();
  renderLocationOptions(options, "frequent");
  return options.length > 0;
}

function renderLocationOptions(options, mode = "search")
{
  const container = document.getElementById("locationSuggestions");
  const input = document.getElementById("location");
  const uniqueMap = new Map();
  (options || []).forEach(item => {
    const label = String(typeof item === "string" ? item : item?.label || "").replace(/\s+/g, " ").trim();
    if(!label) return;
    const key = label.toLocaleLowerCase("vi-VN");
    if(!uniqueMap.has(key)) uniqueMap.set(key, {
      label,
      count:Math.max(0, Number(typeof item === "string" ? 0 : item?.count) || 0)
    });
  });
  const unique = [...uniqueMap.values()].slice(0, 10);
  locationSuggestionMode = mode;
  locationActiveIndex = unique.length ? Math.min(Math.max(locationActiveIndex, -1), unique.length - 1) : -1;
  container.replaceChildren();
  unique.forEach((item, index) => {
    const {label} = item;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "location-option";
    button.classList.toggle("is-frequent", mode === "frequent");
    button.id = `location-option-${index}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(index === locationActiveIndex));
    button.classList.toggle("is-active", index === locationActiveIndex);
    button.dataset.locationLabel = label;
    const number = document.createElement("span");
    number.className = "location-option-number";
    number.textContent = String(index === 9 ? 0 : index + 1);
    number.title = `Chọn nhanh bằng phím ${number.textContent}`;
    const text = document.createElement("span");
    text.className = "location-option-label";
    text.textContent = mode === "frequent" ? shortLocationLabel(label) : label;
    button.append(number, text);
    if(mode === "frequent") {
      const lock = document.createElement("span");
      const locked = sameLocationLabel(label, lockedLocationLabel);
      lock.className = "location-option-lock";
      lock.classList.toggle("is-locked", locked);
      lock.setAttribute("role", "button");
      lock.setAttribute("aria-label", locked ? "Bỏ khóa địa chỉ mặc định" : "Khóa làm địa chỉ mặc định");
      lock.title = lock.getAttribute("aria-label");
      lock.textContent = locked ? "Đã khóa" : "Khóa";
      lock.addEventListener("mousedown", event => {
        event.preventDefault();
        event.stopPropagation();
      });
      lock.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        toggleLockedLocation(label).catch(error => setStatus(error.message, "error"));
      });
      button.classList.toggle("is-locked", locked);
      button.appendChild(lock);
      const remove = document.createElement("span");
      remove.className = "location-option-remove";
      remove.setAttribute("role", "button");
      remove.setAttribute("aria-label", "Xóa khỏi địa chỉ thường dùng");
      remove.title = remove.getAttribute("aria-label");
      remove.textContent = "Xóa";
      remove.addEventListener("mousedown", event => {
        event.preventDefault();
        event.stopPropagation();
      });
      remove.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        removeLocationSuggestion(label).catch(error => setStatus(error.message, "error"));
      });
      button.appendChild(remove);
    }
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => chooseLocation(label,
      mode === "frequent" ? label.split(" - ")[0] : ""));
    container.appendChild(button);
  });
  container.hidden = unique.length === 0;
  input.setAttribute("aria-expanded", String(unique.length > 0));
  if(locationActiveIndex >= 0)
    input.setAttribute("aria-activedescendant", `location-option-${locationActiveIndex}`);
  else input.removeAttribute("aria-activedescendant");
}

function renderEthnicityOptions(query)
{
  const input = document.getElementById("ethnicity");
  const container = document.getElementById("ethnicitySuggestions");
  if(!input || !container) return;
  const normalized = String(query || "").trim().toLocaleLowerCase("vi-VN");
  const options = ethnicityOptions.filter(item =>
    !normalized || item.toLocaleLowerCase("vi-VN").includes(normalized)
  ).slice(0, 20);
  ethnicityActiveIndex = options.length ? Math.min(Math.max(ethnicityActiveIndex, -1), options.length - 1) : -1;
  container.replaceChildren();
  options.forEach((label, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = `ethnicity-option-${index}`;
    button.className = "location-option";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(index === ethnicityActiveIndex));
    button.classList.toggle("is-active", index === ethnicityActiveIndex);
    button.textContent = label;
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => chooseEthnicity(label).catch(error => setStatus(error.message, "error")));
    container.appendChild(button);
  });
  container.hidden = options.length === 0;
  input.setAttribute("aria-expanded", String(options.length > 0));
}

async function loadEthnicityCatalog(force = false)
{
  if(ethnicityOptions.length && !force) return ethnicityOptions;
  if(ethnicityCatalogLoading && !force) return ethnicityCatalogLoading;
  ethnicityCatalogLoading = (async () => {
    setStatus("Đang đọc toàn bộ danh mục Dân tộc từ HMIS…");
    const response = await messageActiveTab({action:"readAllEthnicityOptions", force});
    if(!response?.ok) throw new Error(response?.error || "Không đọc được danh mục Dân tộc từ HMIS.");
    ethnicityOptions = Array.isArray(response.options) ? response.options : [];
    if(!ethnicityOptions.length) throw new Error("HMIS không trả về danh mục Dân tộc.");
    const input = document.getElementById("ethnicity");
    const current = String(input.value || "Kinh").trim();
    const currentName = current.replace(/^\d+\s*-\s*/, "");
    const exact = ethnicityOptions.find(label =>
      label.replace(/^\d+\s*-\s*/, "").toLocaleLowerCase("vi-VN") === currentName.toLocaleLowerCase("vi-VN")
    );
    if(exact) {
      input.dataset.selectedLabel = exact;
      input.value = exact.replace(/^\d+\s*-\s*/, "") || "Kinh";
    }
    renderEthnicityOptions(input.value);
    saveData();
    setStatus(`Đã lấy ${ethnicityOptions.length} dân tộc trực tiếp từ HMIS.`, "success");
    return ethnicityOptions;
  })().finally(() => { ethnicityCatalogLoading = null; });
  return ethnicityCatalogLoading;
}

async function chooseEthnicity(label)
{
  const input = document.getElementById("ethnicity");
  const selected = String(label || "").trim();
  if(!selected) return;
  setStatus("Đang chọn Dân tộc trên form HMIS…");
  const response = await messageActiveTab({
    action:"selectEthnicityOption",
    label:selected,
    query:selected.replace(/^\d+\s*-\s*/, "")
  });
  if(!response?.ok) throw new Error(response?.error || "Không chọn được Dân tộc trên HMIS.");
  input.dataset.selectedLabel = response.label || selected;
  input.value = input.dataset.selectedLabel.replace(/^\d+\s*-\s*/, "") || "Kinh";
  ethnicityActiveIndex = -1;
  renderEthnicityOptions("");
  document.getElementById("ethnicitySuggestions").hidden = true;
  input.setAttribute("aria-expanded", "false");
  saveData();
  setStatus(`Đã chọn Dân tộc: ${input.value}.`, "success");
  input.focus({preventScroll:true});
  input.setSelectionRange?.(input.value.length, input.value.length);
}

function handleEthnicityKeyboard(event)
{
  if(event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
  const options = Array.from(document.querySelectorAll("#ethnicitySuggestions .location-option"));
  if(event.key === "ArrowDown" || event.key === "ArrowUp") {
    if(!options.length) return;
    event.preventDefault();
    ethnicityActiveIndex = ethnicityActiveIndex < 0
      ? (event.key === "ArrowDown" ? 0 : options.length - 1)
      : (ethnicityActiveIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options.forEach((option, index) => {
      option.classList.toggle("is-active", index === ethnicityActiveIndex);
      option.setAttribute("aria-selected", String(index === ethnicityActiveIndex));
    });
    const active = options[ethnicityActiveIndex];
    event.currentTarget.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({block:"nearest"});
    return;
  }
  if((event.key === " " || event.code === "Space" || event.key === "Enter") &&
    ethnicityActiveIndex >= 0 && options[ethnicityActiveIndex]) {
    event.preventDefault();
    chooseEthnicity(options[ethnicityActiveIndex].textContent).catch(error => setStatus(error.message, "error"));
    return;
  }
  handleDataEntryEnter(event, event.currentTarget);
}

function moveLocationActive(direction)
{
  const options = Array.from(document.querySelectorAll("#locationSuggestions .location-option"));
  if(!options.length) return false;
  locationActiveIndex = locationActiveIndex < 0
    ? (direction > 0 ? 0 : options.length - 1)
    : (locationActiveIndex + direction + options.length) % options.length;
  options.forEach((option, index) => {
    option.classList.toggle("is-active", index === locationActiveIndex);
    option.setAttribute("aria-selected", String(index === locationActiveIndex));
  });
  const active = options[locationActiveIndex];
  document.getElementById("location").setAttribute("aria-activedescendant", active.id);
  active.scrollIntoView({block:"nearest"});
  return true;
}

function handleLocationKeyboard(event)
{
  if(event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
  if(event.key === "ArrowDown" || event.key === "ArrowUp") {
    if(moveLocationActive(event.key === "ArrowDown" ? 1 : -1)) event.preventDefault();
    return;
  }
  const options = Array.from(document.querySelectorAll("#locationSuggestions .location-option"));
  if(/^\d$/.test(event.key) && options.length) {
    const index = event.key === "0" ? 9 : Number(event.key) - 1;
    if(options[index]) {
      event.preventDefault();
      const label = options[index].dataset.locationLabel || options[index].textContent;
      chooseLocation(label, locationSuggestionMode === "frequent" ? label.split(" - ")[0] : "");
      return;
    }
  }
  if((event.key === " " || event.code === "Space" || event.key === "Enter") &&
    locationActiveIndex >= 0 && options[locationActiveIndex]) {
    event.preventDefault();
    const label = options[locationActiveIndex].dataset.locationLabel || options[locationActiveIndex].textContent;
    chooseLocation(label, locationSuggestionMode === "frequent" ? label.split(" - ")[0] : "");
    return;
  }
  handleDataEntryEnter(event, event.currentTarget);
}

async function chooseLocation(label, queryOverride = "")
{
  const input = document.getElementById("location");
  const query = String(queryOverride || input.value || label.split(" - ")[0]).trim();
  clearTimeout(locationSearchTimer);
  locationSearchRevision += 1;
  setStatus("Đang xác nhận Tỉnh/Xã với dữ liệu API…");
  try {
    const response = await messageActiveTab({action:"selectLocationOption", label, query});
    if(!response?.ok) throw new Error(response?.error || "Không chọn được Tỉnh/Xã.");
    input.value = response.label || label;
    input.dataset.selectedLabel = input.value;
    input.dataset.query = query;
    input.dataset.autoLocked = "false";
    input.dataset.autoSelectPending = "false";
    input.dataset.autoCommitted = "true";
    input.classList.remove("invalid");
    locationActiveIndex = -1;
    renderLocationOptions([]);
    await rememberLocation(input.value);
    clearTimeout(saveTimer);
    await chrome.storage.local.set({receptionAutofillData:getData()});
    setStatus("Đã chọn Tỉnh/Xã; form sẽ tự cập nhật các trường liên quan.", "success");
  } catch(error) {
    input.dataset.selectedLabel = "";
    input.classList.add("invalid");
    setStatus(`Tỉnh/Xã chưa được lưu vì API chưa xác nhận: ${error.message}`, "error");
  } finally {
    input.focus({preventScroll:true});
    input.setSelectionRange?.(input.value.length, input.value.length);
  }
}

function searchLocations()
{
  const input = document.getElementById("location");
  const query = input.value.trim();
  if(input.dataset.selectedLabel !== query) {
    input.dataset.selectedLabel = "";
    input.dataset.query = query;
    input.dataset.autoLocked = "false";
    input.dataset.autoSelectPending = "false";
    input.dataset.autoCommitted = "false";
  }
  locationActiveIndex = -1;
  saveData();
  renderLocationOptions([]);
  clearTimeout(locationSearchTimer);
  const revision = ++locationSearchRevision;
  if(query.length < 2) {
    if(!query) showFrequentLocations();
    return;
  }
  messageActiveTab({action:"syncLocationQuery", query}).catch(error => {
    if(revision === locationSearchRevision) setStatus(error.message, "error");
  });
  locationSearchTimer = setTimeout(async () => {
    try {
      const request = messageActiveTab({action:"readLocationOptions", query});
      input.focus({preventScroll:true});
      const response = await request;
      if(revision !== locationSearchRevision) return;
      if(!response?.ok) throw new Error(response?.error || "Không lấy được gợi ý Tỉnh/Xã.");
      renderLocationOptions(response.options || []);
      input.focus({preventScroll:true});
      input.setSelectionRange?.(input.value.length, input.value.length);
      if(!response.options?.length)
        setStatus("Không tìm thấy địa điểm phù hợp.", "error");
    } catch(error) {
      if(revision === locationSearchRevision) setStatus(error.message, "error");
    }
  }, LOCATION_RESULTS_IDLE_MS);
}

document.addEventListener("DOMContentLoaded", async () => {
  const result = await chrome.storage.local.get([
    "receptionAutofillData",
    "receptionDefaultsVersion", "receptionWorkflowDefaultsVersion",
    "receptionPanelCollapsed", "receptionConfigCollapsed", "receptionPanelAppearance",
    "receptionExistingPatientWidgetPosition", "receptionFullAutoResetPending",
    LOCATION_HISTORY_KEY, LOCATION_LOCK_KEY
  ]);
  locationHistory = normalizeLocationHistory(result[LOCATION_HISTORY_KEY]);
  lockedLocationLabel = String(result[LOCATION_LOCK_KEY] || "").trim();
  setupExistingPatientWidgetDrag(result.receptionExistingPatientWidgetPosition);
  const fullAutoCompletion = result.receptionFullAutoResetPending;
  const focusFirstAfterFullAuto = fullAutoCompletion === true || fullAutoCompletion?.focusFirst === true;
  const resetAfterFullAuto = fullAutoCompletion === true && fullAutoCompletion?.preserveData !== true;
  let initialData = result.receptionAutofillData;
  if(initialData?.fullAutoHotkey == null) {
    initialData = {...(initialData || {}), fullAutoHotkey:DEFAULT_DATA.fullAutoHotkey};
    await chrome.storage.local.set({receptionAutofillData:initialData});
  }
  if(result.receptionDefaultsVersion !== DEFAULTS_VERSION) {
    initialData = {...DEFAULT_DATA, ...(initialData || {})};
    OPTION_IDS.forEach(id => { initialData[id] = false; });
    initialData.vaccinationComplete = true;
    initialData.overwrite = true;
    await chrome.storage.local.set({
      receptionAutofillData:initialData,
      receptionDefaultsVersion:DEFAULTS_VERSION
    });
  }
  if(result.receptionWorkflowDefaultsVersion !== WORKFLOW_DEFAULTS_VERSION) {
    initialData = {...DEFAULT_DATA, ...(initialData || {})};
    initialData.autoOpenHealthAfterSave = true;
    initialData.checkExistingPatient = true;
    if(initialData.fieldDelaySeconds == null || String(initialData.fieldDelaySeconds) === "1")
      initialData.fieldDelaySeconds = "0.25";
    await chrome.storage.local.set({
      receptionAutofillData:initialData,
      receptionWorkflowDefaultsVersion:WORKFLOW_DEFAULTS_VERSION
    });
  }
  if(!String(initialData?.location || initialData?.locationDraft || "").trim())
    initialData = lockedLocationData({...DEFAULT_DATA, ...(initialData || {})});
  if(resetAfterFullAuto) {
    initialData = nextPatientData(initialData);
    await chrome.storage.local.set({receptionAutofillData:initialData});
  }
  if(fullAutoCompletion) await chrome.storage.local.remove("receptionFullAutoResetPending");
  setData(initialData);
  applyGenderFromIdentity();
  const repositionDataGuess = () => {
    if(activeDataGuess) positionDataGuessSuggestion(activeDataGuess.source);
  };
  window.addEventListener("resize", repositionDataGuess);
  window.addEventListener("scroll", repositionDataGuess, true);
  const panelFontSize = document.getElementById("panelFontSize");
  const panelFontSizeValue = document.getElementById("panelFontSizeValue");
  const initialFontSize = Math.min(Math.max(Number(result.receptionPanelAppearance?.fontSize) || 14, 12), 22);
  const applyPanelFontSize = size => {
    const value = Math.min(Math.max(Number(size) || 14, 12), 22);
    document.documentElement.style.setProperty("--panel-font-size", `${value}px`);
    panelFontSize.value = String(value);
    panelFontSizeValue.textContent = `${value}px`;
    return value;
  };
  applyPanelFontSize(initialFontSize);
  panelFontSize.addEventListener("input", async event => {
    const fontSize = applyPanelFontSize(event.target.value);
    await chrome.storage.local.set({receptionPanelAppearance:{fontSize}});
  });
  document.getElementById("resetPanelSize").addEventListener("click", () =>
    messageActiveTab({action:"resetFloatingSize"}).catch(error => setStatus(error.message, "error"))
  );
  const stickyActions = document.querySelector(".sticky-actions");
  const toggleConfig = document.getElementById("toggleConfig");
  const applyConfigState = collapsed => {
    stickyActions.classList.toggle("config-collapsed", collapsed);
    document.body.classList.toggle("config-options-collapsed", collapsed);
    toggleConfig.textContent = collapsed ? "Hiện tùy chọn cấu hình ▼" : "Ẩn tùy chọn cấu hình ▲";
    toggleConfig.setAttribute("aria-expanded", String(!collapsed));
  };
  applyConfigState(result.receptionConfigCollapsed === true);
  toggleConfig.addEventListener("click", async () => {
    const collapsed = !stickyActions.classList.contains("config-collapsed");
    applyConfigState(collapsed);
    await chrome.storage.local.set({receptionConfigCollapsed:collapsed});
  });
  const toggleActions = document.getElementById("toggleActions");
  const embeddedFloating = window.self !== window.top;
  document.body.classList.toggle("embedded-floating", embeddedFloating);
  const applyPanelState = collapsed => {
    document.body.classList.toggle("panel-collapsed", collapsed);
    toggleActions.textContent = collapsed ? "‹" : "›";
    toggleActions.title = collapsed ? "Mở extension" : "Ẩn extension";
    toggleActions.setAttribute("aria-label", toggleActions.title);
  };
  if(embeddedFloating) {
    applyPanelState(false);
  } else {
    applyPanelState(result.receptionPanelCollapsed === true);
    toggleActions.addEventListener("click", async () => {
      const collapsed = !document.body.classList.contains("panel-collapsed");
      applyPanelState(collapsed);
      await chrome.storage.local.set({receptionPanelCollapsed:collapsed});
    });
  }
  FIELD_IDS.forEach(id => {
    const element = document.getElementById(id);
    if(id === "location" || id === "ethnicity") return;
    element.addEventListener("input", event => {
      if(event.isTrusted) element.classList.remove("auto-adjusted", "duplicate-match");
    });
    element.addEventListener("input", saveData);
    element.addEventListener("change", saveData);
    if(["fullName", "identity", "birthDate", "gender", "existingPatientFromDate", "existingPatientToDate"].includes(id)) {
      element.addEventListener("input", scheduleExistingPatientPreview);
      element.addEventListener("change", scheduleExistingPatientPreview);
    }
    if(DATA_ENTRY_IDS.includes(id)) {
      element.addEventListener("focus", () => clearTimeout(dataEntryAdvanceTimer));
      element.addEventListener("compositionstart", () => {
        composingDataEntry.add(element);
        clearTimeout(dataEntryAdvanceTimer);
      });
      element.addEventListener("compositionend", () => {
        composingDataEntry.delete(element);
        scheduleDataEntryAdvance(element);
      });
      element.addEventListener("input", event => {
        setEarlyValidationMessage(element.id, "", true);
        if(!event.isComposing) scheduleDataEntryAdvance(element);
      });
      element.addEventListener("change", () => scheduleDataEntryAdvance(element));
      element.addEventListener("keydown", event => handleDataEntryEnter(event, element));
    }
  });
  DATA_GUESS_SOURCE_IDS.forEach(id => {
    const element = document.getElementById(id);
    element.addEventListener("keydown", event => handleDataGuessKeydown(event, element), true);
    element.addEventListener("input", event => {
      if(!event.isComposing) detectDataGuess(element);
    });
    element.addEventListener("blur", () => {
      setTimeout(() => {
        if(!document.getElementById("dataGuessSuggestion")?.contains(document.activeElement))
          hideDataGuessSuggestion();
      }, 120);
    });
  });
  EARLY_VALIDATION_IDS.forEach(id => {
    const element = document.getElementById(id);
    element.addEventListener("focus", () => {
      earlyValidationStarted = true;
      earlyValidationTouched.add(id);
      setEarlyValidationMessage(id, "");
    });
    element.addEventListener("input", () => {
      earlyValidationStarted = true;
      earlyValidationTouched.add(id);
      setEarlyValidationMessage(id, "");
      scheduleEarlyValidation();
    });
    element.addEventListener("change", () => {
      earlyValidationStarted = true;
      earlyValidationTouched.add(id);
      setEarlyValidationMessage(id, "");
      scheduleEarlyValidation(100);
    });
    element.addEventListener("blur", () => {
      earlyValidationStarted = true;
      earlyValidationTouched.add(id);
      scheduleEarlyValidation(120);
    });
  });
  document.getElementById("autoAdvanceDataEntry").addEventListener("change", event => {
    if(!event.target.checked) clearTimeout(dataEntryAdvanceTimer);
  });
  document.getElementById("autoAdvanceFixedLength").addEventListener("change", event => {
    if(!event.target.checked && !document.getElementById("autoAdvanceDataEntry").checked)
      clearTimeout(dataEntryAdvanceTimer);
  });
  const refreshIdentityGenderWarning = () => {
    const identity = document.getElementById("identity");
    const complete = identity.value.replace(/\D/g, "").length === 12 &&
      birthDateDigits(document.getElementById("birthDate").value).length === 8;
    if(complete) setEarlyValidationMessage("identity", earlyValidationMessage("identity"), true);
  };
  document.getElementById("identity").addEventListener("input", () => {
    applyGenderFromIdentity();
    refreshIdentityGenderWarning();
  });
  document.getElementById("birthDate").addEventListener("input", refreshIdentityGenderWarning);
  document.getElementById("birthDate").addEventListener("change", refreshIdentityGenderWarning);
  document.getElementById("gender").addEventListener("change", refreshIdentityGenderWarning);
  document.getElementById("autoGenderFromIdentity").addEventListener("change", event => {
    if(event.target.checked) applyGenderFromIdentity();
    refreshIdentityGenderWarning();
    saveData();
  });
  const refreshCompanionGenderWarning = () => {
    const companionIdentity = document.getElementById("companionIdentity");
    if(companionIdentity.value.replace(/\D/g, "").length === 12)
      setEarlyValidationMessage("companionIdentity",
        earlyValidationMessage("companionIdentity"), true);
  };
  document.getElementById("companionIdentity").addEventListener("input", refreshCompanionGenderWarning);
  document.getElementById("companionIdentity").addEventListener("change", refreshCompanionGenderWarning);
  document.getElementById("guardianRelationship").addEventListener("change", refreshCompanionGenderWarning);
  for(const id of ["healthConclusionTuberculosisRisk", "healthConclusionProblem"]) {
    document.getElementById(id).addEventListener("change", () => {
      updateHealthConclusionVisibility();
      saveData();
      if(!document.getElementById("healthConclusionReasonWrap").hidden)
        document.getElementById("healthConclusionReason").focus({preventScroll:true});
    });
  }
  document.querySelectorAll(".select-all-title").forEach(title => {
    title.addEventListener("click", () => selectAllInExamGroup(title));
    title.addEventListener("keydown", event => {
      if(event.key !== "Enter" && event.key !== " " && event.code !== "Space") return;
      event.preventDefault();
      selectAllInExamGroup(title);
    });
  });
  const normalizeInputValue = (element, formatter) => {
    if(!element || composingDataEntry.has(element)) return false;
    const previous = element.value;
    const start = element.selectionStart ?? previous.length;
    const end = element.selectionEnd ?? start;
    const next = formatter(previous);
    if(next === previous) return false;
    const nextStart = Math.min(next.length, formatter(previous.slice(0, start)).length);
    const nextEnd = Math.min(next.length, formatter(previous.slice(0, end)).length);
    element.value = next;
    element.setSelectionRange?.(nextStart, nextEnd);
    return true;
  };
  document.getElementById("fullName").addEventListener("input", event => {
    if(!event.isComposing) normalizeInputValue(event.currentTarget, upperPersonName);
  });
  document.getElementById("guardianName").addEventListener("input", event => {
    if(!event.isComposing) normalizeInputValue(event.currentTarget, titleCasePersonName);
  });
  document.getElementById("birthDate").addEventListener("keydown", event => {
    if(event.key !== "Enter" || event.isComposing) return;
    const formatted = formatBirthDateForCommit(event.currentTarget.value);
    event.currentTarget.value = formatted;
    event.currentTarget.setSelectionRange?.(formatted.length, formatted.length);
    saveData();
    scheduleExistingPatientPreview();
  });
  document.getElementById("birthDate").addEventListener("blur", event => {
    const previous = event.currentTarget.value;
    const formatted = formatBirthDateForCommit(event.currentTarget.value);
    if(formatted === event.currentTarget.value) return;
    event.currentTarget.value = formatted;
    if(birthYearWasAutoCompleted(previous, formatted)) markAutoAdjusted(event.currentTarget);
    saveData();
    scheduleExistingPatientPreview();
  });
  const redirectTypedLetterToLocation = event => {
    if(event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
      event.key.length !== 1 || !/\p{L}/u.test(event.key)) return;
    event.preventDefault();
    clearTimeout(dataEntryAdvanceTimer);
    const locationInput = document.getElementById("location");
    locationInput.value = event.key;
    locationInput.dataset.selectedLabel = "";
    locationInput.dataset.query = event.key;
    locationInput.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
    locationInput.focus({preventScroll:true});
    locationInput.setSelectionRange?.(locationInput.value.length, locationInput.value.length);
    locationInput.dispatchEvent(new InputEvent("input", {
      bubbles:true,
      data:event.key,
      inputType:"insertText"
    }));
  };
  document.getElementById("gender").addEventListener("keydown", redirectTypedLetterToLocation);
  document.getElementById("premature").addEventListener("keydown", redirectTypedLetterToLocation);
  for(const id of ["gender", "guardianRelationship", "premature", "historySelf", "historyFamily", "historyTuberculosis"])
    document.getElementById(id).addEventListener("keydown", event => handleBinarySpace(event, event.currentTarget));
  const normalizeArmCircumferenceInput = element => {
    if(!element || composingDataEntry.has(element)) return;
    const normalized = armCircumferenceValue(element.value);
    if(normalized === element.value) return;
    element.value = normalized;
    element.setSelectionRange?.(normalized.length, normalized.length);
    saveData();
  };
  const armCircumferenceInput = document.getElementById("armCircumferenceMm");
  armCircumferenceInput.addEventListener("change", event => normalizeArmCircumferenceInput(event.currentTarget));
  armCircumferenceInput.addEventListener("blur", event => normalizeArmCircumferenceInput(event.currentTarget));
  armCircumferenceInput.addEventListener("keydown", event => {
    if(event.key === "Enter" && !event.isComposing)
      normalizeArmCircumferenceInput(event.currentTarget);
  });
  for(const id of ["existingPatientFromDate", "existingPatientToDate"]) {
    const input = document.getElementById(id);
    input.addEventListener("keydown", event => {
      if(event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      const formatted = formatConfigDateDisplay(event.currentTarget.value);
      event.currentTarget.value = formatted;
      event.currentTarget.setSelectionRange?.(formatted.length, formatted.length);
      saveData();
      scheduleExistingPatientPreview();
    });
  }
  document.getElementById("addressDetail").addEventListener("input", event => {
    if(!event.isComposing)
      normalizeInputValue(event.currentTarget, value => formatAddressValue(
        value,
        document.getElementById("addressUppercaseRules").value,
        document.getElementById("capitalizeAddress").checked
      ));
  });
  document.getElementById("capitalizeAddress").addEventListener("change", event => {
    if(event.currentTarget.checked)
      normalizeInputValue(document.getElementById("addressDetail"), value => formatAddressValue(
        value,
        document.getElementById("addressUppercaseRules").value,
        true
      ));
  });
  document.getElementById("addressUppercaseRules").addEventListener("change", () => {
    normalizeInputValue(document.getElementById("addressDetail"), value => formatAddressValue(
      value,
      document.getElementById("addressUppercaseRules").value,
      document.getElementById("capitalizeAddress").checked
    ));
    saveData();
  });
  document.getElementById("showGuidance").addEventListener("change", () => {
    updateGuidanceVisibility();
    saveData();
  });
  for(const [id, formatter] of [
    ["fullName", upperPersonName],
    ["guardianName", titleCasePersonName],
    ["addressDetail", value => formatAddressValue(
      value,
      document.getElementById("addressUppercaseRules").value,
      document.getElementById("capitalizeAddress").checked
    )]
  ]) {
    const element = document.getElementById(id);
    element.addEventListener("compositionend", () => {
      normalizeInputValue(element, formatter);
      saveData();
    });
    element.addEventListener("blur", () => {
      normalizeInputValue(element, formatter);
    });
  }
  document.getElementById("existingPatientIndicator").addEventListener("click", () => {
    if(suppressExistingPatientWidgetClick) return;
    const indicator = document.getElementById("existingPatientIndicator");
    if(!document.getElementById("existingPatientToast").hidden) {
      hideExistingPatientToast();
      return;
    }
    if(indicator.classList.contains("is-checking")) return;
    if((indicator.classList.contains("is-warning") || indicator.classList.contains("is-identity-match")) &&
      lastExistingPatientMatches.length) {
      showExistingPatientMatches(lastExistingPatientMatches, lastExistingPatientPreviewData || getData());
      return;
    }
    hideExistingPatientToast();
    scheduleExistingPatientPreview(true);
  });
  document.getElementById("returnToReception").addEventListener("click", async () => {
    try {
      await messageActiveTab({action:"goToReceptionForm"});
    } catch(error) {
      setStatus(error.message, "error");
    }
  });
  document.getElementById("checkExistingPatient").addEventListener("change", () => {
    updateExistingPatientCheckVisibility();
    saveData();
    scheduleExistingPatientPreview();
    if(earlyValidationStarted) scheduleEarlyValidation(0);
  });
  for(const id of ["historySelf", "historyFamily"]) {
    document.getElementById(id).addEventListener("change", () => {
      updateHistoryNoteVisibility();
      saveData();
      if(document.getElementById(id).checked)
        document.getElementById(`${id}Note`)?.focus({preventScroll:true});
    });
  }
  document.querySelector(".history-group")?.addEventListener("keydown", event => {
    if(event.isComposing || event.ctrlKey || event.altKey || event.metaKey || !/^\d$/.test(event.key)) return;
    const target = document.getElementById("temperature");
    if(!target) return;
    event.preventDefault();
    clearTimeout(dataEntryAdvanceTimer);
    target.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
    target.focus({preventScroll:true});
    target.value = event.key;
    target.setSelectionRange?.(1, 1);
    target.dispatchEvent(new InputEvent("input", {bubbles:true, data:event.key, inputType:"insertText"}));
  }, true);
  document.getElementById("fill").addEventListener("click", () => fillCurrentTab(false));
  document.getElementById("fillFullAuto").addEventListener("click", () => fillCurrentTab(true));
  const fullAutoHotkeyInput = document.getElementById("fullAutoHotkey");
  fullAutoHotkeyInput.addEventListener("keydown", event => {
    event.preventDefault();
    event.stopPropagation();
    if(event.key === "Backspace" || event.key === "Delete" || event.key === "Escape") {
      fullAutoHotkeyInput.value = "";
      saveData();
      setStatus("Đã xóa phím tắt Auto hoàn toàn.", "success");
      return;
    }
    const hotkey = hotkeyFromEvent(event);
    if(!hotkey) return;
    const hasModifier = event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
    if(!hasModifier && !/^F(?:[1-9]|1[0-2])$/i.test(event.key)) {
      setStatus("Phím tắt cần có Ctrl, Alt hoặc Shift; cũng có thể dùng F1–F12.", "error");
      return;
    }
    fullAutoHotkeyInput.value = hotkey;
    saveData();
    setStatus(`Đã đặt phím tắt Auto hoàn toàn: ${hotkey}.`, "success");
  });
  document.addEventListener("keydown", event => {
    if(event.target === fullAutoHotkeyInput || !matchesConfiguredHotkey(event, fullAutoHotkeyInput.value)) return;
    event.preventDefault();
    event.stopPropagation();
    runFullAutoFromHotkey();
  });
  document.getElementById("clear").addEventListener("click", clearData);
  document.getElementById("location").addEventListener("input", event => {
    if(event.isTrusted) event.currentTarget.classList.remove("auto-adjusted", "duplicate-match");
    searchLocations(event);
  });
  document.getElementById("location").addEventListener("keydown", handleLocationKeyboard);
  document.getElementById("location").addEventListener("focus", event => {
    const input = event.currentTarget;
    if(!input.value.trim() || input.dataset.selectedLabel === input.value.trim()) {
      showFrequentLocations();
      if(input.dataset.autoLocked === "true" && input.dataset.autoSelectPending === "true") {
        input.dataset.autoSelectPending = "false";
        requestAnimationFrame(() => input.select());
      }
    }
  });
  document.getElementById("location").addEventListener("blur", event => {
    const input = event.currentTarget;
    clearTimeout(locationSearchTimer);
    locationSearchRevision += 1;
    locationActiveIndex = -1;
    renderLocationOptions([]);
    setTimeout(() => {
      if(input.dataset.autoLocked !== "true" || input.dataset.autoCommitted === "true" ||
        input.dataset.selectedLabel !== input.value.trim()) return;
      applyLockedLocationOnPage().catch(error => setStatus(error.message, "error"));
    }, 0);
  });
  const ethnicityInput = document.getElementById("ethnicity");
  ethnicityInput.addEventListener("focus", async () => {
    ethnicityActiveIndex = -1;
    try {
      await loadEthnicityCatalog(false);
      renderEthnicityOptions(ethnicityInput.value);
    } catch(error) {
      renderEthnicityOptions("");
      setStatus(error.message, "error");
    }
  });
  ethnicityInput.addEventListener("input", () => {
    ethnicityInput.classList.remove("auto-adjusted", "duplicate-match");
    ethnicityInput.dataset.selectedLabel = "";
    ethnicityActiveIndex = -1;
    renderEthnicityOptions(ethnicityInput.value);
    if(!ethnicityOptions.length && !ethnicityCatalogLoading)
      loadEthnicityCatalog(false).catch(error => setStatus(error.message, "error"));
    saveData();
  });
  ethnicityInput.addEventListener("keydown", handleEthnicityKeyboard);
  ethnicityInput.addEventListener("blur", () => setTimeout(() => {
    restoreDefaultEthnicity();
    document.getElementById("ethnicitySuggestions").hidden = true;
    ethnicityInput.setAttribute("aria-expanded", "false");
  }, 120));
  try {
    const current = await messageActiveTab({action:"getCurrentLocation"});
    const locationInput = document.getElementById("location");
    if(current?.label) {
      locationInput.value = current.label;
      locationInput.dataset.selectedLabel = current.label;
      locationInput.dataset.query = current.label.split(" - ")[0];
      locationInput.dataset.autoLocked = "false";
      locationInput.dataset.autoSelectPending = "false";
      locationInput.dataset.autoCommitted = "true";
      saveData();
    }
  } catch(error) {
    setStatus(error.message, "error");
  }
  scheduleExistingPatientPreview();
  window.addEventListener("pagehide", () => {
    clearTimeout(saveTimer);
    chrome.storage.local.set({receptionAutofillData:getData()});
  });
  if(focusFirstAfterFullAuto)
    setTimeout(focusFirstDataEntry, 180);
});
