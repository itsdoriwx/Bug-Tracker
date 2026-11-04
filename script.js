const BIN_ID = "6aeb4792ac6210605a6c18a1";
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;

const SEVERITY = {
  critical: { label: "Критичні" },
  major: { label: "Серйозні" },
  minor: { label: "Незначні" },
};

const STATUS = {
  open: "Відкрито",
  in_progress: "У роботі",
  resolved: "Виправлено",
};

const PRIORITY = {
  high:{ label: "Високий",  order: 0 },
  medium: { label: "Середній", order: 1 },
  low: { label: "Низький",  order: 2 },
};

function esc(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function plural(n, forms) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

class Bug {
  constructor({ id, title, severity, priority, status, assignee, created }) {
    this.id = id;
    this.title = title;
    this.severity = severity;
    this.priority = priority;
    this.status = status;
    this.assignee = assignee;
    this.created = created;
  }

  get isOpen() {
    return this.status !== "resolved";
  }

  get createdLabel() {
    return new Date(this.created).toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "short",
    });
  }

  get initial() {
    return this.assignee ? this.assignee.trim()[0].toUpperCase() : "?";
  }

  matches(query) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [this.id, this.title, this.assignee]
      .join(" ")
      .toLowerCase()
      .includes(q);
  }

  // HTML-картка
  toHTML() {
    const priority = PRIORITY[this.priority] ?? PRIORITY.low;
    return `
      <article class="bug bug--${esc(this.status)}">
        <div class="bug__top">
          <span class="bug__id">${esc(this.id)}</span>
          <span class="chip chip--${esc(this.status)}">${STATUS[this.status] ?? esc(this.status)}</span>
        </div>
        <h3 class="bug__title">${esc(this.title)}</h3>
        <div class="bug__bottom">
          <span class="prio prio--${esc(this.priority)}">
            <span class="prio__bars"><i></i><i></i><i></i></span>
            ${priority.label}
          </span>
          <span class="who">
            <span class="avatar">${esc(this.initial)}</span>
            ${esc(this.createdLabel)}
          </span>
        </div>
      </article>`;
  }
}

class BugTracker {
  constructor(records) {
    this.bugs = records.map((record) => new Bug(record));
  }

  filter({ query = "", status = "all" } = {}) {
    return this.bugs.filter(
      (bug) => bug.matches(query) && (status === "all" || bug.status === status)
    );
  }

  groupBySeverity(list = this.bugs) {
    const groups = {};
    for (const key of Object.keys(SEVERITY)) groups[key] = [];

    for (const bug of list) {
      if (groups[bug.severity]) groups[bug.severity].push(bug);
    }

    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        const byPriority = PRIORITY[a.priority].order - PRIORITY[b.priority].order;
        return byPriority || b.created.localeCompare(a.created);
      });
    }
    return groups;
  }

  // загальна статистика
  stats() {
    const total = this.bugs.length;
    const resolved = this.bugs.filter((b) => b.status === "resolved").length;

    const bySeverity = {};
    for (const key of Object.keys(SEVERITY)) {
      bySeverity[key] = this.bugs.filter((b) => b.severity === key).length;
    }

    return {
      total,
      resolved,
      open: total - resolved,
      resolvedPercent: total ? Math.round((resolved / total) * 100) : 0,
      bySeverity,
    };
  }
}

const summaryEl = document.getElementById("summary");
const boardEl = document.getElementById("board");
const searchEl = document.getElementById("search");
const projectEl = document.getElementById("project");

let tracker = null;
const view = { query: "", status: "all" };

function renderSummary() {
  const s = tracker.stats();

  const segments = Object.keys(SEVERITY)
    .map((key) => {
      const share = s.total ? (s.bySeverity[key] / s.total) * 100 : 0;
      return `<span class="bar__seg bar__seg--${key}" data-width="${share}"></span>`;
    })
    .join("");

  const legend = Object.keys(SEVERITY)
    .map(
      (key) => `
        <li style="--c: var(--${key})">
          <span class="dot"></span>
          ${SEVERITY[key].label}: <b>${s.bySeverity[key]}</b>
        </li>`
    )
    .join("");

  summaryEl.innerHTML = `
    <div class="total">
      <span class="total__num">${s.total}</span>
      <span class="total__label">${plural(s.total, ["баг", "баги", "багів"])} у проєкті</span>
    </div>

    <div class="dist">
      <div class="bar" role="img" aria-label="Розподіл багів за критичністю">${segments}</div>
      <ul class="legend">${legend}</ul>
    </div>

    <div class="progress">
      <div class="progress__value">${s.resolvedPercent}%</div>
      <div class="progress__label">виправлено (${s.resolved} з ${s.total})</div>
      <div class="progress__track"><div class="progress__fill" data-width="${s.resolvedPercent}"></div></div>
    </div>`;

  requestAnimationFrame(() => {
    summaryEl.querySelectorAll("[data-width]").forEach((el) => {
      el.style.width = `${el.dataset.width}%`;
    });
  });
}

function renderBoard() {
  const groups = tracker.groupBySeverity(tracker.filter(view));

  boardEl.innerHTML = Object.keys(SEVERITY)
    .map((key) => {
      const list = groups[key];
      const cards = list.length
        ? list.map((bug) => bug.toHTML()).join("")
        : `<p class="empty">Немає багів у цій групі</p>`;

      return `
        <section class="col col--${key}">
          <div class="col__head">
            <span class="dot" style="--c: var(--${key})"></span>
            <h2>${SEVERITY[key].label}</h2>
          </div>
          <div class="col__list">${cards}</div>
        </section>`;
    })
    .join("");
}

function showError(message) {
  boardEl.innerHTML = `<p class="state state--error">${esc(message)}</p>`;
}

async function loadData() {
  try {
    const response = await fetch(API_URL);

    // 404/401 не є помилкою для fetch, тому перевіряємо вручну
    if (!response.ok) {
      throw new Error(`Статус сервера: ${response.status}`);
    }

    const json = await response.json();
    const data = json.record;

    tracker = new BugTracker(data.bugs);
    projectEl.textContent = `Проєкт: ${data.project}`;

    renderSummary();
    renderBoard();
  } catch (error) {
    showError(
      `Не вдалося завантажити дані. (${error.message})`
    );
  }
}

searchEl.addEventListener("input", () => {
  view.query = searchEl.value;
  if (tracker) renderBoard();
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".filter.is-active").classList.remove("is-active");
    button.classList.add("is-active");
    view.status = button.dataset.status;
    if (tracker) renderBoard();
  });
});

loadData();