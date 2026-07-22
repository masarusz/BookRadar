'use strict';

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
  '熊本県','大分県','宮崎県','鹿児島県','沖縄県'
];

const LS_APPKEY = 'br_appkey';
const LS_GBOOKS_KEY = 'br_gbooks_key';
const LS_DEFAULT = 'br_default';

const els = {
  settingsBtn: document.getElementById('settingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  appkeyInput: document.getElementById('appkeyInput'),
  saveKeyBtn: document.getElementById('saveKeyBtn'),
  gbooksKeyInput: document.getElementById('gbooksKeyInput'),
  saveGbooksKeyBtn: document.getElementById('saveGbooksKeyBtn'),
  prefSelect: document.getElementById('prefSelect'),
  citySelect: document.getElementById('citySelect'),
  systemsList: document.getElementById('systemsList'),
  saveDefaultBtn: document.getElementById('saveDefaultBtn'),
  defaultSummary: document.getElementById('defaultSummary'),
  currentCity: document.getElementById('currentCity'),
  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  resultsSection: document.getElementById('resultsSection'),
  resultsList: document.getElementById('resultsList'),
  availabilitySection: document.getElementById('availabilitySection'),
  availabilityBook: document.getElementById('availabilityBook'),
  availabilityStatus: document.getElementById('availabilityStatus'),
  availabilityList: document.getElementById('availabilityList'),
  message: document.getElementById('message'),
};

let libraryCacheByPref = {}; // pref -> array of library objects from Calil
let pendingSystems = [];     // grouped systems for the currently selected city in the modal

// ---------- storage helpers ----------

function getAppkey() {
  return localStorage.getItem(LS_APPKEY) || '';
}

function getGbooksKey() {
  return localStorage.getItem(LS_GBOOKS_KEY) || '';
}

function getDefault() {
  const raw = localStorage.getItem(LS_DEFAULT);
  return raw ? JSON.parse(raw) : null;
}

function setDefault(def) {
  localStorage.setItem(LS_DEFAULT, JSON.stringify(def));
}

// ---------- UI helpers ----------

function showMessage(text) {
  els.message.textContent = text;
  els.message.hidden = false;
}

function hideMessage() {
  els.message.hidden = true;
}

function openModal() {
  els.appkeyInput.value = getAppkey();
  els.gbooksKeyInput.value = getGbooksKey();
  refreshDefaultSummary();
  els.settingsModal.hidden = false;
}

function closeModal() {
  els.settingsModal.hidden = true;
}

function refreshDefaultSummary() {
  const def = getDefault();
  if (def) {
    els.defaultSummary.textContent = `現在のデフォルト: ${def.pref} ${def.city}（${def.systems.map(s => s.systemname).join('、')}）`;
    els.currentCity.textContent = `📍 ${def.pref} ${def.city}`;
  } else {
    els.defaultSummary.textContent = 'デフォルトの図書館は未設定です。';
    els.currentCity.textContent = '📍 図書館が未設定です（⚙️ から設定）';
  }
}

// ---------- Calil helpers ----------

function calilLibraryUrl(pref, city) {
  const key = getAppkey();
  const params = new URLSearchParams({ appkey: key, pref, format: 'json', callback: 'no' });
  if (city) params.set('city', city);
  return `https://api.calil.jp/library?${params.toString()}`;
}

async function fetchLibrariesForPref(pref) {
  if (libraryCacheByPref[pref]) return libraryCacheByPref[pref];
  const res = await fetch(calilLibraryUrl(pref));
  if (!res.ok) throw new Error('図書館情報の取得に失敗しました');
  const data = await res.json();
  libraryCacheByPref[pref] = data;
  return data;
}

async function calilCheck(isbn, systemids, session) {
  const key = getAppkey();
  const params = new URLSearchParams({ appkey: key, isbn, systemid: systemids, format: 'json', callback: 'no' });
  if (session) params.set('session', session);
  const res = await fetch(`https://api.calil.jp/check?${params.toString()}`);
  if (!res.ok) throw new Error('蔵書状況の取得に失敗しました');
  return res.json();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollAvailability(isbn, systemids) {
  let data = await calilCheck(isbn, systemids);
  let attempts = 0;
  while (data.continue === 1 && attempts < 15) {
    await sleep(2000);
    data = await calilCheck(isbn, systemids, data.session);
    attempts++;
  }
  return data;
}

// ---------- Settings: prefecture / city / systems ----------

function populatePrefectures() {
  for (const pref of PREFECTURES) {
    const opt = document.createElement('option');
    opt.value = pref;
    opt.textContent = pref;
    els.prefSelect.appendChild(opt);
  }
}

els.prefSelect.addEventListener('change', async () => {
  const pref = els.prefSelect.value;
  els.citySelect.innerHTML = '<option value="">市区町村を選択</option>';
  els.citySelect.disabled = true;
  els.systemsList.innerHTML = '';
  els.saveDefaultBtn.disabled = true;
  pendingSystems = [];

  if (!pref) return;
  if (!getAppkey()) {
    showSettingsError('先に API キーを保存してください。');
    return;
  }

  els.citySelect.innerHTML = '<option value="">読み込み中...</option>';
  try {
    const libraries = await fetchLibrariesForPref(pref);
    const cities = [...new Set(libraries.map(l => l.city).filter(Boolean))];
    els.citySelect.innerHTML = '<option value="">市区町村を選択</option>';
    for (const city of cities) {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      els.citySelect.appendChild(opt);
    }
    els.citySelect.disabled = false;
  } catch (e) {
    showSettingsError(e.message);
  }
});

els.citySelect.addEventListener('change', () => {
  const pref = els.prefSelect.value;
  const city = els.citySelect.value;
  els.systemsList.innerHTML = '';
  els.saveDefaultBtn.disabled = true;
  pendingSystems = [];
  if (!pref || !city) return;

  const libraries = (libraryCacheByPref[pref] || []).filter(l => l.city === city);
  const bySystem = {};
  for (const lib of libraries) {
    if (!bySystem[lib.systemid]) {
      bySystem[lib.systemid] = { systemid: lib.systemid, systemname: lib.systemname, category: lib.category, libraries: [] };
    }
    bySystem[lib.systemid].libraries.push({ libid: lib.libid, short: lib.short, formal: lib.formal });
  }
  pendingSystems = Object.values(bySystem);

  for (const sys of pendingSystems) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = sys.systemid;
    checkbox.checked = sys.category !== 'UNIV';
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(`${sys.systemname}（${sys.libraries.length}館）`));
    els.systemsList.appendChild(label);
  }
  els.saveDefaultBtn.disabled = pendingSystems.length === 0;
});

els.saveDefaultBtn.addEventListener('click', () => {
  const pref = els.prefSelect.value;
  const city = els.citySelect.value;
  const checked = [...els.systemsList.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
  const systems = pendingSystems.filter(s => checked.includes(s.systemid));
  if (!pref || !city || systems.length === 0) return;
  setDefault({ pref, city, systems });
  refreshDefaultSummary();
});

function showSettingsError(text) {
  els.systemsList.textContent = text;
}

// ---------- API key ----------

els.saveKeyBtn.addEventListener('click', () => {
  const key = els.appkeyInput.value.trim();
  localStorage.setItem(LS_APPKEY, key);
  showSettingsError('');
  els.systemsList.innerHTML = '';
});

els.saveGbooksKeyBtn.addEventListener('click', () => {
  const key = els.gbooksKeyInput.value.trim();
  localStorage.setItem(LS_GBOOKS_KEY, key);
});

// ---------- Modal open/close ----------

els.settingsBtn.addEventListener('click', openModal);
els.closeSettingsBtn.addEventListener('click', closeModal);
els.settingsModal.addEventListener('click', (e) => {
  if (e.target === els.settingsModal) closeModal();
});

// ---------- Book search (Google Books) ----------

function extractIsbn(volumeInfo) {
  const ids = volumeInfo.industryIdentifiers || [];
  const isbn13 = ids.find(i => i.type === 'ISBN_13');
  const isbn10 = ids.find(i => i.type === 'ISBN_10');
  return (isbn13 || isbn10 || {}).identifier || null;
}

async function searchBooks(query) {
  const params = new URLSearchParams({ q: query, maxResults: '20' });
  const gbooksKey = getGbooksKey();
  if (gbooksKey) params.set('key', gbooksKey);
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);
  if (res.status === 429) {
    throw new Error(gbooksKey
      ? '書籍検索の割り当てを超えました。しばらく待ってから再度お試しください。'
      : '書籍検索に失敗しました（Google の共有割り当て超過の可能性があります。設定で API キーを追加すると安定します）');
  }
  if (!res.ok) throw new Error('書籍検索に失敗しました');
  const data = await res.json();
  return (data.items || []).map(item => {
    const vi = item.volumeInfo || {};
    return {
      title: vi.title || '(タイトル不明)',
      authors: vi.authors || [],
      thumbnail: (vi.imageLinks || {}).smallThumbnail || null,
      isbn: extractIsbn(vi),
    };
  });
}

function renderResults(books) {
  els.resultsList.innerHTML = '';
  els.resultsSection.hidden = books.length === 0;
  for (const book of books) {
    const li = document.createElement('li');
    li.className = 'result-item' + (book.isbn ? '' : ' disabled');

    if (book.thumbnail) {
      const img = document.createElement('img');
      img.src = book.thumbnail;
      img.alt = '';
      li.appendChild(img);
    }

    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = book.title;
    const authors = document.createElement('div');
    authors.className = 'authors';
    authors.textContent = book.authors.join(', ');
    const isbnLine = document.createElement('div');
    isbnLine.className = 'isbn';
    isbnLine.textContent = book.isbn ? `ISBN ${book.isbn}` : 'ISBN なし（検索不可）';
    meta.append(title, authors, isbnLine);
    li.appendChild(meta);

    if (book.isbn) {
      li.addEventListener('click', () => checkAvailability(book));
    }
    els.resultsList.appendChild(li);
  }
}

// ---------- Availability check ----------

function statusBadgeClass(status) {
  if (['貸出可', '在庫あり', '蔵書あり', '館内のみ'].includes(status)) return 'ok';
  if (['貸出中', '予約中'].includes(status)) return 'busy';
  if (['準備中', '休館中', '蔵書なし'].includes(status)) return 'warn';
  return '';
}

async function checkAvailability(book) {
  hideMessage();
  const def = getDefault();
  if (!getAppkey() || !def) {
    showMessage('先に ⚙️ 設定で API キーとデフォルトの図書館を設定してください。');
    openModal();
    return;
  }

  els.availabilitySection.hidden = false;
  els.availabilityList.innerHTML = '';
  els.availabilityBook.innerHTML = `<a href="https://calil.jp/book/${book.isbn}" target="_blank" rel="noopener">${book.title}</a>`;
  els.availabilityStatus.textContent = '検索中...';
  els.availabilitySection.scrollIntoView({ behavior: 'smooth' });

  const systemids = def.systems.map(s => s.systemid).join(',');
  try {
    const data = await pollAvailability(book.isbn, systemids);
    renderAvailability(data, book.isbn, def);
  } catch (e) {
    els.availabilityStatus.textContent = e.message;
  }
}

function renderAvailability(data, isbn, def) {
  els.availabilityList.innerHTML = '';
  const bookData = (data.books || {})[isbn] || {};
  let anyRendered = false;

  for (const sys of def.systems) {
    const result = bookData[sys.systemid];
    if (!result) continue;

    if (result.status === 'Error') {
      const li = document.createElement('li');
      li.className = 'lib-item';
      li.innerHTML = `<div class="system-name">${sys.systemname}</div><div>この図書館システムでは検索できませんでした。</div>`;
      els.availabilityList.appendChild(li);
      anyRendered = true;
      continue;
    }

    const libkeyEntries = Object.entries(result.libkey || {});
    if (libkeyEntries.length === 0) continue;

    for (const [name, status] of libkeyEntries) {
      const libInfo = sys.libraries.find(l => l.short === name || l.formal === name);
      const li = document.createElement('li');
      li.className = 'lib-item';

      const systemNameDiv = document.createElement('div');
      systemNameDiv.className = 'system-name';
      systemNameDiv.textContent = sys.systemname;

      const row = document.createElement('div');
      row.className = 'lib-row';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'lib-name';
      if (libInfo) {
        nameDiv.innerHTML = `<a href="https://calil.jp/library/${libInfo.libid}/${encodeURIComponent(libInfo.formal)}" target="_blank" rel="noopener">${name}</a>`;
      } else {
        nameDiv.textContent = name;
      }

      const badge = document.createElement('span');
      badge.className = 'badge ' + statusBadgeClass(status);
      badge.textContent = status;

      row.append(nameDiv, badge);
      li.append(systemNameDiv, row);

      if (result.reserveurl) {
        const reserveDiv = document.createElement('div');
        reserveDiv.className = 'reserve-link';
        reserveDiv.innerHTML = `<a href="${result.reserveurl}" target="_blank" rel="noopener">予約ページへ →</a>`;
        li.appendChild(reserveDiv);
      }

      els.availabilityList.appendChild(li);
      anyRendered = true;
    }
  }

  els.availabilityStatus.textContent = anyRendered
    ? `更新: ${new Date().toLocaleTimeString('ja-JP')}`
    : 'この本の所蔵情報が見つかりませんでした。';
}

// ---------- Search form ----------

els.searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessage();
  els.availabilitySection.hidden = true;
  const query = els.searchInput.value.trim();
  if (!query) return;
  try {
    const books = await searchBooks(query);
    renderResults(books);
    if (books.length === 0) showMessage('該当する書籍が見つかりませんでした。');
  } catch (e) {
    showMessage(e.message);
  }
});

// ---------- Init ----------

populatePrefectures();
refreshDefaultSummary();
