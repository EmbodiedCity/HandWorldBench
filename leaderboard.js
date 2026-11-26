'use strict';

const scopes = {
  all: ['Overall', 500],
  human: ['Human hands', 322],
  handson: ['Simulated hands', 108],
  real_robot: ['Real robot', 70],
};
// Evaluated conditioning interfaces in Appendix G.
const modelTypes = {
  'CogVideoX1.5': 'General I2V',
  'HunyuanVideo 1.5': 'General I2V',
  'Wan2.1': 'General I2V',
  'Wan2.2': 'General I2V',
  'DWM': 'Hand-guided',
  'EgoHOI': 'Hand-guided',
  'EgoSim': 'Hand-guided',
  'Hand2World': 'Hand-guided',
  'JointControlVideo': 'Hand-guided',
  'PAM': 'Hand-guided',
  'RynnWorld-Teleop': 'Hand-guided',
};
const table = document.querySelector('#board-table');
const tableWrap = document.querySelector('.board-table-wrap');
const groupField = document.querySelector('#group-field');
const scaleNote = document.querySelector('#scale-note');
const statusMessage = document.querySelector('#board-status');
const metricNames = metricGroups.flatMap(group => group.metrics);
const scoreColumn = { id: 'score', label: 'HWBScore', value: row => row.score, digits: 2 };
let scores;
let scope = 'all';
let view = 'summary';
let group = 'all';
let sortKey = 'score';
let descending = true;
let openModel = null;


function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function columnsForView() {
  if (view === 'summary') {
    return [scoreColumn, ...metricGroups.map((g, index) => ({
      id: 'd' + index, label: g.name, value: row => row.dimensions[index], digits: 1,
    }))];
  }
  const groups = group === 'all' ? metricGroups : [metricGroups[group]];
  return [scoreColumn, ...groups.flatMap(g => g.metrics.map(label => {
    const index = metricNames.indexOf(label);
    return { id: 'm' + index, label, group: g.name, value: row => row.metrics[index], digits: 3 };
  }))];
}

function rankMap(key) {
  return new Map(scores[key].map((row, i) => [row.name, i + 1]));
}

function sortButton(col) {
  const cell = el('th');
  cell.scope = 'col';
  const button = el('button', 'sort-button');
  button.type = 'button';
  button.dataset.column = col.id;
  button.append(el('span', 'sort-label', col.label), el('span', 'sort-mark'));
  button.setAttribute('aria-label', 'Sort by ' + col.label);
  if (col.id === sortKey) {
    cell.setAttribute('aria-sort', descending ? 'descending' : 'ascending');
    button.querySelector('.sort-mark').textContent = descending ? '↓' : '↑';
  }
  cell.append(button);
  if (col === scoreColumn) cell.className = 'hwb-head';
  return cell;
}

function plainHeading(text, className) {
  const cell = el('th', className, text);
  cell.scope = 'col';
  return cell;
}

function renderHead(columns) {
  const head = table.tHead;
  head.replaceChildren();
  // One colgroup per render keeps the score columns evenly sized.
  table.querySelector('colgroup')?.remove();
  const cols = document.createElement('colgroup');
  for (const width of ['var(--w-rank)', 'var(--w-model)', 'var(--w-hwb)', ...columns.slice(1).map(() => 'auto')]) {
    const col = document.createElement('col');
    col.style.width = width;
    cols.append(col);
  }
  table.prepend(cols);
  const grouped = view === 'metrics' && group === 'all';
  const top = head.insertRow();
  const fixed = [plainHeading('Rank', 'rank-head'), plainHeading('Model', 'model-head'), sortButton(columns[0])];
  if (!grouped) {
    top.append(...fixed, ...columns.slice(1).map(sortButton));
    return;
  }
  fixed.forEach(cell => cell.rowSpan = 2);
  top.append(...fixed);
  top.className = 'group-row';
  for (const g of metricGroups) {
    const cell = el('th', 'group-head', g.name);
    cell.scope = 'colgroup';
    cell.colSpan = g.metrics.length;
    top.append(cell);
  }
  const second = head.insertRow();
  for (const col of columns.slice(1)) {
    const cell = sortButton(col);
    if (metricGroups.some(g => g.metrics[0] === col.label)) cell.classList.add('group-start');
    second.append(cell);
  }
}

function detailPanel(model, columnCount) {
  const row = el('tr', 'detail-row');
  row.id = 'detail-' + slug(model.name);
  const cell = row.insertCell();
  cell.colSpan = columnCount;
  const panel = el('div', 'detail-panel');

  const ranks = el('div', 'detail-ranks');
  ranks.append(el('h3', null, 'Rank by embodiment'));
  const list = el('ol');
  for (const [key, [name]] of Object.entries(scopes)) {
    const entry = scores[key].find(r => r.name === model.name);
    const item = el('li');
    if (key === scope) item.setAttribute('aria-current', 'true');
    const position = scores[key].indexOf(entry) + 1;
    item.append(el('span', 'detail-scope', name), el('strong', null, '#' + position), el('span', 'detail-score', entry.score.toFixed(2)));
    item.setAttribute('aria-label', name + ': rank ' + position + ' of ' + scores[key].length + ', HWBScore ' + entry.score.toFixed(2));
    list.append(item);
  }
  ranks.append(list);

  const dims = el('div', 'detail-dims');
  dims.append(el('h3', null, 'Dimension scores, ' + scopes[scope][0].toLowerCase()));
  const bars = el('ul');
  metricGroups.forEach((g, index) => {
    const values = scores[scope].map(r => r.dimensions[index]);
    const best = Math.max(...values);
    const leader = scores[scope].find(r => r.dimensions[index] === best).name;
    const value = model.dimensions[index];
    const item = el('li');
    const bar = el('span', 'dim-bar');
    bar.setAttribute('aria-hidden', 'true');
    const fill = el('i');
    fill.style.width = value + '%';
    const tick = el('b');
    tick.style.left = best + '%';
    tick.title = 'Best: ' + leader + ', ' + best.toFixed(1);
    bar.append(fill, tick);
    item.append(el('span', 'dim-name', g.name), bar, el('span', 'dim-value', value.toFixed(1)));
    item.setAttribute('aria-label', g.name + ' ' + value.toFixed(1) + (value === best ? ', best in this view' : ', best is ' + leader + ' at ' + best.toFixed(1)));
    bars.append(item);
  });
  dims.append(bars, el('p', 'dim-key', 'The mark on each track shows the best score among all models in this view.'));

  panel.append(ranks, dims);
  cell.append(panel);
  return row;
}

function renderTable({ grow = false } = {}) {
  if (!scores) return;
  const columns = columnsForView();
  if (!columns.some(col => col.id === sortKey)) { sortKey = 'score'; descending = true; }
  const [scopeName, count] = scopes[scope];
  const entries = scores[scope];
  const ranks = rankMap(scope);
  const overallRanks = rankMap('all');
  const column = columns.find(col => col.id === sortKey);
  const sorted = [...entries].sort((left, right) => {
    const a = column.value(left), b = column.value(right);
    if (a === b) return ranks.get(left.name) - ranks.get(right.name);
    if (a == null) return 1;
    if (b == null) return -1;
    return descending ? b - a : a - b;
  });
  const ranges = new Map(columns.slice(1).map(col => {
    const values = entries.map(col.value).filter(v => v != null);
    return [col.id, [Math.min(...values), Math.max(...values)]];
  }));

  renderHead(columns);
  const body = table.tBodies[0];
  body.replaceChildren();
  const columnCount = columns.length + 2;
  for (const model of sorted) {
    const row = body.insertRow();
    const rank = ranks.get(model.name);
    const type = modelTypes[model.name] ?? 'Other';
    row.dataset.type = type;
    if (rank <= 3) row.dataset.podium = rank;

    const rankCell = row.insertCell();
    rankCell.className = 'rank';
    rankCell.append(el('span', 'rank-num', rank));
    if (scope !== 'all') {
      const shift = overallRanks.get(model.name) - rank;
      const delta = el('span', 'rank-shift');
      delta.dataset.dir = shift > 0 ? 'up' : shift < 0 ? 'down' : 'same';
      delta.textContent = shift > 0 ? '▲' + shift : shift < 0 ? '▼' + -shift : '';
      delta.title = shift === 0 ? 'Same rank as overall' : (shift > 0 ? 'Up ' : 'Down ') + Math.abs(shift) + ' from overall rank ' + overallRanks.get(model.name);
      delta.setAttribute('aria-label', delta.title);
      rankCell.append(delta);
    }

    const nameCell = row.insertCell();
    nameCell.className = 'model';
    const toggle = el('button', 'model-toggle');
    toggle.type = 'button';
    toggle.dataset.model = model.name;
    toggle.setAttribute('aria-expanded', openModel === model.name);
    toggle.setAttribute('aria-controls', 'detail-' + slug(model.name));
    const typeTag = el('span', 'model-type', type);
    typeTag.dataset.type = type;
    toggle.append(el('span', 'model-name', model.name), typeTag);
    nameCell.append(toggle);

    for (const col of columns) {
      const cell = row.insertCell();
      const value = col.value(model);
      if (col === scoreColumn) {
        cell.className = 'hwb';
        const bar = el('span', 'hwb-bar');
        bar.setAttribute('aria-hidden', 'true');
        const fill = el('i');
        fill.style.width = value + '%';
        bar.append(fill);
        cell.append(el('span', 'hwb-value', value.toFixed(2)), bar);
        continue;
      }
      cell.className = 'heat';
      if (metricGroups.some(g => g.metrics[0] === col.label) && view === 'metrics' && group === 'all') cell.classList.add('group-start');
      if (value == null) {
        cell.textContent = '—';
        cell.classList.add('empty');
        cell.setAttribute('aria-label', 'Not applicable');
        continue;
      }
      const [min, max] = ranges.get(col.id);
      const t = max > min ? (value - min) / (max - min) : 1;
      if (value === max) { cell.classList.add('best'); cell.title = 'Best in this column'; }
      const inner = el('span', 'heat-inner');
      const track = el('span', 'heat-track');
      track.setAttribute('aria-hidden', 'true');
      const fill = el('i');
      fill.style.width = Math.max(t * 100, 3) + '%';
      track.append(fill);
      inner.append(el('span', 'heat-value', value.toFixed(col.digits)), track);
      cell.append(inner);
    }
    if (openModel === model.name) body.append(detailPanel(model, columnCount));
  }

  const detail = view === 'metrics';
  table.classList.toggle('detail', detail);
  table.classList.toggle('grouped', detail && group === 'all');
  table.classList.toggle('grow', grow);
  document.querySelector('#board-caption').textContent = scopeName + ', ' + (detail ? (group === 'all' ? 'all 17 metrics' : metricGroups[group].name) : 'six dimensions') + ', ranked by HWBScore';
  document.querySelector('#scope-count').textContent = entries.length + ' models evaluated on ' + count + ' ' + (scope === 'all' ? 'cases across three embodiments.' : scopeName.toLowerCase() + ' cases.') + (scope === 'all' ? '' : ' Arrows show the change from the overall rank.');
  scaleNote.textContent = detail
    ? 'Individual metrics use the paper’s 0–1 scale; HWBScore uses 0–100. A dash marks a metric that does not apply to this subset. The bar under each score is scaled within its own column, and rank follows HWBScore.'
    : 'HWBScore and the six dimension scores use a 0–100 scale, higher is better. The bar under each score is scaled within its own column, and the bold navy bar marks the best score in that column. Select a column heading to sort.';
  if (column !== scoreColumn) {
    scaleNote.textContent = 'Sorted by ' + column.label + ' (' + (descending ? 'high to low' : 'low to high') + '). The rank column still follows HWBScore. ' + scaleNote.textContent;
  }
  syncPanelWidth();
}

function syncPanelWidth() {
  table.style.setProperty('--wrap-w', tableWrap.clientWidth + 'px');
}
new ResizeObserver(syncPanelWidth).observe(tableWrap);

function renderGroupChips() {
  const options = [['all', 'All'], ...metricGroups.map((g, i) => [String(i), g.name])];
  groupField.replaceChildren(...options.map(([value, label]) => {
    const chip = el('button', null, label);
    chip.type = 'button';
    chip.dataset.group = value;
    chip.setAttribute('aria-pressed', String(group) === value);
    return chip;
  }));
}

function changeView({ grow = true } = {}) {
  groupField.hidden = view !== 'metrics';
  document.querySelectorAll('[data-scope]').forEach(button => button.setAttribute('aria-pressed', button.dataset.scope === scope));
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', button.dataset.view === view));
  renderGroupChips();
  tableWrap.scrollLeft = 0;
  renderTable({ grow });
}

document.querySelectorAll('[data-scope]').forEach(button => button.onclick = () => {
  if (scope === button.dataset.scope) return;
  scope = button.dataset.scope;
  changeView();
});
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => {
  if (view === button.dataset.view) return;
  view = button.dataset.view;
  sortKey = 'score';
  descending = true;
  changeView({ grow: false });
});
groupField.onclick = event => {
  const chip = event.target.closest('[data-group]');
  if (!chip) return;
  group = chip.dataset.group === 'all' ? 'all' : Number(chip.dataset.group);
  changeView({ grow: false });
  groupField.querySelector('[data-group="' + chip.dataset.group + '"]').focus({ preventScroll: true });
};
table.tHead.onclick = event => {
  const button = event.target.closest('[data-column]');
  if (!button) return;
  const key = button.dataset.column;
  descending = key === sortKey ? !descending : true;
  sortKey = key;
  renderTable();
  table.tHead.querySelector('[data-column="' + key + '"]').focus({ preventScroll: true });
};
table.tBodies[0].onclick = event => {
  const toggle = event.target.closest('.model-toggle');
  if (!toggle) return;
  const name = toggle.dataset.model;
  openModel = openModel === name ? null : name;
  renderTable();
  table.querySelector('.model-toggle[data-model="' + CSS.escape(name) + '"]').focus({ preventScroll: true });
};

async function loadScores() {
  try {
    const response = await fetch('assets/results.json?v=manuscript4');
    if (!response.ok) throw new Error('Score data unavailable');
    scores = await response.json();
    changeView();
    statusMessage.hidden = true;
  } catch {
    statusMessage.textContent = 'Scores could not be loaded. Reload the page to try again.';
  }
}
loadScores();

const newsFeed = document.querySelector('.news-feed');
const newsList = newsFeed.querySelector('.news-list');
// Each announcement is one list item with an ISO publication date.
const announcements = Array.from(newsList.children);
announcements.sort((a, b) =>
  b.querySelector('time').dateTime.localeCompare(a.querySelector('time').dateTime)
);
newsList.append(...announcements);
function updateNewsFade() {
  const remaining = newsFeed.scrollHeight - newsFeed.clientHeight - newsFeed.scrollTop;
  newsFeed.parentElement.classList.toggle('can-scroll', remaining > 2);
}
newsFeed.addEventListener('scroll', updateNewsFade, { passive: true });
newsFeed.addEventListener('toggle', updateNewsFade, true);
const newsObserver = new ResizeObserver(updateNewsFade);
newsObserver.observe(newsFeed);
newsObserver.observe(newsFeed.firstElementChild);

const requestForm = document.querySelector('#request-form');
const draft = document.querySelector('#email-draft');
const recipient = 'learnerwang04@gmail.com';
const copyStatus = document.querySelector('#copy-status');
let emailText = '';

requestForm.addEventListener('input', () => {
  draft.hidden = true;
  copyStatus.textContent = '';
});

requestForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(requestForm);
  const fields = [
    ['Team', 'team'], ['Organization', 'organization'],
    ['Contact', 'contact'], ['Reply email', 'email'], ['Model and version', 'model'],
    ['Model interface', 'kind'], ['Additional contact', 'alternate'], ['WeChat ID', 'wechat'],
    ['Source repository', 'repo'], ['Commit or release', 'revision'],
    ['Model weights', 'weights'], ['Checkpoint version', 'checkpoint'],
    ['Inputs and evaluation setup', 'setup'], ['Reproduction instructions', 'run'],
  ];
  const subject = '[HandWorldBench evaluation] ' + data.get('model').trim() + ' | ' + data.get('team').trim();
  const body = ['Dear HandWorldBench team,', '', 'Please evaluate the following model across all three embodiments.', '',
    ...fields.filter(([, key]) => data.get(key).trim()).map(([label, key]) => label + ': ' + data.get(key).trim()),
  ].join('\r\n');
  emailText = 'To: ' + recipient + '\r\nSubject: ' + subject + '\r\n\r\n' + body;
  document.querySelector('#draft-to').textContent = 'To: ' + recipient;
  document.querySelector('#draft-subject').textContent = 'Subject: ' + subject;
  document.querySelector('#draft-body').value = body;
  document.querySelector('#open-email').href = 'mailto:' + recipient + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  draft.hidden = false;
  document.querySelector('#draft-body').focus();
});

document.querySelector('#copy-email').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(emailText);
    copyStatus.textContent = 'Email copied with recipient and subject.';
  } catch {
    const field = document.querySelector('#draft-body');
    field.focus();
    field.select();
    copyStatus.textContent = 'Copy the selected body and use the recipient and subject shown above.';
  }
});
