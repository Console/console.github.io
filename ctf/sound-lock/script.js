window.onload = function() {
    const startButton = document.getElementById('start');
    const frequencyDisplay = document.getElementById('frequency');
    const matchDisplay = document.getElementById('matchDisplay');
    const countdownDisplay = document.getElementById('countdownDisplay');
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
    let matchStartTime = null;
    let countdownTimer = null;

    document.getElementById('configBtn').addEventListener('click', function() {
        var panel = document.getElementById('configPanel');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    });

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
            stopListening();
        }
    });

    function stopListening() {
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
        matchDisplay.innerHTML = '<img src="red_light.png" alt="Red Light">';
        countdownDisplay.textContent = "";
    }

    function analyzeSound() {
        const dataArray = new Uint8Array(analyser.fftSize);
        const requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;

        function update() {
            if (!isListening) return;
            analyser.getByteTimeDomainData(dataArray);
            const frequency = findFrequency(dataArray, audioContext.sampleRate);

            if (frequency !== 0) {
                const averageFrequency = frequency;
                frequencyDisplay.innerText = `Frequency: ${averageFrequency.toFixed(2)} Hz`;

                const lowValue = parseInt(lowFreq.value);
                const highValue = parseInt(highFreq.value);
                if (averageFrequency >= lowValue && averageFrequency <= highValue) {
                    if (!matchStartTime) {
                        matchStartTime = Date.now(); // Start the timer
                        countdownTimer = setInterval(function() {
                            updateCountdown(matchStartTime, parseInt(targetDuration.value));
                        }, 100); // Update every 100 ms for smooth countdown
                        matchDisplay.innerHTML = '<img src="yellow_light.png" alt="Yellow Light">';
                    }
                } else {
                    stopListening();
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
            countdownDisplay.textContent = `${timeLeft.toFixed(1)}s`;
        } else {
            clearInterval(countdownTimer);
            countdownDisplay.textContent = "";
            matchDisplay.innerHTML = '<img src="green_light.png" alt="Green Light">';
        }
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

    function updateBandPassFilter() {
        const lowValue = parseInt(lowFreq.value);
        const highValue = parseInt(highFreq.value);
        bandPassFilter.frequency.value = (lowValue + highValue) / 2;
        bandPassFilter.Q.value = bandPassFilter.frequency.value / (highValue - lowValue);
    }
};
