window.onload = function() {
    const startButton = document.getElementById('start');
    const frequencyDisplay = document.getElementById('frequency');
    const firstMatchDisplay = document.getElementById('firstMatchDisplay');
    const secondMatchDisplay = document.getElementById('secondMatchDisplay');
    const gainControl = document.getElementById('gain');
    const lowFreq = document.getElementById('lowFreq');
    const highFreq = document.getElementById('highFreq');
    const targetDuration = document.getElementById('targetDuration');
    const firstTargetFrequency = 440; // First target frequency
    const secondTargetFrequency = 660; // Second target frequency
    const tolerance = 20; // Tolerance for frequency matching
    let audioContext;
    let analyser;
    let microphone;
    let gainNode;
    let bandPassFilter;
    let isListening = false;
    let streamReference;
    let matchStartTime = null;
    let countdownTimer = null;
    let secondTargetActive = false; // To track if the second target needs to be matched

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
        firstMatchDisplay.innerText = "First Match: No";
        secondMatchDisplay.style.display = "none"; // Hide second match display
    }

    function analyzeSound() {
        const dataArray = new Uint8Array(analyser.fftSize);
        const requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;

        function update() {
            if (!isListening) return;
            analyser.getByteTimeDomainData(dataArray);
            const frequency = findFrequency(dataArray, audioContext.sampleRate);

            if (frequency !== 0) {
                frequencyDisplay.innerText = `Frequency: ${frequency.toFixed(2)} Hz`;

                let currentTargetFrequency = secondTargetActive ? secondTargetFrequency : firstTargetFrequency;
                let matchDisplay = secondTargetActive ? secondMatchDisplay : firstMatchDisplay;

                if (Math.abs(frequency - currentTargetFrequency) <= tolerance) {
                    if (!matchStartTime) {
                        matchStartTime = Date.now();
                        countdownTimer = setInterval(function() {
                            updateCountdown(matchStartTime, parseInt(targetDuration.value), matchDisplay);
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

    function updateCountdown(startTime, targetDuration, matchDisplay) {
        const now = Date.now();
        const elapsed = (now - startTime) / 1000;
        const timeLeft = targetDuration - elapsed;

        if (timeLeft > 0) {
            matchDisplay.innerText = `Match: Yes, ${timeLeft.toFixed(1)}s remaining`;
        } else {
            clearInterval(countdownTimer);
            matchDisplay.innerText = "Match: Yes, duration met";
            if (!secondTargetActive) {
                secondTargetActive = true;
                secondMatchDisplay.style.display = "block"; // Show second match display
                matchDisplay.innerText = "First Match: Latched";
            } else {
                stopListening(); // Optionally stop listening after second target is matched
                secondMatchDisplay.innerText = "Second Match: Latched";
            }
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
