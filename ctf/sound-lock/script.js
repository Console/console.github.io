window.onload = function() {
    const startButton = document.getElementById('start');
    const frequencyDisplay = document.getElementById('frequency');
    const firstMatchDisplay = document.getElementById('firstMatchDisplay');
    const secondMatchDisplay = document.getElementById('secondMatchDisplay');
    const thirdMatchDisplay = document.getElementById('thirdMatchDisplay');
    const challengeCompleteDisplay = document.getElementById('challengeCompleteDisplay');
    const gainControl = document.getElementById('gain');
    const lowFreq = document.getElementById('lowFreq');
    const highFreq = document.getElementById('highFreq');
    const targetDuration = document.getElementById('targetDuration');
    const targetFrequencies = [261, 293, 329]; // Array of target frequencies
    const tolerance = 10; // Tolerance for frequency matching
    let audioContext;
    let analyser;
    let microphone;
    let gainNode;
    let bandPassFilter;
    let isListening = false;
    let streamReference;
    let currentTargetIndex = 0; // Index to track the current target frequency
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

    document.getElementById('resetButton').addEventListener('click', function() {
        // Reset all match statuses
        const matchDisplays = [document.getElementById('firstMatchDisplay'), document.getElementById('secondMatchDisplay'), document.getElementById('thirdMatchDisplay')];
        matchDisplays.forEach(display => {
            display.innerText = "Match: No";
            display.style.display = "none"; // Hide all but the first display
        });
        matchDisplays[0].style.display = "block"; // Only show the first target
    
        // Hide challenge complete message
        document.getElementById('challengeCompleteDisplay').style.display = "none";
    
        // Reset current target index
        currentTargetIndex = 0;
    
        // Stop and reset all audio processing and timers if running
        stopListening();
    
        // Reset interface
        if (countdownTimer) {
            clearInterval(countdownTimer);
        }
        if (isListening) {
            stopListening();
        }
        document.getElementById('start').textContent = "Start Listening"; // Reset start button text
        document.getElementById('frequency').innerText = "Frequency: -- Hz"; // Reset frequency display
    });
    
    function stopListening() {
        if (microphone) {
            microphone.disconnect();
            gainNode.disconnect();
            bandPassFilter.disconnect();
            streamReference.getTracks().forEach(track => track.stop());
        }
        isListening = false;
        clearInterval(countdownTimer);
        document.getElementById('start').textContent = "Start Listening";
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

                let currentTargetFrequency = targetFrequencies[currentTargetIndex];
                let matchDisplays = [firstMatchDisplay, secondMatchDisplay, thirdMatchDisplay];
                let matchDisplay = matchDisplays[currentTargetIndex];

                if (Math.abs(frequency - currentTargetFrequency) <= tolerance) {
                    if (!matchStartTime) {
                        matchStartTime = Date.now();
                        countdownTimer = setInterval(function() {
                            updateCountdown(matchStartTime, parseInt(targetDuration.value), matchDisplay, matchDisplays);
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

    function updateCountdown(startTime, targetDuration, matchDisplay, matchDisplays) {
        const now = Date.now();
        const elapsed = (now - startTime) / 1000;
        const timeLeft = targetDuration - elapsed;

        if (timeLeft > 0) {
            matchDisplay.innerText = `Match: Yes, ${timeLeft.toFixed(1)}s remaining`;
        } else {
            clearInterval(countdownTimer);
            matchDisplay.innerText = "Match: Yes, duration met";
            currentTargetIndex++;
            if (currentTargetIndex < targetFrequencies.length) {
                matchDisplays[currentTargetIndex].style.display = "block"; // Show the next target display
                matchStartTime = null; // Reset start time for the next frequency matching
            } else {
                // All targets matched, challenge completed
                matchDisplays.forEach(display => {
                display.innerText = "Match: Yes, duration met"; // Update all displays to show matched
                });
                challengeCompleteDisplay.innerText = "Challenge Completed";
                challengeCompleteDisplay.style.display = "block";
                stopListening(); // Optionally stop listening after all targets are matched
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
