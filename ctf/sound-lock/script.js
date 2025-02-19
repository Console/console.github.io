window.onload = function() {
    const startButton = document.getElementById('start');
    const frequencyDisplay = document.getElementById('frequency');
    const firstMatchDisplay = document.getElementById('firstMatchDisplay');
    const secondMatchDisplay = document.getElementById('secondMatchDisplay');
    const thirdMatchDisplay = document.getElementById('thirdMatchDisplay');
    const challengeCompleteDisplay = document.getElementById('challengeCompleteDisplay');
    const targetFrequencies = [256, 293, 329]; // Array of target frequencies
    const tolerance = 10; // Tolerance for frequency matching
    const targetDuration = 3000; // Duration in milliseconds
    let audioContext;
    let analyser;
    let microphone;
    let gainNode;
    let bandPassFilter;
    let isListening = false;
    let streamReference;
    let currentTargetIndex = 0; // Index to track the current target frequency
    let countdownTimer = null;
    let emaFrequency = 0; // Initialize EMA at 0
    const alpha = 0.1; // Smoothing factor for EMA

    function updateEMA(currentFrequency) {
        emaFrequency = alpha * currentFrequency + (1 - alpha) * emaFrequency;
        return emaFrequency;
    }


    startButton.addEventListener('click', function() {
        if (!audioContext) {
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 4096;
            gainNode = audioContext.createGain();
            bandPassFilter = audioContext.createBiquadFilter();
            bandPassFilter.type = 'bandpass';
            bandPassFilter.frequency.value = 600; // hardcoded center frequency for the bandpass filter
            bandPassFilter.Q.value = 1.5; // hardcoded Q value for the bandpass filter
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
                startButton.textContent = "Stop Listening  ";
                startButton.classList.add('button-stop'); // Change button to red
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
        document.getElementById('start').textContent = "Start ▶️"; // Reset start button text
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
        document.getElementById('start').textContent = "Start ▶️";
        startButton.classList.remove('button-stop'); // Change button back to normal
    }

    function analyzeSound() {
        const dataArray = new Uint8Array(analyser.fftSize);
        const requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;

        function update() {
            if (!isListening) return;
            analyser.getByteTimeDomainData(dataArray);
            const frequency = findFrequency(dataArray, audioContext.sampleRate);
            if (frequency !== 0) {
                const smoothedFrequency = updateEMA(frequency);
                frequencyDisplay.innerText = `Frequency: ${smoothedFrequency.toFixed(2)} Hz`;

                let currentTargetFrequency = targetFrequencies[currentTargetIndex];
                let matchDisplay = [firstMatchDisplay, secondMatchDisplay, thirdMatchDisplay][currentTargetIndex];
                const frequencyDifference = Math.abs(smoothedFrequency - currentTargetFrequency);
                
                if (frequencyDifference <= tolerance) {
                    if (!matchStartTime) {
                        matchStartTime = Date.now();
                        countdownTimer = setInterval(function() {
                            updateCountdown(matchStartTime, parseInt(targetDuration), matchDisplay, [firstMatchDisplay, secondMatchDisplay, thirdMatchDisplay]);
                        }, 100);
                    }
                } else {
                    matchDisplay.innerText = "🔴 Target Frequency NOT Matched";
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
        const elapsed = (now - startTime) / 1000; // Convert milliseconds to seconds
        const timeLeft = (targetDuration / 1000) - elapsed; // Calculate remaining time in seconds
    
        if (timeLeft > 0) {
            matchDisplay.innerText = `🟡 Target Frequency Matching, ${timeLeft.toFixed(1)}s remaining`;
        } else {
            clearInterval(countdownTimer);
            matchDisplay.innerText = "🟢 Target Frequency Matched, Target Duration Met";
            currentTargetIndex++;
            if (currentTargetIndex < targetFrequencies.length) {
                matchDisplays[currentTargetIndex].style.display = "block"; // Show the next target display
                matchStartTime = null; // Reset start time for the next frequency matching
            } else {
                matchDisplays.forEach(display => {
                    display.innerText = "🟢 Target Frequency Matched, Target Duration Met"; // Update all displays to show matched
                });
                challengeCompleteDisplay.innerHTML = "Challenge Completed<br/><span id=flagSpan>flag{Canu_r_Dydd_a_Chanu_r_Nos}</span>";
                challengeCompleteDisplay.style.display = "block";
                stopListening();
            }
        }
    }
    

    function updateBandPassFilter() {
        bandPassFilter.frequency.value = 600; // hardcoded center frequency for the bandpass filter
        bandPassFilter.Q.value = 1.5; // hardcoded Q value for the bandpass filter
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