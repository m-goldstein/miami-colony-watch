// A code-native illustration: its motion follows saved simulator events.
export const habitatScene = `
<svg viewBox="0 0 1000 530" role="img" aria-labelledby="habitat-svg-title habitat-svg-description">
  <title id="habitat-svg-title">A sheltered community-cat feeding corner</title>
  <desc id="habitat-svg-description">Two relaxed illustrated cats, a covered feeder with a guarded mechanism, a water bowl, a raised resting bed, and a controller connected to a shared hub. The controls below demonstrate proposed hardware.</desc>
  <defs>
    <linearGradient id="habitat-sky" x2="0" y2="1"><stop stop-color="#d8ede4"/><stop offset="1" stop-color="#f0f4de"/></linearGradient>
    <linearGradient id="habitat-board" x2="1" y2="1"><stop stop-color="#20796c"/><stop offset="1" stop-color="#104e47"/></linearGradient>
    <pattern id="habitat-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#a6c7b7" opacity=".35"/></pattern>
  </defs>
  <rect width="1000" height="530" rx="24" fill="url(#habitat-sky)"/>
  <rect width="1000" height="530" rx="24" fill="url(#habitat-grid)"/>
  <g class="habitat-sun"><circle cx="825" cy="94" r="34" fill="#f6d789"/><circle cx="825" cy="94" r="47" fill="none" stroke="#eacb7d" stroke-dasharray="3 12" stroke-width="3"/></g>
  <g class="habitat-cloud" fill="#f8fbef"><path d="M668 87c-12-32-48-24-51-4-28-15-47 8-36 22h110c12-19-4-28-23-18Z"/><path d="M168 64c-10-22-34-20-39-4-22-6-31 6-28 17h85c6-15-8-21-18-13Z"/></g>
  <path d="M0 405Q175 357 335 393T670 389T1000 378V530H0Z" fill="#bed6b4"/>
  <path d="M0 445Q206 398 415 432T820 430T1000 422V530H0Z" fill="#d9dfbc"/>
  <g class="habitat-plant" fill="#598a6c"><path d="M85 409q10-88-37-125 3 77 37 125Z"/><path d="M84 409q-2-110 42-145 6 88-42 145Z"/><path d="M87 408q37-80 80-82-24 62-80 82Z"/><path d="M86 407q-52-56-79-47 17 43 79 47Z"/></g>
  <g class="habitat-plant habitat-plant-right" fill="#729474"><path d="M922 418q-15-90 28-122 1 80-28 122Z"/><path d="M922 418q-54-59-83-45 30 41 83 45Z"/><path d="M926 421q28-66 67-68-14 53-67 68Z"/></g>
  <ellipse cx="506" cy="442" rx="353" ry="29" fill="#64775d" opacity=".13"/>
  <!-- An open-sided, shaded structure; animals are never restrained. -->
  <path d="M208 197h570v214H208Z" fill="#b9cec0" opacity=".4"/>
  <path d="M205 182v245M771 182v245" stroke="#597e70" stroke-width="13" stroke-linecap="round"/>
  <path d="m172 191 65-61h511l62 61Z" fill="#267c70"/>
  <path d="M172 191h638" stroke="#15564e" stroke-width="12" stroke-linecap="round"/>
  <path d="M250 143h481" stroke="#70a28c" stroke-width="3" stroke-linecap="round"/>
  <rect x="400" y="150" width="179" height="25" rx="12" fill="#e1ecce"/><text x="490" y="167" text-anchor="middle" fill="#315c4d" font-size="11" letter-spacing="2">THE CARE CORNER</text>
  <!-- Removable dry-food hopper, guarded gate and open bowl. -->
  <rect x="303" y="225" width="116" height="143" rx="15" fill="#f7efd8" stroke="#b6b58e" stroke-width="2"/>
  <rect x="315" y="238" width="92" height="81" rx="8" fill="#e4bb75"/>
  <path d="m315 288 21 10 20-12 22 13 29-14v26a8 8 0 0 1-8 8h-76a8 8 0 0 1-8-8Z" fill="#bf9158"/>
  <g fill="#8b6e42"><ellipse cx="333" cy="263" rx="5" ry="3"/><ellipse cx="358" cy="281" rx="5" ry="3"/><ellipse cx="390" cy="256" rx="5" ry="3"/><ellipse cx="383" cy="302" rx="5" ry="3"/></g>
  <rect x="341" y="229" width="39" height="10" rx="4" fill="#759b8c"/><path class="habitat-sonar" d="M350 247q12 9 24 0m-30 9q19 13 37 0" fill="none" stroke="#6f9478" stroke-width="2"/>
  <text x="361" y="341" text-anchor="middle" font-size="11" fill="#567763">DRY RESERVE</text>
  <path d="M340 368h42l-8 25h-26Z" fill="#a9b5a0"/>
  <rect class="habitat-gate" x="341" y="372" width="39" height="5" rx="2" fill="#315e54"/>
  <rect x="408" y="340" width="28" height="30" rx="6" fill="#de9e76"/><path d="m421 351-24 22h-16" fill="none" stroke="#9b765b" stroke-width="5"/>
  <g class="habitat-kibble" fill="#a97b43"><circle cx="352" cy="394" r="3"/><circle cx="364" cy="388" r="3"/><circle cx="374" cy="398" r="3"/></g>
  <path d="M321 407h85l-12 23h-61Z" fill="#d4876c"/><ellipse cx="363" cy="406" rx="43" ry="7" fill="#edba91"/>
  <!-- RFID close-pass loop; low-power signal is an illustration, not a range claim. -->
  <path d="M459 419V301a43 43 0 0 1 86 0v118" fill="none" stroke="#84b9a7" stroke-width="9"/>
  <path d="M468 417V304a34 34 0 0 1 68 0v113" fill="none" stroke="#d3ebd5" stroke-width="2"/>
  <g class="habitat-rfid-waves" fill="none" stroke="#3a9e88" stroke-width="2"><ellipse cx="503" cy="340" rx="54" ry="44"/><ellipse cx="503" cy="340" rx="67" ry="55"/></g>
  <!-- Mango, with a soft breathing motion and a moving tail. -->
  <g class="habitat-cat">
    <path class="habitat-tail" d="M594 400q55 19 49-24-2-18-18-19" fill="none" stroke="#c58e50" stroke-width="16" stroke-linecap="round"/>
    <ellipse cx="565" cy="389" rx="51" ry="34" fill="#d9a362"/>
    <path d="M528 413v13h18v-19m35 5v14h18v-23" fill="#edd8ad"/>
    <path d="m491 373 3-49 23 15h22l22-16 2 52q-4 35-37 34-33-2-35-36Z" fill="#e1af71"/>
    <path d="m499 335 2 17 10-8m40-9-2 17-10-8" fill="#d3927f"/>
    <path d="m516 340 6 14m7-15-1 13m12-10-5 12" fill="none" stroke="#a77946" stroke-width="4" stroke-linecap="round"/>
    <path class="habitat-cat-eyes" d="m503 370 9-2m26 0 9 2" stroke="#435749" stroke-width="3" stroke-linecap="round"/>
    <path d="m519 381 7 4 7-4" fill="#ad735c"/><path d="M511 389q15 15 29-1" fill="#f6e9c9"/>
    <path d="m578 368-5 14m16-8-5 13m-26-23-3 11" stroke="#b37e45" stroke-width="6" stroke-linecap="round"/>
  </g>
  <!-- A clean water bowl and raised, washable resting surface. -->
  <path d="M600 431h76l-11 19h-54Z" fill="#6fa89e"/><ellipse cx="638" cy="431" rx="38" ry="7" fill="#b7ded3"/><ellipse class="habitat-water" cx="638" cy="431" rx="18" ry="3" fill="none" stroke="#6ca99f" stroke-width="1.5"/>
  <rect x="665" y="386" width="91" height="17" rx="7" fill="#879b76"/><path d="M676 401v14m69-14v14" stroke="#6b866e" stroke-width="7"/>
  <g class="habitat-sleepy"><ellipse cx="709" cy="373" rx="36" ry="19" fill="#738c83"/><path d="m675 372 2-24 13 8 10-10 5 27Z" fill="#8da69a"/><path d="m680 369 7 2m8-2 6-2" stroke="#344f47" stroke-width="2" stroke-linecap="round"/><path d="M736 371q14 21-19 16" fill="none" stroke="#a6bbb0" stroke-width="9" stroke-linecap="round"/></g>
  <g class="habitat-snooze" fill="#527869" font-size="13"><text x="726" y="343">z</text><text x="741" y="328" font-size="17">z</text></g>
  <!-- Edge board inset, with gold paths to each subsystem. -->
  <path class="habitat-trace" d="M263 300h24v-66h54M263 318h25v61h50M263 335h17v104h180M241 342v112h585v-202" stroke="#dbbb76" stroke-width="2" fill="none" stroke-dasharray="6 7"/>
  <rect x="173" y="253" width="92" height="93" rx="11" fill="url(#habitat-board)" stroke="#b8cdb5" stroke-width="3"/>
  <rect x="193" y="268" width="48" height="39" rx="4" fill="#bdcac0"/><path d="m199 277 6-5 6 5 6-5 6 5 9-5" stroke="#6b8076" stroke-width="2" fill="none"/>
  <text x="217" y="297" font-size="7" text-anchor="middle" fill="#315c50">ESP32</text><text x="217" y="334" font-size="8" text-anchor="middle" fill="#dce8c8">EDGE NODE</text>
  <g fill="#d9bb75"><rect x="180" y="272" width="5" height="22" rx="1"/><rect x="248" y="272" width="5" height="22" rx="1"/><rect x="196" y="314" width="8" height="7" rx="1"/><rect x="211" y="314" width="8" height="7" rx="1"/></g><circle class="habitat-led" cx="240" cy="318" r="4" fill="#b7e18e"/>
  <g class="habitat-hub"><rect x="797" y="220" width="66" height="66" rx="14" fill="#f9f5e7" stroke="#a8c5b1" stroke-width="2"/><path d="M830 220v-18" stroke="#487e6b" stroke-width="4" stroke-linecap="round"/><circle class="habitat-hub-led" cx="829" cy="243" r="5" fill="#68ab89"/><text x="830" y="270" text-anchor="middle" font-size="10" fill="#4e7766">HUB</text><path class="habitat-hub-waves" d="M811 202q19-21 38 0m-46-8q27-29 54 0" fill="none" stroke="#5d9d83" stroke-width="2"/></g>
  <g class="habitat-rain" stroke="#79a89f" stroke-width="2.5" stroke-linecap="round"><path d="m93 122-6 17m71 7-6 17m715-28-6 17m44 35-6 17m39-93-6 17m-83 94-6 17m-700-10-6 17m820-10-6 17m-867 28-6 17"/></g>
  <g fill="#416d5d" font-size="11" font-family="inherit"><text x="216" y="477" text-anchor="middle">01 · LOCAL BRAIN</text><text x="363" y="477" text-anchor="middle">02 · GUARDED FEEDER</text><text x="527" y="477" text-anchor="middle">03 · A FAMILIAR VISITOR</text><text x="714" y="477" text-anchor="middle">04 · ROOM TO REST</text></g>
</svg>`;

export const habitatMarkup = `<div class="habitat-heading"><div><span class="eyebrow">SOUTH POINT PARK · A STATION WITH A PURPOSE</span><h3>Good care, down to the little details.</h3><p>Explore a shaded, open feeding corner designed around the cats.</p></div><button id="habitat-motion" class="button outline small" type="button" aria-pressed="false">Pause motion</button></div>
<div id="habitat-scene" class="habitat-scene" data-weather="calm" data-hub="online" data-fault="none"><div class="habitat-scene-label"><span class="habitat-dot"></span>ILLUSTRATED HABITAT <b>SIMULATED</b></div>${habitatScene}<div class="habitat-scene-caption"><span>Open access</span><span>Covered food</span><span>Fresh water by caregivers</span><span>Shaded resting space</span></div></div>
<div class="habitat-dashboard"><div><span>Proposed climate probe</span><b id="habitat-climate">26°C · 56% RH</b><small>Simulated · humidity is not in the kit</small></div><div><span>Visitor log</span><b id="habitat-visitor">Ready for Mango</b><small id="habitat-visitor-note">One cat, one reviewed identity</small></div><div><span>Care hub</span><b id="habitat-connection">Ready to sync</b><small id="habitat-queue">0 packets waiting</small></div></div>
<div class="habitat-controls"><div class="habitat-weather-controls" role="group" aria-label="Simulated habitat weather"><button type="button" data-habitat-weather="calm" aria-pressed="true">☀ Sheltered day</button><button type="button" data-habitat-weather="rain" aria-pressed="false">☂ Rain arrives</button><button type="button" data-habitat-weather="humid" aria-pressed="false">◌ Humid afternoon</button></div><div class="habitat-event-controls"><button type="button" id="habitat-read" class="button dark small">Mango visits ↗</button><button type="button" id="habitat-feed" class="button outline small">Preview food gate</button><button type="button" id="habitat-offline" class="button outline small">Take hub offline</button></div></div><p id="habitat-status" class="habitat-status" role="status">Choose a scene or a device action. Every event stays in the exercise.</p><p class="habitat-disclaimer">Concept animation, not a welfare assessment. RFID, humidity, the food gate and wireless links are simulated; physical-kit readings are available in Live Arduino.</p>`;
