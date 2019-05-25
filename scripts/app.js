var pitchShifter = (function () {

	var audioContext,
		audioSource ,
		pitchShifterProcessor,
		spectrumAudioAnalyser,
		sonogramAudioAnalyser,
		canvas,
		canvasContext,
		barGradient,
		waveGradient;

	var audioSourcesNames = ['Microphone'],
		audioSourceIndex = 0,
		audioVisualisationNames = ['Spectrum', 'Wave', 'Sonogram'],
		audioVisualisationIndex = 0,
		validGranSizes = [256, 512, 1024, 2048, 4096, 8192],
		grainSize = validGranSizes[1],
		pitchRatio = 1.0,
		overlapRatio = 0.50,
		spectrumFFTSize = 128,
		spectrumSmoothing = 0.8,
		sonogramFFTSize = 2048,
		sonogramSmoothing = 0;

	var record = document.querySelector('.record');
	var stop = document.querySelector('.stop');
	var soundClips = document.querySelector('.sound-clips');
	var canvas = document.querySelector('.visualizer');
	var mainSection = document.querySelector('.main-controls');

	var chunks = [];

	hannWindow = function (length) {

		var window = new Float32Array(length);
		for (var i = 0; i < length; i++) {
			window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
		}
		return window;
	};

	linearInterpolation = function (a, b, t) {
		return a + (b - a) * t;
	};

	initAudio = function () {

		if (!navigator.getUserMedia) {

			alert('Your browser does not support the Media Stream API');

		} else {

			navigator.getUserMedia(

				{audio: true, video: false},

				function (stream) {

					var mediaRecorder = new MediaRecorder(stream);

					audioSource = audioContext.createMediaStreamSource(stream);

					function makeDistortionCurve(amount) {
					  var k = typeof amount === 'number' ? amount : 50,
					    n_samples = 44100,
					    curve = new Float32Array(n_samples),
					    deg = Math.PI / 180,
					    i = 0,
					    x;
					  for ( ; i < n_samples; ++i ) {
					    x = i * 2 / n_samples - 1;
					    curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
					  }
					  return curve;
					};

					var distortion = audioContext.createWaveShaper();

					var gain = audioContext.createGain();

					audioSource.connect(gain);
					gain.connect(distortion);
					distortion.connect(audioContext.destination);

					gain.gain.value = 1;
					distortion.curve = makeDistortionCurve(0);
					distortion.oversample = '4x';

					var range = document.querySelector('#range');
					range.addEventListener('input', function(){
					  var value = parseInt(this.value) * 5;
					  distortion.curve = makeDistortionCurve(value);
					});

					record.onclick = function() {

						mediaRecorder.start();
						console.log(mediaRecorder.state);
						console.log("recorder started");
						record.style.background = "red";

						stop.disabled = false;
						record.disabled = true;
					}

					stop.onclick = function() {
						mediaRecorder.stop();

						console.log(mediaRecorder.state);
						console.log("recorder stopped");
						record.style.background = "";
						record.style.color = "";

						stop.disabled = true;
						record.disabled = false;
					}

					mediaRecorder.onstop = function(e) {
				      console.log("data available after MediaRecorder.stop() called.");

				      var clipName = prompt('Enter a name for your sound clip?','My unnamed clip');
				      console.log(clipName);
				      var clipContainer = document.createElement('article');
				      var clipLabel = document.createElement('p');
				      var audio = document.createElement('audio');
				      var deleteButton = document.createElement('button');

				      clipContainer.classList.add('clip');
				      audio.setAttribute('controls', '');
				      deleteButton.textContent = 'Delete';
				      deleteButton.className = 'delete';

				      if(clipName === null) {
				        clipLabel.textContent = 'My unnamed clip';
				      } else {
				        clipLabel.textContent = clipName;
				      }

				      clipContainer.appendChild(audio);
				      clipContainer.appendChild(clipLabel);
				      clipContainer.appendChild(deleteButton);
				      soundClips.appendChild(clipContainer);

				      audio.controls = true;
				      var blob = new Blob(chunks, { 'type' : 'audio/ogg; codecs=opus' });
				      chunks = [];
				      var audioURL = window.URL.createObjectURL(blob);
				      audio.src = audioURL;
				      console.log("recorder stopped");

				      deleteButton.onclick = function(e) {
				        evtTgt = e.target;
				        evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
				      }

				      clipLabel.onclick = function() {
				        var existingName = clipLabel.textContent;
				        var newClipName = prompt('Enter a new name for your sound clip?');
				        if(newClipName === null) {
				          clipLabel.textContent = existingName;
				        } else {
				          clipLabel.textContent = newClipName;
				        }
				      }
				    }

				    mediaRecorder.ondataavailable = function(e) {
				      chunks.push(e.data);
				    }

				},

				function (error) {
					alert('Unable to get the user media');
				}
			);
		}

			spectrumAudioAnalyser = audioContext.createAnalyser();
        	spectrumAudioAnalyser.fftSize = spectrumFFTSize;
        	spectrumAudioAnalyser.smoothingTimeConstant = spectrumSmoothing;

        	sonogramAudioAnalyser = audioContext.createAnalyser();
        	sonogramAudioAnalyser.fftSize = sonogramFFTSize;
        	sonogramAudioAnalyser.smoothingTimeConstant = sonogramSmoothing;

	};

	initProcessor = function () {

		if (pitchShifterProcessor) {
			pitchShifterProcessor.disconnect();
		}

		if (audioContext.createScriptProcessor) {
			pitchShifterProcessor = audioContext.createScriptProcessor(grainSize, 1, 1);
		} else if (audioContext.createJavaScriptNode) {
			pitchShifterProcessor = audioContext.createJavaScriptNode(grainSize, 1, 1);
		}

		pitchShifterProcessor.buffer = new Float32Array(grainSize * 2);
		pitchShifterProcessor.grainWindow = hannWindow(grainSize);
		pitchShifterProcessor.onaudioprocess = function (event) {

			var inputData = event.inputBuffer.getChannelData(0);
			var outputData = event.outputBuffer.getChannelData(0);

			for (i = 0; i < inputData.length; i++) {

				// Apply the window to the input buffer
				inputData[i] *= this.grainWindow[i];

				// Shift half of the buffer
				this.buffer[i] = this.buffer[i + grainSize];

				// Empty the buffer tail
				this.buffer[i + grainSize] = 0.0;
			}

			// Calculate the pitch shifted grain re-sampling and looping the input
			var grainData = new Float32Array(grainSize * 2);
			for (var i = 0, j = 0.0;
				 i < grainSize;
				 i++, j += pitchRatio) {

				var index = Math.floor(j) % grainSize;
				var a = inputData[index];
				var b = inputData[(index + 1) % grainSize];
				grainData[i] += linearInterpolation(a, b, j % 1.0) * this.grainWindow[i];
			}

			// Copy the grain multiple times overlapping it
			for (i = 0; i < grainSize; i += Math.round(grainSize * (1 - overlapRatio))) {
				for (j = 0; j <= grainSize; j++) {
					this.buffer[i + j] += grainData[j];
				}
			}

			// Output the first half of the buffer
			for (i = 0; i < grainSize; i++) {
				outputData[i] = this.buffer[i];
			}
		};

        	pitchShifterProcessor.connect(spectrumAudioAnalyser);
        	pitchShifterProcessor.connect(sonogramAudioAnalyser);
        	pitchShifterProcessor.connect(audioContext.destination);

	};

	initSliders = function () {

		$("#pitchRatioSlider").slider({
			orientation: "horizontal",
			min: 0.5,
			max: 2,
			step: 0.01,
			range: 'min',
			value: pitchRatio,
			slide: function (event, ui) {

				pitchRatio = ui.value;
				$("#pitchRatioDisplay").text(pitchRatio);
			}
		});

		$("#overlapRatioSlider").slider({
			orientation: "horizontal",
			min: 0,
			max: 0.75,
			step: 0.01,
			range: 'min',
			value: overlapRatio,
			slide: function (event, ui) {

				overlapRatio = ui.value;
				$("#overlapRatioDisplay").text(overlapRatio);
			}
		});

		$("#grainSizeSlider").slider({
			orientation: "horizontal",
			min: 0,
			max: validGranSizes.length - 1,
			step: 1,
			range: 'min',
			value: validGranSizes.indexOf(grainSize),
			slide: function (event, ui) {

				grainSize = validGranSizes[ui.value];
				$("#grainSizeDisplay").text(grainSize);

				initProcessor();

				if (audioSource) {
					audioSource.connect(pitchShifterProcessor);
				}
			}
		});

		$("#audioVisualisationSlider").slider({
			orientation: "horizontal",
			min: 0,
			max: audioVisualisationNames.length - 1,
			step: 1,
			value: audioVisualisationIndex,
			slide: function (event, ui) {

				audioVisualisationIndex = ui.value;
				$("#audioVisualisationDisplay").text(audioVisualisationNames[audioVisualisationIndex]);
			}
		});

		$("#audioSourceSlider").slider({
			orientation: "horizontal",
			min: 0,
			max: audioSourcesNames.length - 1,
			step: 1,
			value: audioSourceIndex,
			slide: function (event, ui) {

				if (audioSource) {
					audioSource.disconnect();
				}

				audioSourceIndex = ui.value;
				$("#audioSourceDisplay").text(audioSourcesNames[audioSourceIndex]);

				if (audioSource) {
					audioSource.connect(pitchShifterProcessor);
				}
			}
		});

		$("#pitchRatioDisplay").text(pitchRatio);
		$("#overlapRatioDisplay").text(overlapRatio);
		$("#grainSizeDisplay").text(grainSize);
		$("#audioVisualisationDisplay").text(audioVisualisationNames[audioVisualisationIndex]);
		$("#audioSourceDisplay").text(audioSourcesNames[audioSourceIndex]);
	};

	initCanvas = function (stream) {

        canvas = document.querySelector('canvas');
        canvasContext = canvas.getContext('2d');

        barGradient = canvasContext.createLinearGradient(0, 0, 1, canvas.height - 1);
        barGradient.addColorStop(0, '#550000');
        barGradient.addColorStop(0.995, '#AA5555');
        barGradient.addColorStop(1, '#555555');

        waveGradient = canvasContext.createLinearGradient(canvas.width - 2, 0, canvas.width - 1, canvas.height - 1);
        waveGradient.addColorStop(0, '#FFFFFF');
        waveGradient.addColorStop(0.75, '#550000');
        waveGradient.addColorStop(0.75, '#555555');
        waveGradient.addColorStop(0.76, '#AA5555');
        waveGradient.addColorStop(1, '#FFFFFF');
    };

    renderCanvas = function () {


    	switch (audioVisualisationIndex) {

            case 0:

                var frequencyData = new Uint8Array(spectrumAudioAnalyser.frequencyBinCount);
                spectrumAudioAnalyser.getByteFrequencyData(frequencyData);

                canvasContext.clearRect(0, 0, canvas.width, canvas.height);
                canvasContext.fillStyle = barGradient;

                var barWidth = canvas.width / frequencyData.length;
                for (i = 0; i < frequencyData.length; i++) {
                    var magnitude = frequencyData[i];
                    canvasContext.fillRect(barWidth * i, canvas.height, barWidth - 1, -magnitude - 1);
                }

                break;

            case 1:

                var timeData = new Uint8Array(spectrumAudioAnalyser.frequencyBinCount);
                spectrumAudioAnalyser.getByteTimeDomainData(timeData);
                var amplitude = 0.0;
                for (i = 0; i < timeData.length; i++) {
                    amplitude += timeData[i];
                }
                amplitude = Math.abs(amplitude / timeData.length - 128) * 5 + 1;

                var previousImage = canvasContext.getImageData(1, 0, canvas.width - 1, canvas.height);
                canvasContext.putImageData(previousImage, 0, 0);

                var axisY = canvas.height * 3 / 4;
                canvasContext.fillStyle = '#FFFFFF';
                canvasContext.fillRect(canvas.width - 1, 0, 1, canvas.height);
                canvasContext.fillStyle = waveGradient;
                canvasContext.fillRect(canvas.width - 1, axisY, 1, -amplitude);
                canvasContext.fillRect(canvas.width - 1, axisY, 1, amplitude / 2);

                break;

            case 2:

                frequencyData = new Uint8Array(sonogramAudioAnalyser.frequencyBinCount);
                sonogramAudioAnalyser.getByteFrequencyData(frequencyData);

                previousImage = canvasContext.getImageData(1, 0, canvas.width - 1, canvas.height);
                canvasContext.putImageData(previousImage, 0, 0);

                var bandHeight = canvas.height / frequencyData.length;
                for (var i = 0, y = canvas.height - 1;
                     i < frequencyData.length;
                     i++, y -= bandHeight) {

                    var color = frequencyData[i] << 16;
                    canvasContext.fillStyle = '#' + color.toString(16);
                    canvasContext.fillRect(canvas.width - 1, y, 1, -bandHeight);
                }

                break;
        }

        window.requestAnimFrame(renderCanvas);
    };

	return {

		init: function () {

			if ('AudioContext' in window) {
				audioContext = new AudioContext();
			} else {
				alert('Your browser does not support the Web Audio API');
				return;
			}



			initAudio();
			initProcessor();
			initSliders();
			initCanvas();

			window.requestAnimFrame(renderCanvas);
		}
	}

}());

window.requestAnimFrame = (function () {

	return (window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			function (callback) {
				window.setTimeout(callback, 1000 / 60);
			});
})();

window.addEventListener("DOMContentLoaded", pitchShifter.init, true);
