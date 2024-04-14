window.onload = function() {
    const startButton = document.getElementById('start');
    const frequencyDisplay = document.getElementById('frequency');
    const matchDisplay = document.getElementById('match');
    const gainControl = document.getElementById('gain');
    const lowFreq = document.getElementById('lowFreq');
    const highFreq = document.getElementById('highFreq');
    let audioContext;
    let analyser;
    let microphone;
    let gainNode;
    let bandPassFilter;
    let isListening = false;
    let streamReference;
    let frequencySum = 0;
    let frequencyCount = 0;
    const updateInterval = 500; // Debounce interval in ms
    let lastUpdateTime = 0;

    startButton.addEventListener('click', function() {
        if (!audioContext) {
            try {
                audioContext = new AudioContext();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 4096; // Increased FFT size
                gainNode = audioContext.createGain();
                gainNode.gain.value = gainControl.value;

                bandPassFilter = audioContext.createBiquadFilter();
                bandPassFilter.type = 'bandpass';
                updateBandPassFilter(); // Update filter settings based on initial input values

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
            if (now - lastUpdateTime > updateInterval) {
                const averageFrequency = frequencySum / frequencyCount;
                frequencyDisplay.innerText = `Frequency: ${averageFrequency.toFixed(2)} Hz`;

                const lowValue = parseInt(lowFreq.value);
                const highValue = parseInt(highFreq.value);
                if (averageFrequency >= lowValue && averageFrequency <= highValue) {
                    matchDisplay.innerText = "Match: Yes";
                } else {
                    matchDisplay.innerText = "Match: No";
                }
                // Reset for next average calculation
                frequencySum = 0;
                frequencyCount = 0;
                lastUpdateTime = now;
            }

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
