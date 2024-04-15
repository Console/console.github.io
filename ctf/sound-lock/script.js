window.onload = function() {
    const startButton = document.getElementById('start');
    const frequencyDisplay = document.getElementById('frequency');
    const firstMatchDisplay = document.getElementById('firstMatchDisplay');
    const secondMatchDisplay = document.getElementById('secondMatchDisplay');
    const thirdMatchDisplay = document.getElementById('thirdMatchDisplay');
    const challengeCompleteDisplay = document.getElementById('challengeCompleteDisplay');
    const targetFrequencies = [256, 293, 329];
    const tolerance = 10;
    const targetDuration = 2000;
    let audioContext;
    let analyser;
    let microphone;
    let gainNode;
    let bandPassFilter;
    let isListening = false;
    let streamReference;
    let currentTargetIndex = 0;
    let countdownTimer = null;

    console.log("Application loaded and initial setup complete.");

    startButton.addEventListener('click', function() {
        if (!audioContext) {
            console.log("Initializing Audio Context and components...");
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 4096;
            gainNode = audioContext.createGain();
            bandPassFilter = audioContext.createBiquadFilter();
            bandPassFilter.type = 'bandpass';
            updateBandPassFilter();
        }

        if (!isListening) {
            console.log("Starting audio processing...");
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
                streamReference = stream;
                microphone = audioContext.createMediaStreamSource(stream);
                microphone.connect(gainNode);
                gainNode.connect(bandPassFilter);
                bandPassFilter.connect(analyser);
                analyzeSound();
                startButton.textContent = "Stop Listening";
                startButton.classList.add('button-stop');
                isListening = true;
            }).catch(function(error) {
                console.error('Error accessing the microphone: ' + error.message);
            });
        } else {
            console.log("Stopping audio processing...");
            stopListening();
        }
    });

    function analyzeSound() {
        const dataArray = new Uint8Array(analyser.fftSize);
        const requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
        const recentFrequencies = [];
        const debounceDelay = 10;
        let lastDebounceTime = 0;

        function update() {
            if (!isListening) return;
            analyser.getByteTimeDomainData(dataArray);
            const frequency = findFrequency(dataArray, audioContext.sampleRate);
            console.log(`Detected Frequency: ${frequency} Hz`);

            if (frequency !== 0) {
                recentFrequencies.push(frequency);
                if (recentFrequencies.length > 10) recentFrequencies.shift();
                const averageFrequency = recentFrequencies.reduce((sum, curr) => sum + curr, 0) / recentFrequencies.length;

                frequencyDisplay.innerText = `Frequency: ${averageFrequency.toFixed(2)} Hz`;
                console.log(`Smoothed Frequency: ${averageFrequency.toFixed(2)} Hz`);

                let currentTargetFrequency = targetFrequencies[currentTargetIndex];
                let matchDisplay = [firstMatchDisplay, secondMatchDisplay, thirdMatchDisplay][currentTargetIndex];

                const frequencyDifference = Math.abs(averageFrequency - currentTargetFrequency);
                const currentTime = Date.now();
                if (currentTime - lastDebounceTime > debounceDelay) {
                    if (frequencyDifference <= tolerance) {
                        console.log(`Frequency within tolerance for target ${currentTargetIndex + 1}.`);
                        if (!countdownTimer) {
                            matchDisplay.innerText = "🟡 Matching...";
                            countdownTimer = setInterval(function() {
                                updateCountdown(currentTargetIndex);
                            }, 100);
                        }
                    } else {
                        console.log(`Frequency out of tolerance: ${frequencyDifference.toFixed(2)} Hz difference.`);
                        matchDisplay.innerText = "🔴 Not Matched";
                        clearInterval(countdownTimer);
                        countdownTimer = null;
                    }
                    lastDebounceTime = currentTime;
                }
            }

            requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
    }

    function updateCountdown(targetIndex) {
        let matchDisplay = [firstMatchDisplay, secondMatchDisplay, thirdMatchDisplay][targetIndex];
        const startTime = Date.now();
        const targetTime = startTime + targetDuration;

        function countdown() {
            const now = Date.now();
            const timeLeft = targetTime - now;
            if (timeLeft > 0) {
                matchDisplay.innerText = `🟡 Matching... ${Math.ceil(timeLeft / 1000)}s remaining`;
            } else {
                matchDisplay.innerText = "🟢 Matched";
                clearInterval(countdownTimer);
                countdownTimer = null;
                if (targetIndex < targetFrequencies.length - 1) {
                    console.log(`Target ${targetIndex + 1} matched. Moving to next.`);
                    currentTargetIndex++;
                } else {
                    console.log("All targets matched. Challenge completed.");
                    challengeCompleteDisplay.style.display = "block";
                    challengeCompleteDisplay.innerText = "Challenge Completed!";
                    stopListening();
                }
            }
        }

        countdownTimer = setInterval(countdown, 100);
    }

    function stopListening() {
        if (microphone) {
            microphone.disconnect();
            gainNode.disconnect();
            bandPassFilter.disconnect();
            streamReference.getTracks().forEach(track => track.stop());
        }
        isListening = false;
        clearInterval(countdownTimer);
        countdownTimer = null;
        startButton.textContent = "Start Listening ▶️";
        startButton.classList.remove('button-stop');
        console.log("Audio processing stopped.");
    }

    function updateBandPassFilter() {
        bandPassFilter.frequency.value = 300; // Change to suitable frequency based on your needs
        bandPassFilter.Q.value = 1.5; // Change Q value based on your needs
        console.log(`Bandpass Filter updated: Frequency - ${bandPassFilter.frequency.value}, Q - ${bandPassFilter.Q.value}`);
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
            const calculatedFrequency = sampleRate / avgPeriod;
            console.log(`Calculated frequency: ${calculatedFrequency}`);
            return calculatedFrequency;
        }
        return 0;
    }
};
