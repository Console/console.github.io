// Get game canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Get developer panel elements
const devToggleBtn = document.getElementById('devToggleBtn');
const devCanvas = document.getElementById('devCanvas');
const devCtx = devCanvas.getContext('2d');
let devPanelVisible = false;

// Global variable for the current pitch detected
let currentPitch = 0;
// Global frequency history to store pitch values (with timestamps) over the last 5 seconds
let frequencyHistory = [];

// Define the game character as a black square
let character = {
  x: 100,
  y: canvas.height / 2,
  size: 30 // side length of the square
};

// Array to hold wall objects and constants for spacing/speed
let walls = [];
const wallSpacing = 300;    // Horizontal distance between walls
const wallSpeed = 2;        // Speed at which walls scroll left

// Initialize walls with a randomly placed hole in each
function initWalls() {
  for (let x = canvas.width; x < canvas.width * 2; x += wallSpacing) {
    walls.push({
      x: x,
      width: 50,
      // Choose a random hole position (ensuring the gap fits within the canvas)
      holeY: Math.random() * (canvas.height - 150) + 50,
      holeHeight: 150
    });
  }
}
initWalls();

//
// Audio setup and pitch detection
//

// Create the AudioContext for processing microphone input
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Resume AudioContext on a user gesture to prevent auto-start errors
const startBtn = document.getElementById('startBtn');
startBtn.addEventListener('click', () => {
  audioContext.resume().then(() => {
    console.log("AudioContext resumed");
    startBtn.style.display = 'none';
    // Request microphone access and set up an AnalyserNode
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        // Begin processing audio input
        updateAudio(analyser);
      })
      .catch(err => console.error('Audio access error:', err));
  });
});

//
// Pitch detection using an autocorrelation algorithm
//
function detectPitch(buffer, sampleRate) {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // Low volume = silence

  let bestOffset = -1;
  let bestCorrelation = 0;
  let lastCorrelation = 1;
  
  for (let offset = 0; offset < SIZE; offset++) {
    let correlation = 0;
    for (let i = 0; i < SIZE - offset; i++) {
      correlation += buffer[i] * buffer[i + offset];
    }
    correlation /= (SIZE - offset);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
    if (correlation < lastCorrelation) {
      break; // Assume we've passed the peak
    }
    lastCorrelation = correlation;
  }
  
  if (bestCorrelation > 0.9 && bestOffset !== 0) {
    return sampleRate / bestOffset;
  }
  return -1;
}

//
// Map frequency (80Hz to 1000Hz) to a Y coordinate on the game canvas.
// Higher frequencies yield a higher position.
function mapFrequencyToY(frequency, canvasHeight) {
  const minFreq = 80;
  const maxFreq = 1000;
  if (frequency < minFreq) frequency = minFreq;
  if (frequency > maxFreq) frequency = maxFreq;
  return canvasHeight - ((frequency - minFreq) / (maxFreq - minFreq)) * canvasHeight;
}

//
// Continuously analyze the audio stream and update the character's Y position.
// Also record the pitch values (with timestamps) in frequencyHistory for the last 5 seconds.
//
function updateAudio(analyser) {
  const bufferLength = analyser.fftSize;
  const dataArray = new Float32Array(bufferLength);

  function analyze() {
    requestAnimationFrame(analyze);
    analyser.getFloatTimeDomainData(dataArray);
    let pitch = detectPitch(dataArray, audioContext.sampleRate);
    if (pitch !== -1) {
      currentPitch = pitch;
      character.y = mapFrequencyToY(pitch, canvas.height);
    } else {
      currentPitch = 0;
    }
    // Record the current pitch with a timestamp
    const now = performance.now();
    frequencyHistory.push({ t: now, f: pitch });
    // Remove data older than 5 seconds
    while (frequencyHistory.length > 0 && (now - frequencyHistory[0].t) > 5000) {
      frequencyHistory.shift();
    }
  }
  analyze();
}

//
// The main game loop: updates game elements and renders the scene on the game canvas.
//
function gameLoop() {
  requestAnimationFrame(gameLoop);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Move walls only if a valid pitch is detected.
  if (currentPitch > 0) {
    walls.forEach(wall => {
      wall.x -= wallSpeed;
    });
  }

  // Recycle walls that have scrolled off-screen.
  walls.forEach(wall => {
    if (wall.x + wall.width < 0) {
      wall.x = canvas.width;
      wall.holeY = Math.random() * (canvas.height - wall.holeHeight - 50) + 50;
    }
  });

  // Draw each wall as a full-height green rectangle with a white "hole".
  walls.forEach(wall => {
    ctx.fillStyle = 'green';
    ctx.fillRect(wall.x, 0, wall.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(wall.x, wall.holeY, wall.width, wall.holeHeight);
  });

  // Draw the character as a black square.
  ctx.fillStyle = 'black';
  ctx.fillRect(character.x - character.size / 2, character.y - character.size / 2, character.size, character.size);

  // Check for collisions.
  checkCollision();
}

//
// Basic collision detection: if the character's horizontal position overlaps a wall
// and its Y position is not within the hole, then a collision is logged.
//
function checkCollision() {
  walls.forEach(wall => {
    if (character.x + character.size / 2 > wall.x && character.x - character.size / 2 < wall.x + wall.width) {
      if (character.y - character.size / 2 < wall.holeY ||
          character.y + character.size / 2 > wall.holeY + wall.holeHeight) {
        console.log("Collision detected!");
        // Optionally, pause or reset the game here.
      }
    }
  });
}

// Start the main game loop.
gameLoop();

//
// Developer Panel functionality
//

// Toggle the visibility of the developer panel when its button is clicked.
devToggleBtn.addEventListener('click', () => {
  devPanelVisible = !devPanelVisible;
  devCanvas.style.display = devPanelVisible ? 'block' : 'none';
});

// Clicking directly on the developer panel hides it.
devCanvas.addEventListener('click', () => {
  devPanelVisible = false;
  devCanvas.style.display = 'none';
});

//
// Draw the spectrograph on the developer panel.
// This graph shows a moving average of the audio frequencies over the last 5 seconds.
//
function drawSpectrograph() {
  // Clear the developer canvas
  devCtx.clearRect(0, 0, devCanvas.width, devCanvas.height);
  const now = performance.now();
  const duration = 5000; // last 5 seconds
  const binCount = devCanvas.width; // one bin per pixel horizontally
  const binDuration = duration / binCount;
  let avgValues = new Array(binCount).fill(null);

  // Compute average frequency for each bin
  for (let i = 0; i < binCount; i++) {
    const binStart = now - duration + i * binDuration;
    const binEnd = binStart + binDuration;
    let sum = 0, count = 0;
    for (let j = 0; j < frequencyHistory.length; j++) {
      if (frequencyHistory[j].t >= binStart && frequencyHistory[j].t < binEnd) {
        let freqValue = frequencyHistory[j].f;
        // Treat silence (-1) as the minimum frequency (80Hz)
        if (freqValue === -1) freqValue = 80;
        sum += freqValue;
        count++;
      }
    }
    if (count > 0) {
      avgValues[i] = sum / count;
    }
  }

  // Draw the moving average graph
  devCtx.beginPath();
  for (let i = 0; i < binCount; i++) {
    if (avgValues[i] === null) continue;
    // Map frequency (80Hz at bottom, 1000Hz at top) to y coordinate on devCanvas
    const minFreq = 80, maxFreq = 1000;
    const y = devCanvas.height - ((avgValues[i] - minFreq) / (maxFreq - minFreq)) * devCanvas.height;
    if (i === 0) {
      devCtx.moveTo(i, y);
    } else {
      devCtx.lineTo(i, y);
    }
  }
  devCtx.strokeStyle = 'blue';
  devCtx.lineWidth = 2;
  devCtx.stroke();
}

// Developer panel update loop: redraw the spectrograph if the panel is visible.
function devLoop() {
  if (devPanelVisible) {
    drawSpectrograph();
  }
  requestAnimationFrame(devLoop);
}
devLoop();
