var STORE = 'gt_tracker_v3';

function loadToday() {
  try {
    var stored = JSON.parse(localStorage.getItem(STORE));
    if (stored && stored.dateKey === todayKey()) return stored;
    return mkFresh();
  } catch(e) {
    return mkFresh();
  }
}

function mkFresh() { 
  return { 
    dateKey: todayKey(), 
    status: 'out', 
    inTime: null, 
    lunchStart: null, 
    lunchEnd: null, 
    outTime: null
  }; 
}

function saveToday(s) { localStorage.setItem(STORE, JSON.stringify(s)); }

function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
}
function pad(n) { return String(n).padStart(2,'0'); }

var state = loadToday();

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function dur(ms) {
  if (!ms || ms <= 0) return '0h 0m';
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
  document.getElementById('m-worked').textContent = dur(workedMs(s)) || '0h 0m';
  document.getElementById('today-date').textContent = new Date().toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
}

function clockIn() {
  var now = Date.now();
  state = { dateKey: todayKey(), status: 'in', inTime: now, lunchStart: null, lunchEnd: null, outTime: null };
  saveToday(state); renderTracker();
}

function toggleLunch() {
  var now = Date.now();
  if (state.status === 'in') {
    state.lunchStart = now; state.status = 'lunch';
  } else if (state.status === 'lunch') {
    state.lunchEnd = now; state.status = 'in';
  }
  saveToday(state); renderTracker();
}

function clockOut() {
  var now = Date.now();
  state.outTime = now; state.status = 'done';
  if (state.lunchStart && !state.lunchEnd) state.lunchEnd = now;
  saveToday(state); renderTracker();
}

setInterval(function() {
  var d = new Date();
  document.getElementById('live-clock').textContent = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  
  if (state.dateKey !== todayKey()) {
    state = loadToday();
    renderTracker();
  }
  if (state.status === 'in' || state.status === 'lunch') {
    document.getElementById('m-worked').textContent = dur(workedMs(state));
  }
}, 1000);

renderTracker();