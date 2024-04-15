const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let sequence = [];
let userSequence = [];
let level = 0;
let gameActive = false;

function playSound(frequency) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
}

const colorFrequencies = {
    'green': 392,
    'red': 440,
    'yellow': 493.88,
    'blue': 523.25
};

function nextSequence() {
    if (!gameActive) return;
    userSequence = [];
    level++;
    document.getElementById('level-display').innerText = `Level: ${level}`;
    const colors = ['green', 'red', 'yellow', 'blue'];
    sequence.push(colors[Math.floor(Math.random() * colors.length)]);
    sequence.forEach((color, index) => {
        setTimeout(() => {
            document.getElementById(color).style.opacity = 1;
            playSound(colorFrequencies[color]);
            setTimeout(() => {
                document.getElementById(color).style.opacity = 0.8;
            }, 500);
        }, 1000 * index);
    });
}

function tryColor(color) {
    if (!gameActive) return;
    userSequence.push(color);
    playSound(colorFrequencies[color]);
    if (userSequence[userSequence.length - 1] !== sequence[userSequence.length - 1]) {
        alert("Game Over. Press OK to restart.");
        stopResetGame();
    } else if (userSequence.length === sequence.length) {
        setTimeout(() => {
            nextSequence();
        }, 1000);
    }
}

function startGame() {
    if (gameActive) return;
    gameActive = true;
    level = 0;
    sequence = [];
    nextSequence();
}

function stopResetGame() {
    gameActive = false;
    sequence = [];
    level = 0;
    document.getElementById('level-display').innerText = "Level: 0";
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('level-display').innerText = "Level: 0";
});
