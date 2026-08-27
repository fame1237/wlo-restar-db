import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

type ElementKey = "earth" | "water" | "wind" | "fire" | "unknown";
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

interface DailyRecord {
  id: string;
  demonId: string;
  activeDate: string;
  slot: number;
  isNewDemon: boolean;
  createdAt: string;
}

interface DailyDatabaseRow {
  id: string;
  demon_id: string;
  active_date: string;
  slot: number;
  is_new_demon: boolean;
  created_at: string;
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
const DAILY_STORAGE_KEY = "demondex-daily-v1";
const DAILY_LIMIT = 5;
const DAILY_SUGGESTION_DELAY = 240;
const THAI_TIME_ZONE = "Asia/Bangkok";
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
  { label: string; css: string; soft: string; line: string; icon: string }
> = {
  earth: {
    label: "ดิน",
    css: "#e6b43c",
    soft: "#211c10",
    line: "#665326",
    icon: '<path d="M2.65 18.15 8.3 8.45a1.35 1.35 0 0 1 2.34 0l2.18 3.75 1.08-1.86a1.35 1.35 0 0 1 2.34 0l5.11 7.81A1.35 1.35 0 0 1 20.18 20H3.82a1.35 1.35 0 0 1-1.17-1.85Z" />',
  },
  water: {
    label: "น้ำ",
    css: "#4299ff",
    soft: "#101d2d",
    line: "#274d76",
    icon: '<path d="M12 2.3S5.5 9.72 5.5 14.6a6.5 6.5 0 0 0 13 0C18.5 9.72 12 2.3 12 2.3Zm0 16.1a3.82 3.82 0 0 1-3.8-3.8c0-.62.24-1.47.7-2.45.18 2.25 1.42 3.75 3.73 4.5a1 1 0 0 1-.63 1.75Z" />',
  },
  wind: {
    label: "ลม",
    css: "#58bf8b",
    soft: "#10241b",
    line: "#2b6548",
    icon: '<path d="M3 8h10.2a2.8 2.8 0 1 0-2.45-4.15M3 12h17M3 16h11.2a2.8 2.8 0 1 1-2.45 4.15" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />',
  },
  fire: {
    label: "ไฟ",
    css: "#f0645b",
    soft: "#291313",
    line: "#743431",
    icon: '<path d="M13.35 2.2c.56 3.18-.28 4.9-1.75 6.12.08-1.56-.66-2.84-1.84-3.74.06 3-4.26 5.35-4.26 10.2A6.5 6.5 0 0 0 12 21.3a6.5 6.5 0 0 0 6.5-6.52c0-4.23-2.36-9.67-5.15-12.58Zm-1.36 16.6a3.62 3.62 0 0 1-3.61-3.63c0-1.54.8-2.68 1.65-3.78.45.7.92 1.5 1.24 2.5 1.9-1 2.83-2.43 3.08-3.95a12.2 12.2 0 0 1 1.25 5.23 3.62 3.62 0 0 1-3.61 3.63Z" />',
  },
  unknown: {
    label: "ยังไม่รู้",
    css: "#aeb4c2",
    soft: "#1a1d24",
    line: "#4a505e",
    icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" /><path d="M9.65 9.1a2.55 2.55 0 0 1 4.9.98c0 1.92-2.55 2.05-2.55 3.7M12 17.35h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />',
  },
};

function elementIconSvg(element: ElementKey): string {
  return `<svg class="element-icon" viewBox="0 0 24 24" aria-hidden="true">${ELEMENTS[element].icon}</svg>`;
}

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
  ["สารละลายโลหะหนัก", "fire"],
  ["เสาอากาศสื่อสาร", "wind"],
  ["เศษทองแดง", "fire"],
  ["จอภาพเก่า", "wind"],
  ["กรดอะซิติก", "water"],
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
  activeAlphabetKey: string | null;
  dailyRecords: DailyRecord[];
  dailyDate: string;
  dailyLoading: boolean;
  dailyError: string;
  dailyEditingSlot: number | null;
  dailyName: string;
  dailyElement: ElementKey | "";
  dailySelectedDemonId: string | null;
} = {
  records: supabase ? [] : loadLocalRecords(),
  query: "",
  element: "all",
  sort: "name-asc",
  editingId: null,
  deletingId: null,
  session: null,
  collapsedGroups: new Set<string>(),
  activeAlphabetKey: null,
  dailyRecords: [],
  dailyDate: bangkokDateKey(),
  dailyLoading: true,
  dailyError: "",
  dailyEditingSlot: null,
  dailyName: "",
  dailyElement: "",
  dailySelectedDemonId: null,
};
let dailySuggestionTimer: number | null = null;
const thaiCollator = new Intl.Collator("th-TH", { sensitivity: "base", numeric: true });

function queryRequired<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`ไม่พบ element ที่จำเป็น: ${selector}`);
  return node;
}

const dom = {
  dailyPanel: queryRequired<HTMLElement>("#daily-panel"),
  dailyDate: queryRequired<HTMLElement>("#daily-date"),
  dailyProgress: queryRequired<HTMLElement>("#daily-progress"),
  dailyTiming: queryRequired<HTMLElement>("#daily-timing"),
  dailyCurrentTime: queryRequired<HTMLTimeElement>("#daily-current-time"),
  dailyCountdown: queryRequired<HTMLTimeElement>("#daily-countdown"),
  dailyContent: queryRequired<HTMLElement>("#daily-content"),
  searchInput: queryRequired<HTMLInputElement>("#search-input"),
  tableBody: queryRequired<HTMLTableSectionElement>("#demon-table-body"),
  cardList: queryRequired<HTMLElement>("#demon-card-list"),
  emptyState: queryRequired<HTMLElement>("#empty-state"),
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
  adminActionHeader: queryRequired<HTMLTableCellElement>("[data-admin-only]"),
  tableWrap: queryRequired<HTMLElement>(".table-wrap"),
};

function isElementKey(value: unknown): value is ElementKey {
  return typeof value === "string" && value in ELEMENTS;
}

function isSortKey(value: string): value is SortKey {
  return ["name-asc", "name-desc", "updated-desc"].includes(value);
}

function bangkokDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: THAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function bangkokDateLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: THAI_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function bangkokClockParts(date = new Date()): {
  hour: number;
  minute: number;
  second: number;
  display: string;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: THAI_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.hour ?? 0);
  const minute = Number(values.minute ?? 0);
  const second = Number(values.second ?? 0);
  return {
    hour,
    minute,
    second,
    display: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
  };
}

function updateDailyClock(date = new Date()): void {
  const clock = bangkokClockParts(date);
  const elapsedSeconds = clock.hour * 3_600 + clock.minute * 60 + clock.second;
  const remainingSeconds = 86_400 - elapsedSeconds;
  const hours = Math.floor(remainingSeconds / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  const seconds = remainingSeconds % 60;
  const countdown = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  dom.dailyCurrentTime.textContent = clock.display;
  dom.dailyCurrentTime.dateTime = clock.display;
  dom.dailyCountdown.textContent = countdown;
  dom.dailyCountdown.dateTime = `PT${hours}H${minutes}M${seconds}S`;
  dom.dailyTiming.setAttribute(
    "aria-label",
    `เวลาปัจจุบัน ${clock.hour} นาฬิกา ${clock.minute} นาที ${clock.second} วินาที รีเซ็ตใน ${hours} ชั่วโมง ${minutes} นาที ${seconds} วินาที`,
  );
}

function normalizeDemonName(value: string): string {
  return value
    .trim()
    .replace(/^ปีศาจ\s*/u, "")
    .trim()
    .replace(/\s+/gu, " ");
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
    return valid.length === stored.length
      ? valid.map((record) => ({ ...record, name: normalizeDemonName(record.name) }))
      : [...SAMPLE_RECORDS];
  } catch {
    return [...SAMPLE_RECORDS];
  }
}

function saveLocalRecords(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function loadAllLocalDailyRecords(): DailyRecord[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter(
      (item): item is DailyRecord =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string" &&
        "demonId" in item &&
        typeof item.demonId === "string" &&
        "activeDate" in item &&
        typeof item.activeDate === "string" &&
        "slot" in item &&
        typeof item.slot === "number" &&
        item.slot >= 1 &&
        item.slot <= DAILY_LIMIT &&
        "isNewDemon" in item &&
        typeof item.isNewDemon === "boolean" &&
        "createdAt" in item &&
        typeof item.createdAt === "string",
    );
  } catch {
    return [];
  }
}

function saveLocalDailyRecords(): void {
  const otherDates = loadAllLocalDailyRecords().filter(
    (record) => record.activeDate !== state.dailyDate,
  );
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify([...otherDates, ...state.dailyRecords]));
}

function fromDatabaseRow(row: DatabaseRow): DemonRecord {
  return {
    id: row.id,
    name: normalizeDemonName(row.name),
    element: row.element,
    updatedAt: row.updated_at,
  };
}

function fromDailyDatabaseRow(row: DailyDatabaseRow): DailyRecord {
  return {
    id: row.id,
    demonId: row.demon_id,
    activeDate: row.active_date,
    slot: row.slot,
    isNewDemon: row.is_new_demon,
    createdAt: row.created_at,
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

async function fetchDailyRecords(): Promise<DailyRecord[]> {
  if (!supabase) {
    return loadAllLocalDailyRecords()
      .filter((record) => record.activeDate === state.dailyDate)
      .sort((a, b) => a.slot - b.slot);
  }

  const { data, error } = await supabase
    .from("daily_demons")
    .select("id,demon_id,active_date,slot,is_new_demon,created_at")
    .eq("active_date", state.dailyDate)
    .order("slot", { ascending: true });
  if (error) throw error;
  return (data as DailyDatabaseRow[]).map(fromDailyDatabaseRow);
}

async function saveDailyRecord(
  slot: number,
  demonId: string,
  isNewDemon: boolean,
): Promise<DailyRecord> {
  if (!supabase) {
    const existing = state.dailyRecords.find((record) => record.slot === slot);
    const saved: DailyRecord = {
      id:
        existing?.id ??
        (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `daily-${Date.now()}`),
      demonId,
      activeDate: state.dailyDate,
      slot,
      isNewDemon,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    state.dailyRecords = [
      ...state.dailyRecords.filter((record) => record.slot !== slot),
      saved,
    ].sort((a, b) => a.slot - b.slot);
    saveLocalDailyRecords();
    return saved;
  }

  const { data, error } = await supabase
    .from("daily_demons")
    .upsert(
      { active_date: state.dailyDate, slot, demon_id: demonId, is_new_demon: isNewDemon },
      { onConflict: "active_date,slot" },
    )
    .select("id,demon_id,active_date,slot,is_new_demon,created_at")
    .single();
  if (error) throw error;
  return fromDailyDatabaseRow(data as DailyDatabaseRow);
}

async function deleteDailyRecord(id: string): Promise<void> {
  if (!supabase) {
    state.dailyRecords = state.dailyRecords.filter((record) => record.id !== id);
    saveLocalDailyRecords();
    return;
  }
  const { error } = await supabase.from("daily_demons").delete().eq("id", id);
  if (error) throw error;
}

async function createRecord(values: FormValues): Promise<DemonRecord> {
  const normalizedValues = { ...values, name: normalizeDemonName(values.name) };
  if (!supabase) {
    const record: DemonRecord = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `demon-${Date.now()}`,
      ...normalizedValues,
      updatedAt: new Date().toISOString(),
    };
    state.records.unshift(record);
    saveLocalRecords();
    return record;
  }

  const { data, error } = await supabase
    .from("demons")
    .insert({ name: normalizedValues.name, element: normalizedValues.element })
    .select("id,name,element,updated_at")
    .single();
  if (error) throw error;
  return fromDatabaseRow(data as DatabaseRow);
}

async function updateRecord(id: string, values: FormValues): Promise<DemonRecord> {
  const normalizedValues = { ...values, name: normalizeDemonName(values.name) };
  if (!supabase) {
    const index = state.records.findIndex((record) => record.id === id);
    const current = state.records[index];
    if (index < 0 || !current) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
    const updated: DemonRecord = { ...current, ...normalizedValues, updatedAt: new Date().toISOString() };
    state.records[index] = updated;
    saveLocalRecords();
    return updated;
  }

  const { data, error } = await supabase
    .from("demons")
    .update({ name: normalizedValues.name, element: normalizedValues.element })
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
  return normalizeDemonName(value).toLocaleLowerCase("th-TH");
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

function findDemonByName(name: string): DemonRecord | undefined {
  const normalizedName = normalize(name);
  if (!normalizedName) return undefined;
  return state.records.find((record) => normalize(record.name) === normalizedName);
}

function getDailyDemon(record: DailyRecord): DemonRecord | undefined {
  return state.records.find((demon) => demon.id === record.demonId);
}

function dailyDuplicateForSlot(demonId: string, slot: number): boolean {
  return state.dailyRecords.some(
    (record) => record.demonId === demonId && record.slot !== slot,
  );
}

function resetDailyFormState(): void {
  state.dailyEditingSlot = null;
  state.dailyName = "";
  state.dailyElement = "";
  state.dailySelectedDemonId = null;
  if (dailySuggestionTimer !== null) window.clearTimeout(dailySuggestionTimer);
  dailySuggestionTimer = null;
}

function dailySavedRow(slot: number, dailyRecord: DailyRecord, demon: DemonRecord): string {
  const element = ELEMENTS[demon.element];
  const editAction = dailyRecord.isNewDemon
    ? `<button class="action-button" type="button" data-action="edit-daily" data-slot="${slot}" aria-label="เปลี่ยน ${escapeHtml(demon.name)}" title="เปลี่ยน">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16.86 3.49 3.65 3.65a1.7 1.7 0 0 1 0 2.4L9.55 20.5 3 21l.5-6.55L14.46 3.49a1.7 1.7 0 0 1 2.4 0ZM5.4 15.34l-.27 3.53 3.53-.27 8.72-8.72-3.26-3.26-8.72 8.72Zm10.13-10.13 3.26 3.26.3-.3-3.26-3.26-.3.3Z" /></svg>
        </button>`
    : "";
  const actions = canWrite()
    ? `<div class="daily-row-actions">
        ${editAction}
        <button class="action-button is-delete" type="button" data-action="delete-daily" data-id="${escapeHtml(dailyRecord.id)}" aria-label="นำ ${escapeHtml(demon.name)} ออกจากวันนี้" title="นำออกจากวันนี้">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3a2 2 0 0 0-2 2v1H4a1 1 0 1 0 0 2h1l.8 11.1A2 2 0 0 0 7.8 21h8.4a2 2 0 0 0 2-1.9L19 8h1a1 1 0 1 0 0-2h-3V5a2 2 0 0 0-2-2H9Zm6 3H9V5h6v1Zm-7.2 2h8.4l-.8 11H8.6l-.8-11Z" /></svg>
        </button>
      </div>`
    : "";
  return `<div class="daily-row" data-daily-slot="${slot}" style="${recordStyle(demon)}">
      <span class="daily-row-number" aria-hidden="true">${slot}</span>
      <span class="daily-saved-main">
        <span class="daily-saved-name">${escapeHtml(demon.name)}</span>
        <span class="element-badge">${elementIconSvg(demon.element)}${element.label}</span>
      </span>
      ${actions}
    </div>`;
}

function dailyEmptyRow(slot: number): string {
  if (canWrite()) {
    return `<div class="daily-row is-empty is-selectable" data-daily-slot="${slot}">
        <span class="daily-row-number" aria-hidden="true">${slot}</span>
        <button class="daily-empty-action" type="button" data-action="choose-daily-slot" data-slot="${slot}" aria-label="เพิ่มปีศาจในช่องที่ ${slot}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5a1 1 0 1 0-2 0v6H5a1 1 0 1 0 0 2h6v6a1 1 0 1 0 2 0v-6h6a1 1 0 1 0 0-2h-6V5Z" /></svg>
          <span>เพิ่มปีศาจในช่องนี้</span>
        </button>
      </div>`;
  }
  return `<div class="daily-row is-empty" data-daily-slot="${slot}">
      <span class="daily-row-number" aria-hidden="true">${slot}</span>
      <span class="daily-empty-copy">รอผู้ดูแลเพิ่มรายชื่อ</span>
    </div>`;
}

function dailyFormStatus(slot: number): { html: string; tone: "normal" | "error" } {
  const normalizedName = normalizeDemonName(state.dailyName);
  if (!normalizedName) return { html: "พิมพ์ชื่อบางส่วนเพื่อค้นหา หรือกรอกชื่อใหม่", tone: "normal" };
  if (normalizedName.length < 2) return { html: "ชื่อควรมีอย่างน้อย 2 ตัวอักษร", tone: "error" };

  const existing = findDemonByName(normalizedName);
  if (existing && dailyDuplicateForSlot(existing.id, slot)) {
    return { html: "ปีศาจตัวนี้อยู่ในรายการวันนี้แล้ว", tone: "error" };
  }
  if (state.dailySelectedDemonId && existing) {
    return {
      html: `มีอยู่ในระบบแล้ว · ใช้ธาตุ${ELEMENTS[existing.element].label}อัตโนมัติ`,
      tone: "normal",
    };
  }
  if (existing) return { html: "พบชื่อในระบบ เลือกจากคำแนะนำเพื่อใช้ธาตุเดิม", tone: "normal" };
  return {
    html: `จะบันทึกเป็น: <strong>${escapeHtml(normalizedName)}</strong> · ไม่พบในระบบ จะเพิ่มเป็นปีศาจใหม่`,
    tone: "normal",
  };
}

function dailyFormIsValid(slot: number): boolean {
  const normalizedName = normalizeDemonName(state.dailyName);
  if (normalizedName.length < 2) return false;
  const existing = findDemonByName(normalizedName);
  if (existing) return !dailyDuplicateForSlot(existing.id, slot);
  return isElementKey(state.dailyElement);
}

function dailyFormRow(slot: number): string {
  const selected = state.dailySelectedDemonId
    ? state.records.find((record) => record.id === state.dailySelectedDemonId)
    : undefined;
  const selectedElement = selected?.element ?? state.dailyElement;
  const status = dailyFormStatus(slot);
  const elementOptions = (Object.keys(ELEMENTS) as ElementKey[])
    .map(
      (key) =>
        `<option value="${key}"${selectedElement === key ? " selected" : ""}>${ELEMENTS[key].label}</option>`,
    )
    .join("");
  const selectedStyle = selected ? recordStyle(selected) : "";
  const editingExisting = state.dailyRecords.some((record) => record.slot === slot);
  const actionLabel = editingExisting ? "บันทึกการเปลี่ยน" : "เพิ่มในวันนี้";

  return `<form class="daily-row is-form" data-daily-form data-slot="${slot}" novalidate>
      <span class="daily-row-number" aria-hidden="true">${slot}</span>
      <div class="daily-field daily-field-name">
        <label for="daily-name">ชื่อปีศาจ</label>
        <input id="daily-name" name="daily-name" type="text" maxlength="80" autocomplete="off" aria-autocomplete="list" aria-controls="daily-suggestions" value="${escapeHtml(state.dailyName)}" placeholder="พิมพ์ชื่อปีศาจ" />
        <div id="daily-suggestions" class="daily-suggestion-menu" role="listbox" hidden></div>
        <div id="daily-name-note" class="daily-field-note${status.tone === "error" ? " is-error" : ""}">${status.html}</div>
      </div>
      <div class="daily-field daily-field-element" style="${selectedStyle}">
        <label for="daily-element">ธาตุ</label>
        <select id="daily-element" name="daily-element"${selected ? ' class="is-locked" disabled aria-label="ธาตุจากรายชื่อเดิม"' : ""}>
          <option value="">เลือกธาตุ</option>
          ${elementOptions}
        </select>
        <div id="daily-element-note" class="daily-field-note">${selected ? `ใช้ธาตุ${ELEMENTS[selected.element].label}จากข้อมูลเดิม` : "ชื่อใหม่ต้องเลือกธาตุก่อนบันทึก"}</div>
      </div>
      <button class="button button-primary daily-submit" type="submit"${dailyFormIsValid(slot) ? "" : " disabled"}>${actionLabel}</button>
      <div class="daily-form-help">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm1 10.5a1 1 0 1 1-2 0v-5a1 1 0 1 1 2 0v5Z" /></svg>
        <span>ชื่อใหม่จะถูกเพิ่มในรายชื่อหลักอัตโนมัติ</span>
        <button class="text-button daily-form-cancel" type="button" data-action="cancel-daily-slot">ยกเลิก</button>
      </div>
    </form>`;
}

function renderDaily(): void {
  dom.dailyDate.textContent = bangkokDateLabel();
  dom.dailyProgress.textContent = `${state.dailyRecords.length.toLocaleString("th-TH")} จาก ${DAILY_LIMIT.toLocaleString("th-TH")}`;
  updateDailyClock();
  dom.dailyContent.setAttribute("aria-busy", String(state.dailyLoading));

  if (state.dailyLoading) {
    dom.dailyContent.innerHTML = '<div class="daily-loading">กำลังโหลดรายชื่อประจำวัน...</div>';
    return;
  }
  if (state.dailyError) {
    dom.dailyContent.innerHTML = `<div class="daily-load-error"><span>${escapeHtml(state.dailyError)}</span><button class="text-button" type="button" data-action="retry-daily">ลองอีกครั้ง</button></div>`;
    return;
  }

  const formSlot = canWrite() ? state.dailyEditingSlot : null;
  const rows: string[] = [];
  for (let slot = 1; slot <= DAILY_LIMIT; slot += 1) {
    const dailyRecord = state.dailyRecords.find((record) => record.slot === slot);
    const demon = dailyRecord ? getDailyDemon(dailyRecord) : undefined;
    if (formSlot === slot) rows.push(dailyFormRow(slot));
    else if (dailyRecord && demon) rows.push(dailySavedRow(slot, dailyRecord, demon));
    else rows.push(dailyEmptyRow(slot));
  }
  dom.dailyContent.innerHTML = rows.join("");
  bindDailyForm();
}

function updateDailyFormControls(form: HTMLFormElement): void {
  const slot = Number(form.dataset.slot);
  const input = form.querySelector<HTMLInputElement>("#daily-name");
  const select = form.querySelector<HTMLSelectElement>("#daily-element");
  const nameNote = form.querySelector<HTMLElement>("#daily-name-note");
  const elementNote = form.querySelector<HTMLElement>("#daily-element-note");
  const submit = form.querySelector<HTMLButtonElement>(".daily-submit");
  const elementField = form.querySelector<HTMLElement>(".daily-field-element");
  if (!input || !select || !nameNote || !elementNote || !submit || !elementField) return;

  const selected = state.dailySelectedDemonId
    ? state.records.find((record) => record.id === state.dailySelectedDemonId)
    : undefined;
  const status = dailyFormStatus(slot);
  nameNote.innerHTML = status.html;
  nameNote.classList.toggle("is-error", status.tone === "error");
  input.toggleAttribute("aria-invalid", status.tone === "error");

  if (selected) {
    state.dailyElement = selected.element;
    select.value = selected.element;
    select.disabled = true;
    select.classList.add("is-locked");
    select.setAttribute("aria-label", "ธาตุจากรายชื่อเดิม");
    elementField.setAttribute("style", recordStyle(selected));
    elementNote.textContent = `ใช้ธาตุ${ELEMENTS[selected.element].label}จากข้อมูลเดิม`;
  } else {
    select.disabled = false;
    select.classList.remove("is-locked");
    select.removeAttribute("aria-label");
    elementField.removeAttribute("style");
    select.value = state.dailyElement;
    elementNote.textContent = "ชื่อใหม่ต้องเลือกธาตุก่อนบันทึก";
  }
  submit.disabled = !dailyFormIsValid(slot);
}

function updateDailySuggestions(form: HTMLFormElement): void {
  const input = form.querySelector<HTMLInputElement>("#daily-name");
  const menu = form.querySelector<HTMLElement>("#daily-suggestions");
  if (!input || !menu || !form.isConnected) return;
  const query = normalize(input.value);
  if (!query || document.activeElement !== input) {
    menu.hidden = true;
    menu.innerHTML = "";
    return;
  }

  const slot = Number(form.dataset.slot);
  const matches = state.records
    .filter((record) => normalize(record.name).includes(query))
    .sort((a, b) => {
      const aStarts = normalize(a.name).startsWith(query) ? 0 : 1;
      const bStarts = normalize(b.name).startsWith(query) ? 0 : 1;
      return aStarts - bStarts || thaiCollator.compare(a.name, b.name);
    })
    .slice(0, 5);

  if (matches.length === 0) {
    menu.hidden = true;
    menu.innerHTML = "";
    return;
  }

  menu.innerHTML = matches
    .map((record) => {
      const element = ELEMENTS[record.element];
      const duplicate = dailyDuplicateForSlot(record.id, slot);
      return `<button class="daily-suggestion" type="button" role="option" data-daily-suggestion-id="${escapeHtml(record.id)}" style="${recordStyle(record)}"${duplicate ? " disabled" : ""}>
          <span class="daily-suggestion-copy">
            <strong>${escapeHtml(normalizeDemonName(record.name))}</strong>
            <small>${duplicate ? "อยู่ในรายการวันนี้แล้ว" : "มีอยู่ในระบบแล้ว"}</small>
          </span>
          <span class="element-badge">${elementIconSvg(record.element)}${element.label}</span>
        </button>`;
    })
    .join("");
  menu.hidden = false;
  menu.querySelectorAll<HTMLButtonElement>("[data-daily-suggestion-id]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      const record = state.records.find((item) => item.id === button.dataset.dailySuggestionId);
      if (!record) return;
      void saveSuggestedDailyDemon(record, slot, button);
    });
  });
}

async function saveSuggestedDailyDemon(
  demon: DemonRecord,
  slot: number,
  button: HTMLButtonElement,
): Promise<void> {
  if (!requireWriteAccess()) return;
  if (dailyDuplicateForSlot(demon.id, slot)) {
    showToast(`“${demon.name}” อยู่ในรายการวันนี้แล้ว`, "info");
    return;
  }

  setBusy(button, true);
  try {
    const saved = await saveDailyRecord(slot, demon.id, false);
    state.dailyRecords = [
      ...state.dailyRecords.filter((record) => record.slot !== slot),
      saved,
    ].sort((a, b) => a.slot - b.slot);
    resetDailyFormState();
    renderDaily();
    showToast(`เพิ่ม “${demon.name}” ในรายชื่อวันนี้แล้ว`, "success");
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>("#daily-name")?.focus();
    });
  } catch (error) {
    const duplicate =
      typeof error === "object" && error !== null && "code" in error && error.code === "23505";
    showToast(
      duplicate
        ? `“${demon.name}” อยู่ในรายการวันนี้แล้ว`
        : errorMessage(error, "บันทึกรายชื่อประจำวันไม่สำเร็จ"),
      duplicate ? "info" : "error",
    );
  } finally {
    if (button.isConnected) setBusy(button, false);
  }
}

function bindDailyForm(): void {
  const form = dom.dailyContent.querySelector<HTMLFormElement>("[data-daily-form]");
  if (!form) return;
  const input = form.querySelector<HTMLInputElement>("#daily-name");
  const select = form.querySelector<HTMLSelectElement>("#daily-element");
  const menu = form.querySelector<HTMLElement>("#daily-suggestions");
  if (!input || !select || !menu) return;

  input.addEventListener("input", () => {
    state.dailyName = input.value;
    const selected = state.dailySelectedDemonId
      ? state.records.find((record) => record.id === state.dailySelectedDemonId)
      : undefined;
    if (selected && normalize(input.value) !== normalize(selected.name)) {
      state.dailySelectedDemonId = null;
      state.dailyElement = "";
    }
    updateDailyFormControls(form);
    if (dailySuggestionTimer !== null) window.clearTimeout(dailySuggestionTimer);
    dailySuggestionTimer = window.setTimeout(
      () => updateDailySuggestions(form),
      DAILY_SUGGESTION_DELAY,
    );
  });
  input.addEventListener("focus", () => {
    if (dailySuggestionTimer !== null) window.clearTimeout(dailySuggestionTimer);
    dailySuggestionTimer = window.setTimeout(() => updateDailySuggestions(form), 40);
  });
  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (menu.isConnected) menu.hidden = true;
    }, 120);
  });
  select.addEventListener("change", () => {
    state.dailyElement = isElementKey(select.value) ? select.value : "";
    select.removeAttribute("aria-invalid");
    updateDailyFormControls(form);
  });
  form.addEventListener("submit", (event) => void submitDailyForm(event));
}

function startDailyEdit(slot: number): void {
  if (!requireWriteAccess()) return;
  const dailyRecord = state.dailyRecords.find((record) => record.slot === slot);
  const demon = dailyRecord ? getDailyDemon(dailyRecord) : undefined;
  if (!dailyRecord || !demon) return;
  if (!dailyRecord.isNewDemon) {
    showToast("รายการที่เลือกจากคำแนะนำลบได้อย่างเดียว", "info");
    return;
  }
  state.dailyEditingSlot = slot;
  state.dailyName = normalizeDemonName(demon.name);
  state.dailyElement = demon.element;
  state.dailySelectedDemonId = demon.id;
  renderDaily();
  window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>("#daily-name")?.focus());
}

function startDailySlot(slot: number): void {
  if (!requireWriteAccess()) return;
  if (!Number.isInteger(slot) || slot < 1 || slot > DAILY_LIMIT) return;
  if (state.dailyRecords.some((record) => record.slot === slot)) return;
  resetDailyFormState();
  state.dailyEditingSlot = slot;
  renderDaily();
  window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>("#daily-name")?.focus());
}

function cancelDailySlot(): void {
  const slot = state.dailyEditingSlot;
  resetDailyFormState();
  renderDaily();
  if (!slot) return;
  window.requestAnimationFrame(() => {
    document
      .querySelector<HTMLButtonElement>(`[data-action="choose-daily-slot"][data-slot="${slot}"]`)
      ?.focus();
  });
}

async function submitDailyForm(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!requireWriteAccess()) return;
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const slot = Number(form.dataset.slot);
  const input = form.querySelector<HTMLInputElement>("#daily-name");
  const select = form.querySelector<HTMLSelectElement>("#daily-element");
  const nameNote = form.querySelector<HTMLElement>("#daily-name-note");
  const elementNote = form.querySelector<HTMLElement>("#daily-element-note");
  const submit = form.querySelector<HTMLButtonElement>(".daily-submit");
  if (!input || !select || !nameNote || !elementNote || !submit) return;

  const normalizedName = normalizeDemonName(input.value);
  const previousDailyRecord = state.dailyRecords.find((record) => record.slot === slot);
  let createdNewDemon = false;
  state.dailyName = input.value;
  if (normalizedName.length < 2) {
    input.setAttribute("aria-invalid", "true");
    nameNote.textContent = "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร";
    nameNote.classList.add("is-error");
    input.focus();
    return;
  }

  let demon = findDemonByName(normalizedName);
  if (demon && dailyDuplicateForSlot(demon.id, slot)) {
    input.setAttribute("aria-invalid", "true");
    nameNote.textContent = "ปีศาจตัวนี้อยู่ในรายการวันนี้แล้ว";
    nameNote.classList.add("is-error");
    input.focus();
    return;
  }
  if (!demon && !isElementKey(state.dailyElement)) {
    select.setAttribute("aria-invalid", "true");
    elementNote.textContent = "กรุณาเลือกธาตุสำหรับปีศาจใหม่";
    elementNote.classList.add("is-error");
    select.focus();
    return;
  }

  setBusy(submit, true);
  const originalLabel = submit.textContent;
  submit.textContent = "กำลังบันทึก...";
  try {
    if (!demon && isElementKey(state.dailyElement)) {
      try {
        demon = await createRecord({ name: normalizedName, element: state.dailyElement });
        createdNewDemon = true;
        if (supabase) state.records.unshift(demon);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505" &&
          supabase
        ) {
          state.records = await fetchCloudRecords();
          demon = findDemonByName(normalizedName);
        } else {
          throw error;
        }
      }
    }
    if (!demon) throw new Error("ไม่พบปีศาจที่ต้องการบันทึก");
    if (dailyDuplicateForSlot(demon.id, slot)) {
      showToast(`“${demon.name}” อยู่ในรายการวันนี้แล้ว`, "info");
      return;
    }

    const isNewDemon =
      createdNewDemon ||
      Boolean(previousDailyRecord?.isNewDemon && previousDailyRecord.demonId === demon.id);
    const saved = await saveDailyRecord(slot, demon.id, isNewDemon);
    state.dailyRecords = [
      ...state.dailyRecords.filter((record) => record.slot !== slot),
      saved,
    ].sort((a, b) => a.slot - b.slot);
    resetDailyFormState();
    render();
    showToast(`เพิ่ม “${demon.name}” ในรายชื่อวันนี้แล้ว`, "success");
  } catch (error) {
    const duplicate =
      typeof error === "object" && error !== null && "code" in error && error.code === "23505";
    nameNote.textContent = duplicate
      ? "ปีศาจตัวนี้อยู่ในรายการวันนี้แล้ว"
      : errorMessage(error, "บันทึกรายชื่อประจำวันไม่สำเร็จ");
    nameNote.classList.add("is-error");
  } finally {
    setBusy(submit, false);
    submit.textContent = originalLabel;
  }
}

async function removeDailyEntry(id: string): Promise<void> {
  if (!requireWriteAccess()) return;
  const dailyRecord = state.dailyRecords.find((record) => record.id === id);
  const demon = dailyRecord ? getDailyDemon(dailyRecord) : undefined;
  if (!dailyRecord || !demon) return;
  if (!window.confirm(`นำ “${demon.name}” ออกจากรายชื่อวันนี้หรือไม่?`)) return;

  try {
    await deleteDailyRecord(id);
    state.dailyRecords = state.dailyRecords.filter((record) => record.id !== id);
    if (state.dailyEditingSlot === dailyRecord.slot) resetDailyFormState();
    renderDaily();
    showToast(`นำ “${demon.name}” ออกจากวันนี้แล้ว`, "success");
  } catch (error) {
    showToast(errorMessage(error, "นำรายชื่อออกไม่สำเร็จ"), "error");
  }
}

async function refreshDailyRecords(): Promise<void> {
  state.dailyLoading = true;
  state.dailyError = "";
  renderDaily();
  try {
    state.dailyRecords = await fetchDailyRecords();
  } catch (error) {
    const missingTable =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "42P01" || error.code === "PGRST205");
    state.dailyError = missingTable
      ? "ยังไม่ได้เปิดใช้รายชื่อประจำวัน กรุณารันไฟล์ supabase/daily-demons.sql"
      : errorMessage(error, "โหลดรายชื่อประจำวันไม่สำเร็จ");
  } finally {
    state.dailyLoading = false;
    renderDaily();
  }
}

function checkDailyDate(): void {
  const now = new Date();
  const currentDate = bangkokDateKey(now);
  updateDailyClock(now);
  if (currentDate !== state.dailyDate) {
    state.dailyDate = currentDate;
    state.dailyRecords = [];
    resetDailyFormState();
    renderDaily();
    void refreshDailyRecords();
  }
}

function canWrite(): boolean {
  return !supabase || Boolean(state.session);
}

function actionButtons(record: DemonRecord): string {
  if (!canWrite()) return "";
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

function tableRow(
  record: DemonRecord,
  groupKey?: string,
  collapsed = false,
): string {
  const element = ELEMENTS[record.element];
  const actionCell = canWrite() ? `<td>${actionButtons(record)}</td>` : "";
  return `
    <tr class="directory-item" style="${recordStyle(record)}"${groupKey ? ` data-group-member="${groupKey}"` : ""}${collapsed ? " hidden" : ""}>
      <td>
        <div class="demon-name-cluster">
          <div class="demon-name"><span>${highlightMatch(record.name)}</span></div>
          <span class="element-badge">${elementIconSvg(record.element)}${element.label}</span>
        </div>
      </td>
      ${actionCell}
    </tr>`;
}

function mobileCard(record: DemonRecord, groupKey?: string, collapsed = false): string {
  const element = ELEMENTS[record.element];
  return `
    <article class="demon-card" style="${recordStyle(record)}"${groupKey ? ` data-group-member="${groupKey}"` : ""}${collapsed ? " hidden" : ""}>
      <div class="demon-card-main">
        <div class="demon-name"><span>${highlightMatch(record.name)}</span></div>
        <div class="demon-card-meta"><span class="element-badge">${elementIconSvg(record.element)}${element.label}</span></div>
      </div>
      ${actionButtons(record)}
    </article>`;
}

function tableGroup(group: RecordGroup): string {
  const collapsed = state.collapsedGroups.has(group.key);
  return `
    <tr class="alphabet-row" id="alpha-table-${group.key}">
      <th colspan="${canWrite() ? "2" : "1"}" scope="rowgroup">
        <button class="group-toggle${collapsed ? " is-collapsed" : ""}" type="button" data-group-key="${group.key}" aria-expanded="${String(!collapsed)}" aria-label="${collapsed ? "ขยาย" : "ยุบ"}กลุ่มตัวอักษร ${escapeHtml(group.letter)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7.4 9.4 4.6 4.6 4.6-4.6a1 1 0 1 1 1.4 1.4l-5.3 5.3a1 1 0 0 1-1.4 0L6 10.8a1 1 0 0 1 1.4-1.4Z" /></svg>
          <span class="group-prefix" aria-hidden="true">กลุ่ม</span>
          <span class="group-letter">${escapeHtml(group.letter)}</span>
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
        <span class="group-prefix" aria-hidden="true">กลุ่ม</span>
        <span class="group-letter">${escapeHtml(group.letter)}</span>
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
            `<button class="${state.activeAlphabetKey === group.key ? "is-active" : ""}" type="button" data-alpha-key="${group.key}" aria-label="ไปยังรายชื่อขึ้นต้นด้วย ${escapeHtml(group.letter)}"${state.activeAlphabetKey === group.key ? ' aria-current="true"' : ""}>${escapeHtml(group.letter)}</button>`,
        )
        .join("")
    : "";
}

function countByElement(element: ElementKey): number {
  return state.records.filter((record) => record.element === element).length;
}

function renderCounts(): void {
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
  renderCounts();
  renderSummary(visibleRecords);
  renderAlphabetNav(groups, visibleRecords);
  updateSortHeaders();
  renderDaily();
}

function syncAuthUi(): void {
  const writer = canWrite();
  dom.primaryAddButton.hidden = !writer;
  dom.adminActionHeader.hidden = !writer;

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
  state.activeAlphabetKey = null;
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
  const name = normalizeDemonName(dom.demonName.value);
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
    if (action === "retry-daily") void refreshDailyRecords();
    if (action === "choose-daily-slot" && actionTarget.dataset.slot) {
      startDailySlot(Number(actionTarget.dataset.slot));
    }
    if (action === "cancel-daily-slot") cancelDailySlot();
    if (action === "edit-daily" && actionTarget.dataset.slot) {
      startDailyEdit(Number(actionTarget.dataset.slot));
    }
    if (action === "delete-daily" && id) void removeDailyEntry(id);
  }

  const filterButton = event.target.closest<HTMLButtonElement>("[data-element]");
  if (filterButton) {
    const element = filterButton.dataset.element;
    if (element === "all" || isElementKey(element)) {
      state.element = element;
      state.activeAlphabetKey = null;
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
      state.activeAlphabetKey = null;
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
    state.activeAlphabetKey = key;
    state.collapsedGroups.delete(key);
    render();
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
  state.activeAlphabetKey = null;
  render();
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("en-US") === "k") {
    event.preventDefault();
    dom.searchInput.focus();
    dom.searchInput.select();
  }
});
dom.clearFilterButton.addEventListener("click", clearFilters);
dom.sortSelect.addEventListener("change", () => {
  if (!isSortKey(dom.sortSelect.value)) return;
  state.sort = dom.sortSelect.value;
  state.activeAlphabetKey = null;
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
    state.dailyLoading = false;
    state.dailyError = "ตั้งค่า Supabase ไม่ครบ กรุณาตรวจไฟล์ .env";
    syncAuthUi();
    render();
    showToast("ตั้งค่า Supabase ไม่ครบ กรุณาตรวจไฟล์ .env", "error");
    return;
  }

  if (!supabase) {
    syncAuthUi();
    render();
    await refreshDailyRecords();
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) showToast(errorMessage(error, "ตรวจสอบสถานะผู้ใช้ไม่สำเร็จ"), "error");
  state.session = data.session;
  syncAuthUi();
  render();
  await refreshCloudRecords();
  await refreshDailyRecords();

  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    syncAuthUi();
    render();
  });
}

window.setInterval(checkDailyDate, 1_000);
void initialize();
