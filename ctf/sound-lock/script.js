window.onload = function() {
    const startButton = document.getElementById('start');
    const frequencyDisplay = document.getElementById('frequency');
    const matchDisplay = document.getElementById('matchDisplay');
    const gainControl = document.getElementById('gain');
    const lowFreq = document.getElementById('lowFreq'); // Lower bound for bandpass filter
    const highFreq = document.getElementById('highFreq'); // Upper bound for bandpass filter
    const targetDuration = document.getElementById('targetDuration');
    const targetFrequency = 440; // Target frequency for matching
    const tolerance = 20; // Tolerance for frequency matching
    const movingAverageBuffer = [];
    const movingAverageSize = 10; // Number of samples to average

    let audioContext;
    let analyser;
    let microphone;
    let gainNode;
    let bandPassFilter;
    let isListening = false;
    let streamReference;
    let matchStartTime = null;
    let countdownTimer = null;

    document.getElementById('configBtn').addEventListener('click', function() {
        var panel = document.getElementById('configPanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    startButton.addEventListener('click', function() {
        if (!audioContext) {
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 4096;
            gainNode = audioContext.createGain();
            bandPassFilter = audioContext.createBiquadFilter();
            bandPassFilter.type = 'bandpass';
            updateBandPassFilter();
        }

        if (!isListening) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
                streamReference = stream;
                microphone = audioContext.createMediaStreamSource(stream);
                microphone.connect(gainNode);
                gainNode.connect(bandPassFilter);
                bandPassFilter.connect(analyser);
                analyzeSound();
                startButton.textContent = "Stop Listening";
                isListening = true;
            }).catch(function(error) {
                alert('Error accessing the microphone: ' + error.message);
            });
        } else {
            stopListening();
        }
    });

    function stopListening() {
        if (microphone) {
            microphone.disconnect();
            gainNode.disconnect();
            bandPassFilter.disconnect();
            streamReference.getTracks().forEach(track => track.stop());
        }
        startButton.textContent = "Start Listening";
        isListening = false;
        matchStartTime = null;
        clearInterval(countdownTimer);
        matchDisplay.innerText = "Match: No";
    }

    function analyzeSound() {
        const dataArray = new Uint8Array(analyser.fftSize);
        const requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
    
        function update() {
            if (!isListening) return;
            analyser.getByteTimeDomainData(dataArray);
            const frequency = findFrequency(dataArray, audioContext.sampleRate);
    
            if (frequency !== 0) {
                // Add the new frequency to the moving average buffer
                movingAverageBuffer.push(frequency);
                if (movingAverageBuffer.length > movingAverageSize) {
                    movingAverageBuffer.shift(); // Remove the oldest frequency value
                }
    
                // Calculate the moving average of frequencies
                const sum = movingAverageBuffer.reduce((a, b) => a + b, 0);
                const averageFrequency = sum / movingAverageBuffer.length;
    
                frequencyDisplay.innerText = `Frequency: ${averageFrequency.toFixed(2)} Hz`;
    
                // Check if the detected average frequency is within the target frequency range plus/minus the tolerance
                if (Math.abs(averageFrequency - targetFrequency) <= tolerance) {
                    if (!matchStartTime) {
                        matchStartTime = Date.now();
                        countdownTimer = setInterval(function() {
                            updateCountdown(matchStartTime, parseInt(targetDuration.value));
                        }, 100);
                        matchDisplay.innerText = "Match: Yes";
                    }
                } else {
                    matchDisplay.innerText = "Match: No";
                    matchStartTime = null;
                    clearInterval(countdownTimer);
                }
            }
    
            requestAnimationFrame(update);
        }
    
        requestAnimationFrame(update);
    }
  
    function updateCountdown(startTime, targetDuration) {
        const now = Date.now();
        const elapsed = (now - startTime) / 1000;
        const timeLeft = targetDuration - elapsed;

        if (timeLeft > 0) {
            matchDisplay.innerText = `Match: Yes, ${timeLeft.toFixed(1)}s remaining`;
        } else {
            clearInterval(countdownTimer);
            matchDisplay.innerText = "Match: Yes, duration met";
        }
    }

    function updateBandPassFilter() {
        const lowValue = parseInt(lowFreq.value);
        const highValue = parseInt(highFreq.value);
        bandPassFilter.frequency.value = (lowValue + highValue) / 2;
        bandPassFilter.Q.value = bandPassFilter.frequency.value / (highValue - lowValue);
    }

    function findFrequency(dataArray, sampleRate) {
        let lastCrossing = 0;
        let numCrossings = 0;
        for (let i = 1; i < dataArray.length; i++) {
            if ((dataArray[i-1] < 128) && (dataArray[i] >= 128)) {
                if (lastCrossing > 0) {
                    numCrossings++;
                }
                lastCrossing = i;
            }
        }

        if (numCrossings > 0) {
            const avgPeriod = (lastCrossing / numCrossings);
            return sampleRate / avgPeriod;
        }
        return 0; // Return 0 if no frequency found
    }
};
