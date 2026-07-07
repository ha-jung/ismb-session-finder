const DATA_PATH = "./sessions.json";
const MAX_RESULTS = 40;
const STORAGE_KEY = "ismb2026_saved_sessions";
const EXCLUDED_DATES = new Set(["2026-07-06", "2026-07-07"]);

const form = document.querySelector("#search-form");
const timeForm = document.querySelector("#time-form");
const queryInput = document.querySelector("#query");
const dateSelect = document.querySelector("#date-select");
const timeSelect = document.querySelector("#time-select");
const trackFilter = document.querySelector("#track-filter");
const roomFilter = document.querySelector("#room-filter");
const sortSelect = document.querySelector("#sort-select");
const nowButton = document.querySelector("#now-button");
const scheduleButton = document.querySelector("#schedule-button");
const statusEl = document.querySelector("#status");
const answerEl = document.querySelector("#answer");
const resultsEl = document.querySelector("#results");
const quickButtons = document.querySelectorAll("[data-query]");

let sessions = [];
let savedIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
let activeQuery = "";

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "me",
  "of",
  "on",
  "or",
  "show",
  "talk",
  "talks",
  "the",
  "to",
  "with",
]);

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(value) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTime(timeValue) {
  const [hour, minute] = timeValue.split(":");
  const date = new Date(Date.UTC(2026, 6, 7, Number(hour), Number(minute)));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function timeToMinutes(timeValue) {
  const [hour, minute] = timeValue.split(":").map(Number);
  return hour * 60 + minute;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function saveSchedule() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...savedIds]));
}

function conferenceSessions() {
  return sessions.filter((session) => !EXCLUDED_DATES.has(session.date));
}

function isOverlapping(a, b) {
  if (a.id === b.id || a.date !== b.date) return false;
  const aStart = timeToMinutes(a.start_time);
  const aEnd = timeToMinutes(a.end_time);
  const bStart = timeToMinutes(b.start_time);
  const bEnd = timeToMinutes(b.end_time);
  return aStart < bEnd && bStart < aEnd;
}

function getSavedSessions() {
  return conferenceSessions().filter((session) => savedIds.has(session.id));
}

function getConflictTitles(session) {
  return getSavedSessions()
    .filter((saved) => isOverlapping(session, saved))
    .map((saved) => saved.title);
}

function populateControls() {
  const availableSessions = conferenceSessions();
  const dates = [...new Set(availableSessions.map((session) => session.date))].sort();
  const times = [
    ...new Set(
      availableSessions.flatMap((session) => [
        session.start_time.slice(0, 5),
        session.end_time.slice(0, 5),
      ]),
    ),
  ].sort();
  const tracks = [...new Set(availableSessions.map((session) => session.track))].sort();
  const rooms = [...new Set(availableSessions.map((session) => session.room).filter(Boolean))].sort();

  dateSelect.innerHTML = dates
    .map((date) => `<option value="${escapeHtml(date)}">${formatDate(date)}</option>`)
    .join("");

  timeSelect.innerHTML = times
    .map((time) => `<option value="${escapeHtml(time)}">${formatTime(`${time}:00`)}</option>`)
    .join("");

  trackFilter.innerHTML = `<option value="">All tracks</option>${tracks
    .map((track) => `<option value="${escapeHtml(track)}">${escapeHtml(track)}</option>`)
    .join("")}`;

  roomFilter.innerHTML = `<option value="">All rooms</option>${rooms
    .map((room) => `<option value="${escapeHtml(room)}">${escapeHtml(room)}</option>`)
    .join("")}`;

  const firstTalk = availableSessions.find((session) => session.start_time);
  if (firstTalk) {
    dateSelect.value = firstTalk.date;
    timeSelect.value = firstTalk.start_time.slice(0, 5);
  }
}

function sessionText(session) {
  return normalize(
    [
      session.title,
      session.track,
      session.room,
      session.date,
      session.presenter,
      session.authors,
      session.format,
      session.keywords,
      session.abstract,
    ].join(" "),
  );
}

function queryMatches(session, query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return true;

  const text = sessionText(session);
  const orGroups = cleanQuery.split(/\s+OR\s+/i);

  return orGroups.some((group) => {
    const andParts = group.split(/\s+AND\s+/i);
    return andParts.every((part) => {
      const tokens = tokenize(part);
      return tokens.length > 0 && tokens.every((token) => text.includes(token));
    });
  });
}

function scoreSession(session, rawQuery) {
  const title = normalize(session.title);
  const track = normalize(session.track);
  const room = normalize(session.room);
  const date = normalize(session.date);
  const presenter = normalize(session.presenter || "");
  const authors = normalize(session.authors || "");
  const keywords = normalize(session.keywords || "");
  const abstract = normalize(session.abstract || "");
  const haystack = `${title} ${track} ${room} ${date} ${presenter} ${authors} ${keywords} ${abstract}`;
  const phrase = normalize(rawQuery);
  let score = 0;

  if (phrase && title.includes(phrase)) score += 18;
  if (phrase && keywords.includes(phrase)) score += 14;
  if (phrase && track.includes(phrase)) score += 10;
  if (phrase && abstract.includes(phrase)) score += 6;

  for (const token of tokenize(rawQuery)) {
    if (title.includes(token)) score += 8;
    if (keywords.includes(token)) score += 6;
    if (track.includes(token)) score += 4;
    if (presenter.includes(token) || authors.includes(token)) score += 4;
    if (abstract.includes(token)) score += 3;
    if (room.includes(token)) score += 2;
    if (date.includes(token)) score += 2;
    if (haystack.includes(token)) score += 1;
  }

  return score;
}

function applyFilters(list) {
  return list.filter((session) => {
    if (trackFilter.value && session.track !== trackFilter.value) return false;
    if (roomFilter.value && session.room !== roomFilter.value) return false;
    return true;
  });
}

function sortSessions(list, mode = sortSelect.value) {
  return [...list].sort((a, b) => {
    if (mode === "relevance" && (b.score || a.score)) {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    }
    if (mode === "track") {
      const trackOrder = a.track.localeCompare(b.track);
      if (trackOrder !== 0) return trackOrder;
    }
    return `${a.date} ${a.start_time} ${a.room}`.localeCompare(`${b.date} ${b.start_time} ${b.room}`);
  });
}

function search(query) {
  return sortSessions(
    applyFilters(
      sessions
        .filter((session) => !EXCLUDED_DATES.has(session.date))
        .map((session) => ({ ...session, score: scoreSession(session, query) }))
        .filter((session) => queryMatches(session, query)),
    ),
  ).slice(0, MAX_RESULTS);
}

function highlight(value, query) {
  let html = escapeHtml(value);
  const tokens = [...new Set(tokenize(query))].sort((a, b) => b.length - a.length);

  for (const token of tokens) {
    const pattern = new RegExp(`(${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    html = html.replace(pattern, "<mark>$1</mark>");
  }

  return html;
}

function snippet(value, query, maxLength = 320) {
  if (!value) return "";
  const cleanValue = value.replace(/\s+/g, " ").trim();
  const tokens = tokenize(query);
  const normalized = normalize(cleanValue);
  const hit = tokens.map((token) => normalized.indexOf(token)).find((index) => index >= 0);
  const start = hit && hit > 80 ? Math.max(0, hit - 90) : 0;
  const end = Math.min(cleanValue.length, start + maxLength);
  const prefix = start > 0 ? "... " : "";
  const suffix = end < cleanValue.length ? " ..." : "";
  return `${prefix}${cleanValue.slice(start, end)}${suffix}`;
}

function renderSessions(matches, options = {}) {
  const query = options.query || "";
  const showConflicts = options.showConflicts || false;

  resultsEl.innerHTML = matches
    .map((session) => {
      const saved = savedIds.has(session.id);
      const conflicts = showConflicts ? getConflictTitles(session) : [];
      const title = query ? highlight(session.title, query) : escapeHtml(session.title);
      const track = query ? highlight(session.track, query) : escapeHtml(session.track);
      const keywords = query
        ? highlight(session.keywords || "", query)
        : escapeHtml(session.keywords || "");
      const abstract = snippet(session.abstract || "", query);
      const abstractHtml = query ? highlight(abstract, query) : escapeHtml(abstract);
      const fullAbstract = query
        ? highlight(session.abstract || "", query)
        : escapeHtml(session.abstract || "");
      const people = [session.presenter, session.format].filter(Boolean).join(" · ");
      const authors = session.authors ? escapeHtml(session.authors) : "";

      return `
        <article class="result-card">
          <div class="result-header">
            <h2 class="result-title">${title}</h2>
            <button class="save-button ${saved ? "saved" : ""}" type="button" data-save-id="${escapeHtml(session.id)}">
              ${saved ? "Saved" : "Save"}
            </button>
          </div>
          <div class="meta">
            <span class="pill">${formatDate(session.date)}</span>
            <span class="pill">${formatTime(session.start_time)}-${formatTime(session.end_time)}</span>
            ${session.room ? `<span class="pill">${escapeHtml(session.room)}</span>` : ""}
          </div>
          <div class="track">${track}</div>
          ${people ? `<div class="presenter">${escapeHtml(people)}</div>` : ""}
          ${keywords ? `<div class="keywords">${keywords}</div>` : ""}
          ${
            abstract
              ? `
                <p class="abstract">${abstractHtml}</p>
                <details class="abstract-details">
                  <summary>Full abstract</summary>
                  ${authors ? `<div class="authors">${authors}</div>` : ""}
                  <p>${fullAbstract}</p>
                </details>
              `
              : ""
          }
          ${
            conflicts.length
              ? `<div class="conflict">Time conflict with: ${escapeHtml(conflicts.join("; "))}</div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function renderSearchAnswer(query, matches) {
  if (!matches.length) {
    answerEl.textContent = `"${query}"에 맞는 세션을 찾지 못했습니다. 필터를 줄이거나 더 넓은 키워드로 검색해보세요.`;
    resultsEl.innerHTML = "";
    return;
  }

  const top = matches[0];
  const date = formatDate(top.date);
  const time = `${formatTime(top.start_time)}-${formatTime(top.end_time)}`;

  answerEl.innerHTML = `
    <strong>${matches.length} related sessions found.</strong>
    The strongest match is <strong>${escapeHtml(top.title)}</strong>,
    scheduled on <strong>${date}</strong> at <strong>${time}</strong>
    in <strong>${escapeHtml(top.room)}</strong>.
  `;

  renderSessions(matches, { query });
}

function sessionsAtTime(date, time, query = "") {
  const selected = timeToMinutes(`${time}:00`);

  return sortSessions(
    applyFilters(
      sessions
        .filter((session) => !EXCLUDED_DATES.has(session.date))
        .map((session) => ({ ...session, score: scoreSession(session, query) }))
        .filter((session) => {
          if (session.date !== date) return false;
          if (!queryMatches(session, query)) return false;
          const start = timeToMinutes(session.start_time);
          const end = timeToMinutes(session.end_time);
          return start <= selected && selected < end;
        }),
    ),
    query ? sortSelect.value : "time",
  );
}

function renderTimeResults(date, time, matches, query = "") {
  const label = `${formatDate(date)} at ${formatTime(`${time}:00`)}`;
  const queryText = query ? ` matching <strong>${escapeHtml(query)}</strong>` : "";

  if (!matches.length) {
    answerEl.innerHTML = `<strong>No sessions found</strong> for ${label}${queryText}. Try another time, keyword, or loosen the filters.`;
    resultsEl.innerHTML = "";
    return;
  }

  answerEl.innerHTML = `
    <strong>${matches.length} sessions are active</strong>
    on <strong>${label}</strong>${queryText}.
  `;

  renderSessions(matches, { query });
}

function runTimeSearch() {
  const cleanQuery = queryInput.value.trim();
  activeQuery = cleanQuery;
  renderTimeResults(
    dateSelect.value,
    timeSelect.value,
    sessionsAtTime(dateSelect.value, timeSelect.value, cleanQuery),
    cleanQuery,
  );
}

function runSearch(query) {
  const cleanQuery = query.trim();
  activeQuery = cleanQuery;

  if (!cleanQuery) {
    answerEl.textContent = "검색어를 입력하면 관련 title, 시간, 방, track을 찾아드립니다.";
    resultsEl.innerHTML = "";
    return;
  }

  renderSearchAnswer(cleanQuery, search(cleanQuery));
}

function runNowMode() {
  const now = new Date();
  const dates = [...new Set(conferenceSessions().map((session) => session.date))].sort();
  const todayIso = now.toISOString().slice(0, 10);
  const date = dates.includes(todayIso) ? todayIso : dateSelect.value;
  const time = dates.includes(todayIso)
    ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    : timeSelect.value;
  const cleanQuery = queryInput.value.trim();
  const active = sessionsAtTime(date, time, cleanQuery);

  answerEl.innerHTML = `
    <strong>Suggested sessions for ${formatDate(date)} at ${formatTime(`${time}:00`)}</strong>.
    Showing what is active now for the selected conference day${cleanQuery ? ` matching <strong>${escapeHtml(cleanQuery)}</strong>` : ""}.
  `;

  if (!active.length) {
    resultsEl.innerHTML = "";
    answerEl.innerHTML += " No active sessions were found at that time.";
    return;
  }

  renderSessions(active, { query: cleanQuery });
}

function renderSchedule() {
  const saved = sortSessions(getSavedSessions(), "time");

  if (!saved.length) {
    answerEl.innerHTML = "<strong>My Schedule is empty.</strong> Save sessions to build a personal plan.";
    resultsEl.innerHTML = "";
    return;
  }

  const conflictCount = saved.filter((session) => getConflictTitles(session).length > 0).length;
  answerEl.innerHTML = `
    <strong>${saved.length} saved sessions</strong>
    ${conflictCount ? `with <strong>${conflictCount}</strong> sessions having time conflicts.` : "with no time conflicts."}
  `;

  renderSessions(saved, { showConflicts: true });
}

async function boot() {
  try {
    const response = await fetch(DATA_PATH);
    if (!response.ok) throw new Error(`Data load failed: ${response.status}`);
    sessions = await response.json();
    populateControls();
    const abstractCount = conferenceSessions().filter((session) => session.abstract).length;
    statusEl.textContent = `${conferenceSessions().length} conference sessions loaded · ${abstractCount} abstracts`;
    answerEl.textContent = "Enter a keyword query or choose a date and time to find sessions.";
    resultsEl.innerHTML = "";
  } catch (error) {
    statusEl.textContent = "Could not load the schedule data. Please run this page through a local server.";
    answerEl.textContent = error.message;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch(queryInput.value);
});

quickButtons.forEach((button) => {
  button.addEventListener("click", () => {
    queryInput.value = button.dataset.query;
    runSearch(button.dataset.query);
  });
});

timeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runTimeSearch();
});

trackFilter.addEventListener("change", () => {
  if (activeQuery) runSearch(activeQuery);
});

roomFilter.addEventListener("change", () => {
  if (activeQuery) runSearch(activeQuery);
});

sortSelect.addEventListener("change", () => {
  if (activeQuery) runSearch(activeQuery);
});

nowButton.addEventListener("click", runNowMode);
scheduleButton.addEventListener("click", renderSchedule);

resultsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-save-id]");
  if (!button) return;

  const id = button.dataset.saveId;
  if (savedIds.has(id)) {
    savedIds.delete(id);
  } else {
    savedIds.add(id);
  }
  saveSchedule();

  if (activeQuery) {
    runSearch(activeQuery);
  } else if (answerEl.textContent.includes("saved sessions") || answerEl.textContent.includes("My Schedule")) {
    renderSchedule();
  } else {
    runTimeSearch();
  }
});

boot();
