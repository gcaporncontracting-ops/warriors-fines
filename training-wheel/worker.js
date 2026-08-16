// clfc-training-wheel — "Who'll be at training this week?"
//
// NOT DEPLOYED. Same build concept as clfc-first-goal-scorer: PIN entry,
// spin a wheel populated from PlayHQ-registered players, land on someone.
// Deliberately has NONE of FGS's stakes-handling: no D1, no entries, no
// payment flow, no lockouts, no "already spun" tracking. Every spin is
// a fresh, independent, purely-for-fun pick with nothing persisted.
//
// Requires (not yet configured):
//   - VOTES_KV binding (same shared namespace as hub / FGS / vote-v2) \u2014
//     this is the ONLY binding needed. No D1 at all.
//
// DATA GAP TO KNOW ABOUT BEFORE DEPLOYING:
// "Entire list of registered players in all 4 teams" pulls from
// gradelist:<grade> in VOTES_KV. Those lists only exist for grades in
// FGS's VOTE_LINKED_GRADES constant, which today is
// ["League", "Reserves", "Colts"] \u2014 Thirds is NOT included, so Thirds
// players have never been PIN-registered and won't appear on this wheel
// (or be able to spin it) until that's changed. Same gap flagged in the
// voting build. One-line fix in FGS (add "Thirds" to VOTE_LINKED_GRADES)
// covers this wheel, PIN issuance, and Players' Player all at once \u2014
// your call on whether Thirds should be in that system before this goes
// live, since it's a shared switch, not something scoped to just this
// feature.

const ADMIN_PASSCODE = "Warriors-Kick-9247"; // same as FGS, for consistency \u2014 change if you'd rather this app has its own

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/'/g, "");
}

// Union of every registered grade list, deduped by slug. A player rostered
// in more than one grade (fringe players) only appears once \u2014 "entire
// list of registered players/members," not one wheel slot per grade.
async function getAllRegisteredPlayers(env) {
  const grades = ["League", "Reserves", "Colts", "Thirds"];
  const seen = new Map(); // slug -> name
  for (const grade of grades) {
    const raw = await env.VOTES_KV.get(`gradelist:${grade}`);
    if (!raw) continue;
    const names = JSON.parse(raw);
    for (const name of names) {
      const slug = slugify(name);
      if (!seen.has(slug)) seen.set(slug, name);
    }
  }
  return [...seen.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Same PIN pattern as every other app \u2014 any registered player can
    // spin, not just this week's named team, since this is just for a
    // laugh and everything else about it is deliberately unlocked.
    if (pathname === "/api/auth/pin" && request.method === "POST") {
      const { pin, adminPasscode } = await request.json().catch(() => ({}));
      if (!pin || !/^\d{4}$/.test(pin)) return json({ error: "Enter a 4-digit PIN" }, 400);
      if (pin === "0000") {
        if (adminPasscode !== ADMIN_PASSCODE) return json({ error: "Incorrect PIN" }, 401);
        return json({ ok: true, fullName: "Testing" });
      }
      const slug = await env.VOTES_KV.get(`pinused:${pin}`);
      if (!slug) return json({ error: "Incorrect PIN" }, 401);
      const fullName = await env.VOTES_KV.get(`name:${slug}`) || slug;
      return json({ ok: true, fullName });
    }

    // The full wheel population \u2014 fetched fresh every time the wheel
    // page loads. No caching, no "current round" concept: this is always
    // just "everyone currently registered," full stop.
    if (pathname === "/api/players" && request.method === "GET") {
      const players = await getAllRegisteredPlayers(env);
      return json({ players });
    }

    return new Response(INDEX_HTML_CONTENT, {
      headers: { "Content-Type": "text/html", "Cache-Control": "no-cache, must-revalidate" }
    });
  }
};

const INDEX_HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CLFC Who's At Training?</title>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{
    --navy:#132a6e; --navy-deep:#0b1c4d; --red:#d62828; --blue:#1d4fd8; --gold:#f2b134;
    --ink:#14161c; --paper:#f6f3ec; --line:rgba(20,22,28,.14);
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{
    font-family:'Work Sans', sans-serif; color:#fff; min-height:100vh;
    background:linear-gradient(180deg, var(--navy-deep) 0%, #0d234f 40%, #123267 100%);
  }
  .wrap{max-width:520px;margin:0 auto;padding:24px 18px 60px;position:relative;}
  .home-link{
    position:absolute;top:8px;left:18px;
    font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
    color:rgba(255,255,255,.75);text-decoration:none;
    background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);
    padding:6px 12px;border-radius:999px;
  }
  .eyebrow{
    font-family:'JetBrains Mono',monospace;letter-spacing:.2em;text-transform:uppercase;
    font-size:11px;color:var(--gold);text-align:center;margin:0 0 6px;
  }
  h1.title{
    font-family:'Anton',sans-serif;text-transform:uppercase;text-align:center;
    font-size:clamp(24px,7vw,34px);margin:0 0 6px;line-height:1;
  }
  .subtitle{text-align:center;font-size:13.5px;color:rgba(255,255,255,.75);margin:0 0 26px;}
  .laugh-note{background:#eef2ff;border:2px solid var(--blue);border-radius:14px;padding:14px 16px;margin-bottom:16px;color:var(--ink);font-size:13px;line-height:1.5;text-align:center;}
  .laugh-note strong{color:var(--red);}
  .card{
    background:var(--paper);border-radius:16px;padding:24px 20px;color:var(--ink);
    box-shadow:0 18px 40px rgba(0,0,0,.35);
  }
  label{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--navy);margin:14px 0 6px;}
  input[type=tel]{
    width:100%;font-size:17px;padding:12px 14px;border:1.5px solid var(--line);border-radius:10px;
    background:#fff;color:var(--ink);text-align:center;letter-spacing:2px;
  }
  button.primary{
    width:100%;margin-top:18px;font-family:'JetBrains Mono',monospace;font-weight:700;
    letter-spacing:.04em;text-transform:uppercase;background:var(--red);color:#fff;border:none;
    border-radius:10px;padding:14px;font-size:14.5px;cursor:pointer;box-shadow:0 6px 0 #9c1c1c;
  }
  button.primary:active{transform:translateY(3px);box-shadow:0 3px 0 #9c1c1c;}
  button.primary:disabled{opacity:.5;cursor:not-allowed;}
  .error{color:var(--red);font-size:13.5px;font-weight:600;margin-top:12px;text-align:center;}

  .wheel-wrap{position:relative;width:min(84vw,340px);aspect-ratio:1;margin:20px auto 0;}
  .wheel-wrap canvas{width:100%;height:100%;border-radius:50%;box-shadow:0 0 0 6px var(--navy),0 12px 30px rgba(0,0,0,.35);}
  .wheel-wrap .pointer{
    position:absolute;top:-16px;left:50%;transform:translateX(-50%);width:0;height:0;
    border-left:16px solid transparent;border-right:16px solid transparent;border-top:30px solid var(--red);
    z-index:5;filter:drop-shadow(0 3px 3px rgba(0,0,0,.4));
  }
  .result-box{text-align:center;margin-top:20px;}
  .result-box .big-tick{font-size:44px;}
  .result-box h2{font-family:'Anton',sans-serif;text-transform:uppercase;margin:6px 0 4px;font-size:20px;color:var(--navy);}
  .result-box .player-name{font-family:'Anton',sans-serif;text-transform:uppercase;font-size:28px;color:var(--red);margin:6px 0 14px;}
  .center{text-align:center;}
  .back-link{
    display:inline-block;margin-top:18px;font-family:'JetBrains Mono',monospace;font-size:12px;
    color:rgba(255,255,255,.7);text-decoration:none;text-align:center;cursor:pointer;
  }
</style>
</head>
<body>
<div class="wrap" id="app"></div>

<script>
const app = document.getElementById("app");

function heroHTML(sub){
  return \`
    <a href="https://warriors-hub.gcaporncontracting.workers.dev/" class="home-link">\u2190 Home</a>
    <p class="eyebrow">Cockburn Lakes F.C.</p>
    <h1 class="title">Who's At Training?</h1>
    <p class="subtitle">\${sub}</p>
  \`;
}

function main(){ renderPinScreen(); }

function renderPinScreen(){
  app.innerHTML = \`
    \${heroHTML("Enter your PIN to spin")}
    <div class="laugh-note">Just a bit of fun \u2014 doesn't mean anything, doesn't lock you out of anything else. Spin as many times as you like.</div>
    <div class="card">
      <label for="pinInput">Your PIN</label>
      <input type="tel" id="pinInput" inputmode="numeric" maxlength="4" placeholder="\u2022\u2022\u2022\u2022">
      <button class="primary" id="pinBtn">Continue</button>
      <div id="pinError"></div>
    </div>
  \`;
  const btn = document.getElementById("pinBtn");
  btn.addEventListener("click", async ()=>{
    const pin = document.getElementById("pinInput").value.trim();
    const errBox = document.getElementById("pinError");
    errBox.innerHTML = "";
    if (!/^\\d{4}$/.test(pin)){ errBox.innerHTML = \`<p class="error">Enter a 4-digit PIN.</p>\`; return; }
    let adminPasscode = null;
    if (pin === "0000"){ adminPasscode = prompt("Admin passcode:"); if (!adminPasscode) return; }
    btn.disabled = true;
    try{
      const res = await fetch("/api/auth/pin", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ pin, adminPasscode }) });
      const data = await res.json();
      if (!res.ok){ errBox.innerHTML = \`<p class="error">\${data.error}</p>\`; btn.disabled = false; return; }
      renderWheel(data.fullName);
    }catch(e){
      errBox.innerHTML = \`<p class="error">Network error \u2014 try again.</p>\`;
      btn.disabled = false;
    }
  });
}

async function renderWheel(fullName){
  app.innerHTML = \`\${heroHTML("Loading the club...")}<div class="card"><p style="text-align:center;">One sec...</p></div>\`;
  const res = await fetch("/api/players");
  const data = await res.json();
  const players = data.players || [];
  if (players.length === 0){
    app.innerHTML = \`\${heroHTML("")}<div class="card"><p class="error">No registered players found yet \u2014 try again later.</p></div>\`;
    return;
  }
  const names = players.map(p => p.name);

  app.innerHTML = \`
    \${heroHTML("Hey " + fullName + " \u2014 spin away")}
    <div class="card">
      <div class="wheel-wrap">
        <div class="pointer"></div>
        <canvas id="wheelCanvas"></canvas>
      </div>
      <button class="primary" id="spinBtn" style="margin-top:20px;">Spin the wheel</button>
      <div id="resultArea"></div>
    </div>
    <div class="center"><a class="back-link" id="startOverLink">Start over</a></div>
  \`;
  document.getElementById("startOverLink").addEventListener("click", ()=> main());

  drawWheel(names);
  document.getElementById("spinBtn").addEventListener("click", async ()=>{
    const btn = document.getElementById("spinBtn");
    btn.disabled = true;
    btn.textContent = "Spinning...";
    const targetIndex = Math.floor(Math.random() * names.length);
    await spinWheel(targetIndex, names.length);
    document.getElementById("resultArea").innerHTML = \`
      <div class="result-box">
        <div class="big-tick">\u{1F3C8}</div>
        <h2>At training this week...</h2>
        <div class="player-name">\${names[targetIndex]}</div>
      </div>
    \`;
    btn.disabled = false;
    btn.textContent = "Spin again";
  });
}

// ---- Wheel drawing/animation \u2014 same code and pointer math as FGS ----
let wheelRotation = 0;
function drawWheel(options){
  const canvas = document.getElementById("wheelCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width = 800, h = canvas.height = 800;
  const cx = w/2, cy = h/2, rad = w/2 - 10;
  const slice = (Math.PI*2)/options.length;
  ctx.clearRect(0,0,w,h);
  options.forEach((opt, i)=>{
    const ang = i*slice;
    ctx.beginPath();
    ctx.fillStyle = i%2===0 ? "#132a6e" : "#1d4fd8";
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,rad,ang,ang+slice);
    ctx.fill();
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(ang + slice/2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "bold " + (options.length > 24 ? 14 : 20) + "px 'JetBrains Mono'";
    ctx.fillText(opt, rad-24, 6);
    ctx.restore();
  });
}
function spinWheel(targetIndex, totalOptions, durationMs){
  return new Promise(resolve=>{
    const canvas = document.getElementById("wheelCanvas");
    const sliceDeg = 360 / totalOptions;
    const targetDeg = 270 - (targetIndex * sliceDeg) - (sliceDeg/2);
    const rotations = 10 + Math.floor(Math.random()*4);
    const finalDeg = wheelRotation + rotations*360 + ((targetDeg - (wheelRotation%360)) + 360)%360;
    const start = performance.now(), duration = durationMs || 6500, startDeg = wheelRotation;
    function frame(t){
      const elapsed = t-start, progress = Math.min(elapsed/duration,1);
      const eased = 1 - Math.pow(1-progress,4);
      wheelRotation = startDeg + (finalDeg-startDeg)*eased;
      canvas.style.transform = \`rotate(\${wheelRotation}deg)\`;
      if (progress<1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

main();
<\/script>
</body>
</html>
`;
