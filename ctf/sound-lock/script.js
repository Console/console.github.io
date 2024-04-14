window.onload = function() {
    const startButton = document.getElementById('start');
    const frequencyDisplay = document.getElementById('frequency');
    let audioContext;
    let analyser;
    let microphone;

    startButton.addEventListener('click', function() {
        if (!audioContext) {
            try {
                // Initialize the Audio Context
                audioContext = new AudioContext();

                // Setup the Analyzer
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 2048; // Change this to more or less, depending on the desired precision

                // Ask for microphone access
                navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
                    microphone = audioContext.createMediaStreamSource(stream);
                    microphone.connect(analyser);
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
            frequencyDisplay.innerText = `Frequency: ${frequency.toFixed(2)} Hz`;

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