// java.js - Adds music commands (YouTube/Spotify) + alarm system + robust open-any-website resolver
// Uploaded logo path (if needed in HTML): /mnt/data/34ab347a-1250-4a11-b21f-01ed9de737ef.png

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('#btn');
  const content = document.querySelector('#content');
  const voice = document.querySelector('#voice');

  // --- speech synthesis helper ---
  function speak(text, lang = "en-IN", rate = 1, pitch = 1) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    window.speechSynthesis.speak(u);
  }

  // --- greeting on load ---
  function wishme() {
    const now = new Date();
    const h = now.getHours();
    if (h < 12) speak("Good morning sir! I am Shifra. How can I help you?");
    else if (h < 18) speak("Good afternoon sir! I am Shifra. How can I help you?");
    else speak("Good evening sir! I am Shifra. How can I help you?");
  }
  window.addEventListener('load', wishme);

  // --- Notification permission (for alarms) ---
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission().then(permission => {
      console.log('Notification permission:', permission);
    });
  }

  // --- SpeechRecognition setup ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (content) content.innerText = "SpeechRecognition not supported. Use Chrome/Edge.";
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  let listening = false;

  recognition.onstart = () => {
    listening = true;
    if (content) content.innerText = 'Listening...';
    if (btn) btn.style.display = 'none';
    if (voice) voice.style.display = 'block';
  };
  recognition.onend = () => {
    listening = false;
    if (btn) btn.style.display = 'flex';
    if (voice) voice.style.display = 'none';
  };
  recognition.onerror = (event) => {
    console.error('Recognition error', event);
    if (content) content.innerText = 'Recognition error: ' + (event.error || 'unknown');
    if (btn) btn.style.display = 'flex';
    if (voice) voice.style.display = 'none';
    // auto-restart on no-speech
    if (event.error === 'no-speech') {
      setTimeout(() => {
        try { recognition.start(); } catch (e) {}
      }, 300);
    }
  };
  recognition.onresult = (event) => {
    const transcript = event.results[event.resultIndex][0].transcript.trim();
    console.log('Transcript:', transcript);
    if (content) content.innerText = transcript;
    handleCommand(transcript.toLowerCase());
  };

  if (btn) {
    btn.addEventListener('click', () => {
      try {
        recognition.start();
      } catch (e) {
        console.warn('Start error', e);
      }
    });
  }

  // --- Alarm system (unchanged) ---
  let alarms = JSON.parse(localStorage.getItem('va_alarms') || '[]');
  let alarmTimers = {}; // id -> timerId

  function saveAlarms() {
    localStorage.setItem('va_alarms', JSON.stringify(alarms));
  }

  function scheduleAlarm(alarm) {
    const now = Date.now();
    const delay = alarm.when - now;
    if (delay <= 0) {
      triggerAlarm(alarm);
      return;
    }
    if (alarmTimers[alarm.id]) clearTimeout(alarmTimers[alarm.id]);
    alarmTimers[alarm.id] = setTimeout(() => {
      triggerAlarm(alarm);
      alarms = alarms.filter(a => a.id !== alarm.id);
      saveAlarms();
      delete alarmTimers[alarm.id];
    }, delay);
    console.log('Scheduled alarm', alarm.id, 'in', Math.round(delay/1000), 'seconds');
  }

  function triggerAlarm(alarm) {
    const msg = alarm.label ? `Alarm: ${alarm.label}` : 'Alarm ringing';
    speak(msg);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Alarm', { body: alarm.label || 'Alarm', silent: false });
    }
    if (alarm.url) openUrl(alarm.url, true);
  }

  alarms.forEach(scheduleAlarm);

  function nextAlarmId() {
    return Date.now() + Math.floor(Math.random()*1000);
  }

  function parseRelativeTime(text) {
    const inMatch = text.match(/in\s+(\d+)\s*(second|seconds|minute|minutes|hour|hours)/);
    if (!inMatch) return null;
    const num = parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    let ms = 0;
    if (unit.startsWith('second')) ms = num * 1000;
    else if (unit.startsWith('minute')) ms = num * 60 * 1000;
    else if (unit.startsWith('hour')) ms = num * 60 * 60 * 1000;
    return Date.now() + ms;
  }

  function parseAbsoluteTime(text) {
    const atMatch = text.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!atMatch) return null;
    let hour = parseInt(atMatch[1], 10);
    const minute = atMatch[2] ? parseInt(atMatch[2], 10) : 0;
    const ampm = atMatch[3];
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && hour < 12) hour += 12;
      if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
    }
    const now = new Date();
    const alarmDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (alarmDate.getTime() <= Date.now()) alarmDate.setDate(alarmDate.getDate() + 1);
    return alarmDate.getTime();
  }

  // --- music helpers (kept) ---
  function playOnYouTube(query) {
    const q = encodeURIComponent(query);
    const url = `https://www.youtube.com/results?search_query=${q}`;
    openUrl(url, true);
  }
  function playOnSpotify(query) {
    const q = encodeURIComponent(query);
    const url = `https://open.spotify.com/search/${q}`;
    openUrl(url, true);
  }
  function playOnYoutubeMusic(query) {
    const q = encodeURIComponent(query);
    const url = `https://music.youtube.com/search?q=${q}`;
    openUrl(url, true);
  }

  // ---------------------------
  // NEW: open any website logic (replacements)
  // ---------------------------

  // small map for super common services (kept for quick hits)
  const specialMap = {
    youtube: 'https://www.youtube.com',
    'youtube music': 'https://music.youtube.com',
    spotify: 'https://open.spotify.com',
    google: 'https://www.google.com',
    gmail: 'https://mail.google.com',
    facebook: 'https://www.facebook.com',
    instagram: 'https://www.instagram.com',
    linkedin: 'https://www.linkedin.com',
    github: 'https://github.com',
    stackoverflow: 'https://stackoverflow.com',
    amazon: 'https://www.amazon.com',
    flipkart: 'https://www.flipkart.com',
    twitter: 'https://twitter.com',
    imdb: 'https://www.imdb.com'
  };

  // safer open via anchor click and basic validation
  function openUrl(url, newTab = true) {
    if (typeof url !== 'string' || !url.trim()) return;
    url = url.trim();

    // sanitize common mistakes: remove repeated dots/hyphens, trim trailing '-' or '.'
    url = url.replace(/\.{2,}/g, '.').replace(/\-{2,}/g, '-').replace(/[.-]+$/g, '');

    // handle spoken "dot" and remove spaces
    url = url.replace(/\s+dot\s+/g, '.').replace(/\s+/g, '');

    // if still doesn't include scheme, add https:// for domain-like strings, else treat as search
    if (!/^https?:\/\//i.test(url)) {
      if (/[a-z0-9-]+\.[a-z]{2,}$/i.test(url)) {
        url = 'https://' + url;
      } else {
        // treat as search term
        const search = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        console.warn('openUrl: treating as search because not a domain:', url);
        if (newTab) window.open(search, '_blank');
        else window.location.href = search;
        return;
      }
    }

    console.log('openUrl -> trying:', url);
    // open via anchor.click to reduce popup blocking
    if (newTab) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.location.href = url;
    }
  }

  // create candidate domains but sanitize and avoid trailing hyphens
  function makeCandidates(name) {
    const s = (name || '').toLowerCase().trim();
    // replace spoken "dot" -> ".", remove illegal chars
    const cleaned = s.replace(/\s+dot\s+/g, '.').replace(/[^a-z0-9\.\s-]/g, ' ').trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    const joined = words.join('');
    const hyphen = words.join('-');

    const sanitize = x => x.replace(/[^\w.-]/g, '').replace(/^[.-]+|[.-]+$/g, '');

    const bases = [joined, hyphen, words[words.length - 1] || joined].map(sanitize).filter(Boolean);
    const candidates = [];
    const tlds = ['.com', '.in', '.org', '.net', '.co.in'];

    bases.forEach(b => {
      if (!b) return;
      if (b.includes('.')) {
        candidates.push(`https://${b}`);
        return;
      }
      candidates.push(`https://${b}.com`);
      candidates.push(`https://www.${b}.com`);
      candidates.push(`https://${b}.in`);
      candidates.push(`https://www.${b}.in`);
      candidates.push(`https://www.${b}`);
      candidates.push(`https://${b}`);
      tlds.forEach(tld => {
        candidates.push(`https://${b}${tld}`);
        candidates.push(`https://www.${b}${tld}`);
      });
    });

    const uniq = Array.from(new Set(candidates)).filter(u => u && !/[-]{2,}/.test(u));
    return uniq.slice(0, 12);
  }

  // show fallback links in content area (so user can click)
  function showFallbackLinks(name, urls) {
    try {
      const safeName = escapeHtml(name);
      let html = `<div>Attempting: <strong>${safeName}</strong>. If that didn't open, try these:</div><ul>`;
      urls.forEach(u => {
        const display = u.replace(/^https?:\/\//, '');
        html += `<li><a href="${u}" target="_blank" rel="noopener">${display}</a></li>`;
      });
      html += `</ul><div style="color: #faa; margin-top:8px;">Note: I will open the exact site you requested — be careful with content.</div>`;
      if (content) content.innerHTML = html;
    } catch (e) {
      console.warn('showFallback error', e);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // main site resolver: attempts to open a site from a phrase
  function openWebsiteFromSpeech(phrase) {
    if (content) content.innerText = `Heard: "${phrase}" — resolving site...`;
    // normalize phrase to remove filler words
    const cleaned = (phrase || '').toLowerCase()
      .replace(/\b(open|open the|go to|visit|website|site|web|please|launch|play on|play)\b/g, '')
      .replace(/[^a-z0-9\s\.\-]/g, ' ')
      .trim();

    if (!cleaned) {
      speak('Which site should I open?');
      return;
    }

    // if phrase already contains a clear domain like "example.com" or "www.example.com"
    const domainMatch = cleaned.match(/([a-z0-9-]+\.[a-z]{2,}(\.[a-z]{2,})?)/i);
    if (domainMatch) {
      const domain = domainMatch[1].replace(/\s+/, '');
      const sanitized = domain.replace(/[^\w.-]/g, '').replace(/[.-]+$/g, '');
      const urlCandidate = /^https?:\/\//i.test(sanitized) ? sanitized : `https://${sanitized}`;
      if (content) content.innerText = `Trying ${urlCandidate}`;
      openUrl(urlCandidate, true);
      const google = `https://www.google.com/search?q=${encodeURIComponent(cleaned)}`;
      showFallbackLinks(cleaned, [urlCandidate, google]);
      return;
    }

    // check special map
    for (const key of Object.keys(specialMap)) {
      if (cleaned.includes(key)) {
        const url = specialMap[key];
        speak(`Opening ${key}`);
        openUrl(url, true);
        showFallbackLinks(cleaned, [url, ...makeCandidates(key)]);
        return;
      }
    }

    // music patterns: "play <song> on youtube/spotify"
    const musicMatch = cleaned.match(/(.+?)\s+(on|in)\s+(youtube music|youtube|spotify)/);
    if (musicMatch) {
      const q = musicMatch[1].trim();
      const plat = musicMatch[3];
      if (plat.includes('spotify')) {
        const url = `https://open.spotify.com/search/${encodeURIComponent(q)}`;
        speak(`Searching ${q} on Spotify`);
        openUrl(url, true);
        showFallbackLinks(q, [url]);
        return;
      } else {
        const url = `https://music.youtube.com/search?q=${encodeURIComponent(q)}`;
        speak(`Searching ${q} on YouTube Music`);
        openUrl(url, true);
        showFallbackLinks(q, [url, `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`]);
        return;
      }
    }

    // "play <song>" default to YouTube Music
    const playMatch = cleaned.match(/^play\s+(.+)/);
    if (playMatch) {
      const q = playMatch[1].trim();
      const url = `https://music.youtube.com/search?q=${encodeURIComponent(q)}`;
      speak(`Searching ${q} on YouTube Music`);
      openUrl(url, true);
      showFallbackLinks(q, [url, `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`]);
      return;
    }

    // otherwise extract token(s) and generate candidates
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const lastToken = tokens[tokens.length - 1] || tokens[0] || cleaned;
    const base = lastToken.length > 2 ? lastToken : tokens.join('');
    const candidates = makeCandidates(base);

    if (candidates && candidates.length) {
      const primary = candidates[0];
      speak(`Attempting to open ${base}`);
      openUrl(primary, true);
      const google = `https://www.google.com/search?q=${encodeURIComponent(cleaned)}`;
      showFallbackLinks(cleaned, [...candidates, google]);
      return;
    }

    // final fallback: google search
    const search = `https://www.google.com/search?q=${encodeURIComponent(cleaned)}`;
    speak(`Searching the web for ${cleaned}`);
    openUrl(search, true);
    showFallbackLinks(cleaned, [search]);
  }

  // ---------------------------
  // Command handler (integrates site opener)
  // ---------------------------
  function handleCommand(text) {
    if (!text || !text.trim()) {
      speak("I did not understand. Please say again.");
      return;
    }

    // small replies
    if (text.includes('hello')) { speak('Hello sir! How can I help you?'); return; }
    if (text.includes('who are you')) { speak('I am Shifra, your virtual assistant made by Sahil.'); return; }

    // Play music explicit (on platform)
    const playMatch = text.match(/play\s+(.+?)\s+(on|in)\s+(youtube|spotify|youtube music)/);
    if (playMatch) {
      const song = playMatch[1].trim();
      const platform = playMatch[3].toLowerCase();
      if (platform === 'spotify') { speak(`Playing ${song} on Spotify`); playOnSpotify(song); return; }
      if (platform.includes('youtube')) { speak(`Playing ${song} on YouTube Music`); playOnYoutubeMusic(song); return; }
    }

    // quick "play <song>" -> youtube music
    const playShort = text.match(/^play\s+(.+)/);
    if (playShort && !text.includes('alarm')) {
      const song = playShort[1].trim();
      speak(`Searching ${song} on YouTube Music`);
      playOnYoutubeMusic(song);
      return;
    }

    // alarms
    if (text.startsWith('set alarm') || text.startsWith('set an alarm') || text.includes('set alarm in') || text.includes('set alarm at')) {
      const labelMatch = text.match(/(?:to|for)\s+(.+)$/);
      const label = labelMatch ? labelMatch[1].trim() : 'Alarm';
      let when = parseRelativeTime(text) || parseAbsoluteTime(text);
      if (!when) {
        const fallbackMatch = text.match(/(\d{1,2}:\d{2})/);
        if (fallbackMatch) {
          const parts = fallbackMatch[1].split(':');
          const h = parseInt(parts[0],10), m = parseInt(parts[1],10);
          const now = new Date();
          const alarmDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
          if (alarmDate.getTime() <= Date.now()) alarmDate.setDate(alarmDate.getDate() + 1);
          when = alarmDate.getTime();
        }
      }
      if (!when) { speak('I could not understand the alarm time. Say set alarm at 6 30 AM, or set alarm in 10 minutes.'); return; }
      const id = nextAlarmId();
      const alarm = { id, when, label };
      alarms.push(alarm); saveAlarms(); scheduleAlarm(alarm);
      const humanTime = new Date(when).toLocaleString();
      speak(`Alarm set for ${humanTime}. Alarm id ${id}`);
      if (content) content.innerText = `Alarm ${id} set for ${humanTime} — ${label}`;
      return;
    }

    // list / cancel alarms
    if (text.includes('list alarms') || text.includes('show alarms') || text.includes('what alarms')) {
      if (alarms.length === 0) { speak('You have no alarms set.'); return; }
      let reply = `You have ${alarms.length} alarms. `;
      alarms.forEach((a, i) => {
        reply += `Alarm ${a.id} at ${new Date(a.when).toLocaleString()}, labeled ${a.label}. `;
      });
      speak(reply);
      return;
    }
    const cancelMatch = text.match(/(?:cancel|delete|remove)\s+alarm\s+(\d{5,})/);
    if (cancelMatch) {
      const id = parseInt(cancelMatch[1], 10);
      const idx = alarms.findIndex(a => a.id === id);
      if (idx === -1) { speak(`No alarm with id ${id} found.`); return; }
      if (alarmTimers[id]) clearTimeout(alarmTimers[id]);
      alarms.splice(idx, 1);
      saveAlarms();
      speak(`Alarm ${id} canceled.`);
      return;
    }

    // explicit open commands: "open X", "visit Y", "go to Z"
    if (/^\s*(open|visit|go to|launch)\b/.test(text)) {
      openWebsiteFromSpeech(text);
      return;
    }
    // generic fallback that will attempt to open/resolve
    if (/^(play|open|visit|search)\b/.test(text) || text.includes('youtube') || text.includes('spotify') || text.includes('.com')) {
      openWebsiteFromSpeech(text);
      return;
    }

    // time/date/who made you
    if (text.includes('time')) { const t = new Date().toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'}); speak(`The time is ${t}`); return; }
    if (text.includes('date')) { const d = new Date().toLocaleDateString(); speak(`Today is ${d}`); return; }
    if (text.includes('who made you') || text.includes('who created you')) { speak('I was made by Sahil.'); return; }

    // final fallback
    speak("I did not understand that. Try: play <song> on YouTube, set alarm at 6 30 AM, or say open <website>.");
  }

  // expose handler for debugging
  window.handleCommand = handleCommand;

  console.log('Updated java.js ready — unlimited site opener enabled.');
});
