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

  document.getElementById('m-in').textContent = s.inTime ? fmt(s.inTime) : '—';
  document.getElementById('m-lunch').textContent = s.lunchStart ? (fmt(s.lunchStart) + (s.lunchEnd ? ' - ' + fmt(s.lunchEnd) : ' →')) : '—';
  document.getElementById('m-worked').textContent = s.inTime ? (Math.round(workedMs(s) / 60000 / 60 * 10) / 10) + 'h' : '0h';
  document.getElementById('today-date').textContent = new Date().toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
}

function renderCal() {
  var h = loadHist();
  if (state.inTime) h[state.dateKey] = state; 

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
    if (hasData) cls += ' editable-cell'; // Adds a visual pointer style
    
    // Clicking a cell calls our new editing system
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
      renderCal(); // Update calendar cells dynamically if counting hours
    }
  }
}, 1000);

function editDayHours(dateKey) {
  var h = loadHist();
  var existingRecord = h[dateKey];
  
  // 1. If no data exists yet, offer to create a new manual entry baseline
  if (!existingRecord) {
    var newHours = prompt("No hours logged for " + dateKey + ".\nEnter total hours worked to create a log (e.g., 8 or 4.5):");
    if (newHours === null || newHours.trim() === "") return; // Cancelled
    
    var decimalHours = parseFloat(newHours);
    if (isNaN(decimalHours) || decimalHours < 0) {
      alert("Please enter a valid positive number.");
      return;
    }
    
    // Create mock timestamps matching the requested duration
    var mockIn = Date.parse(dateKey + 'T09:00:00');
    var mockOut = mockIn + (decimalHours * 60 * 60 * 1000);
    
    h[dateKey] = { dateKey: dateKey, status: 'done', inTime: mockIn, lunchStart: null, lunchEnd: null, outTime: mockOut };
    
  } else {
    // 2. If data already exists, prompt to modify or completely wipe it
    var currentHours = (workedMs(existingRecord) / 3600000).toFixed(1);
    var updatedInput = prompt(
      "Editing data for " + dateKey + ".\n" +
      "Current calculation: " + currentHours + " hours.\n\n" +
      "Enter new hours (or type '0' to delete this entire day's log):", 
      currentHours
    );
    
    if (updatedInput === null) return; // Cancelled
    var decimalHours = parseFloat(updatedInput);
    
    if (isNaN(decimalHours) || decimalHours < 0) {
      alert("Please enter a valid positive number.");
      return;
    }
    
    if (decimalHours === 0) {
      // Complete removal path
      delete h[dateKey];
      if (dateKey === todayKey()) state = mkFresh();
    } else {
      // Update data mapping properties smoothly
      var mockIn = Date.parse(dateKey + 'T09:00:00');
      var mockOut = mockIn + (decimalHours * 60 * 60 * 1000);
      
      h[dateKey].inTime = mockIn;
      h[dateKey].lunchStart = null;
      h[dateKey].lunchEnd = null;
      h[dateKey].outTime = mockOut;
      h[dateKey].status = 'done';
    }
  }
  
  // Save modifications globally and execute visual re-renders
  saveHist(h);
  if (dateKey === todayKey()) {
    if (h[dateKey]) state = h[dateKey];
    saveToday(state);
  }
  
  renderTracker();
  renderCal();
}

renderTracker();
renderCal();