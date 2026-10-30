"use strict";

const HIGHLIGHT_CLASS = "reception-autofill-filled";
const EXAM_REQUEST_UNDER_SIX = "KSK_TRE_DUOI_6_TUOI - Khám sức khỏe trẻ em dưới 6 tuổi";
const RELATIONSHIP_TARGETS = {
  "Cha":"Bố/Mẹ",
  "Mẹ":"Bố/Mẹ",
  "Ông/Bà":"Ông/bà",
  "Anh/Chị":"Anh/Chị",
  "Họ hàng":"Khác",
  "Khác":"Khác"
};
const UNDER_SIX_RELATIONSHIPS = {
  "Cha":"Cha",
  "Mẹ":"Mẹ",
  "Ông/Bà":"Ông/bà",
  "Anh/Chị":"Anh/chị",
  "Họ hàng":"Họ hàng",
  "Khác":"Khác"
};
let guardianAddressTimers = [];
let bulkFillFocusEnabled = false;
let bulkFillStepDelayMs = 250;

function normalizeText(value)
{
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function isVisible(element)
{
  if(!element || !element.isConnected || element.disabled) return false;
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

function ensureHighlightStyle()
{
  if(document.getElementById("reception-autofill-style")) return;
  const style = document.createElement("style");
  style.id = "reception-autofill-style";
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background-color: #e8f7eb !important;
      box-shadow: 0 0 0 2px #28a745 !important;
      transition: background-color .15s ease, box-shadow .15s ease;
    }
    @keyframes reception-autofill-pulse {
      0%, 100% { box-shadow: 0 0 0 3px rgba(255, 153, 0, .35); }
      50% { box-shadow: 0 0 0 7px rgba(255, 153, 0, .12); }
    }
    .reception-autofill-active {
      position: relative !important;
      z-index: 2 !important;
      background-color: #fff7df !important;
      outline: 3px solid #ff9800 !important;
      outline-offset: 2px !important;
      animation: reception-autofill-pulse 1.1s ease-in-out 2 !important;
    }
    oh-select.reception-autofill-active oh-select-top-control,
    oh-date-picker.reception-autofill-active .ui-picker {
      background-color: #fff7df !important;
    }
    button.reception-health-exam-button {
      width: auto !important;
      min-width: 240px !important;
      min-height: 40px !important;
      padding: 7px 13px !important;
      gap: 7px !important;
      border: 2px solid #08783e !important;
      border-radius: 7px !important;
      background: #0a9b50 !important;
      color: #fff !important;
      box-shadow: 0 3px 9px rgba(7, 107, 55, .3) !important;
      font-size: 14px !important;
    }
    button.reception-health-exam-button .reception-health-exam-label {
      display: inline-block;
      white-space: nowrap;
      font-weight: 700;
    }
    oh-select.${HIGHLIGHT_CLASS} oh-select-top-control,
    oh-date-picker.${HIGHLIGHT_CLASS} .ui-picker {
      background-color: #e8f7eb !important;
      box-shadow: 0 0 0 2px #28a745 !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function markFilled(element)
{
  ensureHighlightStyle();
  element?.classList.add(HIGHLIGHT_CLASS);
}

async function focusBeforeBulkFill(element)
{
  if(!bulkFillFocusEnabled || !element || !isVisible(element)) return;
  ensureHighlightStyle();
  document.querySelectorAll(".reception-autofill-active").forEach(item =>
    item.classList.remove("reception-autofill-active")
  );
  const target = element.closest("oh-date-picker, oh-select, oh-form-item") || element;
  target.classList.add("reception-autofill-active");
  target.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
  const focusTarget = element.matches?.("input, textarea, button")
    ? element
    : element.querySelector?.("input, textarea, button") || element;
  focusTarget.focus?.({preventScroll:true});
  await new Promise(resolve => setTimeout(resolve, bulkFillStepDelayMs));
}

function nativeSetValue(input, value)
{
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if(setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new InputEvent("input", {bubbles:true, inputType:"insertText", data:value}));
  input.dispatchEvent(new Event("change", {bubbles:true}));
  input.dispatchEvent(new Event("blur", {bubbles:true}));
}

function syncGuardianAddress()
{
  const patientAddress = String(findInput("diaChi")?.value || findInput("soNha")?.value || "").trim();
  const guardianAddress = findInput("diaChiLH");
  if(!patientAddress || !guardianAddress || !isVisible(guardianAddress)) return;
  if(String(guardianAddress.value || "").trim() === patientAddress) return;
  nativeSetValue(guardianAddress, patientAddress);
  markFilled(guardianAddress);
}

function scheduleGuardianAddressSync()
{
  guardianAddressTimers.forEach(clearTimeout);
  // “Địa chỉ BN” is assembled asynchronously after Số nhà changes. Recheck a
  // few times so Địa chỉ NLH receives the final, fully assembled address.
  guardianAddressTimers = [80, 300, 800, 1500].map(delay => setTimeout(syncGuardianAddress, delay));
}

function isPatientAddressEvent(event)
{
  const control = event.target?.getAttribute?.("formcontrolname") ||
    event.target?.closest?.("[formcontrolname]")?.getAttribute("formcontrolname");
  return ["soNha", "diaChi", "tinh", "xa", "tinhHuyenXa"].includes(control);
}

document.addEventListener("input", event => {
  if(isPatientAddressEvent(event)) scheduleGuardianAddressSync();
}, true);
document.addEventListener("change", event => {
  if(isPatientAddressEvent(event)) scheduleGuardianAddressSync();
}, true);

function findInput(formControlName)
{
  const direct = document.querySelector(`input[formcontrolname="${formControlName}"], textarea[formcontrolname="${formControlName}"]`);
  if(direct) return direct;
  return document.querySelector(`[formcontrolname="${formControlName}"] input, [formcontrolname="${formControlName}"] textarea`);
}

async function fillInput(formControlName, value, overwrite, filled, skipped)
{
  const text = String(value ?? "").trim();
  if(!text) return false;
  const input = findInput(formControlName);
  if(!input || !isVisible(input)) return false;
  if(!overwrite && String(input.value || "").trim()) {
    skipped.push(formControlName);
    return false;
  }
  await focusBeforeBulkFill(input);
  nativeSetValue(input, text);
  markFilled(input);
  const host = input.closest("oh-date-picker");
  if(host) markFilled(host);
  filled.push(formControlName);
  return true;
}

function normalizedFieldLabel(label)
{
  return normalizeText(label).replace(/^\d+\.\s*/, "");
}

function findInputByLabel(labelText)
{
  const target = normalizedFieldLabel(labelText);
  for(const item of document.querySelectorAll("oh-form-item")) {
    const label = item.querySelector("oh-form-label label");
    if(!label || normalizedFieldLabel(label.textContent) !== target) continue;
    const input = Array.from(item.querySelectorAll("input, textarea")).find(isVisible);
    if(input) return input;
  }
  return null;
}

async function fillLabeledInput(labelText, value, resultName, overwrite, filled, skipped, failed)
{
  const text = String(value ?? "").trim();
  if(!text) return false;
  const input = findInputByLabel(labelText);
  if(!input) {
    failed.push(resultName);
    return false;
  }
  if(!overwrite && String(input.value || "").trim()) {
    skipped.push(resultName);
    return false;
  }
  await focusBeforeBulkFill(input);
  nativeSetValue(input, text);
  if(resultName === "cccdNguoiDiCung") {
    // This is the first field in the under-six exam. Angular can still be
    // settling the newly loaded form and may discard a value when focus moves
    // away too quickly, especially with a 0.1s autofill delay.
    const settleDelay = Math.max(300, bulkFillStepDelayMs);
    for(let attempt = 0; attempt < 3; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, settleDelay));
      if(String(input.value || "").replace(/\D/g, "") === text.replace(/\D/g, "")) break;
      input.focus?.({preventScroll:true});
      nativeSetValue(input, text);
    }
    if(String(input.value || "").replace(/\D/g, "") !== text.replace(/\D/g, "")) {
      failed.push(resultName);
      return false;
    }
  }
  markFilled(input);
  filled.push(resultName);
  return true;
}

async function selectUnderSixRelationship(relationship, filled, failed)
{
  const targetText = UNDER_SIX_RELATIONSHIPS[relationship] || relationship;
  if(!targetText) return false;
  const root = document.querySelector("app-kham-suc-khoe-tre-duoi-6-tuoi") || document;
  const relationshipNames = new Set(Object.values(UNDER_SIX_RELATIONSHIPS).map(normalizeText));
  const candidates = Array.from(root.querySelectorAll("label[oh-checkbox]")).filter(label =>
    relationshipNames.has(normalizeText(label.textContent))
  );
  const target = candidates.find(label => normalizeText(label.textContent) === normalizeText(targetText));
  if(!target) {
    failed.push("moiQuanHeTre");
    return false;
  }
  await focusBeforeBulkFill(target);

  // These are separate checkbox controls. Clear another checked relationship,
  // then click the exact Cha/Mẹ/Ông-bà/... checkbox selected in the popup.
  candidates.forEach(label => {
    const checkbox = label.querySelector('input[type="checkbox"]');
    if(label !== target && checkbox?.checked) checkbox.click();
  });
  const targetCheckbox = target.querySelector('input[type="checkbox"]');
  if(!targetCheckbox?.checked) targetCheckbox?.click();
  if(!targetCheckbox?.checked) {
    failed.push("moiQuanHeTre");
    return false;
  }
  markFilled(target);
  filled.push("moiQuanHeTre");
  return true;
}

function normalizedQuestionText(value)
{
  return normalizeText(value)
    .replace(/^\d+\.\s*/, "")
    .replace(/^[-–]\s*/, "")
    .replace(/:\s*$/, "");
}

async function selectQuestionBoolean(questionText, enabled, resultName, filled, failed)
{
  const root = document.querySelector("app-kham-suc-khoe-tre-duoi-6-tuoi") || document;
  const targetQuestion = normalizedQuestionText(questionText);
  const question = Array.from(root.querySelectorAll("span")).find(span =>
    normalizedQuestionText(span.textContent) === targetQuestion
  );
  const questionColumn = question?.closest("[oh-col]");
  if(!questionColumn) {
    failed.push(resultName);
    return false;
  }
  const desired = enabled ? "co" : "khong";
  const options = [];
  let sibling = questionColumn.nextElementSibling;
  let inspected = 0;
  while(sibling && options.length < 2 && inspected < 4) {
    const labels = Array.from(sibling.querySelectorAll("label[oh-checkbox]")).filter(label => {
      const text = normalizeText(label.textContent);
      return text === "co" || text === "khong";
    });
    options.push(...labels);
    sibling = sibling.nextElementSibling;
    inspected += 1;
  }
  const optionNames = new Set(options.map(label => normalizeText(label.textContent)));
  if(options.length !== 2 || !optionNames.has("co") || !optionNames.has("khong")) {
    failed.push(resultName);
    return false;
  }
  const target = options.find(label => normalizeText(label.textContent) === desired);
  if(!target) {
    failed.push(resultName);
    return false;
  }
  await focusBeforeBulkFill(target);
  const checkbox = target.querySelector('input[type="checkbox"]');
  if(!checkbox?.checked) checkbox?.click();
  options.forEach(label => {
    const other = label.querySelector('input[type="checkbox"]');
    if(label !== target && other?.checked) other.click();
  });
  const checkedCount = options.filter(label => label.querySelector('input[type="checkbox"]')?.checked).length;
  if(!checkbox?.checked || checkedCount !== 1) {
    failed.push(resultName);
    return false;
  }
  markFilled(target);
  filled.push(resultName);
  return true;
}

function historyNoteInput(questionText)
{
  const root = document.querySelector("app-kham-suc-khoe-tre-duoi-6-tuoi") || document;
  const targetQuestion = normalizedQuestionText(questionText);
  const question = Array.from(root.querySelectorAll("span")).find(span =>
    normalizedQuestionText(span.textContent) === targetQuestion
  );
  let sibling = question?.closest("[oh-col]")?.nextElementSibling;
  let inspected = 0;
  while(sibling && inspected < 6) {
    const item = sibling.matches?.("oh-form-item") ? sibling : sibling.querySelector?.("oh-form-item");
    const label = item?.querySelector("oh-form-label label");
    if(label && normalizedFieldLabel(label.textContent) === normalizedFieldLabel("Tên bệnh (nếu có)"))
      return Array.from(item.querySelectorAll("input, textarea")).find(isVisible) || null;
    const nextQuestion = Array.from(sibling.querySelectorAll?.("span") || []).some(span => {
      const text = normalizedQuestionText(span.textContent);
      return text === normalizedQuestionText("Bản thân") ||
        text === normalizedQuestionText("Gia đình") ||
        text === normalizedQuestionText("Tiền sử tiếp xúc với người bệnh lao");
    });
    if(nextQuestion) break;
    sibling = sibling.nextElementSibling;
    inspected += 1;
  }
  return null;
}

async function fillHistoryNote(questionText, value, resultName, overwrite, filled, skipped, failed)
{
  const text = String(value || "").trim();
  if(!text) return false;
  const input = historyNoteInput(questionText);
  if(!input) {
    failed.push(resultName);
    return false;
  }
  if(!overwrite && String(input.value || "").trim()) {
    skipped.push(resultName);
    return false;
  }
  await focusBeforeBulkFill(input);
  nativeSetValue(input, text);
  markFilled(input);
  filled.push(resultName);
  return true;
}

async function fillEthnicity(value, overwrite, filled, skipped, failed)
{
  const ethnicity = String(value || "").trim();
  if(!ethnicity) return false;
  const ethnicityName = ethnicity.replace(/^\d+\s*-\s*/, "").trim();
  const target = normalizedFieldLabel("Dân tộc");
  const item = Array.from(document.querySelectorAll("oh-form-item")).find(formItem => {
    const label = formItem.querySelector("oh-form-label label");
    return label && normalizedFieldLabel(label.textContent).includes(target);
  });
  if(!item) {
    failed.push("danToc");
    return false;
  }
  const select = item.querySelector("oh-select");
  if(select) {
    const controlName = select.getAttribute("formcontrolname") || item.getAttribute("formcontrolname");
    if(controlName) return chooseSearchableSelect(controlName, ethnicityName, filled, failed, ethnicity);
    await focusBeforeBulkFill(select);
    const trigger = select.querySelector("oh-select-top-control, .ui-select-selector") || select;
    trigger.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
    trigger.click();
    const searchInput = await waitForSearchInput(select);
    if(searchInput) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if(setter) setter.call(searchInput, ethnicityName);
      else searchInput.value = ethnicityName;
      searchInput.dispatchEvent(new InputEvent("input", {bubbles:true, inputType:"insertText", data:ethnicityName}));
    }
    const option = await waitForMatchingOption(ethnicity);
    if(!option) {
      failed.push("danToc");
      return false;
    }
    option.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
    option.click();
    markFilled(select);
    filled.push("danToc");
    return true;
  }
  const input = Array.from(item.querySelectorAll("input, textarea")).find(isVisible);
  if(!input) {
    failed.push("danToc");
    return false;
  }
  if(!overwrite && String(input.value || "").trim()) {
    skipped.push("danToc");
    return false;
  }
  await focusBeforeBulkFill(input);
  nativeSetValue(input, ethnicity);
  markFilled(input);
  filled.push("danToc");
  return true;
}

async function fillBirthDate(value, overwrite, filled, skipped, failed)
{
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  if(digits.length !== 8) return false;
  const input = Array.from(document.querySelectorAll(
    'oh-date-picker[formcontrolname="ngaySinh"] input[placeholder="dd/mm/yyyy"]'
  )).find(isVisible);
  if(!input || !isVisible(input)) return false;
  const picker = input.closest('oh-date-picker[formcontrolname="ngaySinh"]');
  if(!overwrite && String(input.value || "").trim() && !picker?.classList.contains("ng-invalid")) {
    skipped.push("ngaySinh");
    return false;
  }
  await focusBeforeBulkFill(picker || input);

  // Work only with the visible inner input. The page's mask needs an editable
  // input operation for every digit; assigning the final value changes the DOM
  // but leaves the Angular oh-date-picker control pristine/invalid.
  input.focus();
  input.setSelectionRange?.(0, String(input.value || "").length);
  const deleted = document.execCommand("delete", false);
  if(!deleted && input.value) {
    const prototypeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if(prototypeSetter) prototypeSetter.call(input, "");
    else input.value = "";
    input.dispatchEvent(new InputEvent("input", {
      bubbles:true,
      inputType:"deleteContentBackward",
      data:null
    }));
  }
  for(const digit of digits) {
    const inserted = document.execCommand("insertText", false, digit);
    if(!inserted) {
      const start = input.selectionStart ?? String(input.value || "").length;
      const end = input.selectionEnd ?? start;
      const next = `${input.value.slice(0, start)}${digit}${input.value.slice(end)}`;
      const prototypeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if(prototypeSetter) prototypeSetter.call(input, next);
      else input.value = next;
      input.dispatchEvent(new InputEvent("input", {bubbles:true, inputType:"insertText", data:digit}));
      input.setSelectionRange?.(start + 1, start + 1);
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  input.dispatchEvent(new Event("change", {bubbles:true}));
  input.blur();

  const committed = await new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const sameDate = String(input.value || "").replace(/\D/g, "").slice(0, 8) === digits;
      const angularAccepted = !picker?.classList.contains("ng-invalid");
      if((sameDate && angularAccepted) || Date.now() - started >= 1000) {
        clearInterval(timer);
        resolve(sameDate && angularAccepted);
      }
    };
    const timer = setInterval(check, 50);
    check();
  });
  if(!committed) {
    failed.push("ngaySinh");
    return false;
  }
  markFilled(input);
  filled.push("ngaySinh");
  return true;
}

function waitForInputValue(formControlName, timeout = 1200)
{
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const input = findInput(formControlName);
      const value = String(input?.value || "").trim();
      if(value || Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(value);
      }
    };
    const timer = setInterval(check, 80);
    check();
  });
}

function currentSelectText(select)
{
  const item = select.querySelector("oh-select-item, .ui-select-selection-item");
  return normalizeText(item?.textContent || "");
}

function visibleOptions()
{
  return Array.from(document.querySelectorAll(
    'oh-option-item, [role="option"], .ui-select-item-option, .ui-select-dropdown .ui-select-item'
  )).filter(isVisible);
}

function waitForOption(targetText, timeout = 2500)
{
  const target = normalizeText(targetText);
  return new Promise(resolve => {
    const find = () => visibleOptions().find(option => {
      const text = normalizeText(option.textContent);
      return text === target || text.startsWith(target + " ");
    });
    const immediate = find();
    if(immediate) return resolve(immediate);
    const started = Date.now();
    const timer = setInterval(() => {
      const option = find();
      if(option || Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(option || null);
      }
    }, 80);
  });
}

function waitForSelectedText(select, targetText, timeout = 800)
{
  const target = normalizeText(targetText);
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const matched = currentSelectText(select) === target;
      if(matched || Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(matched);
      }
    };
    const timer = setInterval(check, 50);
    check();
  });
}

async function chooseSelect(formControlName, targetText, filled, failed)
{
  const select = document.querySelector(`oh-select[formcontrolname="${formControlName}"]`);
  if(!select || !isVisible(select)) {
    failed.push(formControlName);
    return false;
  }
  if(currentSelectText(select) === normalizeText(targetText)) {
    for(let index = failed.length - 1; index >= 0; index -= 1)
      if(failed[index] === formControlName) failed.splice(index, 1);
    return true;
  }
  await focusBeforeBulkFill(select);
  const trigger = select.querySelector("oh-select-top-control, .ui-select-selector") || select;
  trigger.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
  trigger.click();
  const option = await waitForOption(targetText);
  if(!option) {
    failed.push(formControlName);
    document.body.click();
    return false;
  }
  option.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
  option.click();
  select.dispatchEvent(new Event("change", {bubbles:true}));
  if(!await waitForSelectedText(select, targetText)) {
    failed.push(formControlName);
    return false;
  }
  for(let index = failed.length - 1; index >= 0; index -= 1)
    if(failed[index] === formControlName) failed.splice(index, 1);
  markFilled(select);
  if(!filled.includes(formControlName)) filled.push(formControlName);
  return true;
}

function selectSearchInput(select)
{
  const local = Array.from(select.querySelectorAll('input:not([type="hidden"])')).find(isVisible);
  if(local) return local;
  return Array.from(document.querySelectorAll(
    '.ui-select-dropdown input:not([type="hidden"]), oh-select-dropdown input:not([type="hidden"]), [role="listbox"] input:not([type="hidden"])'
  )).find(isVisible) || null;
}

function waitForSearchInput(select, timeout = 1200)
{
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const input = selectSearchInput(select);
      if(input || Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(input);
      }
    };
    const timer = setInterval(check, 50);
    check();
  });
}

function waitForMatchingOption(targetText, contextText = "", timeout = 5000)
{
  const target = normalizeText(targetText);
  const context = normalizeText(contextText);
  return new Promise(resolve => {
    const started = Date.now();
    const find = () => {
      const options = selectableVisibleOptions();
      const hasContext = option => !context || normalizeText(option.textContent).includes(context);
      return options.find(option => normalizeText(option.textContent) === target && hasContext(option)) ||
        options.find(option => normalizeText(option.textContent).includes(target) && hasContext(option));
    };
    const check = () => {
      const option = find();
      if(option || Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(option || null);
      }
    };
    const timer = setInterval(check, 100);
    check();
  });
}

async function chooseSearchableSelect(formControlName, targetText, filled, failed, contextText = "")
{
  const target = String(targetText || "").trim();
  if(!target) return true;
  const select = await waitForEnabledSelect(formControlName);
  if(!select) {
    failed.push(formControlName);
    return false;
  }
  const selected = currentSelectText(select);
  if(selected === normalizeText(target) || selected.includes(normalizeText(target))) return true;

  await focusBeforeBulkFill(select);
  const trigger = select.querySelector("oh-select-top-control, .ui-select-selector") || select;
  trigger.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
  trigger.click();
  const searchInput = await waitForSearchInput(select);
  if(searchInput) {
    searchInput.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if(setter) setter.call(searchInput, target);
    else searchInput.value = target;
    searchInput.dispatchEvent(new InputEvent("input", {bubbles:true, inputType:"insertText", data:target}));
    searchInput.dispatchEvent(new KeyboardEvent("keyup", {bubbles:true, key:target.slice(-1)}));
    // The form owns the API request. Typing here makes it generate its normal
    // fields/filter/page/size/sort query, including the cap and parent fields.
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  const option = await waitForMatchingOption(target, contextText);
  if(!option) {
    if(!failed.includes(formControlName)) failed.push(formControlName);
    document.body.click();
    return false;
  }
  const optionLabel = String(option.textContent || "").replace(/\s+/g, " ").trim();
  option.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
  option.click();
  select.dispatchEvent(new Event("change", {bubbles:true}));
  if(!await waitForSelectedText(select, optionLabel, 1400)) {
    if(!failed.includes(formControlName)) failed.push(formControlName);
    return false;
  }
  markFilled(select);
  if(!filled.includes(formControlName)) filled.push(formControlName);
  return true;
}

function locationSelect()
{
  return Array.from(document.querySelectorAll('oh-select[formcontrolname="tinhHuyenXa"]')).find(isVisible) || null;
}

function ethnicitySelect()
{
  const target = normalizedFieldLabel("Dân tộc");
  const item = Array.from(document.querySelectorAll("oh-form-item")).find(formItem => {
    const label = formItem.querySelector("oh-form-label label");
    return label && normalizedFieldLabel(label.textContent).includes(target);
  });
  return item?.querySelector("oh-select") || null;
}

function ethnicityOptionLabels()
{
  return [...new Set(selectableVisibleOptions()
    .map(option => String(option.getAttribute("title") || option.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean))].slice(0, 20);
}

let ethnicitySyncRevision = 0;
let ethnicityCatalogCache = [];

async function readAllEthnicityOptions(force = false)
{
  if(!force && ethnicityCatalogCache.length) return {ok:true, options:ethnicityCatalogCache};
  const previousFocus = document.activeElement;
  const select = ethnicitySelect();
  if(!select) return {ok:false, error:"Trang hiện tại không có ô Dân tộc."};
  try {
    document.body.click();
    const trigger = select.querySelector("oh-select-top-control, .ui-select-selector") || select;
    trigger.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
    trigger.click();
    const input = await waitForSearchInput(select);
    if(input) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if(setter) setter.call(input, "");
      else input.value = "";
      input.dispatchEvent(new InputEvent("input", {bubbles:true, inputType:"deleteContentBackward", data:null}));
      input.dispatchEvent(new KeyboardEvent("keyup", {bubbles:true, key:"Backspace"}));
    }
    await new Promise(resolve => setTimeout(resolve, 180));
    const viewport = Array.from(document.querySelectorAll(
      ".cdk-overlay-pane oh-option-container cdk-virtual-scroll-viewport, .cdk-overlay-pane .cdk-virtual-scroll-viewport"
    )).find(isVisible);
    if(!viewport) return {ok:false, error:"Không đọc được danh sách Dân tộc của HMIS."};
    const catalog = new Map();
    const collect = () => {
      Array.from(viewport.querySelectorAll("oh-option-item.ui-select-item-option, oh-option-item"))
        .filter(isVisible)
        .forEach(option => {
          const label = String(option.getAttribute("title") || option.textContent || "").replace(/\s+/g, " ").trim();
          if(label) catalog.set(normalizeText(label), label);
        });
    };
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll", {bubbles:true}));
    await new Promise(resolve => setTimeout(resolve, 100));
    collect();
    let unchanged = 0;
    for(let step = 0; step < 120; step += 1) {
      const before = catalog.size;
      const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      if(viewport.scrollTop >= maxScroll - 2 && unchanged >= 2) break;
      viewport.scrollTop = Math.min(maxScroll, viewport.scrollTop + Math.max(96, viewport.clientHeight * .7));
      viewport.dispatchEvent(new Event("scroll", {bubbles:true}));
      await new Promise(resolve => setTimeout(resolve, 85));
      collect();
      unchanged = catalog.size === before ? unchanged + 1 : 0;
    }
    ethnicityCatalogCache = [...catalog.values()].sort((left, right) => {
      const leftCode = Number(left.match(/^\d+/)?.[0]);
      const rightCode = Number(right.match(/^\d+/)?.[0]);
      if(Number.isFinite(leftCode) && Number.isFinite(rightCode)) return leftCode - rightCode;
      return left.localeCompare(right, "vi");
    });
    return {ok:true, options:ethnicityCatalogCache};
  } finally {
    document.body.click();
    previousFocus?.focus?.({preventScroll:true});
    restoreEthnicityPanelFocus();
  }
}

async function searchEthnicityOptions(query, restorePanelFocus = true)
{
  const previousFocus = document.activeElement;
  const revision = ++ethnicitySyncRevision;
  try {
    const keyword = String(query || "").trim();
    const select = ethnicitySelect();
    if(!select) return {ok:false, error:"Trang hiện tại không có ô Dân tộc."};
    const trigger = select.querySelector("oh-select-top-control, .ui-select-selector") || select;
    if(!select.classList.contains("ui-select-open")) {
      trigger.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
      trigger.click();
    }
    const input = await waitForSearchInput(select);
    if(input) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if(setter) setter.call(input, keyword);
      else input.value = keyword;
      input.dispatchEvent(new InputEvent("input", {bubbles:true, inputType:"insertText", data:keyword}));
      input.dispatchEvent(new KeyboardEvent("keyup", {bubbles:true, key:keyword.slice(-1)}));
    }
    if(restorePanelFocus) restoreEthnicityPanelFocus();
    const normalizedKeyword = normalizeText(keyword);
    const started = Date.now();
    while(Date.now() - started < 4000) {
      if(revision !== ethnicitySyncRevision) return {ok:true, options:[], stale:true};
      const options = ethnicityOptionLabels();
      const matched = normalizedKeyword
        ? options.filter(label => normalizeText(label).includes(normalizedKeyword))
        : options;
      if(matched.length) return {ok:true, options:matched};
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    return {ok:true, options:[]};
  } finally {
    if(restorePanelFocus) {
      previousFocus?.focus?.({preventScroll:true});
      restoreEthnicityPanelFocus();
    }
  }
}

async function selectEthnicityOption(label, query = "", restorePanelFocus = true)
{
  const previousFocus = document.activeElement;
  try {
    const expected = String(label || "").replace(/\s+/g, " ").trim();
    if(!expected) return {ok:false, error:"Dân tộc không hợp lệ."};
    let option = selectableVisibleOptions().find(item =>
      normalizeText(item.getAttribute("title") || item.textContent) === normalizeText(expected)
    );
    if(!option) {
      const searched = await searchEthnicityOptions(query || expected.replace(/^\d+\s*-\s*/, ""), restorePanelFocus);
      if(!searched.ok) return searched;
      option = selectableVisibleOptions().find(item =>
        normalizeText(item.getAttribute("title") || item.textContent) === normalizeText(expected)
      );
    }
    if(!option) return {ok:false, error:`Không còn tìm thấy dân tộc: ${expected}`};
    option.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
    option.click();
    ethnicitySelect()?.dispatchEvent(new Event("change", {bubbles:true}));
    const select = ethnicitySelect();
    const committed = select && await waitForSelectedText(select, expected, 1400);
    if(!committed) return {ok:false, error:"Form chưa nhận lựa chọn Dân tộc."};
    markFilled(select);
    return {ok:true, label:expected};
  } finally {
    if(restorePanelFocus) {
      previousFocus?.focus?.({preventScroll:true});
      restoreEthnicityPanelFocus();
    }
  }
}

function locationOptionLabels()
{
  return [...new Set(selectableVisibleOptions()
    .map(option => String(option.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean))].slice(0, 10);
}

function restoreLocationPanelFocus()
{
  const frame = document.querySelector("#reception-floating-extension iframe");
  frame?.focus?.({preventScroll:true});
  frame?.contentWindow?.postMessage({type:"receptionRestoreLocationFocus"}, "*");
}

function restoreEthnicityPanelFocus()
{
  const frame = document.querySelector("#reception-floating-extension iframe");
  frame?.focus?.({preventScroll:true});
  frame?.contentWindow?.postMessage({type:"receptionRestoreEthnicityFocus"}, "*");
}

let locationSyncRevision = 0;

async function syncLocationQuery(query, restorePanelFocus = true)
{
  const previousFocus = document.activeElement;
  const revision = ++locationSyncRevision;
  try {
  const keyword = String(query || "").trim();
  if(keyword.length < 2) return {ok:true, options:[]};
  const select = locationSelect();
  if(!select) return {ok:false, error:"Trang hiện tại không có ô Tỉnh/Xã (tinhHuyenXa)."};

  const trigger = select.querySelector("oh-select-top-control, .ui-select-selector") || select;
  if(!select.classList.contains("ui-select-open")) {
    trigger.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
    trigger.click();
    if(restorePanelFocus) restoreLocationPanelFocus();
  }
  const input = await waitForSearchInput(select);
  if(!input) return {ok:false, error:"Không tìm thấy ô tìm kiếm Tỉnh/Xã của form."};
  if(revision !== locationSyncRevision) return {ok:true, stale:true};
  if(restorePanelFocus) restoreLocationPanelFocus();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if(setter) setter.call(input, keyword);
  else input.value = keyword;
  input.dispatchEvent(new InputEvent("input", {bubbles:true, inputType:"insertText", data:keyword}));
  input.dispatchEvent(new KeyboardEvent("keyup", {bubbles:true, key:keyword.slice(-1)}));
  if(restorePanelFocus) restoreLocationPanelFocus();
  return {ok:true};
  } finally {
    if(restorePanelFocus) {
      previousFocus?.focus?.({preventScroll:true});
      restoreLocationPanelFocus();
    }
  }
}

async function readLocationOptions(query, timeout = 6000)
{
  const keyword = String(query || "").trim();
  const revision = locationSyncRevision;
  // The form debounces ohOnSearch before issuing its own authenticated API
  // request. Wait for options that contain the typed term and return at most 10.
  const normalizedKeyword = normalizeText(keyword);
  const started = Date.now();
  while(Date.now() - started < timeout) {
    if(revision !== locationSyncRevision) return {ok:true, options:[], stale:true};
    const options = locationOptionLabels();
    const matched = options.filter(label => normalizeText(label).includes(normalizedKeyword));
    if(matched.length) return {ok:true, options:matched};
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return {ok:true, options:[]};
}

async function searchLocationOptions(query, restorePanelFocus = true)
{
  const synced = await syncLocationQuery(query, restorePanelFocus);
  if(!synced.ok || synced.stale) return synced;
  return readLocationOptions(query);
}

async function selectLocationOption(label, query = "", restorePanelFocus = true)
{
  const previousFocus = document.activeElement;
  try {
  const expected = String(label || "").replace(/\s+/g, " ").trim();
  if(!expected) return {ok:false, error:"Địa điểm không hợp lệ."};
  let option = selectableVisibleOptions().find(item =>
    normalizeText(item.textContent) === normalizeText(expected)
  );
  if(!option) {
    const searched = await searchLocationOptions(query || expected.split(" - ")[0], restorePanelFocus);
    if(!searched.ok) return searched;
    option = selectableVisibleOptions().find(item =>
      normalizeText(item.textContent) === normalizeText(expected)
    );
  }
  if(!option) return {ok:false, error:`Không còn tìm thấy địa điểm: ${expected}`};
  option.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
  option.click();
  locationSelect()?.dispatchEvent(new Event("change", {bubbles:true}));
  const select = locationSelect();
  const committed = select && await waitForSelectedText(select, expected, 1400);
  if(!committed) return {ok:false, error:"Form chưa nhận lựa chọn Tỉnh/Xã."};
  markFilled(select);
  revealLiveField("location");
  return {ok:true, label:expected};
  } finally {
    if(restorePanelFocus) {
      previousFocus?.focus?.({preventScroll:true});
      restoreLocationPanelFocus();
    }
  }
}

function currentLocation()
{
  const select = locationSelect();
  const item = select?.querySelector("oh-select-item, .ui-select-selection-item");
  const label = String(item?.textContent || "").replace(/\s+/g, " ").trim();
  return {ok:!!select, label};
}

async function applyLockedLocation(label)
{
  if(!location.pathname.includes("/ngoaitru/tnkb/tiepnhan"))
    return {ok:false, notReception:true};
  const expected = String(label || "").replace(/\s+/g, " ").trim();
  if(!expected) return {ok:false, error:"Chưa có địa chỉ được khóa."};
  const select = await waitForEnabledSelect("tinhHuyenXa", 8000);
  if(!select) return {ok:false, error:"Form Tiếp nhận chưa sẵn sàng ô Tỉnh/Xã."};
  const current = currentLocation();
  if(current.label) return {
    ok:true,
    label:current.label,
    alreadyFilled:true,
    locked:normalizeText(current.label) === normalizeText(expected)
  };
  const selected = await selectLocationOption(expected, expected.split(" - ")[0], false);
  return {...selected, autoFilled:selected.ok === true};
}

const LIVE_INPUT_CONTROLS = {
  fullName:"hoTen",
  identity:"cccd",
  contactPhone:"sdtNLH",
  guardianName:"nguoiLH",
  addressDetail:"soNha"
};

const LIVE_EXAM_LABELS = {
  companionIdentity:"Mã định danh/CCCD người đi cùng trẻ",
  temperature:"Nhiệt độ (°C)",
  pulse:"Mạch (lần/phút)",
  respiratoryRate:"Nhịp thở (lần/phút)",
  lengthCm:"Chiều dài (cm)",
  weightKg:"Cân nặng (kg)",
  headCircumferenceCm:"Vòng đầu (cm)",
  armCircumferenceMm:"Chu vi vòng cánh tay (mm)"
};

const LIVE_QUESTION_LABELS = {
  autismRisk:"Trẻ có nguy cơ tự kỷ (với trẻ từ 16-30 tháng tuổi)",
  vaccinationComplete:"Tiêm chủng đầy đủ các loại vắc xin theo độ tuổi",
  runnyNose:"Chảy nước mũi",
  stuffyNose:"Nghẹt mũi",
  dentalCaries:"Vết sâu, mảng bám, lỗ trên răng",
  neonatalTeeth:"Răng sữa sơ sinh",
  graspReflex:"Phản xạ nắm",
  moroReflex:"Phản xạ Moro"
};

async function selectHealthConclusionCheckbox(labelText, enabled, resultName, filled, failed)
{
  const root = document.querySelector("app-kham-suc-khoe-tre-duoi-6-tuoi") || document;
  const conclusionTitle = Array.from(root.querySelectorAll("span")).find(span =>
    normalizedQuestionText(span.textContent) === normalizedQuestionText("Kết luận về sức khỏe")
  );
  const scope = conclusionTitle?.closest("oh-collapse-panel") || conclusionTitle?.parentElement;
  const targetText = normalizeText(labelText);
  const target = Array.from(scope?.querySelectorAll?.("label[oh-checkbox]") || []).find(label =>
    normalizeText(label.textContent) === targetText
  );
  const checkbox = target?.querySelector('input[type="checkbox"]');
  if(!target || !checkbox) {
    failed.push(resultName);
    return false;
  }
  await focusBeforeBulkFill(target);
  if(checkbox.checked !== enabled) checkbox.click();
  if(checkbox.checked !== enabled) {
    failed.push(resultName);
    return false;
  }
  markFilled(target);
  filled.push(resultName);
  return true;
}

function questionElement(questionText)
{
  const root = document.querySelector("app-kham-suc-khoe-tre-duoi-6-tuoi") || document;
  const target = normalizedQuestionText(questionText);
  const question = Array.from(root.querySelectorAll("span")).find(span =>
    normalizedQuestionText(span.textContent) === target
  );
  return question?.closest("[oh-col]") || question || null;
}

function liveFieldElement(field)
{
  if(LIVE_INPUT_CONTROLS[field]) return findInput(LIVE_INPUT_CONTROLS[field]);
  if(LIVE_EXAM_LABELS[field]) return findInputByLabel(LIVE_EXAM_LABELS[field]);
  if(LIVE_QUESTION_LABELS[field]) return questionElement(LIVE_QUESTION_LABELS[field]);
  if(field === "birthDate") return Array.from(document.querySelectorAll(
    'oh-date-picker[formcontrolname="ngaySinh"] input[placeholder="dd/mm/yyyy"]'
  )).find(isVisible) || null;
  if(field === "gender") return document.querySelector('oh-select[formcontrolname="gioiTinh"]');
  if(field === "guardianRelationship") {
    return document.querySelector('oh-select[formcontrolname="moiQuanHe"]') ||
      document.querySelector("app-kham-suc-khoe-tre-duoi-6-tuoi");
  }
  if(field === "location") return locationSelect();
  return null;
}

function revealLiveField(field)
{
  ensureHighlightStyle();
  document.querySelectorAll(".reception-autofill-active").forEach(element =>
    element.classList.remove("reception-autofill-active")
  );
  const element = liveFieldElement(field);
  if(!element || !isVisible(element)) return {ok:false, missing:true};
  const highlight = element.closest("oh-date-picker, oh-select, oh-form-item") || element;
  highlight.classList.add("reception-autofill-active");
  highlight.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
  return {ok:true};
}

function setLiveInput(input, value)
{
  if(!input || !isVisible(input)) return false;
  nativeSetValue(input, String(value ?? ""));
  markFilled(input);
  return true;
}

async function liveFillField(field, value, data = {})
{
  revealLiveField(field);
  const filled = [];
  const failed = [];
  if(LIVE_INPUT_CONTROLS[field]) {
    const input = findInput(LIVE_INPUT_CONTROLS[field]);
    const liveValue = ["identity", "contactPhone"].includes(field)
      ? String(value || "").replace(/\D/g, "")
      : value;
    if(!setLiveInput(input, liveValue)) return {ok:false, missing:true};
    if(field === "addressDetail") scheduleGuardianAddressSync();
    return {ok:true};
  }
  if(LIVE_EXAM_LABELS[field]) {
    const input = findInputByLabel(LIVE_EXAM_LABELS[field]);
    const transformed = field === "companionIdentity"
      ? String(value || "").replace(/\D/g, "")
      : field === "armCircumferenceMm" ? armCircumferenceValue(value) : decimalValue(value);
    return {ok:setLiveInput(input, transformed), missing:!input};
  }
  if(field === "birthDate") {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    const input = liveFieldElement(field);
    if(!input) return {ok:false, missing:true};
    if(digits.length === 8) {
      const skipped = [];
      await fillBirthDate(digits, true, filled, skipped, failed);
      revealLiveField(field);
      return {ok:failed.length === 0};
    }
    return {ok:setLiveInput(input, digits)};
  }
  if(field === "gender") {
    const ok = await chooseSelect("gioiTinh", String(value || "Nam"), filled, failed);
    revealLiveField(field);
    return {ok};
  }
  if(field === "guardianRelationship") {
    const isExam = !!document.querySelector("app-kham-suc-khoe-tre-duoi-6-tuoi");
    const ok = isExam
      ? await selectUnderSixRelationship(String(value || "Mẹ"), filled, failed)
      : await chooseSelect("moiQuanHe", RELATIONSHIP_TARGETS[value] || value, filled, failed);
    revealLiveField(field);
    return {ok};
  }
  if(LIVE_QUESTION_LABELS[field]) {
    const ok = await selectQuestionBoolean(LIVE_QUESTION_LABELS[field], value === true, field, filled, failed);
    revealLiveField(field);
    return {ok};
  }
  return {ok:true, ignored:true};
}

function selectableVisibleOptions()
{
  return visibleOptions().filter(option => {
    const text = normalizeText(option.textContent);
    return text &&
      option.getAttribute("aria-disabled") !== "true" &&
      !option.classList.contains("ui-select-item-option-disabled");
  });
}

function waitForSelectableOptions(timeout = 4000)
{
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const options = selectableVisibleOptions();
      if(options.length || Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(options);
      }
    };
    const timer = setInterval(check, 80);
    check();
  });
}

function waitForEnabledSelect(formControlName, timeout = 4000)
{
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const select = document.querySelector(`oh-select[formcontrolname="${formControlName}"]`);
      const disabled = select?.classList.contains("ui-select-disabled") ||
        select?.querySelector("input")?.disabled;
      if((select && isVisible(select) && !disabled) || Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(select && !disabled ? select : null);
      }
    };
    const timer = setInterval(check, 80);
    check();
  });
}

async function chooseFirstSelectOption(formControlName, filled, failed)
{
  const select = await waitForEnabledSelect(formControlName);
  if(!select) {
    failed.push(formControlName);
    return false;
  }
  await focusBeforeBulkFill(select);
  const trigger = select.querySelector("oh-select-top-control, .ui-select-selector") || select;
  trigger.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
  trigger.click();
  const options = await waitForSelectableOptions();
  const option = options[0];
  if(!option) {
    failed.push(formControlName);
    document.body.click();
    return false;
  }
  option.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
  option.click();
  select.dispatchEvent(new Event("change", {bubbles:true}));
  markFilled(select);
  filled.push(formControlName);
  return true;
}

function decimalValue(value)
{
  return String(value ?? "").trim().replace(/\s+/g, "").replace(",", ".");
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

async function fillUnderSixExamForm(data)
{
  const filled = [];
  const skipped = [];
  const failed = [];
  const overwrite = data.overwrite === true;
  const companionIdentity = String(data.companionIdentity || "").replace(/\D/g, "");
  if(companionIdentity && companionIdentity.length !== 12)
    return {ok:false, error:"CCCD người đi cùng trẻ phải có đúng 12 chữ số."};

  await selectQuestionBoolean("Sinh non", data.premature === true,
    "sinhNon", filled, failed);
  await selectUnderSixRelationship(data.guardianRelationship || "Mẹ", filled, failed);
  await fillLabeledInput("Mã định danh/CCCD người đi cùng trẻ", companionIdentity,
    "cccdNguoiDiCung", overwrite, filled, skipped, failed);
  await fillLabeledInput("Nhiệt độ (°C)", decimalValue(data.temperature || "37"),
    "nhietDo", overwrite, filled, skipped, failed);
  await fillLabeledInput("Mạch (lần/phút)", decimalValue(data.pulse || "92"),
    "mach", overwrite, filled, skipped, failed);
  await fillLabeledInput("Nhịp thở (lần/phút)", decimalValue(data.respiratoryRate || "22"),
    "nhipTho", overwrite, filled, skipped, failed);
  await fillLabeledInput("Chiều dài (cm)", decimalValue(data.lengthCm),
    "chieuDai", overwrite, filled, skipped, failed);
  await fillLabeledInput("Cân nặng (kg)", decimalValue(data.weightKg),
    "canNang", overwrite, filled, skipped, failed);
  await fillLabeledInput("Vòng đầu (cm)", decimalValue(data.headCircumferenceCm || "50"),
    "vongDau", overwrite, filled, skipped, failed);
  await fillLabeledInput("Chu vi vòng cánh tay (mm)", armCircumferenceValue(data.armCircumferenceMm),
    "vongCanhTay", overwrite, filled, skipped, failed);
  await selectQuestionBoolean("Trẻ có nguy cơ tự kỷ (với trẻ từ 16-30 tháng tuổi)",
    data.autismRisk === true, "nguyCoTuKy", filled, failed);
  await selectQuestionBoolean("Tiêm chủng đầy đủ các loại vắc xin theo độ tuổi",
    data.vaccinationComplete !== false, "tiemChungDayDu", filled, failed);
  await selectQuestionBoolean("Bản thân", data.historySelf === true,
    "tienSuBanThan", filled, failed);
  if(data.historySelf === true)
    await fillHistoryNote("Bản thân", data.historySelfNote,
      "tienSuBanThanGhiChu", overwrite, filled, skipped, failed);
  await selectQuestionBoolean("Gia đình", data.historyFamily === true,
    "tienSuGiaDinh", filled, failed);
  if(data.historyFamily === true)
    await fillHistoryNote("Gia đình", data.historyFamilyNote,
      "tienSuGiaDinhGhiChu", overwrite, filled, skipped, failed);
  await selectQuestionBoolean("Tiền sử tiếp xúc với người bệnh lao", data.historyTuberculosis === true,
    "tienSuTiepXucLao", filled, failed);
  await selectQuestionBoolean("Chảy nước mũi", data.runnyNose === true,
    "chayNuocMui", filled, failed);
  await selectQuestionBoolean("Nghẹt mũi", data.stuffyNose === true,
    "nghetMui", filled, failed);
  await selectQuestionBoolean("Răng sữa sơ sinh", data.neonatalTeeth === true,
    "rangSuaSoSinh", filled, failed);
  await selectQuestionBoolean("Vết sâu, mảng bám, lỗ trên răng", data.dentalCaries === true,
    "vetSauRang", filled, failed);
  await selectQuestionBoolean("Phản xạ nắm", data.graspReflex !== false,
    "phanXaNam", filled, failed);
  await selectQuestionBoolean("Phản xạ Moro", data.moroReflex !== false,
    "phanXaMoro", filled, failed);
  const hasAbnormalConclusion = data.healthConclusionTuberculosisRisk === true ||
    data.healthConclusionProblem === true;
  await selectHealthConclusionCheckbox("Bình thường", !hasAbnormalConclusion,
    "ketLuanBinhThuong", filled, failed);
  await selectHealthConclusionCheckbox("Có nguy cơ mắc lao (tiền sử tiếp xúc)",
    data.healthConclusionTuberculosisRisk === true, "ketLuanNguyCoLao", filled, failed);
  await selectHealthConclusionCheckbox("Có vấn đề về sức khỏe", data.healthConclusionProblem === true,
    "ketLuanCoVanDeSucKhoe", filled, failed);
  if(hasAbnormalConclusion)
    await fillLabeledInput("Ghi rõ", data.healthConclusionReason,
      "ketLuanGhiRo", overwrite, filled, skipped, failed);

  return {ok:true, filled, skipped, failed};
}

let existingPatientCheckRequestId = 0;

function requestExistingPatientCheck(data)
{
  const requestId = `existing-${Date.now()}-${++existingPatientCheckRequestId}`;
  return new Promise(resolve => {
    let finished = false;
    const finish = result => {
      if(finished) return;
      finished = true;
      clearTimeout(timer);
      document.removeEventListener("reception-existing-patient-result", onResult);
      resolve(result);
    };
    const onResult = event => {
      try {
        const result = JSON.parse(String(event.detail || "{}"));
        if(result.requestId === requestId) finish(result);
      } catch {}
    };
    document.addEventListener("reception-existing-patient-result", onResult);
    const timer = setTimeout(() => finish({
      ok:false,
      error:"Quá thời gian chờ API kiểm tra bệnh nhân đã tiếp nhận. Form chưa được điền."
    }), 105000);
    document.dispatchEvent(new CustomEvent("reception-check-existing-patient", {
      detail:JSON.stringify({
        requestId,
        fullName:String(data.fullName || "").trim(),
        birthDate:String(data.birthDate || "").replace(/\D/g, "").slice(0, 8),
        gender:data.gender === "Nữ" ? "Nữ" : "Nam",
        fromDate:String(data.existingPatientFromDate || ""),
        toDate:String(data.existingPatientToDate || "")
      })
    }));
  });
}

function existingPatientWarning(matches, data)
{
  const first = matches[0] || {};
  const more = matches.length > 1 ? `\nSố bản ghi trùng: ${matches.length}` : "";
  return [
    "CẢNH BÁO: Bệnh nhân có thể đã được tiếp nhận.",
    "",
    `Họ tên: ${first.fullName || data.fullName}`,
    `Ngày sinh: ${first.birthDate || data.birthDate}`,
    `Giới tính: ${first.gender || data.gender}`,
    first.identity ? `CCCD: ${first.identity}` : "",
    first.patientCode ? `Mã bệnh nhân: ${first.patientCode}` : "",
    first.receptionDate ? `Ngày tiếp nhận: ${first.receptionDate}` : "",
    more,
    "",
    "Nhấn OK để vẫn tiếp tục điền form. Nhấn Hủy để dừng."
  ].filter(line => line !== "").join("\n");
}

async function fillReceptionFormCore(data)
{
  const isReceptionForm = !!document.querySelector('input[formcontrolname="hoTen"]');
  const isUnderSixExamForm = !!findInputByLabel("Mã định danh/CCCD người đi cùng trẻ");
  if(!isReceptionForm && isUnderSixExamForm)
    return fillUnderSixExamForm(data);
  if(!isReceptionForm)
    return {ok:false, error:"Trang hiện tại không có form tiếp nhận bệnh nhân."};

  if(data.checkExistingPatient === true) {
    const check = await requestExistingPatientCheck(data);
    if(!check?.ok)
      return {ok:false, checkFailed:true, error:check?.error || "Không kiểm tra được bệnh nhân đã tiếp nhận; form chưa được điền."};
    const matches = Array.isArray(check.matches) ? check.matches : [];
    if(matches.length && !window.confirm(existingPatientWarning(matches, data)))
      return {ok:false, cancelled:true, error:"Đã dừng theo yêu cầu vì bệnh nhân đã tồn tại trong khoảng ngày kiểm tra."};
  }

  const identity = String(data.identity || "").replace(/\D/g, "");
  const contactPhone = String(data.contactPhone || "").replace(/\D/g, "");
  if(identity && identity.length !== 12)
    return {ok:false, error:"CCCD phải có đúng 12 chữ số."};
  if(contactPhone && contactPhone.length !== 10)
    return {ok:false, error:"Số điện thoại phải có đúng 10 chữ số."};
  const location = String(data.location || "").trim();

  const filled = [];
  const skipped = [];
  const failed = [];
  const overwrite = data.overwrite === true;

  if(location) {
    const current = currentLocation().label;
    if(normalizeText(current) !== normalizeText(location)) {
      const searchTerm = String(data.locationQuery || location.split(" - ")[0]).trim();
      const locationSelected = await chooseSearchableSelect(
        "tinhHuyenXa", searchTerm, filled, failed, location
      );
      if(!locationSelected)
        return {ok:false, error:`Không tìm thấy Tỉnh/Xã: ${location}`};
    } else if(!filled.includes("tinhHuyenXa")) {
      filled.push("tinhHuyenXa");
    }
  }

  // Resolve dependent location controls first. If either lookup fails, stop
  // before mutating the remaining patient fields.
  await fillInput("hoTen", data.fullName, overwrite, filled, skipped);
  await fillInput("cccd", identity, overwrite, filled, skipped);
  await fillInput("sdtNLH", contactPhone, overwrite, filled, skipped);
  await fillInput("nguoiLH", data.guardianName, overwrite, filled, skipped);

  // The extension input maps directly to the field labelled “Số nhà”. After
  // Angular refreshes “Địa chỉ BN”, reuse that full address for the guardian.
  if(data.addressDetail) {
    await fillInput("soNha", data.addressDetail, overwrite, filled, skipped);
    const patientAddress = await waitForInputValue("diaChi");
    await fillInput("diaChiLH", patientAddress || data.addressDetail, overwrite, filled, skipped);
    scheduleGuardianAddressSync();
  }

  await chooseSelect("doiTuongBN", "Miễn phí", filled, failed);
  const targetGender = data.gender || "Nam";
  // Select gender first, then enter birth date as required by the page flow.
  await chooseSelect("gioiTinh", targetGender, filled, failed);
  await fillBirthDate(data.birthDate, overwrite, filled, skipped, failed);
  // Some page calculations can reset gender after the birth date changes.
  // Re-assert the requested value only when that actually happened.
  const genderSelect = document.querySelector('oh-select[formcontrolname="gioiTinh"]');
  if(genderSelect && currentSelectText(genderSelect) !== normalizeText(targetGender))
    await chooseSelect("gioiTinh", targetGender, filled, failed);
  await fillEthnicity(data.ethnicity, overwrite, filled, skipped, failed);
  if(data.guardianRelationship) {
    const targetRelationship = RELATIONSHIP_TARGETS[data.guardianRelationship] || data.guardianRelationship;
    await chooseSelect("moiQuanHe", targetRelationship, filled, failed);
  }
  await chooseSelect("lyDoTiepNhan", "Khám bệnh", filled, failed);
  await fillInput("lyDoVaoVien", data.admissionReason || "Khám sức khỏe", overwrite, filled, skipped);
  await chooseSelect("the", "Định danh công dân", filled, failed);
  const examRequestSelected = await chooseSelect("yeuCauKham", EXAM_REQUEST_UNDER_SIX, filled, failed);
  if(examRequestSelected) {
    // The clinic list is loaded only after the examination request changes.
    await new Promise(resolve => setTimeout(resolve, 300));
    await chooseFirstSelectOption("phongKham", filled, failed);
  }

  return {ok:true, filled, skipped, failed};
}

async function fillReceptionForm(data)
{
  const previous = bulkFillFocusEnabled;
  const previousDelay = bulkFillStepDelayMs;
  bulkFillFocusEnabled = true;
  const seconds = Number(String(data.fieldDelaySeconds ?? "0.25").replace(",", "."));
  bulkFillStepDelayMs = Math.round(Math.min(Math.max(Number.isFinite(seconds) ? seconds : .25, .1), 5) * 1000);
  try {
    return await fillReceptionFormCore(data);
  } finally {
    bulkFillFocusEnabled = previous;
    bulkFillStepDelayMs = previousDelay;
  }
}

function workflowActionDescription(button)
{
  return normalizeText([
    button?.textContent,
    button?.getAttribute?.("title"),
    button?.getAttribute?.("aria-label"),
    button?.getAttribute?.("ohtooltiptitle"),
    button?.id
  ].filter(Boolean).join(" "));
}

function findWorkflowSaveButton()
{
  if(onUnderSixHealthExamPage()) {
    const exact = document.querySelector(
      "app-kham-suc-khoe-tre-duoi-6-tuoi his-action-bar button#luu, his-action-bar button#luu"
    );
    // Never fall through to #luuIn while the real KSK save button is still
    // disabled during Angular loading/saving.
    return isVisible(exact) && !exact.disabled ? exact : null;
  }
  return Array.from(document.querySelectorAll("button")).find(button => {
    if(!isVisible(button) || button.closest(".signer-container")) return false;
    const description = workflowActionDescription(button);
    return /(^|\s)luu(?:\s|$|\()/.test(description) &&
      !description.includes("luu ky") && !description.includes("hoan tat ky so") &&
      !description.includes("huy");
  }) || null;
}

function waitForWorkflowElement(getElement, timeout = 30000)
{
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const element = getElement();
      if(element || Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(element || null);
      }
    };
    const timer = setInterval(check, 120);
    check();
  });
}

function activateWorkflowButton(button)
{
  if(!button || !isVisible(button)) return false;
  button.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
  button.focus({preventScroll:true});
  button.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
  button.dispatchEvent(new MouseEvent("mouseup", {bubbles:true, cancelable:true, view:window}));
  button.click();
  return true;
}

async function startFullAutoWorkflow(data)
{
  const isReceptionForm = !!document.querySelector('input[formcontrolname="hoTen"]');
  const isHealthForm = onUnderSixHealthExamPage();
  if(!isReceptionForm && !isHealthForm)
    return {ok:false, error:"Auto hoàn toàn chỉ bắt đầu tại form Tiếp nhận hoặc phiếu KSK dưới 6 tuổi."};

  const normalizedData = {...(data || {}), fullAutoWorkflow:true};
  sessionStorage.setItem(FULL_AUTO_PANEL_EDIT_KEY, "1");
  await chrome.storage.local.set({
    receptionAutofillData:normalizedData,
    [FULL_AUTO_WORKFLOW_KEY]:{
      active:true,
      stage:isReceptionForm ? "saving-reception" : "saving-health",
      // Keep an immutable patient snapshot for this cycle. The panel may now
      // be edited for the next patient while the current cycle continues.
      data:normalizedData,
      createdAt:Date.now(),
      updatedAt:Date.now()
    }
  });

  if(isHealthForm) {
    resumeFullAutoWorkflow().catch(error => failFullAutoWorkflow(error.message));
    return {ok:true, stage:"saving-health"};
  }

  const saveButton = await waitForWorkflowElement(findWorkflowSaveButton, 10000);
  if(!saveButton) {
    await failFullAutoWorkflow("Auto hoàn toàn đã dừng: không tìm thấy nút Lưu của form Tiếp nhận.");
    return {ok:false, error:"Không tìm thấy nút Lưu của form Tiếp nhận."};
  }
  setFloatingWorkflowStatus("Auto hoàn toàn: đã điền form Tiếp nhận, đang Lưu…", "info");
  activateWorkflowButton(saveButton);
  setTimeout(async () => {
    const workflow = await readFullAutoWorkflow();
    if(workflow?.stage === "saving-reception")
      await failFullAutoWorkflow("Auto hoàn toàn đã dừng: quá 60 giây chưa nhận được kết quả Lưu form Tiếp nhận.");
  }, 60000);
  return {ok:true, stage:"saving-reception"};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let task;
  if(message?.action === "fillReceptionForm") task = fillReceptionForm(message.data || {});
  else if(message?.action === "startFullAutoWorkflow") task = startFullAutoWorkflow(message.data || {});
  else if(message?.action === "checkExistingPatientPreview") {
    const isReceptionForm = !!document.querySelector('input[formcontrolname="hoTen"]');
    task = isReceptionForm
      ? requestExistingPatientCheck(message.data || {})
      : Promise.resolve({ok:false, notReception:true});
  }
  else if(message?.action === "searchLocationOptions") task = searchLocationOptions(message.query);
  else if(message?.action === "syncLocationQuery") task = syncLocationQuery(message.query);
  else if(message?.action === "readLocationOptions") task = readLocationOptions(message.query);
  else if(message?.action === "selectLocationOption") task = selectLocationOption(message.label, message.query);
  else if(message?.action === "searchEthnicityOptions") task = searchEthnicityOptions(message.query);
  else if(message?.action === "readAllEthnicityOptions") task = readAllEthnicityOptions(message.force === true);
  else if(message?.action === "selectEthnicityOption") task = selectEthnicityOption(message.label, message.query);
  else if(message?.action === "applyLockedLocation") task = applyLockedLocation(message.label);
  else if(message?.action === "getCurrentLocation") task = Promise.resolve(currentLocation());
  else if(message?.action === "revealLiveField") task = Promise.resolve(revealLiveField(message.field));
  else if(message?.action === "liveFillField") task = liveFillField(message.field, message.value, message.data || {});
  else if(message?.action === "hideFloatingDuringFill") task = Promise.resolve(hideFloatingDuringFill());
  else if(message?.action === "showFloatingAfterFill") task = Promise.resolve(showFloatingAfterFill());
  else if(message?.action === "restoreFloatingAfterFailedFill") task = restoreFloatingAfterFailedFill();
  else if(message?.action === "resetFloatingSize") task = resetFloatingSize();
  else if(message?.action === "resetReceptionWorkflow") task = resetReceptionWorkflow();
  else if(message?.action === "goToReceptionForm") task = Promise.resolve(goToReceptionForm());
  else if(message?.action === "toggleFloatingExtension") task = toggleFloatingExtension();
  else return;
  task.then(sendResponse).catch(error => sendResponse({ok:false, error:error.message}));
  return true;
});

function ensureFloatingExtensionStyle()
{
  if(document.getElementById("reception-floating-extension-style")) return;
  const style = document.createElement("style");
  style.id = "reception-floating-extension-style";
  style.textContent = `
    #reception-floating-extension{position:fixed;z-index:2147483645;top:10px;right:0;width:min(430px,calc(100vw - 12px));height:calc(100vh - 20px);min-width:350px;min-height:320px;max-width:calc(100vw - 12px);max-height:calc(100vh - 12px);transition:transform .22s ease;filter:drop-shadow(-5px 6px 14px rgba(15,35,55,.24));isolation:isolate}
    #reception-floating-extension iframe{position:absolute;top:0;right:0;width:calc(100% - 34px);height:100%;border:1px solid #aebdcd;border-radius:10px 0 0 10px;background:#f4f7fb}
    #reception-floating-extension .rfe-toggle{position:absolute;z-index:2;top:50%;left:0;width:34px;height:58px;padding:0;transform:translateY(-50%);border:0;border-radius:8px 0 0 8px;background:#0b6bc0;color:#fff;font:700 28px/1 Arial,sans-serif;cursor:pointer;box-shadow:-3px 2px 9px rgba(15,35,55,.22)}
    #reception-floating-extension .rfe-resize{position:absolute;z-index:3;bottom:0;left:0;width:34px;height:34px;border:0;border-radius:8px 0 0 0;background:rgba(11,107,192,.88);cursor:nesw-resize}
    #reception-floating-extension .rfe-resize:before{content:"↗";display:block;color:#fff;font:700 18px/34px Arial;text-align:center}
    #reception-floating-extension.rfe-collapsed,#reception-floating-extension.rfe-fill-hidden{transform:translateX(calc(100% - 34px));filter:none}
    #reception-floating-extension.rfe-collapsed iframe,#reception-floating-extension.rfe-fill-hidden iframe{visibility:hidden;pointer-events:none}
    #reception-floating-extension.rfe-list-compact{width:min(360px,calc(100vw - 12px))!important;height:184px!important}
    #reception-floating-extension.rfe-collapsed .rfe-resize,#reception-floating-extension.rfe-fill-hidden .rfe-resize,#reception-floating-extension.rfe-list-compact .rfe-resize{display:none}
    #reception-existing-patient-overlay{position:fixed;z-index:2147483646;top:14px;left:14px;width:max-content;height:36px;font-family:Arial,"Segoe UI",sans-serif;color:#182230}
    #reception-existing-patient-overlay.rpe-dragging,#reception-existing-patient-overlay.rpe-dragging *{cursor:grabbing!important;user-select:none!important}
    #reception-existing-patient-status{height:36px;min-width:98px;padding:0 13px;border:1px solid #98a2b3;border-radius:18px;background:#f2f4f7;color:#667085;box-shadow:0 4px 14px rgba(15,35,55,.22);font:800 12px/1 Arial,sans-serif;cursor:grab}
    #reception-existing-patient-status.rpe-checking,#reception-existing-patient-status.rpe-clear{border-color:#299653;background:#dff5e7;color:#16713a}
    #reception-existing-patient-status.rpe-warning{border-color:#e5a000;background:#fff0ad;color:#7a5000}
    #reception-existing-patient-status.rpe-identity-match{border-color:#c53030;background:#ffd9d9;color:#8f1616}
    #reception-existing-patient-status.rpe-error{border-color:#d85858;background:#fdeaea;color:#9b2525}
    #reception-existing-patient-panel{position:fixed;z-index:2147483647;width:min(390px,calc(100vw - 16px));padding:8px;border:1px solid #e5a000;border-radius:10px;background:#fff9df;color:#684900;box-shadow:0 10px 28px rgba(15,35,55,.3);font:600 12px/1.4 Arial,sans-serif}
    #reception-existing-patient-panel.rpe-identity-panel{border-color:#c53030;background:#fff0f0;color:#861919}
    #reception-existing-patient-panel[hidden]{display:none!important}
    #reception-existing-patient-panel .rpe-head{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:6px;min-height:32px;cursor:grab}
    #reception-existing-patient-panel .rpe-title{font-size:13px;font-weight:900}
    #reception-existing-patient-panel .rpe-expand,#reception-existing-patient-panel .rpe-close{min-height:28px;padding:0 9px;border:0;border-radius:6px;background:rgba(255,255,255,.75);color:inherit;font:800 11px/1 Arial,sans-serif;cursor:pointer}
    #reception-existing-patient-panel .rpe-close{width:28px;padding:0;font-size:18px}
    #reception-existing-patient-panel .rpe-body{max-height:min(58vh,430px);margin-top:5px;padding-top:7px;overflow:auto;border-top:1px solid rgba(104,73,0,.22)}
    #reception-existing-patient-panel .rpe-body[hidden]{display:none!important}
    #reception-existing-patient-panel .rpe-range{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0 0 7px;padding:7px;border-radius:7px;background:rgba(255,255,255,.58)}
    #reception-existing-patient-panel .rpe-range label{display:grid;gap:3px;font:600 11px/1.2 Arial,"Segoe UI",sans-serif}
    #reception-existing-patient-panel .rpe-range input{width:100%;min-width:0;height:30px;padding:3px 5px;border:1px solid rgba(104,73,0,.3);border-radius:5px;background:#fff;color:#3f3208;font:400 11px/1 Arial,"Segoe UI",sans-serif}
    #reception-existing-patient-panel details{margin-bottom:6px;border:1px solid rgba(104,73,0,.25);border-radius:7px;background:rgba(255,255,255,.68)}
    #reception-existing-patient-panel details.rpe-identity-match{border-color:#cf3030;background:#ffe1e1;color:#861919;box-shadow:inset 4px 0 0 #c62828}
    #reception-existing-patient-panel summary{padding:7px;font-weight:800;cursor:pointer}
    #reception-existing-patient-panel dl{display:grid;grid-template-columns:105px minmax(0,1fr);gap:4px 7px;margin:0;padding:0 8px 8px}
    #reception-existing-patient-panel dt{font-weight:800}
    #reception-existing-patient-panel dd{min-width:0;margin:0;overflow-wrap:anywhere}
    #reception-existing-patient-panel .rpe-identity-value{color:#b42318;font-weight:900}
    #reception-existing-patient-panel hr{grid-column:1/-1;width:100%;height:1px;margin:2px 0;border:0;background:rgba(104,73,0,.16)}
    #reception-existing-patient-panel hr:last-child{display:none}
  `;
  (document.head || document.documentElement).appendChild(style);
}

function clampFloatingSize(width, height)
{
  return {
    width:Math.round(Math.min(Math.max(Number(width) || 430, 350), Math.max(350, innerWidth - 12))),
    height:Math.round(Math.min(Math.max(Number(height) || innerHeight - 20, 320), Math.max(320, innerHeight - 12)))
  };
}

async function resetFloatingSize()
{
  const container = document.getElementById("reception-floating-extension");
  if(!container) return {ok:false};
  const size = clampFloatingSize(430, innerHeight - 20);
  container.style.width = `${size.width}px`;
  container.style.height = `${size.height}px`;
  await chrome.storage.local.set({receptionFloatingSize:size});
  return {ok:true, ...size};
}

async function setFloatingExtensionCollapsed(collapsed)
{
  const container = document.getElementById("reception-floating-extension");
  if(!container) return {ok:false};
  container.classList.toggle("rfe-collapsed", collapsed);
  const toggle = container.querySelector(".rfe-toggle");
  toggle.textContent = collapsed ? "‹" : "›";
  toggle.title = collapsed ? "Mở extension" : "Ẩn extension";
  toggle.setAttribute("aria-label", toggle.title);
  await chrome.storage.local.set({receptionFloatingCollapsed:collapsed});
  return {ok:true, collapsed};
}

async function toggleFloatingExtension()
{
  const container = document.getElementById("reception-floating-extension");
  if(!container) {
    await initFloatingExtension();
    return {ok:true, collapsed:false};
  }
  if(container.classList.contains("rfe-fill-hidden")) {
    container.classList.remove("rfe-fill-hidden");
    floatingFillHiddenRoute = "";
    const toggle = container.querySelector(".rfe-toggle");
    toggle.textContent = "›";
    toggle.title = "Ẩn extension";
    toggle.setAttribute("aria-label", toggle.title);
    return {ok:true, collapsed:false};
  }
  return setFloatingExtensionCollapsed(!container.classList.contains("rfe-collapsed"));
}

let lastFloatingPageMode = "";
let floatingFillHiddenRoute = "";
const HEALTH_SIGNATURE_PENDING_KEY = "receptionHealthSignaturePending";
const HEALTH_AUTO_SIGN_KEY = "receptionHealthAutoSign";
const HEALTH_AUTO_SIGN_PROGRESS_KEY = "receptionHealthAutoSignProgress";
const FULL_AUTO_WORKFLOW_KEY = "receptionFullAutoWorkflow";
const FULL_AUTO_RESET_PENDING_KEY = "receptionFullAutoResetPending";
const FULL_AUTO_PANEL_EDIT_KEY = "receptionFullAutoPanelEditable";
const HEALTH_AUTO_SIGN_TARGETS = ["NGUOI_KET_LUAN", "CON_DAU"];
let waitingForHealthSignature = sessionStorage.getItem(HEALTH_SIGNATURE_PENDING_KEY) === "1";
let signatureFinalizeClicked = false;
let signerWasVisible = false;
let healthAutoSignArmed = sessionStorage.getItem(HEALTH_AUTO_SIGN_KEY) === "1";
let healthAutoSignRunning = false;
let healthAutoSignAwaitingResult = false;
let healthAutoSignStartedAt = 0;
let healthAutoSignTimer = 0;
let healthAutoSignEntryButton = null;
let healthAutoSignSubmittedRoles = new Set(readHealthAutoSignProgress());
let fullAutoWorkflowRunning = false;

async function readFullAutoWorkflow()
{
  const stored = await chrome.storage.local.get(FULL_AUTO_WORKFLOW_KEY);
  const workflow = stored[FULL_AUTO_WORKFLOW_KEY];
  return workflow?.active === true ? workflow : null;
}

async function updateFullAutoWorkflow(stage, extra = {})
{
  const current = await readFullAutoWorkflow();
  if(!current) return null;
  const next = {...current, ...extra, stage, updatedAt:Date.now()};
  await chrome.storage.local.set({[FULL_AUTO_WORKFLOW_KEY]:next});
  return next;
}

function showFullAutoNotice(message, isError = false)
{
  let notice = document.getElementById("reception-full-auto-notice");
  if(!notice) {
    notice = document.createElement("div");
    notice.id = "reception-full-auto-notice";
    Object.assign(notice.style, {
      position:"fixed", left:"50%", top:"20px", transform:"translateX(-50%)",
      zIndex:"2147483647", maxWidth:"min(680px, calc(100vw - 32px))", padding:"12px 18px",
      borderRadius:"9px", color:"#fff", font:"700 15px/1.45 Arial, sans-serif",
      boxShadow:"0 6px 24px rgba(0,0,0,.3)", textAlign:"center"
    });
    document.documentElement.appendChild(notice);
  }
  notice.style.background = isError ? "#b42318" : "#08783e";
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(showFullAutoNotice.timer);
  showFullAutoNotice.timer = setTimeout(() => { notice.hidden = true; }, isError ? 12000 : 5000);
}

async function failFullAutoWorkflow(message)
{
  const workflow = await readFullAutoWorkflow();
  if(!workflow) return;
  await chrome.storage.local.remove(FULL_AUTO_WORKFLOW_KEY);
  fullAutoWorkflowRunning = false;
  stopHealthAutoSign(false);
  waitingForHealthSignature = false;
  sessionStorage.removeItem(HEALTH_SIGNATURE_PENDING_KEY);
  sessionStorage.removeItem(FULL_AUTO_PANEL_EDIT_KEY);
  await restoreFloatingAfterFailedFill().catch(() => {});
  const text = message || "Auto hoàn toàn đã dừng.";
  setFloatingWorkflowStatus(text, "error");
  showFullAutoNotice(text, true);
}

function readHealthAutoSignProgress()
{
  try {
    const value = JSON.parse(sessionStorage.getItem(HEALTH_AUTO_SIGN_PROGRESS_KEY) || "[]");
    return Array.isArray(value) ? value.filter(role => HEALTH_AUTO_SIGN_TARGETS.includes(role)) : [];
  } catch {
    return [];
  }
}

function saveHealthAutoSignProgress()
{
  sessionStorage.setItem(HEALTH_AUTO_SIGN_PROGRESS_KEY, JSON.stringify([...healthAutoSignSubmittedRoles]));
}

function currentFloatingRoute()
{
  return `${location.pathname}${location.search}`;
}

function onUnderSixHealthExamPage()
{
  return location.pathname.includes("/ngoaitru/kb/cls/ksk-tre-duoi-6-tuoi");
}

function waitForHealthSignature()
{
  waitingForHealthSignature = true;
  signatureFinalizeClicked = false;
  signerWasVisible = !!document.querySelector(".signer-container");
  sessionStorage.setItem(HEALTH_SIGNATURE_PENDING_KEY, "1");
  if(sessionStorage.getItem(FULL_AUTO_PANEL_EDIT_KEY) !== "1") hideFloatingDuringFill();
  else showFloatingAfterFillForDraft();
}

function showFloatingAfterFillForDraft()
{
  const container = document.getElementById("reception-floating-extension");
  if(!container) return {ok:false};
  floatingFillHiddenRoute = "";
  container.classList.remove("rfe-fill-hidden");
  return {ok:true};
}

function healthSignButtonDescription(button)
{
  return normalizeText([
    button?.textContent,
    button?.getAttribute?.("title"),
    button?.getAttribute?.("aria-label"),
    button?.id
  ].filter(Boolean).join(" "));
}

function isInitialHealthSignButton(button)
{
  if(!button || button.closest?.(".signer-container")) return false;
  const description = healthSignButtonDescription(button);
  if(!/(^|\s)ky(?:\s|$|\()/.test(description) &&
    !description.includes("luu ky") && !description.includes("ky so")) return false;
  return !description.includes("huy ky") && !description.includes("hoan tat ky so") &&
    button.id !== "sca_hoanTatKySo";
}

function signerRoleCode(card)
{
  return String(card?.querySelector?.(".assignee-code")?.getAttribute("title") ||
    card?.querySelector?.(".assignee-code")?.textContent || "").trim().toUpperCase();
}

function signerCardState(card)
{
  const text = normalizeText(card?.textContent || "");
  return {
    signed:card?.classList?.contains("signed") || text.includes("da ky"),
    confirmed:text.includes("xac nhan ky"),
    disabled:card?.classList?.contains("disabled") || card?.getAttribute?.("aria-disabled") === "true",
    processing:card?.classList?.contains("processing")
  };
}

function stopHealthAutoSign(clearProgress = true)
{
  healthAutoSignArmed = false;
  healthAutoSignRunning = false;
  healthAutoSignAwaitingResult = false;
  healthAutoSignStartedAt = 0;
  healthAutoSignEntryButton = null;
  clearTimeout(healthAutoSignTimer);
  healthAutoSignTimer = 0;
  sessionStorage.removeItem(HEALTH_AUTO_SIGN_KEY);
  if(clearProgress) {
    healthAutoSignSubmittedRoles.clear();
    sessionStorage.removeItem(HEALTH_AUTO_SIGN_PROGRESS_KEY);
  }
}

function scheduleHealthAutoSign(delay = 120)
{
  if(!healthAutoSignArmed || healthAutoSignTimer) return;
  healthAutoSignTimer = setTimeout(() => {
    healthAutoSignTimer = 0;
    runHealthAutoSign().catch(() => {
      stopHealthAutoSign(false);
      const message = "Không thể tự ký. Cửa sổ ký vẫn được giữ để thao tác thủ công.";
      setFloatingWorkflowStatus(message, "error");
      failFullAutoWorkflow(message).catch(() => {});
    });
  }, delay);
}

function armHealthAutoSign(button)
{
  healthAutoSignArmed = true;
  healthAutoSignRunning = true;
  healthAutoSignAwaitingResult = false;
  healthAutoSignStartedAt = Date.now();
  healthAutoSignEntryButton = button || null;
  healthAutoSignSubmittedRoles.clear();
  sessionStorage.setItem(HEALTH_AUTO_SIGN_KEY, "1");
  sessionStorage.removeItem(HEALTH_AUTO_SIGN_PROGRESS_KEY);
  setFloatingWorkflowStatus("Đang mở ký số và ký lần lượt Người kết luận, Con dấu…", "info");
  scheduleHealthAutoSign(150);
}

function findHealthSignEntryButton()
{
  if(healthAutoSignEntryButton?.isConnected && !healthAutoSignEntryButton.disabled) {
    return healthAutoSignEntryButton;
  }
  const exact = document.querySelector(
    "app-kham-suc-khoe-tre-duoi-6-tuoi his-action-bar button#kySo, his-action-bar button#kySo"
  );
  if(isVisible(exact) && !exact.disabled) return exact;
  return Array.from(document.querySelectorAll("button"))
    .find(button => !button.disabled && isInitialHealthSignButton(button)) || null;
}

function healthExamFormReady()
{
  const root = document.querySelector("app-kham-suc-khoe-tre-duoi-6-tuoi");
  if(!root) return null;
  const saveButton = root.querySelector("his-action-bar button#luu") || document.querySelector("his-action-bar button#luu");
  const signButton = root.querySelector("his-action-bar button#kySo") || document.querySelector("his-action-bar button#kySo");
  const firstField = findInputByLabel("Mã định danh/CCCD người đi cùng trẻ");
  return saveButton && signButton && firstField ? root : null;
}

async function waitForHealthSaveToSettle(saveButton, timeout = 45000)
{
  const started = Date.now();
  let observedBusy = saveButton?.disabled === true;
  await new Promise(resolve => setTimeout(resolve, 1800));
  return new Promise(resolve => {
    const check = () => {
      const busy = saveButton?.disabled === true ||
        !!document.querySelector("app-kham-suc-khoe-tre-duoi-6-tuoi .overlay-loading, app-kham-suc-khoe-tre-duoi-6-tuoi .ui-spin-spinning");
      observedBusy = observedBusy || busy;
      const elapsed = Date.now() - started;
      if((!busy && (observedBusy || elapsed >= 2500)) || elapsed >= timeout) {
        clearInterval(timer);
        resolve(!busy);
      }
    };
    const timer = setInterval(check, 150);
    check();
  });
}

async function runHealthAutoSign()
{
  if(!healthAutoSignArmed) return;
  if(!onUnderSixHealthExamPage()) {
    stopHealthAutoSign(false);
    return;
  }
  healthAutoSignRunning = true;
  if(!healthAutoSignStartedAt) healthAutoSignStartedAt = Date.now();
  if(Date.now() - healthAutoSignStartedAt > 180000) {
    stopHealthAutoSign(false);
    const message = "Tự ký đã dừng do quá thời gian. Bạn có thể tiếp tục ký thủ công.";
    setFloatingWorkflowStatus(message, "error");
    await failFullAutoWorkflow(message);
    return;
  }

  const signer = document.querySelector(".signer-container");
  if(!signer) {
    if(healthAutoSignAwaitingResult) {
      if(healthAutoSignSubmittedRoles.size >= HEALTH_AUTO_SIGN_TARGETS.length) {
        await finishHealthSignatureWait();
        return;
      }
      const reopenButton = findHealthSignEntryButton();
      if(reopenButton) {
        healthAutoSignAwaitingResult = false;
        signatureFinalizeClicked = false;
        reopenButton.click();
      }
    }
    scheduleHealthAutoSign(700);
    return;
  }

  signerWasVisible = true;
  if(signer.querySelector(".overlay-loading, .kytatca-overlay, .processing")) {
    scheduleHealthAutoSign(450);
    return;
  }

  const cards = Array.from(signer.querySelectorAll(".signer-card"));
  const targetCards = cards.map(card => ({card, role:signerRoleCode(card), state:signerCardState(card)}))
    .filter(item => HEALTH_AUTO_SIGN_TARGETS.includes(item.role));
  if(!targetCards.length) {
    scheduleHealthAutoSign(500);
    return;
  }

  const signedRoles = new Set(targetCards.filter(item => item.state.signed).map(item => item.role));
  if(HEALTH_AUTO_SIGN_TARGETS.every(role => signedRoles.has(role))) {
    await finishHealthSignatureWait();
    return;
  }

  if(healthAutoSignAwaitingResult) {
    const hasNextLevel = targetCards.some(item => !healthAutoSignSubmittedRoles.has(item.role) &&
      !item.state.signed && !item.state.confirmed && !item.state.disabled && !item.state.processing);
    const submittedLevelFinished = [...healthAutoSignSubmittedRoles].some(role => signedRoles.has(role));
    if(!hasNextLevel && !submittedLevelFinished) {
      scheduleHealthAutoSign(600);
      return;
    }
    healthAutoSignAwaitingResult = false;
    signatureFinalizeClicked = false;
  }

  const nextCard = targetCards.find(item => !item.state.signed && !item.state.confirmed &&
    !item.state.disabled && !item.state.processing && !healthAutoSignSubmittedRoles.has(item.role));
  if(nextCard) {
    nextCard.card.click();
    scheduleHealthAutoSign(450);
    return;
  }

  const confirmed = targetCards.filter(item => item.state.confirmed && !item.state.signed);
  if(confirmed.length) {
    confirmed.forEach(item => healthAutoSignSubmittedRoles.add(item.role));
    saveHealthAutoSignProgress();
    const completeButton = signer.querySelector("#sca_hoanTatKySo") ||
      Array.from(signer.querySelectorAll("button")).find(button =>
        healthSignButtonDescription(button).includes("hoan tat ky so"));
    if(completeButton && !completeButton.disabled) {
      signatureFinalizeClicked = true;
      healthAutoSignAwaitingResult = true;
      completeButton.click();
      scheduleHealthAutoSign(900);
      return;
    }
  }

  scheduleHealthAutoSign(500);
}

async function resumeFullAutoWorkflow()
{
  if(fullAutoWorkflowRunning || !onUnderSixHealthExamPage()) return;
  const workflow = await readFullAutoWorkflow();
  if(!workflow) return;
  if(Date.now() - Number(workflow.createdAt || 0) > 10 * 60 * 1000) {
    await failFullAutoWorkflow("Auto hoàn toàn đã dừng vì tiến trình quá 10 phút.");
    return;
  }
  if(workflow.stage === "signing") {
    if(healthAutoSignArmed) scheduleHealthAutoSign(200);
    return;
  }

  fullAutoWorkflowRunning = true;
  try {
    setFloatingWorkflowStatus("Auto hoàn toàn: đang chờ phiếu KSK sẵn sàng…", "info");
    const healthForm = await waitForWorkflowElement(healthExamFormReady, 90000);
    if(!healthForm) throw new Error("Auto hoàn toàn đã dừng: phiếu KSK không tải xong.");

    const stored = workflow.data
      ? null
      : await chrome.storage.local.get("receptionAutofillData");
    const data = workflow.data || stored?.receptionAutofillData || {};
    await updateFullAutoWorkflow("filling-health");
    setFloatingWorkflowStatus("Auto hoàn toàn: đang điền phiếu KSK…", "info");
    const result = await fillReceptionForm(data);
    if(!result?.ok) throw new Error(result?.error || "Không điền được phiếu KSK.");

    await updateFullAutoWorkflow("saving-health", {
      healthFilled:result.filled?.length || 0,
      healthFailed:result.failed || []
    });
    const saveButton = await waitForWorkflowElement(findWorkflowSaveButton, 60000);
    if(!saveButton) throw new Error("Auto hoàn toàn đã dừng: không tìm thấy nút Lưu của phiếu KSK.");
    setFloatingWorkflowStatus("Auto hoàn toàn: đã điền phiếu KSK, đang Lưu…", "info");
    activateWorkflowButton(saveButton);

    setFloatingWorkflowStatus("Auto hoàn toàn: đang chờ HMIS lưu xong phiếu KSK…", "info");
    const saveSettled = await waitForHealthSaveToSettle(saveButton);
    if(!saveSettled) throw new Error("Auto hoàn toàn đã dừng: HMIS chưa hoàn tất Lưu phiếu KSK.");
    const signButton = await waitForWorkflowElement(findHealthSignEntryButton, 60000);
    if(!signButton) throw new Error("Auto hoàn toàn đã dừng: không tìm thấy nút Ký sau khi lưu phiếu KSK.");

    await updateFullAutoWorkflow("signing");
    waitForHealthSignature();
    armHealthAutoSign(signButton);
    setFloatingWorkflowStatus("Auto hoàn toàn: đang ký Người kết luận và Con dấu…", "info");
    activateWorkflowButton(signButton);
  } catch(error) {
    await failFullAutoWorkflow(error.message);
  } finally {
    fullAutoWorkflowRunning = false;
  }
}

function hideFloatingDuringFill()
{
  const container = document.getElementById("reception-floating-extension");
  if(!container) return {ok:false};
  floatingFillHiddenRoute = currentFloatingRoute();
  container.classList.add("rfe-fill-hidden");
  const toggle = container.querySelector(".rfe-toggle");
  toggle.textContent = "‹";
  toggle.title = "Mở extension";
  toggle.setAttribute("aria-label", toggle.title);
  return {ok:true};
}

function showFloatingAfterFill()
{
  const container = document.getElementById("reception-floating-extension");
  if(!container) return {ok:false};
  if(onUnderSixHealthExamPage()) {
    waitForHealthSignature();
    return {ok:true, waitingForSignature:true};
  }
  floatingFillHiddenRoute = "";
  container.classList.remove("rfe-fill-hidden");
  const collapsed = container.classList.contains("rfe-collapsed");
  const toggle = container.querySelector(".rfe-toggle");
  toggle.textContent = collapsed ? "‹" : "›";
  toggle.title = collapsed ? "Mở extension" : "Ẩn extension";
  toggle.setAttribute("aria-label", toggle.title);
  return {ok:true};
}

async function restoreFloatingAfterFailedFill()
{
  const container = document.getElementById("reception-floating-extension");
  if(!container) return {ok:false};
  floatingFillHiddenRoute = "";
  container.classList.remove("rfe-fill-hidden");
  await setFloatingExtensionCollapsed(false);
  updateFloatingPageMode(true);
  return {ok:true};
}

document.addEventListener("click", event => {
  const button = event.target.closest?.("button");
  if(!button || !event.isTrusted) return;
  const description = healthSignButtonDescription(button);
  if(onUnderSixHealthExamPage() && isInitialHealthSignButton(button)) {
    waitForHealthSignature();
    armHealthAutoSign(button);
    return;
  }
  if(onUnderSixHealthExamPage() && /(^|\s)luu(?:\s|$|\()/.test(description)) {
    waitForHealthSignature();
    return;
  }
  if(waitingForHealthSignature &&
    (button.id === "sca_hoanTatKySo" || description.includes("hoan tat ky so"))) {
    signatureFinalizeClicked = true;
    signerWasVisible = signerWasVisible || !!document.querySelector(".signer-container");
  }
}, true);

async function finishHealthSignatureWait()
{
  if(!waitingForHealthSignature) {
    stopHealthAutoSign();
    return;
  }
  stopHealthAutoSign();
  waitingForHealthSignature = false;
  signatureFinalizeClicked = false;
  signerWasVisible = false;
  sessionStorage.removeItem(HEALTH_SIGNATURE_PENDING_KEY);
  const container = document.getElementById("reception-floating-extension");
  if(container) {
    floatingFillHiddenRoute = "";
    container.classList.remove("rfe-fill-hidden");
  }
  await setFloatingExtensionCollapsed(false);
  updateFloatingPageMode(true);
  const fullAutoWorkflow = await readFullAutoWorkflow();
  if(fullAutoWorkflow) {
    setFloatingWorkflowStatus("Auto hoàn toàn: ký số hoàn tất, đang quay về form nhập mới…", "success");
    showFullAutoNotice("Hoàn tất Auto hoàn toàn — đang mở form nhập mới.");
    await chrome.storage.local.set({
      [FULL_AUTO_RESET_PENDING_KEY]:{preserveData:true, focusFirst:true}
    });
    sessionStorage.removeItem(FULL_AUTO_PANEL_EDIT_KEY);
    await chrome.storage.local.remove([FULL_AUTO_WORKFLOW_KEY, POST_SAVE_WORKFLOW_KEY]);
    setTimeout(() => location.assign(RECEPTION_ENTRY_URL), 500);
    return;
  }
  setFloatingWorkflowStatus("Hoàn thành ký số; đã hiện lại extension.", "success");
}

function signatureCompletionText(value)
{
  const text = normalizeText(value);
  return text.includes("hoan thanh ky so") ||
    text.includes("hoan tat ky so thanh cong") ||
    text.includes("ky so thanh cong");
}

const signatureCompletionObserver = new MutationObserver(mutations => {
  if(healthAutoSignArmed) scheduleHealthAutoSign(100);
  if(!waitingForHealthSignature) return;
  if(document.querySelector(".signer-container")) signerWasVisible = true;
  const completionMessage = mutations.some(mutation =>
    signatureCompletionText(mutation.target?.textContent) ||
    Array.from(mutation.addedNodes).some(node => signatureCompletionText(node.textContent))
  );
  const signerClosedAfterFinish = signatureFinalizeClicked && signerWasVisible &&
    !document.querySelector(".signer-container");
  if(completionMessage || signerClosedAfterFinish) {
    if(healthAutoSignArmed && healthAutoSignSubmittedRoles.size < HEALTH_AUTO_SIGN_TARGETS.length) {
      healthAutoSignAwaitingResult = true;
      scheduleHealthAutoSign(600);
      return;
    }
    finishHealthSignatureWait().catch(() => {});
  }
});
signatureCompletionObserver.observe(document.documentElement, {
  childList:true,
  characterData:true,
  subtree:true
});

async function resetReceptionWorkflow()
{
  sessionStorage.removeItem("receptionDrcareConfirmed");
  sessionStorage.removeItem(MANUAL_HEALTH_EXAM_KEY);
  sessionStorage.removeItem(HEALTH_SIGNATURE_PENDING_KEY);
  sessionStorage.removeItem(FULL_AUTO_PANEL_EDIT_KEY);
  stopHealthAutoSign();
  waitingForHealthSignature = false;
  signatureFinalizeClicked = false;
  signerWasVisible = false;
  await chrome.storage.local.remove([
    POST_SAVE_WORKFLOW_KEY,
    FULL_AUTO_WORKFLOW_KEY,
    FULL_AUTO_RESET_PENDING_KEY
  ]);
  fullAutoWorkflowRunning = false;
  const container = document.getElementById("reception-floating-extension");
  if(container) {
    floatingFillHiddenRoute = "";
    container.classList.remove("rfe-fill-hidden", "rfe-collapsed", "rfe-list-compact");
    await chrome.storage.local.set({receptionFloatingCollapsed:false});
  }
  if(location.pathname.endsWith("/new/his/ngoaitru/tnkb/tiepnhan")) {
    updateFloatingPageMode(true);
    return {ok:true, navigated:false};
  }
  location.assign(RECEPTION_ENTRY_URL);
  return {ok:true, navigated:true};
}

if(healthAutoSignArmed) scheduleHealthAutoSign(500);

function updateFloatingPageMode(force = false)
{
  const container = document.getElementById("reception-floating-extension");
  if(!container) return;
  if(!waitingForHealthSignature && floatingFillHiddenRoute && currentFloatingRoute() !== floatingFillHiddenRoute) {
    floatingFillHiddenRoute = "";
    container.classList.remove("rfe-fill-hidden");
    const collapsed = container.classList.contains("rfe-collapsed");
    const toggle = container.querySelector(".rfe-toggle");
    toggle.textContent = collapsed ? "‹" : "›";
    toggle.title = collapsed ? "Mở extension" : "Ẩn extension";
    toggle.setAttribute("aria-label", toggle.title);
  }
  const compact = location.pathname.includes("/ngoaitru/kb/ds-khambenh");
  const mode = compact ? "list-compact" : "full";
  container.classList.toggle("rfe-list-compact", compact);
  if(!force && mode === lastFloatingPageMode) return;
  lastFloatingPageMode = mode;
  container.querySelector("iframe")?.contentWindow?.postMessage({
    type:"receptionFloatingMode",
    mode
  }, "*");
}

let existingPatientOverlayPayload = {state:"idle", matches:[], data:null, error:""};
let suppressExistingPatientOverlayClick = false;
let existingPatientOverlayDateDraft = null;

function existingPatientOverlayLabel(state)
{
  if(state === "identity-match") return "Trùng CCCD";
  if(state === "warning") return "Trùng hồ sơ";
  if(state === "clear") return "Không trùng";
  if(state === "error") return "Lỗi";
  if(state === "checking") return "Đang kiểm tra";
  return "Chưa kiểm tra";
}

function formatExistingPatientDate(value)
{
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const short = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if(short) {
    const year = short[3].length === 2 ? `20${short[3]}` : short[3];
    return `${short[1].padStart(2, "0")}/${short[2].padStart(2, "0")}/${year}`;
  }
  const digits = text.replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}` : text;
}

function addExistingPatientOverlayRow(list, label, value, className = "")
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

function positionExistingPatientOverlayPanel()
{
  const overlay = document.getElementById("reception-existing-patient-overlay");
  const panel = document.getElementById("reception-existing-patient-panel");
  if(!overlay || !panel || panel.hidden) return;
  const rect = overlay.getBoundingClientRect();
  const width = Math.max(240, Math.min(390, innerWidth - 16));
  panel.style.width = `${width}px`;
  let left = Math.min(Math.max(rect.left, 8), innerWidth - width - 8);
  let top = rect.bottom + 8;
  if(top + panel.offsetHeight > innerHeight - 8)
    top = Math.max(8, rect.top - panel.offsetHeight - 8);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function renderExistingPatientOverlayPanel()
{
  const panel = document.getElementById("reception-existing-patient-panel");
  if(!panel) return;
  panel.replaceChildren();
  const payload = existingPatientOverlayPayload;
  const header = document.createElement("div");
  header.className = "rpe-head";
  const title = document.createElement("span");
  title.className = "rpe-title";
  title.textContent = payload.state === "identity-match" ? "Trùng CCCD" :
    payload.state === "warning" ? "Phát hiện trùng" : "Lỗi";
  const expand = document.createElement("button");
  expand.type = "button";
  expand.className = "rpe-expand";
  expand.textContent = "Ẩn";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "rpe-close";
  close.textContent = "×";
  close.title = "Đóng";
  header.append(title, expand, close);
  const body = document.createElement("div");
  body.className = "rpe-body";

  if(payload.state === "warning" || payload.state === "identity-match") {
    const range = document.createElement("div");
    range.className = "rpe-range";
    const fromLabel = document.createElement("label");
    fromLabel.append(document.createTextNode("Từ ngày"));
    const fromInput = document.createElement("input");
    fromInput.type = "text";
    fromInput.inputMode = "numeric";
    fromInput.maxLength = 10;
    fromInput.placeholder = "d/m/yy hoặc dd/mm/yyyy";
    fromInput.value = existingPatientOverlayDateDraft?.fromDate ?? formatExistingPatientDate(payload.data?.existingPatientFromDate);
    fromLabel.appendChild(fromInput);
    const toLabel = document.createElement("label");
    toLabel.append(document.createTextNode("Đến ngày (hôm nay)"));
    const toInput = document.createElement("input");
    toInput.type = "text";
    toInput.inputMode = "numeric";
    toInput.maxLength = 10;
    toInput.placeholder = "Ngày hôm nay";
    const now = new Date();
    const todayText = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    toInput.value = todayText;
    toInput.readOnly = true;
    toLabel.appendChild(toInput);
    const updateRange = () => {
      existingPatientOverlayDateDraft = {fromDate:fromInput.value, toDate:todayText};
      existingPatientOverlayPayload.data = {
        ...(existingPatientOverlayPayload.data || {}),
        existingPatientFromDate:fromInput.value,
        existingPatientToDate:todayText
      };
      document.querySelector("#reception-floating-extension iframe")?.contentWindow?.postMessage({
        type:"receptionExistingPatientDateRange",
        fromDate:fromInput.value,
        toDate:todayText
      }, "*");
    };
    fromInput.addEventListener("change", updateRange);
    for(const input of [fromInput]) input.addEventListener("keydown", event => {
      if(event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      const formatted = formatExistingPatientDate(input.value);
      input.value = formatted;
      input.setSelectionRange?.(formatted.length, formatted.length);
      updateRange();
    });
    range.append(fromLabel, toLabel);
    body.appendChild(range);
  }

  if(payload.state === "warning" || payload.state === "identity-match") {
    const list = document.createElement("div");
    (payload.matches || []).forEach((patient, index) => {
      const item = document.createElement("details");
      if(patient.identityMatch) item.classList.add("rpe-identity-match");
      const summary = document.createElement("summary");
      summary.textContent = `${index + 1}. ${patient.fullName || payload.data?.fullName || ""} · ${formatExistingPatientDate(patient.birthDate || payload.data?.birthDate)} · ${patient.gender || payload.data?.gender || ""}${patient.identityMatch ? " · CCCD TRÙNG" : ""}`;
      const info = document.createElement("dl");
      addExistingPatientOverlayRow(info, patient.identityMatch ? "CCCD TRÙNG" : "CCCD", patient.identity,
        patient.identityMatch ? "rpe-identity-value" : "");
      addExistingPatientOverlayRow(info, "Mã bệnh nhân", patient.patientCode);
      addExistingPatientOverlayRow(info, "Tiếp nhận ID", patient.tiepNhanId);
      addExistingPatientOverlayRow(info, "Ngày tiếp nhận", formatExistingPatientDate(patient.receptionDate));
      addExistingPatientOverlayRow(info, "Mã bệnh án", patient.medicalRecordCode);
      addExistingPatientOverlayRow(info, "Dân tộc", patient.ethnicity);
      addExistingPatientOverlayRow(info, "Địa chỉ", patient.address);
      addExistingPatientOverlayRow(info, "Người thân", patient.guardianName);
      addExistingPatientOverlayRow(info, "SĐT người thân", patient.guardianPhone);
      addExistingPatientOverlayRow(info, "Phòng", patient.roomName);
      if(patient.detailError) addExistingPatientOverlayRow(info, "Lỗi lấy chi tiết", patient.detailError);
      item.append(summary, info);
      item.addEventListener("toggle", () => requestAnimationFrame(positionExistingPatientOverlayPanel));
      list.appendChild(item);
    });
    body.appendChild(list);
  } else {
    const error = document.createElement("div");
    error.textContent = payload.error || "Không kiểm tra được hồ sơ.";
    body.appendChild(error);
  }
  panel.append(header, body);
  expand.addEventListener("click", () => {
    body.hidden = !body.hidden;
    expand.textContent = body.hidden ? "Mở rộng" : "Ẩn";
    requestAnimationFrame(positionExistingPatientOverlayPanel);
  });
  close.addEventListener("click", () => { panel.hidden = true; });
  panel.hidden = false;
  requestAnimationFrame(positionExistingPatientOverlayPanel);
}

function updateExistingPatientOverlay(payload)
{
  existingPatientOverlayPayload = {
    state:String(payload?.state || "idle"),
    title:String(payload?.title || ""),
    matches:Array.isArray(payload?.matches) ? payload.matches : [],
    data:payload?.data || null,
    error:String(payload?.error || "")
  };
  const button = document.getElementById("reception-existing-patient-status");
  const panel = document.getElementById("reception-existing-patient-panel");
  if(!button) return;
  button.className = `rpe-${existingPatientOverlayPayload.state}`;
  button.textContent = existingPatientOverlayLabel(existingPatientOverlayPayload.state);
  button.title = existingPatientOverlayPayload.title;
  panel?.classList.toggle("rpe-identity-panel", existingPatientOverlayPayload.state === "identity-match");
  if(panel && ["idle", "clear"].includes(existingPatientOverlayPayload.state)) panel.hidden = true;
  else if(panel && !panel.hidden && ["warning", "identity-match", "error"].includes(existingPatientOverlayPayload.state))
    renderExistingPatientOverlayPanel();
}

function clampExistingPatientOverlayPosition(position)
{
  const overlay = document.getElementById("reception-existing-patient-overlay");
  const width = overlay?.offsetWidth || 110;
  const height = overlay?.offsetHeight || 36;
  const left = Number(position?.left);
  const top = Number(position?.top);
  return {
    left:Math.min(Math.max(Number.isFinite(left) ? left : 14, 6), Math.max(6, innerWidth - width - 6)),
    top:Math.min(Math.max(Number.isFinite(top) ? top : 14, 6), Math.max(6, innerHeight - height - 6))
  };
}

function applyExistingPatientOverlayPosition(position)
{
  const overlay = document.getElementById("reception-existing-patient-overlay");
  if(!overlay) return;
  const next = clampExistingPatientOverlayPosition(position);
  overlay.style.left = `${next.left}px`;
  overlay.style.top = `${next.top}px`;
}

function ensureExistingPatientOverlay(savedPosition)
{
  let overlay = document.getElementById("reception-existing-patient-overlay");
  if(overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "reception-existing-patient-overlay";
  const status = document.createElement("button");
  status.id = "reception-existing-patient-status";
  status.type = "button";
  status.className = "rpe-idle";
  status.textContent = "Chưa kiểm tra";
  const panel = document.createElement("section");
  panel.id = "reception-existing-patient-panel";
  panel.hidden = true;
  overlay.append(status, panel);
  document.body.appendChild(overlay);
  applyExistingPatientOverlayPosition(savedPosition);

  status.addEventListener("click", () => {
    if(suppressExistingPatientOverlayClick) return;
    if(!["warning", "identity-match", "error"].includes(existingPatientOverlayPayload.state)) return;
    if(!panel.hidden) panel.hidden = true;
    else renderExistingPatientOverlayPanel();
  });

  let drag = null;
  overlay.addEventListener("pointerdown", event => {
    if(event.button !== 0 || event.target.closest(".rpe-head button")) return;
    const handle = event.target.closest("#reception-existing-patient-status, .rpe-head");
    if(!handle) return;
    const rect = overlay.getBoundingClientRect();
    drag = {pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, left:rect.left, top:rect.top, moved:false};
    handle.setPointerCapture?.(event.pointerId);
    overlay.classList.add("rpe-dragging");
  });
  overlay.addEventListener("pointermove", event => {
    if(!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if(!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    event.preventDefault();
    applyExistingPatientOverlayPosition({left:drag.left + dx, top:drag.top + dy});
    positionExistingPatientOverlayPanel();
  });
  const finish = event => {
    if(!drag || event.pointerId !== drag.pointerId) return;
    const moved = drag.moved;
    drag = null;
    overlay.classList.remove("rpe-dragging");
    if(!moved) return;
    suppressExistingPatientOverlayClick = true;
    setTimeout(() => { suppressExistingPatientOverlayClick = false; }, 120);
    const rect = overlay.getBoundingClientRect();
    chrome.storage.local.set({receptionExistingPatientOverlayPosition:{left:Math.round(rect.left), top:Math.round(rect.top)}});
  };
  overlay.addEventListener("pointerup", finish);
  overlay.addEventListener("pointercancel", finish);
  window.addEventListener("resize", () => {
    const rect = overlay.getBoundingClientRect();
    applyExistingPatientOverlayPosition({left:rect.left, top:rect.top});
    positionExistingPatientOverlayPanel();
  });
  return overlay;
}

window.addEventListener("message", event => {
  const frame = document.querySelector("#reception-floating-extension iframe");
  if(!frame || event.source !== frame.contentWindow || event.data?.type !== "receptionExistingPatientStatus") return;
  updateExistingPatientOverlay(event.data);
});

async function initFloatingExtension()
{
  if(location.hostname !== "ytcs.hmis.vn" || document.getElementById("reception-floating-extension")) return;
  ensureFloatingExtensionStyle();
  const container = document.createElement("aside");
  container.id = "reception-floating-extension";
  container.setAttribute("aria-label", "Nhập liệu khám sức khỏe");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "rfe-toggle";
  const resize = document.createElement("button");
  resize.type = "button";
  resize.className = "rfe-resize";
  resize.title = "Kéo để đổi kích thước form";
  resize.setAttribute("aria-label", resize.title);
  const frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL("popup.html");
  frame.title = "Nhập liệu khám sức khỏe trẻ dưới 6 tuổi";
  const hostTabResponse = await chrome.runtime.sendMessage({action:"getReceptionHostTabId"}).catch(() => null);
  const postHostTabId = () => {
    if(Number.isInteger(hostTabResponse?.tabId))
      frame.contentWindow?.postMessage({type:"receptionHostTabId", tabId:hostTabResponse.tabId}, "*");
  };
  frame.addEventListener("load", () => {
    postHostTabId();
    updateFloatingPageMode(true);
  });
  container.append(toggle, resize, frame);
  document.body.appendChild(container);
  if(waitingForHealthSignature && sessionStorage.getItem(FULL_AUTO_PANEL_EDIT_KEY) !== "1") {
    floatingFillHiddenRoute = currentFloatingRoute();
    container.classList.add("rfe-fill-hidden");
  }
  const stored = await chrome.storage.local.get([
    "receptionFloatingCollapsed", "receptionFloatingSize", "receptionExistingPatientOverlayPosition"
  ]);
  ensureExistingPatientOverlay(stored.receptionExistingPatientOverlayPosition);
  updateExistingPatientOverlay(existingPatientOverlayPayload);
  if(stored.receptionFloatingSize) {
    const size = clampFloatingSize(stored.receptionFloatingSize.width, stored.receptionFloatingSize.height);
    container.style.width = `${size.width}px`;
    container.style.height = `${size.height}px`;
  }
  await setFloatingExtensionCollapsed(stored.receptionFloatingCollapsed === true);
  toggle.addEventListener("click", () => toggleFloatingExtension());
  resize.addEventListener("pointerdown", event => {
    if(event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = container.getBoundingClientRect().width;
    const startHeight = container.getBoundingClientRect().height;
    resize.setPointerCapture?.(event.pointerId);
    const move = moveEvent => {
      const size = clampFloatingSize(
        startWidth + startX - moveEvent.clientX,
        startHeight + moveEvent.clientY - startY
      );
      container.style.width = `${size.width}px`;
      container.style.height = `${size.height}px`;
    };
    const stop = async stopEvent => {
      if(resize.hasPointerCapture?.(stopEvent.pointerId))
        resize.releasePointerCapture(stopEvent.pointerId);
      resize.removeEventListener("pointermove", move);
      resize.removeEventListener("pointerup", stop);
      resize.removeEventListener("pointercancel", stop);
      const rect = container.getBoundingClientRect();
      await chrome.storage.local.set({receptionFloatingSize:{width:Math.round(rect.width), height:Math.round(rect.height)}});
    };
    resize.addEventListener("pointermove", move);
    resize.addEventListener("pointerup", stop);
    resize.addEventListener("pointercancel", stop);
    event.preventDefault();
  });
  updateFloatingPageMode();
}

let configuredFullAutoHotkey = "";

function contentHotkeyFromEvent(event)
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

function updateConfiguredFullAutoHotkey(data)
{
  const value = data && Object.prototype.hasOwnProperty.call(data, "fullAutoHotkey")
    ? data.fullAutoHotkey
    : "Alt+Shift+A";
  configuredFullAutoHotkey = String(value || "").trim();
}

chrome.storage.local.get("receptionAutofillData").then(stored =>
  updateConfiguredFullAutoHotkey(stored.receptionAutofillData)
);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if(areaName === "local" && changes.receptionAutofillData)
    updateConfiguredFullAutoHotkey(changes.receptionAutofillData.newValue);
});

document.addEventListener("keydown", event => {
  if(event.repeat || !configuredFullAutoHotkey ||
    contentHotkeyFromEvent(event).toLocaleLowerCase("en-US") !== configuredFullAutoHotkey.toLocaleLowerCase("en-US")) return;
  const frame = document.querySelector("#reception-floating-extension iframe");
  if(!frame) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  setFloatingExtensionCollapsed(false).then(() => {
    frame.contentWindow?.postMessage({type:"receptionRunFullAutoHotkey"}, "*");
  });
}, true);

const MANUAL_HEALTH_EXAM_KEY = "receptionManualHealthExamUntil";
const HEALTH_EXAM_BUTTON_LABEL = "Khám sức khỏe trẻ dưới 6 tuổi";
const POST_SAVE_WORKFLOW_KEY = "receptionPostSaveHealthWorkflow";
const EXAMINATION_LIST_URL = "https://ytcs.hmis.vn/new/his/ngoaitru/kb/ds-khambenh";
const HEALTH_EXAM_DIRECT_URL = "https://ytcs.hmis.vn/new/his/ngoaitru/kb/cls/ksk-tre-duoi-6-tuoi";
const RECEPTION_ENTRY_URL = "https://ytcs.hmis.vn/new/his/ngoaitru/tnkb/tiepnhan";
let capturedPatientSearch = null;
let capturedPatientSearchError = null;

function goToReceptionForm()
{
  if(location.pathname.endsWith("/new/his/ngoaitru/tnkb/tiepnhan"))
    return {ok:true, navigated:false};
  location.assign(RECEPTION_ENTRY_URL);
  return {ok:true, navigated:true};
}

document.addEventListener("reception-patient-search-id", event => {
  try {
    const payload = JSON.parse(String(event.detail || "{}"));
    if(payload.maBn && /^\d+$/.test(String(payload.id || ""))) capturedPatientSearch = payload;
  } catch {}
});

document.addEventListener("reception-patient-search-error", event => {
  try {
    const payload = JSON.parse(String(event.detail || "{}"));
    if(payload.maBn) capturedPatientSearchError = payload;
  } catch {}
});

function waitForCapturedPatientId(maBn, timeout = 4000)
{
  const expected = String(maBn || "").trim().toUpperCase();
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const matched = capturedPatientSearch &&
        String(capturedPatientSearch.maBn || "").trim().toUpperCase() === expected;
      const failed = capturedPatientSearchError &&
        String(capturedPatientSearchError.maBn || "").trim().toUpperCase() === expected;
      if(matched || failed || Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(matched ? String(capturedPatientSearch.id) : "");
      }
    };
    const timer = setInterval(check, 50);
    check();
  });
}

async function requestPatientIdFromListApi(maBn, timeout = 10000)
{
  capturedPatientSearch = null;
  capturedPatientSearchError = null;
  document.dispatchEvent(new CustomEvent("reception-fetch-patient-list", {detail:maBn}));
  return waitForCapturedPatientId(maBn, timeout);
}

async function openDirectHealthExam(patientId, maBn)
{
  await chrome.storage.local.remove(POST_SAVE_WORKFLOW_KEY);
  await updateFullAutoWorkflow("opening-health", {patientId:String(patientId), maBn:String(maBn || "")});
  setFloatingWorkflowStatus(
    `Đã chuyển sang Đang khám và lấy id=${patientId} cho ${maBn}; đang mở phiếu KSK…`,
    "success"
  );
  postSaveWorkflowRunning = false;
  location.assign(`${HEALTH_EXAM_DIRECT_URL}?id=${encodeURIComponent(patientId)}`);
}

function setFloatingWorkflowStatus(text, status = "")
{
  document.querySelector("#reception-floating-extension iframe")?.contentWindow?.postMessage({
    type:"receptionWorkflowStatus",
    text,
    status
  }, "*");
}

function examinationListTable()
{
  const root = document.querySelector("app-danh-sach-kham-benh");
  if(!root) return null;
  const filterInput = Array.from(root.querySelectorAll('input:not([type="hidden"])')).find(input =>
    normalizeText(input.getAttribute("placeholder")).includes("tim theo ma ba/bn")
  );
  if(!filterInput) return null;
  const searchButton = root.querySelector("button#timKiem") || document.querySelector("button#timKiem");
  for(const table of root.querySelectorAll("table")) {
    const rows = table.querySelectorAll("thead tr");
    if(rows.length < 2) continue;
    const headers = Array.from(rows[0].querySelectorAll("th"));
    const patientCodeIndex = headers.findIndex(cell => normalizeText(cell.textContent) === "ma benh nhan");
    if(patientCodeIndex < 0) continue;
    return {table, patientCodeIndex, filterInput, searchButton};
  }
  return null;
}

function waitForExaminationListTable(timeout = 15000)
{
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const info = examinationListTable();
      if(info || Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(info);
      }
    };
    const timer = setInterval(check, 100);
    check();
  });
}

async function setExaminationListFilterAndSearch(info, value)
{
  const input = info.filterInput;
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if(setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new InputEvent("input", {
    bubbles:true,
    inputType:"insertText",
    data:value
  }));
  input.dispatchEvent(new Event("change", {bubbles:true}));
  await new Promise(resolve => setTimeout(resolve, 100));
  if(info.searchButton && !info.searchButton.disabled) {
    info.searchButton.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
    info.searchButton.focus({preventScroll:true});
    info.searchButton.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
    info.searchButton.dispatchEvent(new MouseEvent("mouseup", {bubbles:true, cancelable:true, view:window}));
    info.searchButton.click();
    return "button";
  }
  const options = {
    bubbles:true,
    cancelable:true,
    key:"F3",
    code:"F3",
    keyCode:114,
    charCode:0,
    which:114
  };
  document.dispatchEvent(new KeyboardEvent("keydown", options));
  document.dispatchEvent(new KeyboardEvent("keyup", options));
  return "f3";
}

function waitForUniqueMatchingPatientRow(info, maBn, timeout = 20000)
{
  const expectedCode = normalizeText(maBn);
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const rows = Array.from(info.table.querySelectorAll("tbody tr")).filter(row => {
        if(row.matches("tr.ui-table-measure-now, tr[oh-table-measure-row]")) return false;
        const cells = row.querySelectorAll("td");
        if(cells.length <= info.patientCodeIndex) return false;
        return !Array.from(cells).every(cell => cell.classList.contains("oh-disable-td"));
      });
      const matched = rows.filter(row => {
        const cells = row.querySelectorAll("td");
        return normalizeText(cells[info.patientCodeIndex]?.textContent) === expectedCode;
      });
      const unique = rows.length === 1 && matched.length === 1 ? matched[0] : null;
      if(unique || Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(unique);
      }
    };
    const timer = setInterval(check, 150);
    check();
  });
}

function healthExamActionButton(scope)
{
  if(!scope) return null;
  const labelled = scope.querySelector(
    'button.reception-health-exam-button, button[ohtooltiptitle="Khám lâm sàng"], button[ohtooltiptitle="Khám sức khỏe trẻ dưới 6 tuổi"]'
  );
  if(labelled) return labelled;
  return Array.from(scope.querySelectorAll("button")).find(button =>
    button.querySelector('[ohtype="signature"], .ph-signature')
  ) || scope.querySelector("td.hover-action button, td.ui-table-cell-fix-right button");
}

async function failPostSaveWorkflow(message)
{
  await chrome.storage.local.remove(POST_SAVE_WORKFLOW_KEY);
  postSaveWorkflowRunning = false;
  setFloatingWorkflowStatus(message, "error");
  await failFullAutoWorkflow(message);
}

let postSaveWorkflowRunning = false;
async function resumePostSaveWorkflow()
{
  if(!location.pathname.includes("/ngoaitru/kb/ds-khambenh")) return;
  if(postSaveWorkflowRunning) return;
  postSaveWorkflowRunning = true;
  const stored = await chrome.storage.local.get(POST_SAVE_WORKFLOW_KEY);
  const workflow = stored[POST_SAVE_WORKFLOW_KEY];
  if(!workflow?.maBn) {
    postSaveWorkflowRunning = false;
    return;
  }
  if(Date.now() - Number(workflow.createdAt || 0) > 120000) {
    await failPostSaveWorkflow("Đã hết thời gian tự tìm bệnh nhân sau khi lưu.");
    return;
  }

  setFloatingWorkflowStatus(`Đang đối chiếu Mã bệnh nhân ${workflow.maBn} qua API danh sách khám bệnh…`);
  const directPatientId = await requestPatientIdFromListApi(workflow.maBn);
  if(directPatientId) {
    await openDirectHealthExam(directPatientId, workflow.maBn);
    return;
  }
  if(capturedPatientSearchError?.fatal) {
    await failPostSaveWorkflow(capturedPatientSearchError.message || "Không chuyển được trạng thái sang Đang khám.");
    return;
  }

  setFloatingWorkflowStatus(`API chưa trả về bản ghi duy nhất; đang dùng tìm kiếm trên danh sách làm dự phòng…`);
  const info = await waitForExaminationListTable();
  if(!info) {
    await failPostSaveWorkflow("Không tìm thấy bảng Danh sách khám bệnh.");
    return;
  }
  capturedPatientSearch = null;
  capturedPatientSearchError = null;
  document.dispatchEvent(new CustomEvent("reception-watch-patient-search", {detail:workflow.maBn}));
  const searchMethod = await setExaminationListFilterAndSearch(info, workflow.maBn);
  setFloatingWorkflowStatus(
    `${searchMethod === "button" ? "Đã bấm Tìm kiếm (F3)" : "Đã gửi phím F3"}; đang chờ kết quả duy nhất của ${workflow.maBn}…`
  );

  const row = await waitForUniqueMatchingPatientRow(info, workflow.maBn);
  if(!row) {
    await failPostSaveWorkflow(`Kết quả không có đúng 1 dòng mang Mã bệnh nhân ${workflow.maBn}.`);
    return;
  }
  const patientId = await waitForCapturedPatientId(workflow.maBn);
  if(patientId) {
    await openDirectHealthExam(patientId, workflow.maBn);
    return;
  }
  const button = healthExamActionButton(row);
  if(!button) {
    await failPostSaveWorkflow("Đã thấy bệnh nhân nhưng không tìm thấy nút mở phiếu khám.");
    return;
  }

  await chrome.storage.local.remove(POST_SAVE_WORKFLOW_KEY);
  setFloatingWorkflowStatus(`Đã tìm thấy đúng Mã bệnh nhân ${workflow.maBn}; đang mở phiếu KSK…`, "success");
  sessionStorage.setItem(MANUAL_HEALTH_EXAM_KEY, String(Date.now() + 5000));
  document.dispatchEvent(new CustomEvent("reception-open-health-exam"));
  button.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
  button.focus({preventScroll:true});
  button.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, cancelable:true, view:window}));
  button.dispatchEvent(new MouseEvent("mouseup", {bubbles:true, cancelable:true, view:window}));
  button.click();
  postSaveWorkflowRunning = false;
}

let lastConfirmedPatient = "";
let lastConfirmedAt = 0;
async function handleConfirmedPatient(payload)
{
  const maBn = String(payload.maBn || "").trim();
  if(!maBn || (maBn === lastConfirmedPatient && Date.now() - lastConfirmedAt < 3000)) return;
  lastConfirmedPatient = maBn;
  lastConfirmedAt = Date.now();
  sessionStorage.removeItem("receptionDrcareConfirmed");
  const stored = await chrome.storage.local.get("receptionAutofillData");
  const fullAutoWorkflow = await readFullAutoWorkflow();
  const data = fullAutoWorkflow?.data || stored.receptionAutofillData || {};
  if(data.autoOpenHealthAfterSave !== true && !fullAutoWorkflow) {
    setFloatingWorkflowStatus(`Đã nhận Mã BN ${maBn}; tùy chọn tự tìm và mở KSK đang tắt.`);
    return;
  }
  const fullName = String(data.fullName || "").trim();
  await updateFullAutoWorkflow("finding-health", {maBn});
  await chrome.storage.local.set({
    [POST_SAVE_WORKFLOW_KEY]:{
      maBn,
      fullName,
      maLuotKhamHis:String(payload.maLuotKhamHis || ""),
      maHoSoBenhAn:String(payload.maHoSoBenhAn || ""),
      createdAt:Date.now()
    }
  });
  setFloatingWorkflowStatus(`Đã lấy Mã BN ${maBn}; đang đối chiếu trực tiếp qua API…`, "success");
  const directPatientId = await requestPatientIdFromListApi(maBn);
  if(directPatientId) {
    await openDirectHealthExam(directPatientId, maBn);
    return;
  }
  if(capturedPatientSearchError?.fatal) {
    await failPostSaveWorkflow(capturedPatientSearchError.message || "Không chuyển được trạng thái sang Đang khám.");
    return;
  }
  setFloatingWorkflowStatus(`API chưa trả về bản ghi duy nhất; đang mở Danh sách khám bệnh để tìm dự phòng…`);
  if(location.href !== EXAMINATION_LIST_URL) location.assign(EXAMINATION_LIST_URL);
  else resumePostSaveWorkflow().catch(error => failPostSaveWorkflow(error.message));
}

document.addEventListener("reception-drcare-confirmed", event => {
  let payload;
  try { payload = JSON.parse(String(event.detail || "{}")); } catch { return; }
  handleConfirmedPatient(payload).catch(error => setFloatingWorkflowStatus(error.message, "error"));
});

const pendingConfirmedPatient = sessionStorage.getItem("receptionDrcareConfirmed");
if(pendingConfirmedPatient) {
  try {
    handleConfirmedPatient(JSON.parse(pendingConfirmedPatient))
      .catch(error => setFloatingWorkflowStatus(error.message, "error"));
  } catch {
    sessionStorage.removeItem("receptionDrcareConfirmed");
  }
}

function decorateManualHealthExamButtons()
{
  if(!location.pathname.includes("/ngoaitru/kb/ds-khambenh")) return;
  const root = document.querySelector("app-danh-sach-kham-benh");
  if(!root) return;
  ensureHighlightStyle();
  const buttons = new Set(root.querySelectorAll(
    'button[ohtooltiptitle="Khám lâm sàng"], button.reception-health-exam-button'
  ));
  root.querySelectorAll("tbody tr:not(.ui-table-measure-now) button").forEach(button => {
    if(button.querySelector('[ohtype="signature"], .ph-signature')) buttons.add(button);
  });
  buttons.forEach(button => {
    if(!button.classList.contains("reception-health-exam-button")) {
      button.classList.add("reception-health-exam-button");
    }
    if(button.getAttribute("ohtooltiptitle") !== HEALTH_EXAM_BUTTON_LABEL) {
      button.setAttribute("ohtooltiptitle", HEALTH_EXAM_BUTTON_LABEL);
    }
    if(button.getAttribute("title") !== HEALTH_EXAM_BUTTON_LABEL) {
      button.setAttribute("title", HEALTH_EXAM_BUTTON_LABEL);
    }
    if(button.getAttribute("aria-label") !== HEALTH_EXAM_BUTTON_LABEL) {
      button.setAttribute("aria-label", HEALTH_EXAM_BUTTON_LABEL);
    }
    let label = button.querySelector(".reception-health-exam-label");
    if(!label) {
      label = document.createElement("span");
      label.className = "reception-health-exam-label";
      label.textContent = HEALTH_EXAM_BUTTON_LABEL;
      button.appendChild(label);
    }
  });
}

function redirectManualClinicalExam()
{
  const armedUntil = Number(sessionStorage.getItem(MANUAL_HEALTH_EXAM_KEY) || 0);
  if(Date.now() > armedUntil) {
    sessionStorage.removeItem(MANUAL_HEALTH_EXAM_KEY);
    return false;
  }
  if(!location.pathname.endsWith("/ngoaitru/kb/cls/kham-lamsan")) return false;
  const id = new URL(location.href).searchParams.get("id");
  if(!id) return false;
  sessionStorage.removeItem(MANUAL_HEALTH_EXAM_KEY);
  location.replace(`/new/his/ngoaitru/kb/cls/ksk-tre-duoi-6-tuoi?id=${encodeURIComponent(id)}`);
  return true;
}

document.addEventListener("click", event => {
  const button = event.target.closest?.("button.reception-health-exam-button");
  if(!button || !event.isTrusted) return;
  sessionStorage.setItem(MANUAL_HEALTH_EXAM_KEY, String(Date.now() + 5000));
  document.dispatchEvent(new CustomEvent("reception-open-health-exam"));
  const redirectTimer = setInterval(() => {
    if(redirectManualClinicalExam() || Date.now() > Number(sessionStorage.getItem(MANUAL_HEALTH_EXAM_KEY) || 0)) {
      clearInterval(redirectTimer);
    }
  }, 50);
}, true);

let examinationListRefreshPending = false;
function scheduleExaminationListRefresh()
{
  if(examinationListRefreshPending) return;
  examinationListRefreshPending = true;
  requestAnimationFrame(() => {
    examinationListRefreshPending = false;
    decorateManualHealthExamButtons();
    updateFloatingPageMode();
  });
}

const examinationListObserver = new MutationObserver(scheduleExaminationListRefresh);
examinationListObserver.observe(document.documentElement, {childList:true, subtree:true});
decorateManualHealthExamButtons();
redirectManualClinicalExam();
updateFloatingPageMode();
setInterval(() => updateFloatingPageMode(), 400);

const DOCK_FIELD_IDS = [
  "fullName", "identity", "birthDate", "gender", "contactPhone",
  "guardianName", "guardianRelationship", "province", "commune", "addressDetail", "companionIdentity",
  "temperature", "pulse", "respiratoryRate", "lengthCm", "weightKg",
  "headCircumferenceCm", "armCircumferenceMm", "runnyNose", "stuffyNose",
  "dentalCaries", "neonatalTeeth", "graspReflex", "moroReflex", "overwrite"
];

const DOCK_DEFAULTS = {
  fullName:"", identity:"", birthDate:"", gender:"Nam", contactPhone:"",
  guardianName:"", guardianRelationship:"Mẹ", province:"", commune:"", addressDetail:"", companionIdentity:"",
  temperature:"", pulse:"", respiratoryRate:"", lengthCm:"", weightKg:"",
  headCircumferenceCm:"", armCircumferenceMm:"", runnyNose:false,
  stuffyNose:false, dentalCaries:false, neonatalTeeth:false, graspReflex:false,
  moroReflex:false, overwrite:true
};

function ensureDockStyle()
{
  if(document.getElementById("reception-autofill-dock-style")) return;
  const style = document.createElement("style");
  style.id = "reception-autofill-dock-style";
  style.textContent = `
    html.reception-dock-open{width:calc(100% - var(--rad-dock-width,390px))!important;max-width:calc(100% - var(--rad-dock-width,390px))!important;transition:width .18s ease,max-width .18s ease}
    html.reception-dock-open body{width:100%!important;max-width:100%!important;overflow-x:auto}
    #reception-autofill-dock{position:fixed;z-index:2147483646;top:0;right:0;width:390px;height:100vh;min-width:320px;max-width:min(46vw,560px);overflow:auto;border:0;border-left:1px solid #9eb4ca;border-radius:0;background:#f4f7fb;color:#182230;box-shadow:-4px 0 16px rgba(15,35,55,.16);font:var(--rad-font-size,13px) Arial,"Segoe UI",sans-serif}
    #reception-autofill-dock *{box-sizing:border-box}
    #reception-autofill-dock .rad-head{position:sticky;z-index:2;top:0;display:flex;align-items:center;justify-content:space-between;padding:9px 10px;background:#0b6bc0;color:#fff;user-select:none}
    #reception-autofill-dock .rad-head strong{font-size:15px}
    #reception-autofill-dock .rad-head button{width:auto;min-height:27px;padding:3px 7px;border:0;border-radius:5px;background:#e8edf3;color:#29445f;font:inherit;font-weight:700;cursor:pointer}
    #reception-autofill-dock .rad-head-actions{display:flex;gap:5px}
    #reception-autofill-dock .rad-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:10px}
    #reception-autofill-dock label{display:flex;min-width:0;flex-direction:column;gap:3px;font-weight:700}
    #reception-autofill-dock label.rad-full{grid-column:1/-1}
    #reception-autofill-dock input,#reception-autofill-dock select{width:100%;min-height:32px;padding:5px 7px;border:1px solid #b8c3d1;border-radius:5px;background:#fff;color:#182230;font:inherit}
    #reception-autofill-dock .rad-check{flex-direction:row;align-items:center;min-height:30px;padding:5px 7px;border-radius:5px;background:#e7eef8;font-size:12px}
    #reception-autofill-dock .rad-check input{width:16px;min-height:16px;margin:0}
    #reception-autofill-dock .rad-switch{flex-direction:row;align-items:center;justify-content:space-between;min-height:32px;padding:5px 7px;border-radius:5px;background:#e7eef8;font-size:12px}
    #reception-autofill-dock .rad-switch-wrap{display:inline-flex;align-items:center;gap:5px;cursor:pointer}
    #reception-autofill-dock .rad-switch-wrap input{position:absolute;width:1px;min-height:1px;margin:0;opacity:0}
    #reception-autofill-dock .rad-slider{position:relative;width:34px;height:19px;border-radius:999px;background:#98a2b3;transition:background .15s ease}
    #reception-autofill-dock .rad-slider:after{content:"";position:absolute;top:3px;left:3px;width:13px;height:13px;border-radius:50%;background:#fff;transition:transform .15s ease}
    #reception-autofill-dock .rad-switch-wrap input:checked+.rad-slider{background:#16883f}
    #reception-autofill-dock .rad-switch-wrap input:checked+.rad-slider:after{transform:translateX(15px)}
    #reception-autofill-dock .rad-switch-value:after{content:"Không";color:#667085;font-weight:700}
    #reception-autofill-dock .rad-switch-wrap input:checked~.rad-switch-value:after{content:"Có";color:#176b32}
    #reception-autofill-dock .rad-actions{position:sticky;bottom:0;display:flex;gap:7px;padding:9px 10px;background:#e8edf3}
    #reception-autofill-dock .rad-actions button{min-height:34px;border:0;border-radius:5px;font-weight:700;cursor:pointer}
    #reception-autofill-dock .rad-fill{flex:1;background:#0b6bc0;color:#fff}
    #reception-autofill-dock .rad-clear{width:82px;background:#fff;color:#405166}
    #reception-autofill-dock .rad-status{grid-column:1/-1;min-height:17px;color:#405166;font-size:12px}
    #reception-autofill-dock .rad-status.ok{color:#176b32}
    #reception-autofill-dock .rad-status.error{color:#b42318}
    #reception-autofill-dock .rad-font-control{grid-column:1/-1;display:grid;grid-template-columns:auto 1fr 48px;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:#e7eef8;font-weight:700}
    #reception-autofill-dock .rad-font-control input{min-height:20px;padding:0;border:0;background:transparent}
    #reception-autofill-dock .rad-font-output{text-align:center}
    #reception-autofill-dock label,#reception-autofill-dock input,#reception-autofill-dock select,#reception-autofill-dock button,#reception-autofill-dock .rad-status,#reception-autofill-dock .rad-switch,#reception-autofill-dock .rad-check{font-size:var(--rad-font-size,13px)!important}
    #reception-autofill-dock .rad-head strong{font-size:calc(var(--rad-font-size,13px) + 2px)!important}
    #reception-autofill-dock .reception-dock-invalid{border-color:#d92d20!important;background:#fff1f0!important}
    #reception-autofill-dock.rad-collapsed{width:48px!important;min-width:48px;max-width:48px;overflow:hidden}
    #reception-autofill-dock.rad-collapsed .rad-title,#reception-autofill-dock.rad-collapsed .rad-grid,#reception-autofill-dock.rad-collapsed .rad-actions{display:none}
    #reception-autofill-dock.rad-collapsed .rad-head{height:100vh;padding:6px;align-items:flex-start}
    #reception-autofill-dock.rad-collapsed .rad-head-actions{flex-direction:column}
    #reception-autofill-dock.rad-collapsed .rad-theme,#reception-autofill-dock.rad-collapsed .rad-reset{display:none}
    #reception-autofill-dock.rad-dark{border-color:#526174;background:#171c24;color:#edf2f7;box-shadow:0 8px 28px rgba(0,0,0,.55)}
    #reception-autofill-dock.rad-dark input,#reception-autofill-dock.rad-dark select{border-color:#59687b;background:#242b36;color:#f3f5f7}
    #reception-autofill-dock.rad-dark input::placeholder{color:#9ba8b8}
    #reception-autofill-dock.rad-dark .rad-switch,#reception-autofill-dock.rad-dark .rad-check{background:#293342}
    #reception-autofill-dock.rad-dark .rad-font-control{background:#293342}
    #reception-autofill-dock.rad-dark .rad-actions{background:#202733}
    #reception-autofill-dock.rad-dark .rad-clear{background:#343e4c;color:#f3f5f7}
    #reception-autofill-dock.rad-dark .rad-status{color:#c4cfdb}
    #reception-autofill-dock.rad-dark .rad-status.ok{color:#78d995}
    #reception-autofill-dock.rad-dark .rad-status.error{color:#ff938a}
    #reception-autofill-dock.rad-dark .rad-switch-value:after{color:#bdc8d5}
    #reception-autofill-dock.rad-dark .reception-dock-invalid{border-color:#ff7268!important;background:#402523!important}
  `;
  (document.head || document.documentElement).appendChild(style);
}

function dockInput(id)
{
  return document.getElementById(`reception-dock-${id}`);
}

function getDockData()
{
  const text = id => String(dockInput(id)?.value || "").trim();
  const checked = id => dockInput(id)?.checked === true;
  return {
    fullName:text("fullName"), identity:text("identity").replace(/\D/g, ""),
    birthDate:text("birthDate").replace(/\D/g, "").slice(0, 8), gender:text("gender"),
    contactPhone:text("contactPhone").replace(/\D/g, ""), guardianName:text("guardianName"),
    guardianRelationship:text("guardianRelationship"), province:text("province"),
    commune:text("commune"), addressDetail:text("addressDetail"),
    companionIdentity:text("companionIdentity").replace(/\D/g, ""), temperature:text("temperature"),
    pulse:text("pulse"), respiratoryRate:text("respiratoryRate"), lengthCm:text("lengthCm"),
    weightKg:text("weightKg"), headCircumferenceCm:text("headCircumferenceCm"),
    armCircumferenceMm:text("armCircumferenceMm"), runnyNose:checked("runnyNose"),
    stuffyNose:checked("stuffyNose"), dentalCaries:checked("dentalCaries"),
    neonatalTeeth:checked("neonatalTeeth"), graspReflex:checked("graspReflex"),
    moroReflex:checked("moroReflex"), overwrite:checked("overwrite"),
    patientType:"Miễn phí", receptionReason:"Khám bệnh", documentType:"Định danh công dân",
    examRequest:EXAM_REQUEST_UNDER_SIX, clinicSelection:"first"
  };
}

function setDockData(data)
{
  const value = {...DOCK_DEFAULTS, ...(data || {})};
  const legacyDefaults = {temperature:"37", pulse:"92", respiratoryRate:"22", headCircumferenceCm:"50"};
  Object.entries(legacyDefaults).forEach(([id, oldDefault]) => {
    if(String(value[id] ?? "").trim() === oldDefault) value[id] = "";
  });
  DOCK_FIELD_IDS.forEach(id => {
    const element = dockInput(id);
    if(!element) return;
    if(element.type === "checkbox") element.checked = value[id] === true;
    else if(id === "birthDate") element.value = String(value[id] ?? "").replace(/\D/g, "").slice(0, 8);
    else element.value = value[id] ?? "";
  });
}

function validateDockData(data)
{
  const rules = [
    ["identity", !data.identity || /^\d{12}$/.test(data.identity), "CCCD trẻ em cần đủ 12 số."],
    ["contactPhone", !data.contactPhone || /^\d{10}$/.test(data.contactPhone), "SĐT cần đủ 10 số."],
    ["birthDate", !data.birthDate || /^\d{8}$/.test(data.birthDate), "Ngày sinh cần đủ 8 số ddmmyyyy."],
    ["companionIdentity", !data.companionIdentity || /^\d{12}$/.test(data.companionIdentity), "CCCD người đi cùng cần đủ 12 số."]
  ];
  const numeric = ["temperature", "pulse", "respiratoryRate", "lengthCm", "weightKg", "headCircumferenceCm", "armCircumferenceMm"];
  numeric.forEach(id => rules.push([id, !data[id] || /^\d+(?:[.,]\d+)?$/.test(data[id]), `${id} phải là số.`]));
  const locationComplete = (!data.province && !data.commune) || (!!data.province && !!data.commune);
  rules.push(["province", locationComplete, "Cần nhập đủ cả Tỉnh/Thành phố và Xã/Phường."]);
  rules.push(["commune", locationComplete, "Cần nhập đủ cả Tỉnh/Thành phố và Xã/Phường."]);
  let error = "";
  rules.forEach(([id, valid, message]) => {
    dockInput(id)?.classList.toggle("reception-dock-invalid", !valid);
    if(!valid && !error) error = message;
  });
  return error;
}

function setDockStatus(text, type = "")
{
  const status = document.querySelector("#reception-autofill-dock .rad-status");
  if(!status) return;
  status.textContent = text;
  status.className = `rad-status ${type}`;
}

async function initReceptionDock()
{
  if(location.hostname !== "ytcs.hmis.vn" || document.getElementById("reception-autofill-dock")) return;
  ensureDockStyle();
  const dock = document.createElement("aside");
  dock.id = "reception-autofill-dock";
  dock.innerHTML = `
    <div class="rad-head"><strong class="rad-title">Khám sức khỏe trẻ dưới 6 tuổi</strong><span class="rad-head-actions"><button type="button" class="rad-theme" title="Chuyển giao diện tối">🌙</button><button type="button" class="rad-reset" title="Đặt lại chiều rộng">↺</button><button type="button" class="rad-toggle">Thu gọn</button></span></div>
    <div class="rad-grid">
      <div class="rad-font-control"><span>Cỡ chữ</span><input class="rad-font-range" type="range" min="10" max="24" step="1" value="13"><output class="rad-font-output">13px</output></div>
      <label class="rad-full">Họ và tên<input id="reception-dock-fullName" autocomplete="off"></label>
      <label>CCCD trẻ em<input id="reception-dock-identity" inputmode="numeric" maxlength="12"></label>
      <label>Ngày sinh<input id="reception-dock-birthDate" inputmode="numeric" maxlength="8" placeholder="ddmmyyyy"></label>
      <label>Giới tính<select id="reception-dock-gender"><option>Nam</option><option>Nữ</option></select></label>
      <label>SĐT liên hệ<input id="reception-dock-contactPhone" inputmode="numeric" maxlength="10"></label>
      <label class="rad-full">Tên người liên hệ/giám hộ<input id="reception-dock-guardianName"></label>
      <label>Quan hệ<select id="reception-dock-guardianRelationship"><option>Cha</option><option selected>Mẹ</option><option>Ông/Bà</option><option>Anh/Chị</option><option>Họ hàng</option><option>Khác</option></select></label>
      <label>Tỉnh/Thành phố<input id="reception-dock-province" autocomplete="off" placeholder="Gõ như trên form"></label>
      <label>Xã/Phường<input id="reception-dock-commune" autocomplete="off" placeholder="Gõ như trên form"></label>
      <label class="rad-full">Số nhà<input id="reception-dock-addressDetail"></label>
      <label class="rad-full">CCCD người đi cùng trẻ<input id="reception-dock-companionIdentity" inputmode="numeric" maxlength="12"></label>
      <label>Nhiệt độ °C<input id="reception-dock-temperature" inputmode="decimal" placeholder="Mặc định 37"></label>
      <label>Mạch/phút<input id="reception-dock-pulse" inputmode="decimal" placeholder="Mặc định 92"></label>
      <label>Nhịp thở/phút<input id="reception-dock-respiratoryRate" inputmode="decimal" placeholder="Mặc định 22"></label>
      <label>Chiều dài cm<input id="reception-dock-lengthCm" inputmode="decimal"></label>
      <label>Cân nặng kg<input id="reception-dock-weightKg" inputmode="decimal"></label>
      <label>Vòng đầu cm<input id="reception-dock-headCircumferenceCm" inputmode="decimal" placeholder="Mặc định 50 (49–52)"></label>
      <label class="rad-full">Chu vi vòng cánh tay mm<input id="reception-dock-armCircumferenceMm" inputmode="decimal" placeholder="12,5 → 125"></label>
      <label class="rad-switch"><span>Chảy nước mũi</span><span class="rad-switch-wrap"><input id="reception-dock-runnyNose" type="checkbox"><span class="rad-slider"></span><span class="rad-switch-value"></span></span></label>
      <label class="rad-switch"><span>Nghẹt mũi</span><span class="rad-switch-wrap"><input id="reception-dock-stuffyNose" type="checkbox"><span class="rad-slider"></span><span class="rad-switch-value"></span></span></label>
      <label class="rad-switch"><span>Vết sâu/mảng bám</span><span class="rad-switch-wrap"><input id="reception-dock-dentalCaries" type="checkbox"><span class="rad-slider"></span><span class="rad-switch-value"></span></span></label>
      <label class="rad-switch"><span>Răng sữa sơ sinh</span><span class="rad-switch-wrap"><input id="reception-dock-neonatalTeeth" type="checkbox"><span class="rad-slider"></span><span class="rad-switch-value"></span></span></label>
      <label class="rad-switch"><span>Phản xạ nắm</span><span class="rad-switch-wrap"><input id="reception-dock-graspReflex" type="checkbox"><span class="rad-slider"></span><span class="rad-switch-value"></span></span></label>
      <label class="rad-switch"><span>Phản xạ Moro</span><span class="rad-switch-wrap"><input id="reception-dock-moroReflex" type="checkbox"><span class="rad-slider"></span><span class="rad-switch-value"></span></span></label>
      <label class="rad-check rad-full"><input id="reception-dock-overwrite" type="checkbox">Ghi đè trường đã có dữ liệu</label>
      <div class="rad-status" role="status"></div>
    </div>
    <div class="rad-actions"><button type="button" class="rad-fill">Điền form hiện tại</button><button type="button" class="rad-clear">Xóa</button></div>`;
  document.body.appendChild(dock);

  const stored = await chrome.storage.local.get(["receptionAutofillData", "receptionDockCollapsed", "receptionDockLayout", "receptionDockAppearance"]);
  setDockData(stored.receptionAutofillData);
  let dockAppearance = {
    fontSize:Math.min(Math.max(Number(stored.receptionDockAppearance?.fontSize) || 13, 10), 24),
    theme:stored.receptionDockAppearance?.theme === "dark" ? "dark" : "light"
  };
  const applyDockAppearance = () => {
    dock.style.setProperty("--rad-font-size", `${dockAppearance.fontSize}px`);
    dock.classList.toggle("rad-dark", dockAppearance.theme === "dark");
    dock.querySelector(".rad-font-range").value = String(dockAppearance.fontSize);
    dock.querySelector(".rad-font-output").textContent = `${dockAppearance.fontSize}px`;
    const themeButton = dock.querySelector(".rad-theme");
    themeButton.textContent = dockAppearance.theme === "dark" ? "☀️" : "🌙";
    themeButton.title = dockAppearance.theme === "dark" ? "Chuyển giao diện sáng" : "Chuyển giao diện tối";
  };
  let appearanceTimer;
  const saveDockAppearance = () => {
    applyDockAppearance();
    clearTimeout(appearanceTimer);
    appearanceTimer = setTimeout(() => chrome.storage.local.set({receptionDockAppearance:dockAppearance}), 120);
  };
  applyDockAppearance();
  let dockLayout = stored.receptionDockLayout || {width:390};
  const clampDockWidth = width => Math.min(Math.max(Number(width) || 390, 320), Math.max(320, window.innerWidth * .46));
  const applyDockLayout = layout => {
    dockLayout = {width:clampDockWidth(layout?.width)};
    dock.style.width = `${dockLayout.width}px`;
  };
  const applyDockSpace = () => {
    const collapsed = dock.classList.contains("rad-collapsed");
    document.documentElement.classList.add("reception-dock-open");
    document.documentElement.style.setProperty("--rad-dock-width", collapsed ? "48px" : `${dockLayout.width}px`);
    dock.querySelector(".rad-toggle").textContent = collapsed ? "Mở" : "Thu gọn";
  };
  applyDockLayout(dockLayout);
  dock.classList.toggle("rad-collapsed", stored.receptionDockCollapsed === true);
  applyDockSpace();

  let saveTimer;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => chrome.storage.local.set({receptionAutofillData:getDockData()}), 120);
  };
  DOCK_FIELD_IDS.forEach(id => {
    dockInput(id)?.addEventListener("input", save);
    dockInput(id)?.addEventListener("change", save);
  });
  let layoutTimer;
  const saveDockLayout = () => {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => chrome.storage.local.set({receptionDockLayout:dockLayout}), 160);
  };
  const isLeftResizeEdge = event => !dock.classList.contains("rad-collapsed") &&
    event.clientX - dock.getBoundingClientRect().left <= 9;
  dock.addEventListener("pointermove", event => {
    dock.style.cursor = isLeftResizeEdge(event) ? "ew-resize" : "";
  });
  dock.addEventListener("pointerleave", () => { dock.style.cursor = ""; });
  dock.addEventListener("pointerdown", event => {
    if(event.button !== 0 || !isLeftResizeEdge(event)) return;
    const startWidth = dock.getBoundingClientRect().width;
    const startX = event.clientX;
    const move = moveEvent => {
      dockLayout.width = clampDockWidth(startWidth + startX - moveEvent.clientX);
      dock.style.width = `${dockLayout.width}px`;
      applyDockSpace();
    };
    const stop = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      document.removeEventListener("pointercancel", stop);
      dock.style.cursor = "";
      saveDockLayout();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop, {once:true});
    document.addEventListener("pointercancel", stop, {once:true});
    event.preventDefault();
    event.stopPropagation();
  }, true);

  dock.querySelector(".rad-reset").addEventListener("click", async () => {
    applyDockLayout({width:390});
    applyDockSpace();
    await chrome.storage.local.remove("receptionDockLayout");
  });
  dock.querySelector(".rad-font-range").addEventListener("input", event => {
    dockAppearance.fontSize = Math.min(Math.max(Number(event.target.value) || 13, 10), 24);
    saveDockAppearance();
  });
  dock.querySelector(".rad-theme").addEventListener("click", () => {
    dockAppearance.theme = dockAppearance.theme === "dark" ? "light" : "dark";
    saveDockAppearance();
  });
  dock.querySelector(".rad-toggle").addEventListener("click", async () => {
    const collapsed = !dock.classList.contains("rad-collapsed");
    dock.classList.toggle("rad-collapsed", collapsed);
    applyDockSpace();
    await chrome.storage.local.set({receptionDockCollapsed:collapsed});
  });
  window.addEventListener("resize", () => {
    applyDockLayout(dockLayout);
    applyDockSpace();
  });
  dock.querySelector(".rad-fill").addEventListener("click", async () => {
    const data = getDockData();
    const error = validateDockData(data);
    if(error) return setDockStatus(error, "error");
    setDockStatus("Đang điền dữ liệu…");
    await chrome.storage.local.set({receptionAutofillData:data});
    const result = await fillReceptionForm(data);
    if(!result.ok) return setDockStatus(result.error || "Không tìm thấy form phù hợp.", "error");
    const message = [`Đã điền ${result.filled.length} trường`];
    if(result.skipped.length) message.push(`bỏ qua ${result.skipped.length} trường có dữ liệu`);
    if(result.failed.length) message.push(`chưa điền: ${result.failed.join(", ")}`);
    setDockStatus(message.join(" · "), result.failed.length ? "error" : "ok");
  });
  dock.querySelector(".rad-clear").addEventListener("click", async () => {
    setDockData(DOCK_DEFAULTS);
    await chrome.storage.local.set({receptionAutofillData:{...DOCK_DEFAULTS}});
    setDockStatus("Đã xóa và khôi phục giá trị mặc định.");
  });
}

// Mount the extension as an overlay so the VNPT HIS viewport and layout remain
// untouched. The outer handle collapses the whole interface to the page edge.
initFloatingExtension().catch(() => {});
resumePostSaveWorkflow().catch(error => failPostSaveWorkflow(error.message));
resumeFullAutoWorkflow().catch(error => failFullAutoWorkflow(error.message));
