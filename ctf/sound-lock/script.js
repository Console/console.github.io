window.onload = function() {
    const startButton = document.getElementById('start');
    const frequencyDisplay = document.getElementById('frequency');
    const matchDisplay = document.getElementById('match');
    const gainControl = document.getElementById('gain');
    const lowFreq = document.getElementById('lowFreq');
    const highFreq = document.getElementById('highFreq');
    const targetDuration = document.getElementById('targetDuration');
    let audioContext;
    let analyser;
    let microphone;
    let gainNode;
    let bandPassFilter;
    let isListening = false;
    let streamReference;
    let frequencySum = 0;
    let frequencyCount = 0;
    let matchStartTime = null; // Store the start time when a match is found
    let countdownTimer = null;

    startButton.addEventListener('click', function() {
        if (!audioContext) {
            try {
                audioContext = new AudioContext();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 4096;
                gainNode = audioContext.createGain();
                gainNode.gain.value = gainControl.value;

                bandPassFilter = audioContext.createBiquadFilter();
                bandPassFilter.type = 'bandpass';
                updateBandPassFilter();

                gainControl.oninput = function() {
                    gainNode.gain.value = this.value;
                };
                lowFreq.oninput = highFreq.oninput = updateBandPassFilter;
            } catch (error) {
                alert('Web Audio API not supported by your browser');
                return;
            }
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
            if (microphone) {
                microphone.disconnect();
                gainNode.disconnect();
                bandPassFilter.disconnect();
                if (streamReference) {
                    let tracks = streamReference.getTracks();
                    tracks.forEach(track => track.stop());
                }
            }
            startButton.textContent = "Start Listening";
            isListening = false;
            matchStartTime = null; // Reset match start time
            clearInterval(countdownTimer); // Clear the countdown timer if running
            matchDisplay.innerText = "Match: No";
        }
    });

    function analyzeSound() {
        const dataArray = new Uint8Array(analyser.fftSize);
        const requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;

        function update() {
            if (!isListening) return;
            analyser.getByteTimeDomainData(dataArray);
            const frequency = findFrequency(dataArray, audioContext.sampleRate);

            if (frequency !== 0) {
                frequencySum += frequency;
                frequencyCount++;
            }

            const now = Date.now();
            const averageFrequency = frequencySum / frequencyCount;
            frequencyDisplay.innerText = `Frequency: ${averageFrequency.toFixed(2)} Hz`;

            const lowValue = parseInt(lowFreq.value);
            const highValue = parseInt(highFreq.value);
            if (averageFrequency >= lowValue && averageFrequency <= highValue) {
                if (!matchStartTime) {
                    matchStartTime = now; // Start the timer
                    // Start countdown timer
                    countdownTimer = setInterval(function() {
                        const timePassed = (Date.now() - matchStartTime) / 1000;
                        const timeLeft = parseInt(targetDuration.value) - timePassed;
                        if (timeLeft > 0) {
                            matchDisplay.innerText = `Match: Yes, ${timeLeft.toFixed(1)}s until duration met`;
                        } else {
                            matchDisplay.innerText = "Match: Yes, duration met";
                            clearInterval(countdownTimer); // Clear countdown timer when duration is met
                        }
                    }, 100); // Update every 100 ms for smooth countdown
                }
            } else {
                matchDisplay.innerText = "Match: No";
                matchStartTime = null; // Reset the timer
                clearInterval(countdownTimer); // Clear the countdown timer
            }

            frequencySum = 0;
            frequencyCount = 0;
            requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
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

        // Find zero-crossings
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
