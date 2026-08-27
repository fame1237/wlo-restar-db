import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

type ElementKey = "earth" | "water" | "wind" | "fire";
type ElementFilter = ElementKey | "all";
type SortKey = `name-${"asc" | "desc"}` | "updated-desc";

interface DemonRecord {
  id: string;
  name: string;
  element: ElementKey;
  updatedAt: string;
}

interface DatabaseRow {
  id: string;
  name: string;
  element: ElementKey;
  updated_at: string;
}

interface FormValues {
  name: string;
  element: ElementKey;
}

interface RecordGroup {
  letter: string;
  key: string;
  records: DemonRecord[];
}

const STORAGE_KEY = "demondex-records-v1";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  "";
const adminUsername = import.meta.env.VITE_ADMIN_USERNAME?.trim() || "admin1234";
const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim() || "admin1234@demondex.local";
const hasPartialCloudConfig = Boolean(supabaseUrl || supabaseKey) && !(supabaseUrl && supabaseKey);
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ELEMENTS: Record<
  ElementKey,
  { label: string; css: string; soft: string; line: string }
> = {
  earth: { label: "ดิน", css: "#aa7408", soft: "#fff5d6", line: "#f1d27b" },
  water: { label: "น้ำ", css: "#1670c7", soft: "#e7f3ff", line: "#a8d4f7" },
  wind: { label: "ลม", css: "#18825c", soft: "#e7f8f0", line: "#a9dfc8" },
  fire: { label: "ไฟ", css: "#c94035", soft: "#fff0ee", line: "#f4b8b2" },
};

const SAMPLE_DATA: Array<readonly [string, ElementKey]> = [
  ["กระป๋องเหล็ก", "earth"],
  ["กล่องเครื่องดื่มเคลือบฟอยล์", "fire"],
  ["กล่องดำ", "earth"],
  ["กากกัมมันตรังสี", "earth"],
  ["แกนพลังงาน", "water"],
  ["ขวดน้ำพลาสติก", "water"],
  ["ซากเรือดำน้ำ", "wind"],
  ["ต่างแก", "earth"],
  ["ตะปูเหล็ก", "fire"],
  ["ตัวทำละลาย", "fire"],
  ["ถุงพลาสติก", "wind"],
  ["น้ำยาฟอกขาว", "wind"],
  ["แบตเตอรี่ใช้แล้ว", "earth"],
  ["ฝาขวดพลาสติก", "water"],
  ["โฟมพลาสติก", "wind"],
  ["เรดาร์", "wind"],
  ["โลหะใต้พิภพ", "fire"],
  ["เศษเหล็กเส้นขนาดใหญ่", "fire"],
  ["สมอเรือ", "earth"],
  ["สายเคเบิลใช้แล้ว", "fire"],
  ["สารกำจัดศัตรูพืช", "fire"],
];

const SAMPLE_RECORDS: DemonRecord[] = SAMPLE_DATA.map(([name, element], index) => ({
  id: `sample-${index + 1}`,
  name,
  element,
  updatedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
}));

const state: {
  records: DemonRecord[];
  query: string;
  element: ElementFilter;
  sort: SortKey;
  editingId: string | null;
  deletingId: string | null;
  session: Session | null;
  collapsedGroups: Set<string>;
} = {
  records: supabase ? [] : loadLocalRecords(),
  query: "",
  element: "all",
  sort: "name-asc",
  editingId: null,
  deletingId: null,
  session: null,
  collapsedGroups: new Set<string>(),
};
const thaiCollator = new Intl.Collator("th-TH", { sensitivity: "base", numeric: true });

function queryRequired<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`ไม่พบ element ที่จำเป็น: ${selector}`);
  return node;
}

const dom = {
  searchInput: queryRequired<HTMLInputElement>("#search-input"),
  tableBody: queryRequired<HTMLTableSectionElement>("#demon-table-body"),
  cardList: queryRequired<HTMLElement>("#demon-card-list"),
  emptyState: queryRequired<HTMLElement>("#empty-state"),
  totalCount: queryRequired<HTMLElement>("#total-count"),
  resultCount: queryRequired<HTMLElement>("#result-count"),
  summaryText: queryRequired<HTMLElement>("#result-summary-text"),
  sortSelect: queryRequired<HTMLSelectElement>("#sort-select"),
  alphabetNav: queryRequired<HTMLElement>("#alphabet-nav"),
  alphabetList: queryRequired<HTMLElement>("#alphabet-list"),
  clearFilterButton: queryRequired<HTMLButtonElement>("#clear-filter-button"),
  demonDialog: queryRequired<HTMLDialogElement>("#demon-dialog"),
  deleteDialog: queryRequired<HTMLDialogElement>("#delete-dialog"),
  authDialog: queryRequired<HTMLDialogElement>("#auth-dialog"),
  demonForm: queryRequired<HTMLFormElement>("#demon-form"),
  authForm: queryRequired<HTMLFormElement>("#auth-form"),
  demonName: queryRequired<HTMLInputElement>("#demon-name"),
  authUsername: queryRequired<HTMLInputElement>("#auth-username"),
  authPassword: queryRequired<HTMLInputElement>("#auth-password"),
  nameError: queryRequired<HTMLElement>("#name-error"),
  elementError: queryRequired<HTMLElement>("#element-error"),
  authError: queryRequired<HTMLElement>("#auth-error"),
  formTitle: queryRequired<HTMLElement>("#form-title"),
  formDescription: queryRequired<HTMLElement>("#form-description"),
  submitLabel: queryRequired<HTMLElement>("#submit-label"),
  submitButton: queryRequired<HTMLButtonElement>("#submit-button"),
  confirmDeleteButton: queryRequired<HTMLButtonElement>("#confirm-delete-button"),
  signInButton: queryRequired<HTMLButtonElement>("#sign-in-button"),
  deleteName: queryRequired<HTMLElement>("#delete-name"),
  toastRegion: queryRequired<HTMLElement>("#toast-region"),
  authButton: queryRequired<HTMLButtonElement>("#auth-button"),
  accountLabel: queryRequired<HTMLElement>("#account-label"),
  dataModeLabel: queryRequired<HTMLElement>("#data-mode-label"),
  primaryAddButton: queryRequired<HTMLButtonElement>("[data-action='add']"),
  tableWrap: queryRequired<HTMLElement>(".table-wrap"),
};

function isElementKey(value: unknown): value is ElementKey {
  return typeof value === "string" && value in ELEMENTS;
}

function isSortKey(value: string): value is SortKey {
  return ["name-asc", "name-desc", "updated-desc"].includes(value);
}

function loadLocalRecords(): DemonRecord[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(stored)) return [...SAMPLE_RECORDS];

    const valid = stored.filter(
      (item): item is DemonRecord =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string" &&
        "name" in item &&
        typeof item.name === "string" &&
        "element" in item &&
        isElementKey(item.element) &&
        "updatedAt" in item &&
        typeof item.updatedAt === "string",
    );
    return valid.length === stored.length ? valid : [...SAMPLE_RECORDS];
  } catch {
    return [...SAMPLE_RECORDS];
  }
}

function saveLocalRecords(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function fromDatabaseRow(row: DatabaseRow): DemonRecord {
  return {
    id: row.id,
    name: row.name,
    element: row.element,
    updatedAt: row.updated_at,
  };
}

async function fetchCloudRecords(): Promise<DemonRecord[]> {
  if (!supabase) return state.records;
  const { data, error } = await supabase
    .from("demons")
    .select("id,name,element,updated_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as DatabaseRow[]).map(fromDatabaseRow);
}

async function createRecord(values: FormValues): Promise<DemonRecord> {
  if (!supabase) {
    const record: DemonRecord = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `demon-${Date.now()}`,
      ...values,
      updatedAt: new Date().toISOString(),
    };
    state.records.unshift(record);
    saveLocalRecords();
    return record;
  }

  const { data, error } = await supabase
    .from("demons")
    .insert({ name: values.name, element: values.element })
    .select("id,name,element,updated_at")
    .single();
  if (error) throw error;
  return fromDatabaseRow(data as DatabaseRow);
}

async function updateRecord(id: string, values: FormValues): Promise<DemonRecord> {
  if (!supabase) {
    const index = state.records.findIndex((record) => record.id === id);
    const current = state.records[index];
    if (index < 0 || !current) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
    const updated: DemonRecord = { ...current, ...values, updatedAt: new Date().toISOString() };
    state.records[index] = updated;
    saveLocalRecords();
    return updated;
  }

  const { data, error } = await supabase
    .from("demons")
    .update({ name: values.name, element: values.element })
    .eq("id", id)
    .select("id,name,element,updated_at")
    .single();
  if (error) throw error;
  return fromDatabaseRow(data as DatabaseRow);
}

async function deleteRecord(id: string): Promise<void> {
  if (!supabase) {
    state.records = state.records.filter((record) => record.id !== id);
    saveLocalRecords();
    return;
  }

  const { error } = await supabase.from("demons").delete().eq("id", id);
  if (error) throw error;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("th-TH");
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  };
  return value.replace(/[&<>'"]/g, (char) => entities[char] ?? char);
}

function highlightMatch(name: string): string {
  const query = normalize(state.query);
  if (!query) return escapeHtml(name);

  const index = name.toLocaleLowerCase("th-TH").indexOf(query);
  if (index < 0) return escapeHtml(name);

  const before = escapeHtml(name.slice(0, index));
  const match = escapeHtml(name.slice(index, index + query.length));
  const after = escapeHtml(name.slice(index + query.length));
  return `${before}<mark>${match}</mark>${after}`;
}

function getVisibleRecords(): DemonRecord[] {
  const query = normalize(state.query);
  const records = state.records.filter((record) => {
    const matchesName = !query || normalize(record.name).includes(query);
    const matchesElement = state.element === "all" || record.element === state.element;
    return matchesName && matchesElement;
  });

  const direction = state.sort.endsWith("-desc") ? -1 : 1;
  return records.sort((a, b) => {
    if (state.sort === "updated-desc") {
      const timeDifference = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      return timeDifference || thaiCollator.compare(a.name, b.name);
    }
    return thaiCollator.compare(a.name, b.name) * direction;
  });
}

function firstCharacter(name: string): string {
  return Array.from(name.trim())[0] ?? "#";
}

function alphabetKey(letter: string): string {
  return Array.from(letter)
    .map((character) => character.codePointAt(0)?.toString(16) ?? "unknown")
    .join("-");
}

function shouldGroupByLetter(): boolean {
  return state.sort === "name-asc" || state.sort === "name-desc";
}

function groupRecords(records: DemonRecord[]): RecordGroup[] {
  const groups = new Map<string, DemonRecord[]>();
  records.forEach((record) => {
    const letter = firstCharacter(record.name);
    const current = groups.get(letter) ?? [];
    current.push(record);
    groups.set(letter, current);
  });
  return Array.from(groups, ([letter, groupedRecords]) => ({
    letter,
    key: alphabetKey(letter),
    records: groupedRecords,
  }));
}

function recordStyle(record: DemonRecord): string {
  const element = ELEMENTS[record.element];
  return `--row-color:${element.css};--row-soft:${element.soft};--row-line:${element.line}`;
}

function canWrite(): boolean {
  return !supabase || Boolean(state.session);
}

function actionButtons(record: DemonRecord): string {
  const safeName = escapeHtml(record.name);
  const safeId = escapeHtml(record.id);
  return `
    <div class="row-actions">
      <button class="action-button" type="button" data-action="edit" data-id="${safeId}" aria-label="แก้ไข ${safeName}" title="แก้ไข">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16.86 3.49 3.65 3.65a1.7 1.7 0 0 1 0 2.4L9.55 20.5 3 21l.5-6.55L14.46 3.49a1.7 1.7 0 0 1 2.4 0ZM5.4 15.34l-.27 3.53 3.53-.27 8.72-8.72-3.26-3.26-8.72 8.72Zm10.13-10.13 3.26 3.26.3-.3-3.26-3.26-.3.3Z" /></svg>
      </button>
      <button class="action-button is-delete" type="button" data-action="delete" data-id="${safeId}" aria-label="ลบ ${safeName}" title="ลบ">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3a2 2 0 0 0-2 2v1H4a1 1 0 1 0 0 2h1l.8 11.1A2 2 0 0 0 7.8 21h8.4a2 2 0 0 0 2-1.9L19 8h1a1 1 0 1 0 0-2h-3V5a2 2 0 0 0-2-2H9Zm6 3H9V5h6v1Zm-7.2 2h8.4l-.8 11H8.6l-.8-11Zm2.7 2a1 1 0 0 0-1 1v5a1 1 0 1 0 2 0v-5a1 1 0 0 0-1-1Zm3 0a1 1 0 0 0-1 1v5a1 1 0 1 0 2 0v-5a1 1 0 0 0-1-1Z" /></svg>
      </button>
    </div>`;
}

function tableRow(record: DemonRecord, groupKey?: string, collapsed = false): string {
  const element = ELEMENTS[record.element];
  return `
    <tr style="${recordStyle(record)}"${groupKey ? ` data-group-member="${groupKey}"` : ""}${collapsed ? " hidden" : ""}>
      <td><div class="demon-name"><span>${highlightMatch(record.name)}</span></div></td>
      <td><span class="element-badge"><i aria-hidden="true"></i>${element.label}</span></td>
      <td>${actionButtons(record)}</td>
    </tr>`;
}

function mobileCard(record: DemonRecord, groupKey?: string, collapsed = false): string {
  const element = ELEMENTS[record.element];
  return `
    <article class="demon-card" style="${recordStyle(record)}"${groupKey ? ` data-group-member="${groupKey}"` : ""}${collapsed ? " hidden" : ""}>
      <div class="demon-card-main">
        <div class="demon-name"><span>${highlightMatch(record.name)}</span></div>
        <div class="demon-card-meta"><span class="element-badge"><i aria-hidden="true"></i>${element.label}</span></div>
      </div>
      ${actionButtons(record)}
    </article>`;
}

function tableGroup(group: RecordGroup): string {
  const collapsed = state.collapsedGroups.has(group.key);
  return `
    <tr class="alphabet-row" id="alpha-table-${group.key}">
      <th colspan="3" scope="rowgroup">
        <button class="group-toggle${collapsed ? " is-collapsed" : ""}" type="button" data-group-key="${group.key}" aria-expanded="${String(!collapsed)}" aria-label="${collapsed ? "ขยาย" : "ยุบ"}กลุ่มตัวอักษร ${escapeHtml(group.letter)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7.4 9.4 4.6 4.6 4.6-4.6a1 1 0 1 1 1.4 1.4l-5.3 5.3a1 1 0 0 1-1.4 0L6 10.8a1 1 0 0 1 1.4-1.4Z" /></svg>
          <span>${escapeHtml(group.letter)}</span>
          <small>${group.records.length.toLocaleString("th-TH")} รายการ</small>
        </button>
      </th>
    </tr>
    ${group.records.map((record) => tableRow(record, group.key, collapsed)).join("")}`;
}

function mobileGroup(group: RecordGroup): string {
  const collapsed = state.collapsedGroups.has(group.key);
  return `
    <div class="alphabet-card-header" id="alpha-card-${group.key}">
      <button class="group-toggle${collapsed ? " is-collapsed" : ""}" type="button" data-group-key="${group.key}" aria-expanded="${String(!collapsed)}" aria-label="${collapsed ? "ขยาย" : "ยุบ"}กลุ่มตัวอักษร ${escapeHtml(group.letter)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7.4 9.4 4.6 4.6 4.6-4.6a1 1 0 1 1 1.4 1.4l-5.3 5.3a1 1 0 0 1-1.4 0L6 10.8a1 1 0 0 1 1.4-1.4Z" /></svg>
        <span>${escapeHtml(group.letter)}</span>
        <small>${group.records.length.toLocaleString("th-TH")} รายการ</small>
      </button>
    </div>
    ${group.records.map((record) => mobileCard(record, group.key, collapsed)).join("")}`;
}

function renderAlphabetNav(groups: RecordGroup[], visibleRecords: DemonRecord[]): void {
  const visible = shouldGroupByLetter() && groups.length > 1 && visibleRecords.length > 0;
  dom.alphabetNav.hidden = !visible;
  dom.alphabetList.innerHTML = visible
    ? groups
        .map(
          (group) =>
            `<button type="button" data-alpha-key="${group.key}" aria-label="ไปยังรายชื่อขึ้นต้นด้วย ${escapeHtml(group.letter)}">${escapeHtml(group.letter)}</button>`,
        )
        .join("")
    : "";
}

function countByElement(element: ElementKey): number {
  return state.records.filter((record) => record.element === element).length;
}

function renderCounts(visibleRecords: DemonRecord[]): void {
  dom.totalCount.textContent = state.records.length.toLocaleString("th-TH");
  dom.resultCount.textContent = visibleRecords.length.toLocaleString("th-TH");
  document.querySelectorAll<HTMLElement>("[data-count]").forEach((node) => {
    const element = node.dataset.count;
    const count = element === "all" ? state.records.length : isElementKey(element) ? countByElement(element) : 0;
    node.textContent = count.toLocaleString("th-TH");
  });

}

function renderSummary(visibleRecords: DemonRecord[]): void {
  const parts: string[] = [];
  if (state.query.trim()) parts.push(`คำค้น “${state.query.trim()}”`);
  if (state.element !== "all") parts.push(`ธาตุ${ELEMENTS[state.element].label}`);

  dom.summaryText.textContent = parts.length
    ? `พบ ${visibleRecords.length.toLocaleString("th-TH")} รายการ จาก ${parts.join(" · ")}`
    : `กำลังแสดงข้อมูลทั้งหมด ${state.records.length.toLocaleString("th-TH")} รายการ`;
  dom.clearFilterButton.hidden = parts.length === 0;
}

function updateSortHeaders(): void {
  document.querySelectorAll<HTMLElement>("[data-sort-header]").forEach((header) => {
    const column = header.dataset.sortHeader;
    const active = state.sort.startsWith(`${column}-`);
    const direction = state.sort.endsWith("-desc") ? "descending" : "ascending";
    header.setAttribute("aria-sort", active ? direction : "none");

    const button = header.querySelector<HTMLButtonElement>("[data-sort]");
    if (!button) return;
    button.classList.toggle("is-active", active);
    const nextDirection = active && direction === "ascending" ? "มากไปน้อย" : "น้อยไปมาก";
    const sortLabel = `เรียงตามชื่อปีศาจ ${nextDirection}`;
    button.setAttribute("aria-label", sortLabel);
    button.title = sortLabel;
  });
  dom.sortSelect.value = state.sort;
}

function render(): void {
  const visibleRecords = getVisibleRecords();
  const groups = groupRecords(visibleRecords);
  const grouped = shouldGroupByLetter();
  dom.tableBody.innerHTML = grouped
    ? groups.map(tableGroup).join("")
    : visibleRecords.map((record) => tableRow(record)).join("");
  dom.cardList.innerHTML = grouped
    ? groups.map(mobileGroup).join("")
    : visibleRecords.map((record) => mobileCard(record)).join("");
  dom.emptyState.hidden = visibleRecords.length !== 0;
  dom.tableWrap.hidden = visibleRecords.length === 0;
  dom.cardList.hidden = visibleRecords.length === 0;
  renderCounts(visibleRecords);
  renderSummary(visibleRecords);
  renderAlphabetNav(groups, visibleRecords);
  updateSortHeaders();
}

function syncAuthUi(): void {
  if (!supabase) {
    dom.authButton.hidden = true;
    dom.accountLabel.textContent = "โหมดทดลอง";
    dom.dataModeLabel.textContent = "ข้อมูลในเบราว์เซอร์นี้";
    dom.primaryAddButton.title = "เพิ่มปีศาจ";
    return;
  }

  dom.authButton.hidden = false;
  if (state.session) {
    dom.accountLabel.textContent = adminUsername;
    dom.dataModeLabel.textContent = "แก้ไขข้อมูลส่วนกลางได้";
    dom.authButton.textContent = "ออกจากระบบ";
    dom.authButton.dataset.action = "sign-out";
    dom.primaryAddButton.title = "เพิ่มปีศาจ";
  } else {
    dom.accountLabel.textContent = "ผู้เยี่ยมชม";
    dom.dataModeLabel.textContent = "ดูข้อมูลส่วนกลางได้";
    dom.authButton.textContent = "เข้าสู่ระบบ";
    dom.authButton.dataset.action = "open-auth";
    dom.primaryAddButton.title = "เข้าสู่ระบบเพื่อเพิ่มปีศาจ";
  }
}

async function refreshCloudRecords(): Promise<void> {
  if (!supabase) return;
  try {
    state.records = await fetchCloudRecords();
    render();
  } catch (error) {
    showToast(errorMessage(error, "โหลดข้อมูลไม่สำเร็จ"), "error");
    render();
  }
}

function clearFilters(): void {
  state.query = "";
  state.element = "all";
  dom.searchInput.value = "";
  updateActiveFilter();
  render();
  dom.searchInput.focus();
}

function updateActiveFilter(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-element]").forEach((button) => {
    const active = button.dataset.element === state.element;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function requireWriteAccess(): boolean {
  if (canWrite()) return true;
  openAuth();
  showToast("กรุณาเข้าสู่ระบบก่อนจัดการข้อมูล", "info");
  return false;
}

function openForm(recordId: string | null = null): void {
  if (!requireWriteAccess()) return;
  state.editingId = recordId;
  dom.demonForm.reset();
  clearFormErrors();

  if (recordId) {
    const record = state.records.find((item) => item.id === recordId);
    if (!record) return;
    dom.formTitle.textContent = "แก้ไขข้อมูลปีศาจ";
    dom.formDescription.textContent = "ปรับชื่อหรือธาตุให้เป็นข้อมูลล่าสุด";
    dom.submitLabel.textContent = "บันทึกการแก้ไข";
    dom.demonName.value = record.name;
    const option = dom.demonForm.querySelector<HTMLInputElement>(
      `input[name="element"][value="${record.element}"]`,
    );
    if (option) option.checked = true;
  } else {
    dom.formTitle.textContent = "เพิ่มปีศาจ";
    dom.formDescription.textContent = "กรอกชื่อและเลือกธาตุประจำตัว";
    dom.submitLabel.textContent = "บันทึกข้อมูล";
  }

  dom.demonDialog.showModal();
  window.setTimeout(() => dom.demonName.focus(), 50);
}

function closeForm(): void {
  if (dom.demonDialog.open) dom.demonDialog.close();
  state.editingId = null;
}

function clearFormErrors(): void {
  dom.nameError.textContent = "";
  dom.elementError.textContent = "";
  dom.demonName.removeAttribute("aria-invalid");
}

function validateForm(): FormValues | null {
  clearFormErrors();
  const name = dom.demonName.value.trim();
  const element = new FormData(dom.demonForm).get("element");
  let valid = true;

  if (!name) {
    dom.nameError.textContent = "กรุณากรอกชื่อปีศาจ";
    dom.demonName.setAttribute("aria-invalid", "true");
    valid = false;
  } else if (name.length < 2) {
    dom.nameError.textContent = "ชื่อควรมีอย่างน้อย 2 ตัวอักษร";
    dom.demonName.setAttribute("aria-invalid", "true");
    valid = false;
  } else {
    const duplicate = state.records.some(
      (record) => record.id !== state.editingId && normalize(record.name) === normalize(name),
    );
    if (duplicate) {
      dom.nameError.textContent = "มีชื่อปีศาจนี้อยู่แล้ว กรุณาใช้ชื่ออื่น";
      dom.demonName.setAttribute("aria-invalid", "true");
      valid = false;
    }
  }

  if (!isElementKey(element)) {
    dom.elementError.textContent = "กรุณาเลือกธาตุ 1 รายการ";
    valid = false;
  }

  if (!valid) {
    if (dom.nameError.textContent) dom.demonName.focus();
    else dom.demonForm.querySelector<HTMLInputElement>("input[name='element']")?.focus();
  }

  return valid && isElementKey(element) ? { name, element } : null;
}

function setBusy(button: HTMLButtonElement, busy: boolean): void {
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    if ("code" in error && error.code === "23505") return "มีชื่อปีศาจนี้อยู่แล้ว กรุณาใช้ชื่ออื่น";
    if ("message" in error && typeof error.message === "string") return `${fallback}: ${error.message}`;
  }
  return fallback;
}

async function saveForm(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!requireWriteAccess()) return;
  const values = validateForm();
  if (!values) return;

  setBusy(dom.submitButton, true);
  const originalLabel = dom.submitLabel.textContent;
  dom.submitLabel.textContent = "กำลังบันทึก...";
  try {
    if (state.editingId) {
      const updated = await updateRecord(state.editingId, values);
      const index = state.records.findIndex((record) => record.id === updated.id);
      if (index >= 0) state.records[index] = updated;
      showToast(`แก้ไข “${values.name}” แล้ว`, "success");
    } else {
      const created = await createRecord(values);
      if (supabase) state.records.unshift(created);
      showToast(`เพิ่ม “${values.name}” แล้ว`, "success");
    }
    closeForm();
    render();
  } catch (error) {
    dom.nameError.textContent = errorMessage(error, "บันทึกข้อมูลไม่สำเร็จ");
  } finally {
    setBusy(dom.submitButton, false);
    dom.submitLabel.textContent = originalLabel;
  }
}

function openDelete(recordId: string): void {
  if (!requireWriteAccess()) return;
  const record = state.records.find((item) => item.id === recordId);
  if (!record) return;
  state.deletingId = recordId;
  dom.deleteName.textContent = `“${record.name}”`;
  dom.deleteDialog.showModal();
}

function closeDelete(): void {
  if (dom.deleteDialog.open) dom.deleteDialog.close();
  state.deletingId = null;
}

async function confirmDelete(): Promise<void> {
  if (!state.deletingId || !requireWriteAccess()) return;
  const record = state.records.find((item) => item.id === state.deletingId);
  if (!record) return closeDelete();

  setBusy(dom.confirmDeleteButton, true);
  try {
    await deleteRecord(record.id);
    if (supabase) state.records = state.records.filter((item) => item.id !== record.id);
    closeDelete();
    render();
    showToast(`ลบ “${record.name}” แล้ว`, "success");
  } catch (error) {
    showToast(errorMessage(error, "ลบข้อมูลไม่สำเร็จ"), "error");
  } finally {
    setBusy(dom.confirmDeleteButton, false);
  }
}

function openAuth(): void {
  if (!supabase || state.session) return;
  dom.authForm.reset();
  dom.authError.textContent = "";
  dom.authDialog.showModal();
  window.setTimeout(() => dom.authUsername.focus(), 50);
}

function closeAuth(): void {
  if (dom.authDialog.open) dom.authDialog.close();
  dom.authError.textContent = "";
}

function authCredentials(): { email: string; password: string } | null {
  dom.authError.textContent = "";
  const username = dom.authUsername.value.trim();
  const password = dom.authPassword.value;
  if (!username) {
    dom.authError.textContent = "กรุณากรอกชื่อผู้ใช้";
    dom.authUsername.focus();
    return null;
  }
  if (username.toLocaleLowerCase("en-US") !== adminUsername.toLocaleLowerCase("en-US")) {
    dom.authError.textContent = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
    dom.authUsername.focus();
    return null;
  }
  if (password.length < 6) {
    dom.authError.textContent = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
    dom.authPassword.focus();
    return null;
  }
  return { email: adminEmail, password };
}

async function signIn(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!supabase) return;
  const credentials = authCredentials();
  if (!credentials) return;

  setBusy(dom.signInButton, true);
  try {
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
    closeAuth();
    showToast("เข้าสู่ระบบแล้ว", "success");
  } catch {
    dom.authError.textContent = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
  } finally {
    setBusy(dom.signInButton, false);
  }
}

async function signOut(button: HTMLButtonElement): Promise<void> {
  if (!supabase) return;
  setBusy(button, true);
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    showToast("ออกจากระบบแล้ว", "success");
  } catch (error) {
    showToast(errorMessage(error, "ออกจากระบบไม่สำเร็จ"), "error");
  } finally {
    setBusy(button, false);
  }
}

function showToast(message: string, tone: "success" | "error" | "info" = "success"): void {
  const toast = document.createElement("div");
  toast.className = `toast is-${tone}`;
  toast.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.2-4-4a1 1 0 1 1 1.4-1.4l3.3 3.3 5.8-6.3a1 1 0 0 1 1.4-.1 1 1 0 0 1 .1 1.5l-6.5 7a1 1 0 0 1-1.5 0Z" /></svg>
    <span>${escapeHtml(message)}</span>`;
  dom.toastRegion.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 200);
  }, 3200);
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const actionTarget = event.target.closest<HTMLElement>("[data-action]");
  if (actionTarget) {
    const { action, id } = actionTarget.dataset;
    if (action === "add") openForm();
    if (action === "edit" && id) openForm(id);
    if (action === "delete" && id) openDelete(id);
    if (action === "clear") clearFilters();
    if (action === "close-form") closeForm();
    if (action === "cancel-delete") closeDelete();
    if (action === "confirm-delete") void confirmDelete();
    if (action === "open-auth") openAuth();
    if (action === "close-auth") closeAuth();
    if (action === "sign-out" && actionTarget instanceof HTMLButtonElement) void signOut(actionTarget);
  }

  const filterButton = event.target.closest<HTMLButtonElement>("[data-element]");
  if (filterButton) {
    const element = filterButton.dataset.element;
    if (element === "all" || isElementKey(element)) {
      state.element = element;
      updateActiveFilter();
      render();
    }
  }

  const sortButton = event.target.closest<HTMLButtonElement>("[data-sort]");
  if (sortButton) {
    const column = sortButton.dataset.sort;
    if (column === "name") {
      const currentlyAscending = state.sort === `${column}-asc`;
      state.sort = `${column}-${currentlyAscending ? "desc" : "asc"}`;
      render();
    }
  }

  const groupButton = event.target.closest<HTMLButtonElement>("[data-group-key]");
  if (groupButton?.dataset.groupKey) {
    const key = groupButton.dataset.groupKey;
    if (state.collapsedGroups.has(key)) state.collapsedGroups.delete(key);
    else state.collapsedGroups.add(key);
    render();
  }

  const alphabetButton = event.target.closest<HTMLButtonElement>("[data-alpha-key]");
  if (alphabetButton?.dataset.alphaKey) {
    const key = alphabetButton.dataset.alphaKey;
    if (state.collapsedGroups.delete(key)) render();
    window.requestAnimationFrame(() => {
      const prefix = window.matchMedia("(max-width: 680px)").matches ? "alpha-card" : "alpha-table";
      const target = document.getElementById(`${prefix}-${key}`);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  }
});

dom.searchInput.addEventListener("input", () => {
  state.query = dom.searchInput.value;
  render();
});
dom.clearFilterButton.addEventListener("click", clearFilters);
dom.sortSelect.addEventListener("change", () => {
  if (!isSortKey(dom.sortSelect.value)) return;
  state.sort = dom.sortSelect.value;
  render();
});
dom.demonForm.addEventListener("submit", (event) => void saveForm(event));
dom.authForm.addEventListener("submit", (event) => void signIn(event));

dom.demonDialog.addEventListener("click", (event) => {
  if (event.target === dom.demonDialog) closeForm();
});
dom.deleteDialog.addEventListener("click", (event) => {
  if (event.target === dom.deleteDialog) closeDelete();
});
dom.authDialog.addEventListener("click", (event) => {
  if (event.target === dom.authDialog) closeAuth();
});

async function initialize(): Promise<void> {
  if (hasPartialCloudConfig) {
    syncAuthUi();
    render();
    showToast("ตั้งค่า Supabase ไม่ครบ กรุณาตรวจไฟล์ .env", "error");
    return;
  }

  if (!supabase) {
    syncAuthUi();
    render();
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) showToast(errorMessage(error, "ตรวจสอบสถานะผู้ใช้ไม่สำเร็จ"), "error");
  state.session = data.session;
  syncAuthUi();
  render();
  await refreshCloudRecords();

  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    syncAuthUi();
    render();
  });
}

void initialize();
