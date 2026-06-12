// LocalStorage keys: track running state and historical database separately
var STORE = 'gt_tracker_v3', HIST = 'gt_hist_v3';

function loadToday() {
  try {
    var stored = JSON.parse(localStorage.getItem(STORE));
    if (stored && stored.dateKey === todayKey()) return stored;
    // Auto-archive previous shifts if page left open overnight
    if (stored && stored.inTime) {
      var h = loadHist();
      h[stored.dateKey] = stored;
      saveHist(h);
    }
    return mkFresh();
  } catch(e) {
    return mkFresh();
  }
}

function mkFresh() { 
  return { dateKey: todayKey(), status: 'out', inTime: null, lunchStart: null, lunchEnd: null, outTime: null }; 
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

var activeEditingKey = null;

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function dur(ms) {
  if (!ms || ms <= 0) return '';
  var m = Math.round(ms / 60000);
  var h = Math.floor(m / 60), r = m % 60;
  return h > 0 ? h + 'h' : r + 'm'; // Ultra short duration to fit small cells
}

function workedMs(s) {
  if (!s || !s.inTime) return 0;
  var end = s.outTime || Date.now();
  var total = end - s.inTime;
  if (s.lunchStart && s.lunchEnd) total -= (s.lunchEnd - s.lunchStart);
  else if (s.lunchStart && !s.lunchEnd) total -= (end - s.lunchStart);
  return Math.max(0, total);
}

function renderTracker() {
  var s = state;
  var btnIn = document.getElementById('btn-in');
  var btnLunch = document.getElementById('btn-lunch');
  var btnOut = document.getElementById('btn-out');
  var llbl = document.getElementById('lunch-label');

  if (s.status === 'out' && !s.inTime) {
    btnIn.disabled = false; btnLunch.disabled = true; btnOut.disabled = true;
    llbl.textContent = 'Lunch';
  } else if (s.status === 'in') {
    btnIn.disabled = true; btnLunch.disabled = false; btnOut.disabled = false;
    llbl.textContent = 'Start Lunch';
  } else if (s.status === 'lunch') {
    btnIn.disabled = true; btnLunch.disabled = false; btnOut.disabled = true;
    llbl.textContent = 'End Lunch';
  } else if (s.status === 'done') {
    btnIn.disabled = true; btnLunch.disabled = true; btnOut.disabled = true;
  }

  // FIXED: Removed the old reference calls to dead metrics elements (m-in, m-lunch, m-worked)
  document.getElementById('today-date').textContent = new Date().toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
}

function renderCal() {
  var h = loadHist();
  if (state.inTime) h[state.dateKey] = state; 

  // --- WEEKLY HOURS TRACKER CALCULATION ---
  var now = new Date();
  var currentDayOfWeek = now.getDay(); 
  var startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - currentDayOfWeek);
  
  var weeklyMs = 0;
  for (var i = 0; i < 7; i++) {
    var checkDate = new Date(startOfWeek);
    checkDate.setDate(startOfWeek.getDate() + i);
    var key = checkDate.getFullYear() + '-' + pad(checkDate.getMonth()+1) + '-' + pad(checkDate.getDate());
    if (h[key]) {
      weeklyMs += workedMs(h[key]);
    }
  }

  var weeklyHours = weeklyMs / 3600000;
  var targetHours = 40.0;
  var pct = Math.min(100, Math.round((weeklyHours / targetHours) * 100));
  
  document.getElementById('weekly-hours-txt').textContent = weeklyHours.toFixed(1) + ' / ' + targetHours.toFixed(1) + ' hrs';
  document.getElementById('weekly-progress-fill').style.width = pct + '%';

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-title').textContent = MONTHS[calMonth] + ' ' + calYear;

  var lastDay = new Date(calYear, calMonth+1, 0).getDate();
  var startDow = new Date(calYear, calMonth, 1).getDay();
  var todK = todayKey();

  var html = '';
  for (var i = 0; i < startDow; i++) html += '<div class="cal-cell other-month"></div>';

  for (var d = 1; d <= lastDay; d++) {
    var k = calYear + '-' + pad(calMonth+1) + '-' + pad(d);
    var rec = h[k];
    var hasData = rec && rec.inTime;
    
    var cls = 'cal-cell';
    if (k === todK) cls += ' today';
    
    var clickAction = ' onclick="editDayHours(\'' + k + '\')"';
    
    html += '<div class="' + cls + '"' + clickAction + ' style="cursor: pointer;">';
    html += '<div class="cal-cell-num">' + d + '</div>';
    if (hasData) {
      html += '<div class="cal-cell-hours">' + dur(workedMs(rec)) + '</div>';
    }
    html += '</div>';
  }

  var tail = (7 - ((startDow + lastDay) % 7)) % 7;
  for (var i = 0; i < tail; i++) html += '<div class="cal-cell other-month"></div>';
  document.getElementById('cal-grid').innerHTML = html;
}

function tsToTimeInput(ts) {
  if (!ts) return "";
  var d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function combineDateAndTime(dateStr, timeStr) {
  if (!timeStr) return null;
  return Date.parse(dateStr + 'T' + timeStr + ':00');
}

function editDayHours(dateKey) {
  activeEditingKey = dateKey;
  var h = loadHist();
  var rec = h[dateKey] || { inTime: null, outTime: null, lunchStart: null, lunchEnd: null };

  document.getElementById('edit-date-lbl').textContent = dateKey;
  
  document.getElementById('edit-in').value = tsToTimeInput(rec.inTime);
  document.getElementById('edit-out').value = tsToTimeInput(rec.outTime);
  document.getElementById('edit-l-start').value = tsToTimeInput(rec.lunchStart);
  document.getElementById('edit-l-end').value = tsToTimeInput(rec.lunchEnd);

  document.getElementById('precision-editor').style.display = "flex";
}

function closeEditor() {
  activeEditingKey = null;
  document.getElementById('precision-editor').style.display = "none";
}

function savePrecisionChanges() {
  if (!activeEditingKey) return;
  var h = loadHist();

  var inVal = document.getElementById('edit-in').value;
  var outVal = document.getElementById('edit-out').value;
  var lStartVal = document.getElementById('edit-l-start').value;
  var lEndVal = document.getElementById('edit-l-end').value;

  if (!inVal && (outVal || lStartVal || lEndVal)) {
    alert("You must have at least a Clock In time to log a shift.");
    return;
  }

  if (!inVal) {
    delete h[activeEditingKey];
    if (activeEditingKey === todayKey()) state = mkFresh();
  } else {
    var computedIn = combineDateAndTime(activeEditingKey, inVal);
    var computedOut = combineDateAndTime(activeEditingKey, outVal);
    var computedLStart = combineDateAndTime(activeEditingKey, lStartVal);
    var computedLEnd = combineDateAndTime(activeEditingKey, lEndVal);

    if (computedOut && computedOut <= computedIn) {
      alert("Clock Out time must be later than Clock In time.");
      return;
    }
    if (computedLStart && computedLStart <= computedIn) {
      alert("Lunch Start must occur after your standard Clock In timestamp.");
      return;
    }
    if (computedLEnd && computedLStart && computedLEnd <= computedLStart) {
      alert("Lunch End must follow your Lunch Start arrival markers.");
      return;
    }

    h[activeEditingKey] = {
      dateKey: activeEditingKey,
      status: computedOut ? 'done' : 'in',
      inTime: computedIn,
      lunchStart: computedLStart,
      lunchEnd: computedLEnd,
      outTime: computedOut
    };
  }

  saveHist(h);
  if (activeEditingKey === todayKey()) {
    state = h[activeEditingKey] || mkFresh();
    saveToday(state);
  }

  closeEditor();
  renderTracker();
  renderCal();
}

function deleteDayDirect() {
  if (!activeEditingKey) return;
  if (confirm("Are you sure you want to completely erase all data logs for " + activeEditingKey + "?")) {
    var h = loadHist();
    delete h[activeEditingKey];
    saveHist(h);

    if (activeEditingKey === todayKey()) {
      state = mkFresh();
      saveToday(state);
    }
    closeEditor();
    renderTracker();
    renderCal();
  }
}

function clockIn() {
  var now = Date.now();
  state = { dateKey: todayKey(), status: 'in', inTime: now, lunchStart: null, lunchEnd: null, outTime: null };
  saveToday(state); renderTracker(); renderCal();
}

function toggleLunch() {
  var now = Date.now();
  if (state.status === 'in') {
    state.lunchStart = now; state.status = 'lunch';
  } else if (state.status === 'lunch') {
    state.lunchEnd = now; state.status = 'in';
  }
  saveToday(state); renderTracker(); renderCal();
}

function clockOut() {
  var now = Date.now();
  state.outTime = now; state.status = 'done';
  if (state.lunchStart && !state.lunchEnd) state.lunchEnd = now;
  saveToday(state);
  
  var h = loadHist();
  h[state.dateKey] = state;
  saveHist(h);
  
  renderTracker(); renderCal();
}

function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCal(); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCal(); }

setInterval(function() {
  var d = new Date();
  document.getElementById('live-clock').textContent = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  
  if (state.dateKey !== todayKey()) {
    state = loadToday();
    renderTracker();
    renderCal();
  }
  if (state.status === 'in' || state.status === 'lunch') {
    renderTracker();
    if (calMonth === new Date().getMonth() && calYear === new Date().getFullYear()) {
      renderCal(); 
    }
  }
}, 1000);

renderTracker();
renderCal();