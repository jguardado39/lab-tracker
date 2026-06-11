var STORE = 'gt_tracker_v2', HIST = 'gt_cal_v2';

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
    outTime: null,
    tag: 'General'
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

function renderTracker() {
  var s = state;
  var dot = document.getElementById('status-dot');
  var lbl = document.getElementById('status-label');
  var btnIn = document.getElementById('btn-in');
  var btnLunch = document.getElementById('btn-lunch');
  var btnOut = document.getElementById('btn-out');
  var llbl = document.getElementById('lunch-label');

  if (s.status === 'out' && !s.inTime) {
    dot.className = 'status-dot dot-out'; lbl.textContent = 'Clocked Out';
    btnIn.disabled = false; btnLunch.disabled = true; btnOut.disabled = true;
    llbl.textContent = 'Lunch';
  } else if (s.status === 'in') {
    dot.className = 'status-dot dot-in'; lbl.textContent = 'Working';
    btnIn.disabled = true; btnLunch.disabled = false; btnOut.disabled = false;
    llbl.textContent = 'Start Lunch';
  } else if (s.status === 'lunch') {
    dot.className = 'status-dot dot-lunch'; lbl.textContent = 'Lunch Break';
    btnIn.disabled = true; btnLunch.disabled = false; btnOut.disabled = true;
    llbl.textContent = 'End Lunch';
  } else if (s.status === 'done') {
    dot.className = 'status-dot dot-out'; lbl.textContent = 'Shift Ended';
    btnIn.disabled = true; btnLunch.disabled = true; btnOut.disabled = true;
  }

  document.getElementById('m-in').textContent = s.inTime ? fmt(s.inTime) : '—';
  document.getElementById('m-lunch').textContent = s.lunchStart ? (fmt(s.lunchStart) + (s.lunchEnd ? ' - ' + fmt(s.lunchEnd) : ' →')) : '—';
  document.getElementById('m-worked').textContent = dur(workedMs(s)) || '0h 0m';
  if(s.tag) document.getElementById('tag-select').value = s.tag;

  var entries = s.entries || [];
  document.getElementById('log-badge').textContent = entries.length;

  var logBody = document.getElementById('log-body');
  if (entries.length === 0) {
    logBody.innerHTML = '<div class="empty-text">No data logs yet.</div>';
  } else {
    logBody.innerHTML = entries.map(function(e, i) {
      var noteHtml = e.note ? '<div class="log-note">' + e.note + '</div>' : '';
      var badge = e.label === 'Clock in' || e.label === 'Manual entry' ? '<span class="tag-badge-inline">' + (s.tag || 'Lab') + '</span>' : '';
      return '<div class="log-entry"><div>' + badge + '<span style="font-weight:500;">' + e.label + '</span>' + noteHtml + '</div><span class="log-time">' + fmt(e.ts) + '</span></div>';
    }).join('');
  }

  document.getElementById('today-date').textContent = new Date().toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
}

function renderCal() {
  var h = loadHist();
  if (state.outTime) h[state.dateKey] = state;

  calculateWeeklyMetrics(h);
  calculateTagBreakdown(h);

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
    html += '<div class="' + cls + '"' + click + '>';
    html += '<div class="cal-day-num">' + d + '</div>';
    if (hasData) {
      html += '<div class="cal-hours">' + dur(wms) + '</div>';
      html += '<div class="cal-in-out">' + (rec.tag || 'Lab') + '</div>';
      html += '<div class="cal-bar" style="width:' + barW + '%"></div>';
    }
    html += '</div>';
  }

  var tail = (7 - ((startDow + lastDay) % 7)) % 7;
  for (var i = 0; i < tail; i++) html += '<div class="cal-cell other-month"></div>';
  document.getElementById('cal-grid').innerHTML = html;

  if (selectedDay && h[selectedDay]) renderDetail(h[selectedDay]);
}

function calculateWeeklyMetrics(history) {
  var now = new Date();
  var currentDayOfWeek = now.getDay(); 
  var startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - currentDayOfWeek);
  
  var weeklyMs = 0;
  for (var i = 0; i < 7; i++) {
    var checkDate = new Date(startOfWeek);
    checkDate.setDate(startOfWeek.getDate() + i);
    var key = checkDate.getFullYear() + '-' + pad(checkDate.getMonth()+1) + '-' + pad(checkDate.getDate());
    if (history[key]) weeklyMs += workedMs(history[key]);
  }

  var weeklyHours = weeklyMs / (3600000);
  var targetHours = 40.0;
  var pct = Math.min(100, Math.round((weeklyHours / targetHours) * 100));
  
  document.getElementById('weekly-hours-text').textContent = weeklyHours.toFixed(1) + ' / ' + targetHours.toFixed(1) + ' hrs';
  document.getElementById('weekly-progress-bar').style.width = pct + '%';
}

function calculateTagBreakdown(history) {
  var totals = {};
  var grandTotalMs = 0;

  Object.keys(history).forEach(function(key) {
    var rec = history[key];
    if (rec && rec.inTime) {
      var t = rec.tag || 'General';
      var ms = workedMs(rec);
      totals[t] = (totals[t] || 0) + ms;
      grandTotalMs += ms;
    }
  });

  var container = document.getElementById('tag-breakdown-body');
  if (grandTotalMs === 0) {
    container.innerHTML = '<div class="empty-text">No project breakdown entries.</div>';
    return;
  }

  var html = Object.keys(totals).map(function(tag) {
    var ms = totals[tag];
    var pct = Math.round((ms / grandTotalMs) * 100);
    return '<div class="tag-stat-item">' +
             '<div class="tag-stat-meta">' +
               '<span>' + tag + ' (' + pct + '%)</span>' +
               '<strong>' + dur(ms) + '</strong>' +
             '</div>' +
             '<div class="tag-stat-bar-bg">' +
               '<div class="tag-stat-bar-fill" style="width:' + pct + '%"></div>' +
             '</div>' +
           '</div>';
  }).join('');
  
  container.innerHTML = html;
}

function selectDay(k) {
  selectedDay = k;
  var h = loadHist();
  if (state.outTime) h[state.dateKey] = state;
  renderCal();
}

function renderDetail(rec) {
  var d = new Date(selectedDay + 'T12:00:00');
  var label = d.toLocaleDateString([], {month:'short', day:'numeric'});
  
  // Clear the header container first
  var headerEl = document.getElementById('detail-header');
  headerEl.innerHTML = '';
  
  // Create a clean text label span
  var titleSpan = document.createElement('span');
  titleSpan.textContent = label + ' Log · ' + dur(workedMs(rec));
  headerEl.appendChild(titleSpan);
  
  // Programmatically build the delete button to prevent HTML string syntax errors
  var delBtn = document.createElement('button');
  delBtn.className = 'btn btn-sm';
  delBtn.style.cssText = 'color:var(--amber); border-color:rgba(239,159,39,0.2); background:transparent; padding:2px 8px; margin-left:auto; display:inline-flex; align-items:center; gap:4px; font-size:11px; font-family:var(--font);';
  delBtn.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i> Delete';
  
  // Bind click event cleanly
  delBtn.onclick = function(e) {
    if (e) e.stopPropagation(); // Stops the grid click listener from conflicting
    deleteSelectedDay();
  };
  
  headerEl.appendChild(delBtn);
    
  var entries = rec.entries || [];
  if (entries.length === 0) {
    document.getElementById('detail-body').innerHTML = '<div class="empty-text">No entries.</div>';
  } else {
    document.getElementById('detail-body').innerHTML = entries.map(function(e) {
      var noteHtml = e.note ? '<div class="log-note">' + e.note + '</div>' : '';
      var badge = e.label === 'Clock in' || e.label === 'Manual entry' ? '<span class="tag-badge-inline">' + (rec.tag || 'Lab') + '</span>' : '';
      return '<div class="log-entry"><div>' + badge + '<span style="font-weight:500;">' + e.label + '</span>' + noteHtml + '</div><span class="log-time">' + fmt(e.ts) + '</span></div>';
    }).join('');
  }
}

function deleteSelectedDay() {
  if (!selectedDay) {
    alert("No day selected to delete.");
    return;
  }
  
  var d = new Date(selectedDay + 'T12:00:00');
  var label = d.toLocaleDateString([], {month:'short', day:'numeric'});
  
  if (confirm("Are you sure you want to delete all logged data for " + label + "?")) {
    var h = loadHist();
    
    // Explicitly delete key from map
    if (h.hasOwnProperty(selectedDay)) {
      delete h[selectedDay];
      saveHist(h);
    }
    
    // If it's today, reset the live clock session state variables completely
    if (selectedDay === todayKey()) {
      state = mkFresh();
      saveToday(state);
    }
    
    // Re-initialize values to base configurations 
    selectedDay = null;
    document.getElementById('detail-header').textContent = 'History Details';
    document.getElementById('detail-body').innerHTML = '<div class="empty-text">Select a day.</div>';
    
    // Refresh the UI blocks completely
    renderTracker();
    renderCal();
  }
}

function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } selectedDay = null; renderCal(); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } selectedDay = null; renderCal(); }
function getNote() { return document.getElementById('note-input').value.trim(); }
function getActiveTag() { return document.getElementById('tag-select').value; }

function clockIn() {
  var now = Date.now();
  state = { dateKey: todayKey(), entries: [{ label: 'Clock in', ts: now, note: getNote() }], status: 'in', inTime: now, lunchStart: null, lunchEnd: null, outTime: null, tag: getActiveTag() };
  document.getElementById('note-input').value = '';
  saveToday(state); renderTracker(); renderCal();
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
  saveToday(state); renderTracker(); renderCal();
}
function clockOut() {
  var now = Date.now();
  state.outTime = now; state.status = 'done';
  if (state.lunchStart && !state.lunchEnd) state.lunchEnd = now;
  state.entries.push({ label: 'Clock out', ts: now, note: getNote() });
  document.getElementById('note-input').value = '';
  saveToday(state); archiveToday(); renderTracker(); renderCal();
}

/* DYNAMIC FIELD TOGGLING SYSTEM */
function toggleModalFields() {
  var type = document.getElementById('m-type').value;
  var boxIn = document.getElementById('box-in');
  var boxOut = document.getElementById('box-out');
  var boxLunch = document.getElementById('box-lunch-dur');
  var rowTimes = document.getElementById('row-times');
  var lblIn = document.getElementById('lbl-clock-in');

  // Reset visibilities
  rowTimes.style.display = "grid";
  boxIn.style.display = "flex";
  boxOut.style.display = "flex";
  boxLunch.style.display = "flex";
  lblIn.textContent = "Clock In Time";

  if (type === 'in') {
    boxOut.style.display = "none";
    boxLunch.style.display = "none";
  } else if (type === 'out') {
    boxIn.style.display = "none";
    boxLunch.style.display = "none";
  } else if (type === 'lunch') {
    boxOut.style.display = "none";
    boxLunch.style.display = "none";
    lblIn.textContent = "Break Time Timestamp"; // Re-label input for clarity
  }
}

function openManualModal() {
  var todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('m-type').value = "full";
  document.getElementById('m-date').value = todayStr;
  document.getElementById('m-clock-in').value = "09:00";
  document.getElementById('m-clock-out').value = "17:00";
  document.getElementById('m-lunch-dur').value = "0";
  document.getElementById('m-note').value = "";
  document.getElementById('m-tag').value = "General";
  
  toggleModalFields();
  document.getElementById('manual-modal').classList.add('active');
}

function closeManualModal() {
  document.getElementById('manual-modal').classList.remove('active');
}

function submitManualEntry() {
  var typeVal = document.getElementById('m-type').value;
  var dateVal = document.getElementById('m-date').value;
  var inVal = document.getElementById('m-clock-in').value;
  var outVal = document.getElementById('m-clock-out').value;
  var tagVal = document.getElementById('m-tag').value;
  var lunchMin = parseInt(document.getElementById('m-lunch-dur').value) || 0;
  var noteVal = document.getElementById('m-note').value.trim();

  if (!dateVal) { alert('Please select a valid date.'); return; }

  var h = loadHist();
  // Fetch existing day entry if it exists, or generate a fresh baseline
  var dayRecord = h[dateVal] || {
    dateKey: dateVal,
    status: 'done',
    inTime: null,
    lunchStart: null,
    lunchEnd: null,
    outTime: null,
    tag: tagVal,
    entries: []
  };

  var baseTsStr = dateVal + 'T';

  // HANDLE SINGLE TIMESTAMPS OR FULL CODES
  if (typeVal === 'full') {
    if (!inVal || !outVal) { alert('Please enter both In and Out times.'); return; }
    var inTs = Date.parse(baseTsStr + inVal);
    var outTs = Date.parse(baseTsStr + outVal);
    
    if (outTs <= inTs) { alert('Clock Out must follow Clock In.'); return; }
    var lunchMs = lunchMin * 60 * 1000;
    
    dayRecord.inTime = inTs;
    dayRecord.outTime = outTs;
    if (lunchMs > 0) {
      dayRecord.lunchStart = inTs + 1000;
      dayRecord.lunchEnd = inTs + 1000 + lunchMs;
    }
    dayRecord.tag = tagVal;
    dayRecord.entries.push({ label: 'Manual entry', ts: inTs, note: noteVal || 'Full shift entry logged.' });

  } else if (typeVal === 'in') {
    if (!inVal) { alert('Please enter an arrival time.'); return; }
    var ts = Date.parse(baseTsStr + inVal);
    dayRecord.inTime = ts;
    dayRecord.tag = tagVal;
    dayRecord.entries.push({ label: 'Clock in', ts: ts, note: noteVal || 'Manual punch override' });

  } else if (typeVal === 'out') {
    if (!outVal) { alert('Please enter a departure time.'); return; }
    var ts = Date.parse(baseTsStr + outVal);
    dayRecord.outTime = ts;
    dayRecord.entries.push({ label: 'Clock out', ts: ts, note: noteVal || 'Manual punch override' });

  } else if (typeVal === 'lunch') {
    if (!inVal) { alert('Please enter a timestamp for the break.'); return; }
    var ts = Date.parse(baseTsStr + inVal);
    dayRecord.entries.push({ label: 'Lunch start', ts: ts, note: noteVal || 'Manual break marker' });
  }

  // Save changes to database map
  h[dateVal] = dayRecord;
  saveHist(h);

  // Sync if mutating today's active session state variables
  if (dateVal === todayKey()) {
    state = dayRecord;
    saveToday(state);
  }

  closeManualModal();
  selectedDay = dateVal;
  renderTracker();
  renderCal();
}

document.getElementById('tag-select').addEventListener('change', function(e) {
  if (state.status === 'out') { state.tag = e.target.value; saveToday(state); }
});

setInterval(function() {
  var d = new Date();
  // Live clock displaying hour and minutes cleanly without seconds
  document.getElementById('live-clock').textContent = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  
  if (state.dateKey !== todayKey()) {
    state = loadToday();
    renderTracker();
    renderCal();
  }
  if (state.status === 'in' || state.status === 'lunch') {
    document.getElementById('m-worked').textContent = dur(workedMs(state));
  }
}, 1000);

renderTracker();
renderCal();