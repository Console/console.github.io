let sequence = [];
let userSequence = [];
let level = 0;

// Create audio context
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine'; // 'sine' wave type for a smooth beep sound
    oscillator.frequency.value = frequency; // frequency of the beep
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01); // quick fade in
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3); // fade out over 300ms

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3); // stop after 300 ms
}

// Map each color to a different frequency
const colorFrequencies = {
    'green': 392, // G4
    'red': 440,   // A4
    'yellow': 493.88, // B4
    'blue': 523.25 // C5
};

function nextSequence() {
    userSequence = [];
    level++;
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
    userSequence.push(color);
    playSound(colorFrequencies[color]);
    if (userSequence[userSequence.length - 1] !== sequence[userSequence.length - 1]) {
        alert("Game Over. Press OK to restart.");
        sequence = [];
        level = 0;
        nextSequence();
    } else if (userSequence.length === sequence.length) {
        setTimeout(() => {
            nextSequence();
        }, 1000);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    nextSequence();
});
