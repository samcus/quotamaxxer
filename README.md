<p align="center">
  <img src="media/handsome-quotamaxxing.png" width="80%" alt="Our hero, the automated digital gentleman, performing a 'maximally maximized' wake-up ritual at 6:00 AM while the user sleeps.">
  <br>
  <i>"Go back to sleep. There are limits to respect." — The machine spirit within QuotaMaxxer.</i>
</p>

# 📈 QuotaMaxxer

**"Quota is totally maximized. Go back to sleep. There are limits to respect."**

This is not just code; it is a philosophy. A philosophy of sophisticated, automated laziness and maximum efficiency.

Claude subscriptions operate on an obtuse rolling block timer (a 5-hour window that rounds backwards, triggered by your first prompt). If you are peasant enough to wait until you sit at your desk at 9:00 AM to start your session, you are leaving compute on the table. You are under-maxxing, you are not a Chad.

**QuotaMaxxer** is a lightweight, zero-dependency, globally installed digital servant that wakes up before you do. It hooks into your local Claude Code CLI and sends a real request each morning — asking Claude for a software development best practice in 8 words or fewer (8, because there are 8 bits in a byte). By the time you sit down to work, your usage window is already ticking and a small piece of useful advice is sitting in your log.

Be like the hero of automation: sophisticated, optimized, and sleeping. Be part of the 0.002% of QuotaMaxxers.

---

### Before QuotaMaxxer

> You wake up at 9:00 AM, open your laptop, and start prompting. By 11:30 AM you've burned through your quota. Claude stops responding. You stare at the wall for two and a half hours waiting for your window to reset. Half your workday, gone.

### After QuotaMaxxer

> You set `quotamaxxer init --time 06:30` once. At 6:30 AM, while you're still asleep, QuotaMaxxer asks Claude for a software development best practice — 8 words or fewer, logged for when you wake up. Claude's 5-hour window starts ticking. You wake up at 9:00 AM with a useful tip waiting in your terminal. You work. You hit your limit at 11:30 AM — same as before — but this time your window resets at **11:30 AM**, not 2:00 PM. You're back in seconds. Five hours of effective output, no dead time.

---

## 🚀 Installation

Install globally, and require 0.01% of your brain power to configure:

```bash
npm install -g quotamaxxer
```

## 🛠️ Usage

### 1. Field Test (macOS required, optional elsewhere)
**Run this before anything else.** Confirms your Claude Code connection is working and — on macOS — surfaces any system permission prompts before your real schedule fires at 6 AM while you're asleep.

**macOS:** The first time a background agent fires, macOS may prompt for system permissions. If those prompts go unanswered, the servant silently fails every night while you sleep, completely unaware. This catches all of that up front and confirms Claude responded with actual content.

**Linux / Windows:** Optional sanity check. No permission prompts will appear, but it's a useful way to confirm your setup is working end-to-end before going hands-off.

The test schedules a payload ~2 minutes out, waits for Claude's response, and cleans up the schedule automatically — pass or fail. When it prints `✓ Payload confirmed`, you are cleared for deployment.

```bash
quotamaxxer test
```

### 2. The Automated Devotion Protocol (Setter-and-Forgetter)
Once the field test passes, initialize the daily cron job. It defaults to 06:30 AM (Local System Time).

```bash
quotamaxxer init
```

**The Time Arbitrage (Override):**
Perfect if you plan on actually working at 8:00 AM, but want Claude awake and totally maximized by 5:00 AM. The `--time` flag accepts 24-hour format. Sorry to the Americans. The rest of the world has been living like this since forever and they are fine.
```bash
quotamaxxer init --time 05:00
```

**One schedule. One devotion.** QuotaMaxxer runs a single daily ping — no stacking, no doubles. If you run `init` again with a new time, the previous schedule is automatically deposed and replaced. You will be warned. The machine is loyal, but it is not sentimental.

**Close the terminal. Walk away.** QuotaMaxxer installs itself as a background agent — it does not need your terminal open, your eyes on it, or your blessing. Lock your screen. Go to bed. The machine will handle it. (macOS: launchd. Linux: cron. Windows: Task Scheduler. All three require zero terminal presence.)

**However.** Your computer must be *awake* — not sleeping, not suspended, not in some low-power stupor. Lock screen is fine. Cron fires through a locked screen without issue. But if your laptop is asleep at 6:30 AM, the CPU is halted, the daemon is silent, and that day's ping is simply skipped. No retry. No warning. Nothing. On Windows, Task Scheduler *can* wake your machine from sleep — enable "Wake the computer to run this task" in Task Scheduler if you need that level of commitment.

**Authentication must stay valid:** If your Claude Code auth token expires, the scheduled ping will fail and log a `[FAILURE]` entry. Run `quotamaxxer status` to check, or re-authenticate with `claude auth login`.

### 3. Immediate Maximum Maximization
Need to force a usage window to start *right now*? Run the payload manually:

```bash
quotamaxxer run
```

### 4. Performance Review (Status Audit)
Audit your digital workforce. Verify your Claude Code connection, check your next scheduled maximization, and review recent activity logs.

```bash
quotamaxxer status
```

### 5. Termination Protocol (Stop)
So you've decided to go back to being a peasant. Understandable. This command honorably discharges your digital servant — removing the scheduled ping from cron (macOS/Linux) or Task Scheduler (Windows). The machine will not argue. It will not beg. It will simply cease.

```bash
quotamaxxer stop
```

### 6. Purge Protocol (Clear Logs)
The servant keeps receipts. Every success, every failure — logged in perpetuity at `~/.quotamaxxer/cron.log`. If the record has grown long, embarrassing, or simply offensive to your sensibilities, you may order a purge. The servant will comply without question. It will remember nothing. Neither should you.

```bash
quotamaxxer clear-logs
```

## 📋 Logging

QuotaMaxxer maintains a persistent log of every cron execution — successes and failures — stored at:

```
~/.quotamaxxer/cron.log
```

Each entry is timestamped in ISO 8601 format with a `[SUCCESS]` or `[FAILURE]` tag:

```
2026-03-30T06:30:01.234Z [SUCCESS] Ping sent — quota window activated.
2026-03-30T06:30:01.234Z [FAILURE] Ping failed — claude: command not found
```

The `quotamaxxer status` command renders the last 10 log entries with color-coded output (green for success, red for failure) directly in your terminal.

## 🧠 How It Works

Claude's usage window starts the moment you send your first message of the day. That window lasts 5 hours and rounds back to the top of the hour — so if your first prompt lands at 5:59 AM, your window is treated as starting at 5:00 AM, resetting at 10:00 AM.

QuotaMaxxer sends that first message early, while you sleep. Each morning it asks Claude for a software development best practice in 8 words or fewer — 8, because 8 bits make a byte. It's a small, real request: useful on its own, and useful for kicking off your window at a civilized hour.

If `quotamaxxer` runs at 5:59 AM, your next fresh batch of compute unlocks at 10:00 AM — not the afternoon, not when you're already staring at a rate-limit screen. You bought yourself a meaningful head start *while unconscious*. That is the move. That is the maxx.

## ⚠️ Requirements

QuotaMaxxer does not come with batteries. It is a conductor, not an orchestra. You must have the following installed and authenticated, or the whole operation collapses before it begins:

* [Node.js](https://nodejs.org/) — Yes, obviously. You used `npm install` to get here. If you do not have Node.js, you would not be reading this. We trust you are fine.
* [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) (`npm install -g @anthropic-ai/claude-code`)

QuotaMaxxer will detect your incompetence immediately and throw a loud, descriptive error if:
- Claude Code is not installed on your system
- You are not currently authenticated with Claude Code

Fix those first. Then come back. The machine will be waiting.

*Built for the sophisticatedly lazy. Maximum maximization. Be part of the 0.002% of QuotaMaxxers.*

---

## ⚖️ Disclaimer

While this tool is designed to send genuine, true value, low-cost requests rather than empty pings, Anthropic's Terms of Service and Acceptable Use Policy are subject to change, and automated usage of Claude Code may conflict with those policies now or in the future.

**By using this tool, you accept full responsibility for any consequences, including but not limited to suspension or permanent termination of your Anthropic account or Claude Code access.** The author of QuotaMaxxer is not liable for any account actions taken by Anthropic as a result of your use of this software.

Review [Anthropic's Terms of Service](https://www.anthropic.com/legal/consumer-terms) and [Acceptable Use Policy](https://www.anthropic.com/legal/aup) before using this tool. Use at your own risk.

---

## ☕ Support The Architect

You are now getting more out of your Claude subscription than you were before. Possibly significantly more. Hours of compute, reclaimed from the void — gifted to you by a small Node.js script and one person's refusal to accept rate limits as a fixed constraint of reality.

If QuotaMaxxer has saved you from staring at a usage wall, let you ship something you would have had to pause on, or simply made you feel like the sophisticated, optimized individual you always suspected you were — consider sending something to the person who built it.

No pressure. The machine will continue running either way. But the human behind it runs on coffee.

**[→ Buy Sam a coffee on Ko-fi](https://ko-fi.com/samcus)**

*Every donation is a small act of solidarity between those of us who refuse to leave compute on the table.*