// LocalStorage keys: track running state and historical database separately
var STORE = 'gt_tracker_v3', HIST = 'gt_hist_v3';

function loadToday() {
  try {
    var stored = JSON.parse(localStorage.getItem(STORE));
    if (stored && stored.dateKey === todayKey()) return stored;
    // FIX #4: Auto-archive previous shifts on midnight rollover.
    // Previously, archived incomplete shifts had no outTime, so workedMs()
    // would calculate up to Date.now() — making a shift from yesterday look
    // like it ran until right now. We now cap outTime at midnight of that day.
    if (stored && stored.inTime) {
      if (!stored.outTime) {
        // Set outTime to end-of-day (23:59:59) of the shift's date
        var shiftDate = new Date(stored.dateKey + 'T23:59:59');
        stored.outTime = shiftDate.getTime();
        stored.status = 'done';
      }
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
  // Convert milliseconds directly into decimal hours rounded to 1 decimal place
  var hours = ms / 3600000;
  return hours.toFixed(1) + 'h';
}

function workedMs(s) {
  if (!s || !s.inTime) return 0;
  
  // If the shift is completed, use the exact recorded outTime
  // Otherwise (if live tracking), default to the running clock (Date.now())
  var end = (s.status === 'done' && s.outTime) ? s.outTime : (s.outTime || Date.now());
  var total = end - s.inTime;
  
  // Factor in lunch subtractions dynamically
  if (s.lunchStart && s.lunchEnd) {
    total -= (s.lunchEnd - s.lunchStart);
  } else if (s.lunchStart && !s.lunchEnd) {
    total -= (end - s.lunchStart);
  }
  
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
    if (k === activeEditingKey) cls += ' selected';

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

  // FIX #3: Previously only read from loadHist(), so clicking today's cell while
  // clocked in showed blank fields — today's live state lives in STORE, not HIST,
  // until clock-out. Now we always prefer the live state object for today's key.
  var rec = (dateKey === todayKey())
    ? state
    : (h[dateKey] || { inTime: null, outTime: null, lunchStart: null, lunchEnd: null });

  document.getElementById('edit-date-lbl').textContent = dateKey;
  
  document.getElementById('edit-in').value = tsToTimeInput(rec.inTime);
  document.getElementById('edit-out').value = tsToTimeInput(rec.outTime);
  document.getElementById('edit-l-start').value = tsToTimeInput(rec.lunchStart);
  document.getElementById('edit-l-end').value = tsToTimeInput(rec.lunchEnd);

  document.getElementById('precision-editor').style.display = "flex";
  renderCal(); // re-render so the selected highlight appears immediately
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

  var editorPanel = document.getElementById('precision-editor');

  // 1. Basic Structure Validations
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

    // 2. Chronological Flow Validations
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
    if (computedOut && computedLStart && computedOut <= computedLStart) {
      alert("Clock Out must occur after your Lunch Start.");
      return;
    }
    if (computedOut && computedLEnd && computedOut <= computedLEnd) {
      alert("Clock Out must occur after your Lunch End.");
      return;
    }

    // 3. Smart Duration Threshold Checks
    var totalShiftMs = (computedOut || Date.now()) - computedIn;
    var lunchMs = (computedLStart && computedLEnd) ? (computedLEnd - computedLStart) : 0;
    var finalWorkedMs = totalShiftMs - lunchMs;
    var decimalHours = finalWorkedMs / 3600000;

    if (lunchMs > totalShiftMs) {
      editorPanel.classList.add('validation-flash');
      setTimeout(function() { editorPanel.classList.remove('validation-flash'); }, 1000);
      alert("Error: Your lunch break duration is longer than your total shift length.");
      return;
    }

    if (decimalHours > 16.0) {
      editorPanel.classList.add('validation-flash');
      setTimeout(function() { editorPanel.classList.remove('validation-flash'); }, 1000);
      
      var confirmExcessive = confirm(
        "⚠️ High Hours Warning:\n" +
        "These punches calculate to a " + decimalHours.toFixed(1) + " hour shift.\n\n" +
        "Are you sure this is correct?"
      );
      if (!confirmExcessive) return;
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
  // FIX #5: Previously, if the user forgot to end lunch before clocking out,
  // the entire lunch-to-clock-out window was silently marked as lunch,
  // which could wipe out hours. Now we warn and ask for confirmation first.
  if (state.status === 'lunch') {
    var confirmed = confirm(
      "You're currently on lunch.\n\nClick OK to end your lunch break and clock out now."
    );
    if (!confirmed) return;
    state.lunchEnd = Date.now();
    state.status = 'in';
  }

  var now = Date.now();
  state.outTime = now; state.status = 'done';
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
  
  // 1. Midnight rollover check: reset state if a new day starts
  if (state.dateKey !== todayKey()) {
    state = loadToday();
    renderTracker();
    renderCal();
  }
  
  // 2. Dynamic Browser Tab Clock Handler
  if (state.status === 'in' || state.status === 'lunch') {
    renderTracker();
    
    // If viewing the current month/year grid, keep calendar cell numbers counting up live
    if (calMonth === new Date().getMonth() && calYear === new Date().getFullYear()) {
      renderCal(); 
    }

    // Calculate active running decimal hours
    var activeLiveHours = workedMs(state) / 3600000;
    
    // Update browser tab string to show active count (e.g., "(3.4h) Lab Tracker")
    var statusPrefix = state.status === 'lunch' ? '⏸️ LUNCH ' : '';
    document.title = "(" + statusPrefix + activeLiveHours.toFixed(1) + "h) Lab Tracker";
    
  } else {
    // Standard default tab title when you are completely clocked out
    document.title = "Lab Time Tracker";
  }
}, 1000);

function exportHistoryToCSV() {
  var h = loadHist();
  
  // Mix in current running shift records so today's live activity is captured
  if (state.inTime) {
    h[state.dateKey] = state;
  }

  // Extract keys and sort them chronologically
  var sortedDates = Object.keys(h).sort();

  if (sortedDates.length === 0) {
    alert("There is no logged history data to export yet.");
    return;
  }

  // Build spreadsheet header line column arrays
  var csvLines = [
    "Date,Clock In,Lunch Start,Lunch End,Clock Out,Total Hours Worked"
  ];

  // Helper to format timestamp into human-readable 24hr time for spreadsheets
  function formatCsvTime(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // Iterate over database rows and populate spreadsheet lines
  for (var i = 0; i < sortedDates.length; i++) {
    var dateKey = sortedDates[i];
    var rec = h[dateKey];
    
    var hoursCalculated = (workedMs(rec) / 3600000).toFixed(1);

    var row = [
      dateKey,
      formatCsvTime(rec.inTime),
      formatCsvTime(rec.lunchStart),
      formatCsvTime(rec.lunchEnd),
      formatCsvTime(rec.outTime),
      hoursCalculated
    ];

    csvLines.push(row.join(","));
  }

  // Convert raw text arrays into a downloadable browser text data blob
  var csvString = csvLines.join("\n");
  var blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  var downloadUrl = URL.createObjectURL(blob);

  // Generate a temporary browser anchor link to trigger the download
  var downloadLink = document.createElement("a");
  downloadLink.setAttribute("href", downloadUrl);
  downloadLink.setAttribute("download", "lab_timecard_export_" + new Date().getFullYear() + ".csv");
  document.body.appendChild(downloadLink);
  
  downloadLink.click();
  document.body.removeChild(downloadLink);

  // FIX #8: Revoke the object URL to free memory. Previously this was never
  // called, leaving the blob URL alive for the entire page session.
  URL.revokeObjectURL(downloadUrl);
}

function generateConsoleBackup() {
  var h = loadHist();
  var totalRecords = Object.keys(h).length;
  
  if (totalRecords === 0) return;

  // FIX #7: Replace deprecated escape()/unescape() with a standards-compliant
  // approach using TextEncoder to handle the full Unicode range safely.
  var jsonString = JSON.stringify(h);
  var bytes = new TextEncoder().encode(jsonString);
  var binary = String.fromCharCode.apply(null, bytes);
  var backupCode = btoa(binary);

  console.log("================= LAB TRACKER AUTO-BACKUP =================");
  console.log("Your data is saved locally. If your browser cache is ever cleared,");
  console.log("open the console and paste the recovery command below:");
  console.log("");
  console.log("importBackup('" + backupCode + "')");
  console.log("");
  console.log("===========================================================");
}

function importBackup(backupCode) {
  try {
    // FIX #7: Decode using TextDecoder to match the updated generateConsoleBackup encoder.
    var binary = atob(backupCode);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    var jsonString = new TextDecoder().decode(bytes);
    var importedData = JSON.parse(jsonString);
    
    if (typeof importedData !== 'object' || importedData === null) {
      throw new Error("Invalid backup format.");
    }

    if (confirm("Found " + Object.keys(importedData).length + " historical days in this backup. Overwrite local data?")) {
      saveHist(importedData);
      renderCal();
      alert("Database successfully restored! Your calendar has been rebuilt.");
    }
  } catch (e) {
    alert("Error restoring data: Make sure you copied the entire importBackup('...') command exactly.");
    console.error(e);
  }
}

// Initial render
renderTracker();
renderCal();

// Fire the silent console backup on app launch
generateConsoleBackup();