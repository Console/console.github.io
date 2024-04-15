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
    // Create a new paragraph for each message
    let messageParagraph = document.createElement('p');
    messageParagraph.textContent = message;
    messageDisplay.appendChild(messageParagraph);  // Append the new message as a paragraph
}

function checkLevelMilestones() {
    switch(level) {
        case 10:
            displayMessage('Here have a flag for your efforts. flag{Anything_you_can_do}');
            break;
        case 15:
            displayMessage('Oooh... looks like you are good at this. flag{I_can_d0_better}');
            break;
        case 20:
            displayMessage('Amazing! You deserve this. Carry on if you wish but this is the last flag you will get flag{I_c4n_d0_anyt41ng_b3tt3r_th4n_y0u!}');
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

// Rest of your JavaScript code...


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
