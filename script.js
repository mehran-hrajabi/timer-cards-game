/* ------------------ STATE ------------------ */
let sentences = JSON.parse(localStorage.getItem("sentences")) || [];
let revealed = new Set(JSON.parse(localStorage.getItem("revealed")) || []);

let chosenTime = JSON.parse(localStorage.getItem("chosenTime")) || null;
let remainingSeconds =
  JSON.parse(localStorage.getItem("remainingSeconds")) || null;
let timerInterval = null;

const timerOptions = ["1", "5", "10", "choice"];

/* ------------------ DOM ------------------ */
const sentenceInput = document.getElementById("sentenceInput");
const addBtn = document.getElementById("addBtn");
const startBtn = document.getElementById("startBtn");
const resetAllBtn = document.getElementById("resetAllBtn");
const sentenceContainer = document.getElementById("sentenceContainer");

const randomTimerBtn = document.getElementById("randomTimerBtn");
const customTimeInput = document.getElementById("customTimeInput");
const startTimerBtn = document.getElementById("startTimerBtn");
const timeDisplay = document.getElementById("timeDisplay");

/* ------------------ AUDIO (WebAudio + fallback) ------------------ */
let audioCtx = null;

function ensureAudioContext() {
  if (!("AudioContext" in window || "webkitAudioContext" in window))
    return false;

  if (!audioCtx) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    } catch (e) {
      audioCtx = null;
      return false;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return true;
}

const fallbackBeep = new Audio(
  "data:audio/wav;base64,UklGRoQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQgAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI="
);

function playBeepMs(duration = 180, frequency = 880, type = "sine") {
  if (ensureAudioContext() && audioCtx) {
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + duration / 1000 + 0.02);
      return;
    } catch {}
  }

  try {
    fallbackBeep.currentTime = 0;
    void fallbackBeep.play();
  } catch {}
}

function playFinalBeep() {
  // deeper + longer beep
  playBeepMs(350, 330, "square");
}

/* ------------------ SAVE ------------------ */
function saveState() {
  localStorage.setItem("sentences", JSON.stringify(sentences));
  localStorage.setItem("revealed", JSON.stringify([...revealed]));
  localStorage.setItem("chosenTime", JSON.stringify(chosenTime));
  localStorage.setItem("remainingSeconds", JSON.stringify(remainingSeconds));
}

/* ------------------ UTILS ------------------ */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ------------------ RENDER CARDS ------------------ */
function renderSentenceCards(showText = true, order = null) {
  sentenceContainer.innerHTML = "";
  const indices = order || sentences.map((_, i) => i);

  indices.forEach((index) => {
    const text = sentences[index];
    const isRevealed = revealed.has(index);

    const card = document.createElement("div");
    card.className = "card";
    card.dataset.index = index;

    card.textContent = showText || isRevealed ? text : "";
    if (isRevealed) card.classList.add("revealed");

    card.addEventListener("click", () => {
      if (revealed.has(index)) return;
      revealed.add(index);
      saveState();
      renderSentenceCards(false, indices);
    });

    if (isRevealed) {
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "✕";
      removeBtn.className = "remove-btn";
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeSentence(index);
      };
      card.appendChild(removeBtn);
    }

    sentenceContainer.appendChild(card);
  });
}

function removeSentence(index) {
  sentences.splice(index, 1);

  const newSet = new Set();
  [...revealed].forEach((i) => {
    if (i < index) newSet.add(i);
    else if (i > index) newSet.add(i - 1);
  });
  revealed = newSet;

  saveState();
  renderSentenceCards(false);
}

/* ------------------ ADD SENTENCE ------------------ */
addBtn.onclick = () => {
  const val = sentenceInput.value.trim();
  if (!val) return;
  sentences.push(val);
  sentenceInput.value = "";
  saveState();
  renderSentenceCards(true);
};

/* ------------------ RESET ALL ------------------ */
resetAllBtn.onclick = () => {
  sentences = [];
  revealed = new Set();
  chosenTime = null;
  remainingSeconds = null;

  startTimerBtn.disabled = false;
  randomTimerBtn.disabled = false;

  customTimeInput.style.display = "none";
  timeDisplay.textContent = "";

  saveState();
  renderSentenceCards(true);
};

/* ------------------ START GAME ------------------ */
startBtn.onclick = () => {
  if (!sentences.length) return;
  revealed = new Set();
  saveState();

  const indices = sentences.map((_, i) => i);
  shuffleArray(indices);

  renderSentenceCards(false, indices);
};

/* ------------------ TIMER LOGIC ------------------ */
randomTimerBtn.onclick = () => {
  const rand = timerOptions[Math.floor(Math.random() * timerOptions.length)];

  if (rand === "choice") {
    customTimeInput.style.display = "block";
    chosenTime = null;
    timeDisplay.textContent = "Your Choice";
  } else {
    customTimeInput.style.display = "none";
    chosenTime = parseInt(rand);
    timeDisplay.textContent = `${chosenTime} min`;
  }
  saveState();
};

startTimerBtn.onclick = () => {
  ensureAudioContext();

  if (!chosenTime && customTimeInput.style.display === "block") {
    const v = parseInt(customTimeInput.value);
    if (!v || v <= 0) return alert("Enter valid time");
    chosenTime = v;
    timeDisplay.textContent = `${chosenTime} min`;
    saveState();
  }
  if (!chosenTime) return;

  remainingSeconds = chosenTime * 60;
  saveState();

  startCountdown();

  startTimerBtn.disabled = true;
  randomTimerBtn.disabled = true;
};

/* ------------------ COUNTDOWN ------------------ */
function startCountdown() {
  if (!remainingSeconds) return;

  startTimerBtn.disabled = true;
  randomTimerBtn.disabled = true;

  timerInterval = setInterval(() => {
    remainingSeconds--;

    updateTimeUI(); // ✅ restore UI update behavior

    // Short beeps: 3 → 2 → 1
    if (
      remainingSeconds === 3 ||
      remainingSeconds === 2 ||
      remainingSeconds === 1
    ) {
      playBeepMs(180, 880);
    }

    // Final different beep at 0
    if (remainingSeconds === 0) {
      playBeepMs(350, 330, "square");
    }

    // Stop after 0
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);

      timeDisplay.textContent = "DONE!";
      chosenTime = null;
      remainingSeconds = null;
      saveState();

      customTimeInput.style.display = "none";

      startTimerBtn.disabled = false;
      randomTimerBtn.disabled = false;
      return;
    }
  }, 1000);
}

function updateTimeUI() {
  if (!remainingSeconds) {
    timeDisplay.textContent = "";
    return;
  }
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  timeDisplay.textContent = `${m}:${s.toString().padStart(2, "0")}`;
}

/* ------------------ LOAD ------------------ */
renderSentenceCards(true);

if (remainingSeconds) {
  startTimerBtn.disabled = true;
  randomTimerBtn.disabled = true;

  const indices = sentences.map((_, i) => i);
  shuffleArray(indices);
  renderSentenceCards(false, indices);

  startCountdown();
}
