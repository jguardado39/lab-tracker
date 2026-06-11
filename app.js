var STORE = 'gt_tracker_v1', HIST = 'gt_cal_v1';

function loadToday() {
  try {
    var stored = JSON.parse(localStorage.getItem(STORE));
    if (stored && stored.dateKey === todayKey()) {
      return stored;
    } else if (stored) {
      if (stored.inTime) {
        var h = loadHist();
        h[stored.dateKey] = stored;
        saveHist(h);
      }
    }
    return mkFresh();
  } catch(e) {
    return mkFresh();
  }
}

function mkFresh() { 
  return { 
    dateKey: todayKey(), 
    entries: [], 
    status: 'out', 
    inTime: null, 
    lunchStart: null, 
    lunchEnd: null, 
    outTime: null 
  }; 
}

function saveToday(s) { localStorage.setItem(STORE, JSON.stringify(s)); }
function loadHist() { try { return JSON.parse(localStorage.getItem(HIST)) || {}; } catch(e) { return {}; } }
function saveHist(h) { localStorage.setItem(HIST, JSON.stringify(h)); }

function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
}
function pad(n) { return String(n).padStart(2,'0'); }

var state = loadToday();
var calYear = new Date().getFullYear();
var calMonth = new Date().getMonth();
var selectedDay = null;

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}
function dur(ms) {
  if (!ms || ms <= 0) return '0m';
  var m = Math.round(ms / 60000);
  var h = Math.floor(m / 60), r = m % 60;
  return h > 0 ? h + 'h ' + r + 'm' : r + 'm';
}
function workedMs(s) {
  if (!s || !s.inTime) return 0;
  var end = s.outTime || Date.now();
  var total = end - s.inTime;
  if (s.lunchStart && s.lunchEnd) total -= (s.lunchEnd - s.lunchStart);
  else if (s.lunchStart && !s.lunchEnd) total -= (end - s.lunchStart);
  return Math.max(0, total);
}

function archiveToday() {
  if (!state.inTime || !state.outTime) return;
  var h = loadHist();
  h[state.dateKey] = JSON.parse(JSON.stringify(state));
  saveHist(h);
}

function switchTab(t) {
  var tabs = document.querySelectorAll('.tab');
  tabs[0].classList.toggle('active', t === 'tracker');
  tabs[1].classList.toggle('active', t === 'calendar');
  document.getElementById('view-tracker').classList.toggle('active', t === 'tracker');
  document.getElementById('view-calendar').classList.toggle('active', t === 'calendar');
  if (t === 'calendar') renderCal();
}

function renderTracker() {
  var s = state;
  var dot = document.getElementById('status-dot');
  var lbl = document.getElementById('status-label');
  var btnIn = document.getElementById('btn-in');
  var btnLunch = document.getElementById('btn-lunch');
  var btnOut = document.getElementById('btn-out');
  var llbl = document.getElementById('lunch-label');

  if (s.status === 'out' && !s.inTime) {
    dot.className = 'status-dot dot-out'; lbl.textContent = 'Not clocked in';
    btnIn.disabled = false; btnLunch.disabled = true; btnOut.disabled = true;
    llbl.textContent = 'Start lunch';
  } else if (s.status === 'in') {
    dot.className = 'status-dot dot-in'; lbl.textContent = 'Working';
    btnIn.disabled = true; btnLunch.disabled = false; btnOut.disabled = false;
    llbl.textContent = 'Start lunch';
  } else if (s.status === 'lunch') {
    dot.className = 'status-dot dot-lunch'; lbl.textContent = 'On lunch break';
    btnIn.disabled = true; btnLunch.disabled = false; btnOut.disabled = true;
    llbl.textContent = 'End lunch';
  } else if (s.status === 'done') {
    dot.className = 'status-dot dot-out'; lbl.textContent = 'Clocked out';
    btnIn.disabled = true; btnLunch.disabled = true; btnOut.disabled = true;
  }

  document.getElementById('m-in').textContent = s.inTime ? fmt(s.inTime) : '—';
  document.getElementById('m-lunch').textContent = s.lunchStart ? (fmt(s.lunchStart) + (s.lunchEnd ? ' – ' + fmt(s.lunchEnd) : ' →')) : '—';
  document.getElementById('m-worked').textContent = dur(workedMs(s)) || '0h 0m';

  var entries = s.entries || [];
  document.getElementById('log-badge').textContent = entries.length + (entries.length === 1 ? ' entry' : ' entries');

  var iconMap = {'Clock in':'ti-login','Clock out':'ti-logout','Lunch start':'ti-soup','Lunch end':'ti-arrow-back-up','Manual entry':'ti-file-pencil'};
  var logBody = document.getElementById('log-body');
  if (entries.length === 0) {
    logBody.innerHTML = '<div class="log-empty">No entries yet — clock in to start tracking.</div>';
  } else {
    logBody.innerHTML = entries.map(function(e, i) {
      var prev = i > 0 ? entries[i-1] : null;
      var elapsed = prev ? ' <span class="log-dur">+' + dur(e.ts - prev.ts) + '</span>' : '';
      var noteHtml = e.note ? ' <span class="log-note">· ' + e.note + '</span>' : '';
      var ic = iconMap[e.label] || 'ti-point';
      return '<div class="log-entry"><i class="ti ' + ic + ' log-icon" aria-hidden="true"></i><span class="log-label">' + e.label + noteHtml + '</span><span class="log-time">' + fmt(e.ts) + elapsed + '</span></div>';
    }).join('');
  }

  var dtEl = document.getElementById('day-total');
  if (s.outTime) { dtEl.style.display = 'flex'; document.getElementById('total-disp').textContent = dur(workedMs(s)); }
  else dtEl.style.display = 'none';

  document.getElementById('today-date').textContent = new Date().toLocaleDateString([], {weekday:'long', month:'long', day:'numeric'});
}

function renderCal() {
  var h = loadHist();
  if (state.outTime) h[state.dateKey] = state;

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-title').textContent = MONTHS[calMonth] + ' ' + calYear;

  var lastDay = new Date(calYear, calMonth+1, 0).getDate();
  var startDow = new Date(calYear, calMonth, 1).getDay();
  var todK = todayKey();

  var days = 0, totalMs = 0;
  for (var d = 1; d <= lastDay; d++) {
    var k = calYear + '-' + pad(calMonth+1) + '-' + pad(d);
    if (h[k] && h[k].inTime) { days++; totalMs += workedMs(h[k]); }
  }
  document.getElementById('cal-days').textContent = days;
  document.getElementById('cal-total').textContent = dur(totalMs) || '0h 0m';
  document.getElementById('cal-avg').textContent = days > 0 ? dur(Math.round(totalMs / days)) : '—';

  var maxMs = 9 * 3600000;
  var html = '';
  for (var i = 0; i < startDow; i++) html += '<div class="cal-cell other-month"></div>';

  for (var d = 1; d <= lastDay; d++) {
    var k = calYear + '-' + pad(calMonth+1) + '-' + pad(d);
    var rec = h[k];
    var hasData = rec && rec.inTime;
    var wms = hasData ? workedMs(rec) : 0;
    var barW = hasData ? Math.min(100, Math.round(wms / maxMs * 100)) : 0;
    var cls = 'cal-cell';
    if (k === todK) cls += ' today';
    if (hasData) cls += ' has-data';
    if (k === selectedDay) cls += ' selected';
    var click = ' onclick="selectDay(\'' + k + '\')"';
    html += '<button class="' + cls + '"' + click + '>';
    html += '<div class="cal-day-num">' + d + '</div>';
    if (hasData) {
      html += '<div class="cal-hours">' + dur(wms) + '</div>';
      html += '<div class="cal-bar" style="width:' + barW + '%"></div>';
      html += '<div class="cal-in-out">' + fmt(rec.inTime) + ' – ' + fmt(rec.outTime) + '</div>';
    }
    html += '</button>';
  }

  var tail = (7 - ((startDow + lastDay) % 7)) % 7;
  for (var i = 0; i < tail; i++) html += '<div class="cal-cell other-month"></div>';
  document.getElementById('cal-grid').innerHTML = html;

  if (selectedDay && h[selectedDay]) renderDetail(h[selectedDay]);
}

function selectDay(k) {
  selectedDay = k;
  var h = loadHist();
  if (state.outTime) h[state.dateKey] = state;
  renderCal();
}

function renderDetail(rec) {
  var d = new Date(selectedDay + 'T12:00:00');
  var label = d.toLocaleDateString([], {weekday:'long', month:'long', day:'numeric', year:'numeric'});
  document.getElementById('detail-header').textContent = label + ' · ' + dur(workedMs(rec));
  var entries = rec.entries || [];
  var iconMap = {'Clock in':'ti-login','Clock out':'ti-logout','Lunch start':'ti-soup','Lunch end':'ti-arrow-back-up','Manual entry':'ti-file-pencil'};
  if (entries.length === 0) {
    document.getElementById('detail-body').innerHTML = '<div class="detail-empty">No log entries for this day.</div>';
  } else {
    document.getElementById('detail-body').innerHTML = entries.map(function(e, i) {
      var prev = i > 0 ? entries[i-1] : null;
      var elapsed = prev ? ' <span class="log-dur">+' + dur(e.ts - prev.ts) + '</span>' : '';
      var noteHtml = e.note ? ' <span class="log-note">· ' + e.note + '</span>' : '';
      var ic = iconMap[e.label] || 'ti-point';
      return '<div class="log-entry"><i class="ti ' + ic + ' log-icon" aria-hidden="true"></i><span class="log-label">' + e.label + noteHtml + '</span><span class="log-time">' + fmt(e.ts) + elapsed + '</span></div>';
    }).join('');
  }
}

function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } selectedDay = null; renderCal(); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } selectedDay = null; renderCal(); }
function getNote() { return document.getElementById('note-input').value.trim(); }

function clockIn() {
  var now = Date.now();
  state = { dateKey: todayKey(), entries: [{ label: 'Clock in', ts: now, note: getNote() }], status: 'in', inTime: now, lunchStart: null, lunchEnd: null, outTime: null };
  document.getElementById('note-input').value = '';
  saveToday(state); renderTracker();
}
function toggleLunch() {
  var now = Date.now();
  if (state.status === 'in') {
    state.lunchStart = now; state.status = 'lunch';
    state.entries.push({ label: 'Lunch start', ts: now, note: getNote() });
  } else if (state.status === 'lunch') {
    state.lunchEnd = now; state.status = 'in';
    state.entries.push({ label: 'Lunch end', ts: now, note: getNote() });
  }
  document.getElementById('note-input').value = '';
  saveToday(state); renderTracker();
}
function clockOut() {
  var now = Date.now();
  state.outTime = now; state.status = 'done';
  if (state.lunchStart && !state.lunchEnd) state.lunchEnd = now;
  state.entries.push({ label: 'Clock out', ts: now, note: getNote() });
  document.getElementById('note-input').value = '';
  saveToday(state); archiveToday(); renderTracker();
}

/* MODAL CONFIG & LOGIC FOR MANUAL ENTRIES */
function openManualModal() {
  var todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('m-date').value = todayStr;
  document.getElementById('m-clock-in').value = "09:00";
  document.getElementById('m-clock-out').value = "17:00";
  document.getElementById('m-lunch-dur').value = "0";
  document.getElementById('m-note').value = "";
  document.getElementById('manual-modal').classList.add('active');
}
function closeManualModal() {
  document.getElementById('manual-modal').classList.remove('active');
}
function submitManualEntry() {
  var dateVal = document.getElementById('m-date').value;
  var inVal = document.getElementById('m-clock-in').value;
  var outVal = document.getElementById('m-clock-out').value;
  var lunchMin = parseInt(document.getElementById('m-lunch-dur').value) || 0;
  var noteVal = document.getElementById('m-note').value.trim();

  if (!dateVal || !inVal || !outVal) {
    alert('Please fill out all date and time parameters.');
    return;
  }

  var inTs = Date.parse(dateVal + 'T' + inVal);
  var outTs = Date.parse(dateVal + 'T' + outVal);

  if (outTs <= inTs) {
    alert('Clock out time must happen after your Clock In time.');
    return;
  }

  var lunchMs = lunchMin * 60 * 1000;
  if ((outTs - inTs) <= lunchMs) {
    alert('Lunch duration cannot be longer than total hours logged.');
    return;
  }

  var targetKey = dateVal; 
  var mockRecord = {
    dateKey: targetKey,
    status: 'done',
    inTime: inTs,
    lunchStart: lunchMs > 0 ? inTs + 1000 : null,
    lunchEnd: lunchMs > 0 ? inTs + 1000 + lunchMs : null,
    outTime: outTs,
    entries: [
      { label: 'Manual entry', ts: inTs, note: noteVal || 'Logged retroactively' }
    ]
  };

  var h = loadHist();
  h[targetKey] = mockRecord;
  saveHist(h);

  if (targetKey === todayKey()) {
    state = mockRecord;
    saveToday(state);
    renderTracker();
  }

  closeManualModal();
  selectedDay = targetKey;
  renderCal();
}

setInterval(function() {
  var d = new Date();
  document.getElementById('live-clock').textContent = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  
  if (state.dateKey !== todayKey()) {
    state = loadToday();
    renderTracker();
    if (document.getElementById('view-calendar').classList.contains('active')) {
      renderCal();
    }
  }

  if (state.status === 'in' || state.status === 'lunch') {
    document.getElementById('m-worked').textContent = dur(workedMs(state));
  }
}, 1000);

renderTracker();