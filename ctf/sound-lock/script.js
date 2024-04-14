window.onload = function() {
    const startButton = document.getElementById('start');
    const frequencyDisplay = document.getElementById('frequency');
    const matchDisplay = document.getElementById('match');
    const gainControl = document.getElementById('gain');
    let audioContext;
    let analyser;
    let microphone;
    let gainNode;
    let isListening = false;
    let streamReference;
    let frequencies = []; // Array to keep the last N frequencies
    const numAverages = 10; // Number of averages for moving average calculation
    const updateInterval = 500; // Update frequency display every 500ms
    let lastUpdateTime = 0;

    startButton.addEventListener('click', function() {
        if (!audioContext) {
            try {
                audioContext = new AudioContext();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 4096; // Increased FFT size for better resolution
                gainNode = audioContext.createGain();
                gainNode.gain.value = gainControl.value;
                gainControl.oninput = function() {
                    gainNode.gain.value = this.value;
                };
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
                gainNode.connect(analyser);
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
                frequencies.push(frequency);
                if (frequencies.length > numAverages) frequencies.shift(); // Keep only the last N frequencies
            }

            const now = Date.now();
            if (now - lastUpdateTime > updateInterval) {
                const averageFrequency = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
                frequencyDisplay.innerText = `Frequency: ${averageFrequency.toFixed(2)} Hz`;
                lastUpdateTime = now;
            }

            requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
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
        return 0;
    }
};
