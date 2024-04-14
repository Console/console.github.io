window.onload = function() {
    const startButton = document.getElementById('start');
    const frequencyDisplay = document.getElementById('frequency');
    const matchDisplay = document.getElementById('match');
    const gainControl = document.getElementById('gain');
    let audioContext;
    let analyser;
    let microphone;
    let gainNode;
    const targetFrequency = 440; // A4 note, for example
    const frequencyThreshold = 5; // Frequency range within target
    let frequencySum = 0;
    let frequencyCount = 0;

    startButton.addEventListener('click', function() {
        if (!audioContext) {
            try {
                // Initialize the Audio Context
                audioContext = new AudioContext();

                // Setup the Analyzer
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 2048;

                // Create Gain Node
                gainNode = audioContext.createGain();
                gainNode.gain.value = gainControl.value;

                // Attach event listener to the gain slider
                gainControl.oninput = function() {
                    gainNode.gain.value = this.value;
                };

                // Ask for microphone access
                navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
                    microphone = audioContext.createMediaStreamSource(stream);
                    microphone.connect(gainNode);
                    gainNode.connect(analyser);
                    analyzeSound();
                }).catch(function(error) {
                    alert('Error accessing the microphone: ' + error.message);
                });
            } catch (error) {
                alert('Web Audio API not supported by your browser');
            }
        }
    });

    function analyzeSound() {
        const dataArray = new Uint8Array(analyser.fftSize);
        const requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;

        function update() {
            analyser.getByteTimeDomainData(dataArray);

            // Calculate the frequency
            const frequency = findFrequency(dataArray, audioContext.sampleRate);
            if (frequency !== 0) {
                frequencySum += frequency;
                frequencyCount++;
            }
            const averageFrequency = frequencySum / frequencyCount;
            frequencyDisplay.innerText = `Frequency: ${averageFrequency.toFixed(2)} Hz`;

            // Check if the frequency is within the target range
            if (Math.abs(averageFrequency - targetFrequency) <= frequencyThreshold) {
                matchDisplay.innerText = "Match: Yes";
            } else {
                matchDisplay.innerText = "Match: No";
            }

            requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
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
        return 0;
    }
};
