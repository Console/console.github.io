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

function displayMessage(message) {
    const messageDisplay = document.getElementById('message-display');
    let messageParagraph = document.createElement('p');
    messageParagraph.textContent = message;
    messageDisplay.appendChild(messageParagraph);
}

function checkLevelMilestones() {
    switch(level) {
        case 3:
            displayMessage('Great job! You reached Level 10!');
            break;
        case 5:
            displayMessage('Awesome! Level 20 mastered!');
            break;
        case 8:
            displayMessage('Incredible! Level 30! Keep going!');
            break;
    }
}

function nextSequence() {
    if (!gameActive) return;
    userSequence = [];
    level++;
    document.getElementById('level-display').innerText = `Level: ${level}`;
    checkLevelMilestones();
    const colors = ['green', 'red', 'yellow', 'blue'];
    sequence.push(colors[Math.floor(Math.random() * colors.length)]);
    sequence.forEach((color, index) => {
        setTimeout(() => {
            const colorElement = document.getElementById(color);
            colorElement.classList.add('highlight');
            playSound(colorFrequencies[color]);
            setTimeout(() => {
                colorElement.classList.remove('highlight');
            }, 500);
        }, 1000 * index);
    });
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
    // Optionally clear the message when the game stops/resets
    document.getElementById('message-display').innerHTML = ""; 
}

// Initialization code
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('level-display').innerText = "Level: 0";
});

