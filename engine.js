// ChargePlan engine - EV off-peak charging schedule (no DOM)
(function (root) {
  'use strict';

  function clampPct(p) { return Math.max(0, Math.min(100, Number(p) || 0)); }

  // kWh needed to go from pctNow to pctTarget on a capacity-kWh pack.
  function energyNeeded(capKwh, pctNow, pctTarget) {
    var cap = Math.max(0, Number(capKwh) || 0);
    var from = clampPct(pctNow), to = clampPct(pctTarget);
    if (to <= from) return 0;
    // charging tapers near full: add 10% time penalty above 80% handled in minutesNeeded
    return Math.round(cap * (to - from) / 100 * 10) / 10;
  }

  // Minutes to deliver kwh at kw, with taper above 80% state of charge.
  function minutesNeeded(kwh, kw, capKwh, pctNow, pctTarget) {
    var rate = Math.max(0.1, Number(kw) || 0);
    var cap = Math.max(1, Number(capKwh) || 1);
    var from = clampPct(pctNow), to = clampPct(pctTarget);
    if (kwh <= 0) return 0;
    // portion of the charge that lands above 80% SoC runs at 60% speed
    var hi = Math.max(0, to - Math.max(from, 80));
    var lo = Math.max(0, Math.min(to, 80) - from);
    var mins = (lo / 100 * cap) / rate * 60 + (hi / 100 * cap) / (rate * 0.6) * 60;
    return Math.ceil(mins);
  }

  // Expand a repeating window (startMin, endMin, may wrap midnight) into concrete
  // [start, end) intervals in minutes relative to `fromMin`, covering `spanMin` ahead.
  function expandWindow(startMin, endMin, fromMin, spanMin) {
    var out = [];
    var dur = (endMin - startMin + 1440) % 1440;
    if (dur === 0) dur = 1440;
    var first = startMin;
    while (first < fromMin) first += 1440;
    first -= 1440; // include a window that started before fromMin
    for (var s = first; s < fromMin + spanMin; s += 1440) {
      var a = Math.max(s, fromMin), b = s + dur;
      if (b > a) out.push({ start: a, end: b });
    }
    return out;
  }

  // Plan charging within a cheap window to finish by deadlineMin (minutes, timeline base = nowMin).
  // nowMin: current minutes-of-day. deadlineMin: minutes-of-day to be ready (may be tomorrow).
  // winStart/winEnd: cheap window minutes-of-day (may wrap).
  // Returns {sessions:[{start,end}], totalMin, finishMin, verdict, slackMin}
  function plan(nowMin, deadlineMin, neededMin, winStart, winEnd) {
    // normalize deadline onto the timeline: next occurrence of deadlineMin after nowMin
    var dl = deadlineMin;
    if (dl <= nowMin) dl += 1440;
    var span = dl - nowMin + 60; // small buffer past deadline for window expansion
    var windows = expandWindow(winStart, winEnd, nowMin, span)
      .filter(function (w) { return w.start < dl; })
      .map(function (w) { return { start: w.start, end: Math.min(w.end, dl) }; });
    var available = 0;
    windows.forEach(function (w) { available += w.end - w.start; });

    var sessions = [], left = neededMin, cursor = nowMin;
    for (var i = 0; i < windows.length && left > 0; i++) {
      var w = windows[i];
      var s = Math.max(w.start, cursor);
      var take = Math.min(w.end - s, left);
      if (take > 0) { sessions.push({ start: s, end: s + take }); left -= take; cursor = s + take; }
    }
    var charged = neededMin - left;
    var finishMin = sessions.length ? sessions[sessions.length - 1].end : nowMin;
    var verdict, slackMin = Math.round(dl - finishMin);
    if (neededMin === 0) verdict = 'already-there';
    else if (left > 0) verdict = available < neededMin ? 'wont-fit' : 'needs-now';
    else if (slackMin <= 30) verdict = 'tight';
    else verdict = 'comfortable';
    return {
      sessions: sessions, totalMin: neededMin, chargedMin: charged,
      finishMin: finishMin, deadlineAbs: dl, slackMin: slackMin, verdict: verdict,
      availableMin: available
    };
  }

  function cost(kwh, ratePerKwh) {
    return Math.round(kwh * (Number(ratePerKwh) || 0) * 100) / 100;
  }

  function fmt(minutesOfDay) {
    var m = ((Math.round(minutesOfDay) % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    var ap = h >= 12 ? 'PM' : 'AM';
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':' + String(mm).padStart(2, '0') + ' ' + ap;
  }

  function fmtDay(minutesOfDay, nowMin) {
    var label = fmt(minutesOfDay);
    if (minutesOfDay >= 1440 && Math.floor(minutesOfDay / 1440) > Math.floor(nowMin / 1440)) return label + ' tomorrow';
    if (minutesOfDay >= 1440) return label + ' (+1d)';
    return label;
  }

  var api = { energyNeeded: energyNeeded, minutesNeeded: minutesNeeded, expandWindow: expandWindow,
    plan: plan, cost: cost, fmt: fmt, fmtDay: fmtDay, clampPct: clampPct };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChargeEngine = api;
})(typeof self !== 'undefined' ? self : this);
