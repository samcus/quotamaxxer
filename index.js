#!/usr/bin/env node

/**
 * QuotaMaxxer — Sophisticated, automated laziness. Maximum Claude quota efficiency.
 * Zero-dependency global Node.js CLI.
 * Works on macOS, Linux, and Windows.
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ─── Constants ──────────────────────────────────────────────────────────────

const APP_DIR = path.join(os.homedir(), '.quotamaxxer');
const LOG_FILE = path.join(APP_DIR, 'cron.log');
const CRON_TAG = '# quotamaxxer';
const TASK_NAME = 'QuotaMaxxer';   // Windows Task Scheduler task name
const DEFAULT_TIME = '06:30';

const IS_WINDOWS = process.platform === 'win32';
const IS_MACOS   = process.platform === 'darwin';

// macOS uses launchd (Launch Agents) instead of cron — runs in the user session
// with full keychain access, identical to opening a terminal.
const LAUNCHD_LABEL = 'com.quotamaxxer';
const LAUNCHD_PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LAUNCHD_LABEL}.plist`);

// 8 words or fewer — because 8 bits make a byte. Real value, minimal tokens.
const PING_PROMPT = 'Give me a software development best practice in 8 words or fewer.';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureAppDir() {
  if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });
}

function localTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function log(status, message) {
  ensureAppDir();
  const entry = `${localTimestamp()} [${status}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, entry);
}

function printLog(lines = 20) {
  if (!fs.existsSync(LOG_FILE)) {
    console.log('No log entries yet.');
    return;
  }
  const entries = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
  const tail = entries.slice(-lines);
  tail.forEach(l => {
    if (l.includes('[SUCCESS]')) process.stdout.write(`\x1b[32m${l}\x1b[0m\n`);
    else if (l.includes('[FAILURE]')) process.stdout.write(`\x1b[31m${l}\x1b[0m\n`);
    else process.stdout.write(`${l}\n`);
  });
}

// Synchronous sleep — Atomics.wait is allowed on the main thread in Node.js.
function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// On Windows, shell:true is required so npm's .cmd shims (e.g. claude.cmd) resolve.
function spawnOpts(extra = {}) {
  return { encoding: 'utf8', shell: IS_WINDOWS, ...extra };
}

// ─── Preflight checks ────────────────────────────────────────────────────────

function assertClaudeInstalled() {
  const result = spawnSync('claude', ['--version'], spawnOpts());
  if (result.error || result.status !== 0) {
    const msg = 'Claude Code not found — the operation collapses before it begins.';
    log('FAILURE', msg);
    console.error(
      `\x1b[31m✗ ${msg}\x1b[0m\n` +
      '  npm install -g @anthropic-ai/claude-code — you know what to do.'
    );
    process.exit(1);
  }
}

function assertClaudeLoggedIn() {
  const result = spawnSync('claude', ['auth', 'status'], spawnOpts());
  if (result.status !== 0 || (result.stdout && result.stdout.includes('not logged in'))) {
    const msg = 'Not authenticated — the servant cannot work without credentials.';
    log('FAILURE', msg);
    console.error(
      `\x1b[31m✗ ${msg}\x1b[0m\n` +
      '  Run: claude auth login'
    );
    process.exit(1);
  }
}

// ─── Core: fire the ping ─────────────────────────────────────────────────────

function runPing() {
  assertClaudeInstalled();

  console.log('⚡ Deploying the 8-bit wisdom payload...');

  const result = spawnSync(
    'claude',
    ['-p', PING_PROMPT, '--output-format', 'text'],
    spawnOpts({ timeout: 60_000 })
  );

  if (result.error || result.status !== 0) {
    const parts = [
      result.error?.message,
      result.stderr?.trim(),
      result.stdout?.trim(),
    ].filter(Boolean);
    const err = parts.join(' | ') || `process exited with code ${result.status}`;
    log('FAILURE', `Payload delivery failed — ${err}`);
    console.error(`\x1b[31m✗ Payload delivery failed:\x1b[0m ${err}`);
    process.exit(1);
  }

  const tip = (result.stdout || '').trim();
  log('SUCCESS', `Window activated. Today's tip: ${tip}`);
  console.log('\x1b[32m✓ Window activated. Wisdom delivered. Go back to sleep.\x1b[0m');
  if (tip) console.log(`\x1b[36m  💡 ${tip}\x1b[0m`);
}

// ─── Shared time parsing ──────────────────────────────────────────────────────

function parseCronTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    console.error(`\x1b[31m✗ Invalid time format "${timeStr}". Use HH:MM (24-hour).\x1b[0m`);
    process.exit(1);
  }
  return { h, m };
}

// ─── Unix (macOS + Linux): crontab ───────────────────────────────────────────

function getCurrentCrontab() {
  // Exit 1 with "no crontab for user" is normal — treat as empty.
  const result = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout || '';
}

function setCrontab(content) {
  const tmp = path.join(os.tmpdir(), `quotamaxxer-cron-${Date.now()}.txt`);
  fs.writeFileSync(tmp, content);
  const r = spawnSync('crontab', [tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  if (r.status !== 0) {
    console.error(`\x1b[31m✗ Failed to install crontab:\x1b[0m ${r.stderr}`);
    process.exit(1);
  }
}

function initCronUnix(timeStr) {
  const { h, m } = parseCronTime(timeStr);
  const bin = process.execPath;           // absolute path to node binary
  const script = path.resolve(__filename);
  // Bake in PATH and HOME so cron can find `claude` and its auth config.
  const userPath = (process.env.PATH || '').replace(/"/g, '');
  const homeDir  = os.homedir();
  const cronLine = `${m} ${h} * * * HOME="${homeDir}" PATH="${userPath}" ${bin} ${script} _ping ${CRON_TAG}`;

  let tab = getCurrentCrontab();
  const existing = tab.split('\n').find(l => l.includes(CRON_TAG));
  if (existing) {
    const match = existing.match(/^(\d+)\s+(\d+)/);
    if (match) {
      const oldHH = String(match[2]).padStart(2, '0');
      const oldMM = String(match[1]).padStart(2, '0');
      console.log(`\x1b[33m⚠ Previous servant deposed (${oldHH}:${oldMM}). New orders: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}.\x1b[0m`);
    } else {
      console.log(`\x1b[33m⚠ Existing QuotaMaxxer schedule found and replaced. The machine is loyal, but not sentimental.\x1b[0m`);
    }
  }
  tab = tab.split('\n').filter(l => !l.includes(CRON_TAG)).join('\n').trim();
  const newTab = tab ? `${tab}\n${cronLine}\n` : `${cronLine}\n`;
  setCrontab(newTab);

  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  log('SUCCESS', `Servant deployed — daily wisdom payload at ${hh}:${mm}`);
  console.log(`\x1b[32m✓ Servant deployed. Daily wisdom payload at ${hh}:${mm} local time.\x1b[0m`);
  console.log('  The machine will wake up before you do. You will not notice. That is the point.');
}

// ─── macOS: launchd (Launch Agent) ───────────────────────────────────────────

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function initLaunchdMac(timeStr) {
  const { h, m } = parseCronTime(timeStr);
  const bin    = process.execPath;
  const script = path.resolve(__filename);

  if (fs.existsSync(LAUNCHD_PLIST)) {
    const hh2 = String(h).padStart(2, '0'), mm2 = String(m).padStart(2, '0');
    console.log(`\x1b[33m⚠ Previous servant deposed. New orders: ${hh2}:${mm2}.\x1b[0m`);
    spawnSync('launchctl', ['unload', LAUNCHD_PLIST], { encoding: 'utf8' });
  }

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LAUNCHD_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${xmlEscape(bin)}</string>
        <string>${xmlEscape(script)}</string>
        <string>_ping</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>${h}</integer>
        <key>Minute</key>
        <integer>${m}</integer>
    </dict>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${xmlEscape(os.homedir())}</string>
        <key>PATH</key>
        <string>${xmlEscape(process.env.PATH || '/usr/local/bin:/usr/bin:/bin')}</string>
    </dict>
</dict>
</plist>`;

  const agentsDir = path.dirname(LAUNCHD_PLIST);
  if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(LAUNCHD_PLIST, plist);

  const result = spawnSync('launchctl', ['load', LAUNCHD_PLIST], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`\x1b[31m✗ Failed to load Launch Agent:\x1b[0m ${result.stderr || result.stdout}`);
    process.exit(1);
  }

  const hh = String(h).padStart(2, '0'), mm = String(m).padStart(2, '0');
  log('SUCCESS', `Servant deployed — daily wisdom payload at ${hh}:${mm}`);
  console.log(`\x1b[32m✓ Servant deployed. Daily wisdom payload at ${hh}:${mm} local time.\x1b[0m`);
  console.log('  The machine will wake up before you do. You will not notice. That is the point.');
}

function stopLaunchdMac() {
  if (!fs.existsSync(LAUNCHD_PLIST)) {
    console.log('\x1b[33m⚠ No QuotaMaxxer Launch Agent found. Were you even maxxing?\x1b[0m');
    return;
  }
  spawnSync('launchctl', ['unload', LAUNCHD_PLIST], { encoding: 'utf8' });
  fs.unlinkSync(LAUNCHD_PLIST);
  log('SUCCESS', 'Servant honorably discharged — daily payload disabled.');
  console.log('\x1b[32m✓ Servant honorably discharged. You are on your own now, pal.\x1b[0m');
}

// ─── Windows: Task Scheduler (schtasks) ──────────────────────────────────────

function initCronWindows(timeStr) {
  const { h, m } = parseCronTime(timeStr);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const startTime = `${hh}:${mm}`;

  // Quote paths to handle spaces (e.g. C:\Program Files\nodejs\node.exe).
  const bin = `"${process.execPath}"`;
  const script = `"${path.resolve(__filename)}"`;
  const taskRun = `${bin} ${script} _ping`;

  // Warn if a task already exists before overwriting.
  const existing = spawnSync('schtasks', ['/query', '/tn', TASK_NAME, '/fo', 'LIST'], { encoding: 'utf8', shell: true });
  if (existing.status === 0) {
    const match = existing.stdout.match(/Next Run Time:\s*(.+)/i);
    console.log(`\x1b[33m⚠ Replacing existing QuotaMaxxer schedule${match ? ` (next was: ${match[1].trim()})` : ''}.\x1b[0m`);
  }

  // /f forces overwrite of an existing task with the same name.
  const result = spawnSync(
    'schtasks',
    ['/create', '/tn', TASK_NAME, '/tr', taskRun, '/sc', 'DAILY', '/st', startTime, '/f'],
    { encoding: 'utf8', shell: true }
  );

  if (result.status !== 0) {
    console.error(`\x1b[31m✗ Failed to create scheduled task:\x1b[0m ${result.stderr || result.stdout}`);
    process.exit(1);
  }

  log('SUCCESS', `Servant deployed — daily wisdom payload at ${startTime}`);
  console.log(`\x1b[32m✓ Servant deployed. Daily wisdom payload at ${startTime} local time.\x1b[0m`);
  console.log('  The machine will wake up before you do. You will not notice. That is the point.');
}

// ─── Stop / remove scheduler ─────────────────────────────────────────────────

function stopCronUnix() {
  let tab = getCurrentCrontab();
  const before = tab.split('\n').filter(l => l.includes(CRON_TAG));
  if (before.length === 0) {
    console.log('\x1b[33m⚠ No QuotaMaxxer cron entry found. Were you even maxxing bro?\x1b[0m');
    return;
  }
  tab = tab.split('\n').filter(l => !l.includes(CRON_TAG)).join('\n').trim();
  setCrontab(tab ? `${tab}\n` : '');
  log('SUCCESS', 'Servant honorably discharged — daily payload disabled.');
  console.log('\x1b[32m✓ Servant honorably discharged. You are on your own now, pal.\x1b[0m');
}

function stopCronWindows() {
  const result = spawnSync(
    'schtasks',
    ['/delete', '/tn', TASK_NAME, '/f'],
    { encoding: 'utf8', shell: true }
  );
  if (result.status !== 0) {
    console.log('\x1b[33m⚠ No QuotaMaxxer scheduled task found. Were you even maxxing?\x1b[0m');
    return;
  }
  log('SUCCESS', 'Servant honorably discharged — daily payload disabled.');
  console.log('\x1b[32m✓ Servant honorably discharged. You are on your own now, pal.\x1b[0m');
}

function stopCron() {
  if (IS_WINDOWS) stopCronWindows();
  else if (IS_MACOS) stopLaunchdMac();
  else stopCronUnix();
}

// ─── Clear logs ──────────────────────────────────────────────────────────────

function clearLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log('\x1b[33m⚠ No logs found. The servant has nothing to confess.\x1b[0m');
    return;
  }
  fs.writeFileSync(LOG_FILE, '');
  console.log('\x1b[32m✓ Logs purged. The past is gone. The servant remembers nothing. A clean slate.\x1b[0m');
}

// ─── Scheduler dispatcher ────────────────────────────────────────────────────

function initCron(timeStr) {
  assertClaudeInstalled();
  assertClaudeLoggedIn();
  if (IS_WINDOWS) initCronWindows(timeStr);
  else if (IS_MACOS) initLaunchdMac(timeStr);
  else initCronUnix(timeStr);
}

// ─── Status ───────────────────────────────────────────────────────────────────

function getScheduleStatus() {
  if (IS_WINDOWS) {
    const r = spawnSync(
      'schtasks',
      ['/query', '/tn', TASK_NAME, '/fo', 'LIST'],
      { encoding: 'utf8', shell: true }
    );
    if (r.status !== 0) return null;
    const match = r.stdout.match(/Next Run Time:\s*(.+)/i);
    return { label: 'Task Scheduler', detail: match ? match[1].trim() : 'Scheduled' };
  } else if (IS_MACOS) {
    if (!fs.existsSync(LAUNCHD_PLIST)) return null;
    return { label: 'launchd', detail: LAUNCHD_PLIST };
  } else {
    const tab = getCurrentCrontab();
    const line = tab.split('\n').find(l => l.includes(CRON_TAG));
    return line ? { label: 'cron', detail: line.replace(CRON_TAG, '').trim() } : null;
  }
}

function showStatus() {
  console.log('\n\x1b[1mQuotaMaxxer Status\x1b[0m');
  console.log('─'.repeat(40));

  // Claude installed?
  const ver = spawnSync('claude', ['--version'], spawnOpts());
  if (ver.error || ver.status !== 0) {
    console.log('  Claude Code : \x1b[31m✗ Absent. Completely absent.\x1b[0m');
  } else {
    console.log(`  Claude Code : \x1b[32m✓ Present and accounted for — ${(ver.stdout || '').trim()}\x1b[0m`);
  }

  // Logged in?
  const auth = spawnSync('claude', ['auth', 'status'], spawnOpts());
  const loggedIn = auth.status === 0 && !(auth.stdout || '').includes('not logged in');
  console.log(`  Auth        : ${loggedIn ? '\x1b[32m✓ Credentialed. The servant has a badge.\x1b[0m' : '\x1b[31m✗ Not logged in. The servant has no badge and no future.\x1b[0m'}`);

  // Scheduler?
  const schedule = getScheduleStatus();
  if (schedule) {
    console.log(`  Scheduler   : \x1b[32m✓ Servant on duty (${schedule.label})\x1b[0m`);
    console.log(`  Next run    : ${schedule.detail}`);
  } else {
    console.log(`  Scheduler   : \x1b[33m⚠ Undeployed/unemployed — run: quotamaxxer init\x1b[0m`);
  }

  // Recent log
  console.log('\n\x1b[1mRecent Activity (last 10 entries)\x1b[0m');
  console.log('─'.repeat(40));
  printLog(10);
  console.log();
}

// ─── One-minute field test ───────────────────────────────────────────────────

function runTest() {
  assertClaudeInstalled();
  assertClaudeLoggedIn();

  const existing = getScheduleStatus();
  if (existing) {
    console.log('\x1b[33m⚠ Your existing schedule will be replaced for this test and removed when it finishes.\x1b[0m');
    console.log('  Re-run quotamaxxer init --time HH:MM once the test passes.\n');
  }

  // Add 2 minutes so the truncated HH:MM is always at least ~60s in the future,
  // regardless of where we are in the current minute.
  const fireTime = new Date(Date.now() + 2 * 60_000);
  const hh = String(fireTime.getHours()).padStart(2, '0');
  const mm = String(fireTime.getMinutes()).padStart(2, '0');

  console.log(`\x1b[1m⏱  One-Minute Field Test\x1b[0m`);
  console.log(`  Test payload deploying at ${hh}:${mm}. The servant is on a trial run.\n`);

  // Install — route through the same platform dispatchers as init.
  if (IS_WINDOWS) initCronWindows(`${hh}:${mm}`);
  else if (IS_MACOS) initLaunchdMac(`${hh}:${mm}`);
  else initCronUnix(`${hh}:${mm}`);

  // Snapshot AFTER install so the "Servant deployed" log entry is already
  // included — we only want to detect entries written by the scheduled job itself.
  const priorLines = fs.existsSync(LOG_FILE)
    ? fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean).length
    : 0;

  // Poll for a new log entry, up to 3 minutes.
  const TIMEOUT  = 180_000;
  const INTERVAL =   3_000;
  const deadline = Date.now() + TIMEOUT;
  let newEntry = null;

  console.log('');
  process.stdout.write('  Watching for confirmation');
  while (Date.now() < deadline) {
    sleepMs(INTERVAL);
    process.stdout.write('.');
    if (fs.existsSync(LOG_FILE)) {
      const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
      if (lines.length > priorLines) {
        newEntry = lines[lines.length - 1];
        break;
      }
    }
  }
  process.stdout.write('\n\n');

  // Always clean up — test schedule is temporary.
  if (IS_MACOS && fs.existsSync(LAUNCHD_PLIST)) {
    spawnSync('launchctl', ['unload', LAUNCHD_PLIST], { encoding: 'utf8' });
    fs.unlinkSync(LAUNCHD_PLIST);
  } else if (IS_WINDOWS) {
    spawnSync('schtasks', ['/delete', '/tn', TASK_NAME, '/f'], { encoding: 'utf8', shell: true });
  } else {
    let tab = getCurrentCrontab();
    tab = tab.split('\n').filter(l => !l.includes(CRON_TAG)).join('\n').trim();
    setCrontab(tab ? `${tab}\n` : '');
  }

  if (!newEntry) {
    console.log('\x1b[31m✗ Timed out. The payload never landed within 3 minutes.\x1b[0m');
    console.log('  Run quotamaxxer status for clues, then try again.');
    return;
  }

  const tipMatch = newEntry.includes('[SUCCESS]') && newEntry.split("Today's tip:")[1]?.trim();

  if (tipMatch) {
    console.log('\x1b[32m✓ Payload confirmed. Claude responded. Permissions cleared. The servant is combat-ready.\x1b[0m');
    console.log(`\x1b[36m  💡 ${tipMatch}\x1b[0m`);
    console.log('\n  Test schedule removed. Deploy for real:');
    console.log('  \x1b[1mquotamaxxer init --time HH:MM\x1b[0m');
  } else if (newEntry.includes('[SUCCESS]')) {
    console.log('\x1b[33m⚠ Schedule fired and the script ran, but Claude returned no content.\x1b[0m');
    console.log('  Permissions may still be pending. Try: quotamaxxer test');
  } else {
    console.log('\x1b[31m✗ Test failed. Address the error below, then re-run: quotamaxxer test\x1b[0m');
    console.log(`  \x1b[31m${newEntry}\x1b[0m`);
  }
}

// ─── Easter egg ──────────────────────────────────────────────────────────────

function showSquid() {
  const c = '\x1b[96m';   // bright cyan — the face of a god
  const g = '\x1b[33m';   // gold — the shirt of distinction
  const b = '\x1b[1m';    // bold
  const d = '\x1b[2m';    // dim
  const r = '\x1b[0m';    // reset

  const face = [
    '----------------------------.....-------------........--.----------------------------',
    '--------------..------------.......--------.................-------------------------',
    '-------------.......------.....................................-.....-.....----------',
    '------------........................--+++++++---...........................----------',
    '------------................-+++----............----+++-....................---------',
    '-------------...........-++-............................-++-...............----------',
    '-------------........-#-....................................+-.............----------',
    '---------------....-+-.......................................-+-............---------',
    '---------------...+-...........................................++..........----------',
    '-----------------#-................................--...........+-...............----',
    '--------------..#-..................................+...........-+...................',
    '----------.....--...............--..................--...........#..................-',
    '--------.......+-................--...............-..+.--........+-.................-',
    '---...........-+..................--...............+..-+.........--.................-',
    '---...........++..................+................--.-..........-+..................',
    '---...........+-................--.................--.-............+.................',
    '----..........+-...............--..............-...--.--...........-+................',
    '----..........+-................+...........-++-...-.....--........+-................',
    '----..........-+.................-.....-+---------...---+---++--..+-.................',
    '----...........#-.................----.++--+++++-+-..-+---+++---.#...................',
    '---............--..................---.-...-+++..--..-+...++++.+-#...................',
    '----............#-............-.........--.....-+-.....--....--..+-..................',
    '------...........+-..........+-...............---.......++---.....--.................',
    '-------...........++........-+.............---..........-.........-+.................',
    '-------.............++......-+..........................-.........--.................',
    '------................-++....-+................-.......--........++..................',
    '--.......................--++--+--...........-+........-++.....++....................',
    '--..........................+...--+++---.....+--+-......-+...++......................',
    '-----......................+-...--.....+...-+.-...+-....---.-........................',
    '-----.....................-+....+-.....+...-.......----...-.+........................',
    '---.......................+-....+-.....-...-.....-------..-.+........................',
    '---......................#-.....+.........--...-+-.------...+........................',
    '---..................--+#-.....-+............-#+++++++++#...+........................',
  ];

  const shirt = [
    '------...--+++++++++..-#-......-+..............----------...+........................',
    '------+##+-------+-...+........+-................+----+-....+.......................-',
    '-+#++-----------+..............#.................------.....+...........----------...',
    '+--------------+-..............+............................-+-........--------------',
    '---------------+-..............++.................------.......#.......--------------',
    '---------------+-...............-++.....................+......+-.....---------------',
    '---------------+-..................-++-.................-......++-..-----------------',
    '++++-----------+-......................-++-.............+.--++++-+#+-----------------',
    '----+#+---------+..........................-+++-------++-++-------++-++--------------',
    '-------++--------+-............................--.--.....+-------------+#------------',
    '--------+#+-------+-..-.-....................-+-........-+---------------++----------',
    '----------#+-------+-.--.+.--..........................-+-----------------++---------',
    '-----------++--------+---.-.--...........--..........-+--------------------++--------',
  ];

  console.log('');
  face.forEach(l => console.log(c + l + r));
  shirt.forEach(l => console.log(g + l + r));
  console.log('');
  console.log(c + b + '              Handsome Squid' + r);
  console.log(d + '        "Too beautiful for your quota limits."' + r);
  console.log('');
}

// ─── CLI router ──────────────────────────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'init': {
    const timeFlag = args.indexOf('--time');
    const timeVal = timeFlag !== -1 ? args[timeFlag + 1] : DEFAULT_TIME;
    initCron(timeVal);
    break;
  }

  case 'run':
    runPing();
    break;

  case 'status':
    showStatus();
    break;

  case 'stop':
    stopCron();
    break;

  // Internal hook called by the scheduler — not intended for direct use.
  case '_ping':
    runPing();
    break;

  case 'test':
    runTest();
    break;

  case 'clear-logs':
    clearLogs();
    break;

  case 'squid':
    showSquid();
    break;

  default:
    console.log(
      '\n\x1b[1mQuotaMaxxer\x1b[0m — Sophisticated, automated laziness.\n\n' +
      'Commands:\n' +
      '  quotamaxxer init [--time HH:MM]  Deploy your servant (default: 06:30)\n' +
      '  quotamaxxer test                 Fire a one-minute trial run, verify permissions, self-cleanup\n' +
      '  quotamaxxer run                  Fire the payload right now\n' +
      '  quotamaxxer status               Audit your digital workforce\n' +
      '  quotamaxxer stop                 Honorably discharge the servant\n' +
      '  quotamaxxer clear-logs           Purge the record. The servant forgets everything.\n'
    );
}
