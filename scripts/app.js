var pitchShifter = (function () {

// set up basic variables for app

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

	var whitenoise = document.getElementById("white");
	var annoyingnoise = document.getElementById("annoying");

// disable stop button while not recording

	stop.disabled = true;

//Set active button to false while it is not pressed

	whitenoise.addEventListener("click", StartWhite);
	annoyingnoise.addEventListener("click", StartAnnoying);

	whitenoise.disabled = false;
	annoyingnoise.disabled = false;

//Set up White Noise button when is pressed to play white noise
//and when is pressed second time to stop white noise

	function StartWhite(){
    console.log("Started White Noise");
    whiteNoise.play();
    annoyingnoise.disabled = true;
    whitenoise.removeEventListener("click", StartWhite);
    whitenoise.addEventListener("click", StopWhite);
    whitenoise.value = "StopWhite";
	}

	function StopWhite(){
    console.log("Stopped White Noise");
    whiteNoise.stop();
    annoyingnoise.disabled = false;
    whitenoise.removeEventListener("click", StopWhite);
    whitenoise.addEventListener("click", StartWhite);
    whitenoise.value = "StartWhite";
	}

//Set up Annoying Noise button when is pressed to play oscillator noise
//and when is pressed second time to stop oscillator noise

	function StartAnnoying(){
    console.log("Started Annoying Noise");
    annoyingSound.play();
    whitenoise.disabled = true;
    annoyingnoise.removeEventListener("click", StartAnnoying);
    annoyingnoise.addEventListener("click", StopAnnoying);
    annoyingnoise.value = "StopAnnoying";
	}

	function StopAnnoying(){
    console.log("Stopped Annoying Noise");
    annoyingSound.stop();
    whitenoise.disabled = false;
    annoyingnoise.removeEventListener("click", StopAnnoying);
    annoyingnoise.addEventListener("click", StartAnnoying);
    annoyingnoise.value = "StartAnnoying";
	}

//array to collect the audio data

	var chunks = [];

//function for pitch effect

	hannWindow = function (length) {

		var window = new Float32Array(length);
		for (var i = 0; i < length; i++) {
			window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
		}
		return window;
	};

//function for pitch effect

	linearInterpolation = function (a, b, t) {
		return a + (b - a) * t;
	};

//Audio initialization function

	initAudio = function () {


		if (!navigator.getUserMedia) {

			alert('Your browser does not support the Media Stream API');

		} else {

			//To grab the media stream we want to capture, we use getUserMedia()

			navigator.getUserMedia(

				//we only use audio in this app

				{audio: true, video: false},

				function (stream) {

					//We use the MediaRecorder API to record the stream

					var mediaRecorder = new MediaRecorder(stream);

					//The createMediaStreamSource() method of the AudioContext
					//Interface is used to create a new MediaStreamAudioSourceNode object,
					//given a media stream (say, from a navigator.getUserMedia instance),
					//the audio from which can then be played and manipulated.

					audioSource = audioContext.createMediaStreamSource(stream);

					//makeDistortionCurve function taken from
					//https://stackoverflow.com/questions/22312841/waveshaper-node-in-webaudio-how-to-emulate-distortion

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

					//The WaveShaperNode interface represents a non-linear distorter. It is an AudioNode
					//that uses a curve to apply a wave shaping distortion to the signal. Beside obvious
					//distortion effects, it is often used to add a warm feeling to the signal

					var distortion = audioContext.createWaveShaper();

					//The createGain() method of the BaseAudioContext interface creates a GainNode, which
					//can be used to control the overall gain (or volume) of the audio graph

					var gain = audioContext.createGain();

					//cpnnectin gain with distortion and with audioContext output

					audioSource.connect(gain);
					gain.connect(distortion);
					distortion.connect(audioContext.destination);

					//using gain and distortion functions

					gain.gain.value = 1;
					distortion.curve = makeDistortionCurve(0);

					//Multiply by 4 the amount of samples before applying the shaping curve

					distortion.oversample = '4x';

					//using user input to manipulate distortion

					var range = document.querySelector('#range');
					range.addEventListener('input', function(){
					  var value = parseInt(this.value) * 5;
					  distortion.curve = makeDistortionCurve(value);
					});

					record.onclick = function() {

						//MediaRecorder.start() is used to start recording the stream once the record button is pressed

						mediaRecorder.start();

						//When the MediaRecorder is recording, the MediaRecorder.state property will return a value of "recording"

						console.log(mediaRecorder.state);
						console.log("recorder started");
						record.style.background = "red";
						record.style.color = "black";

						stop.disabled = false;
						record.disabled = true;
					}

					stop.onclick = function() {

						//we use the MediaRecorder.stop() method to stop the recording when the stop button is pressed,
						//and finalize the Blob ready for use somewhere else in our application

						mediaRecorder.stop();

						console.log(mediaRecorder.state);
						console.log("recorder stopped");
						record.style.background = "";
						record.style.color = "";

						stop.disabled = true;
						record.disabled = false;
					}

					//When recording has stopped, the state property returns a value of "inactive", and a stop event is fired.
					//We register an event handler for this using mediaRecorder.onstop, and finalize our blob there from all
					//the chunks we have received

					mediaRecorder.onstop = function(e) {
				      console.log("data available after MediaRecorder.stop() called.");

							//Next, we create an HTML structure like the following, inserting it into our clip container,
							//which is an <article> element as below:

							//<article class="clip">
							//  <audio controls></audio>
							//  <p>your clip name</p>
							//  <button>Delete</button>
							//</article>

							//getting user input to determine clip name

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

							//if user does not name his clip then it will be unnamed
							//as My unnamed clip

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

							//After that, we create a combined Blob out of the recorded audio chunks, and create an object URL pointing
							//to it, using window.URL.createObjectURL(blob). We then set the value of the <audio> element's src attribute
							//to the object URL, so that when the play button is pressed on the audio player, it will play the Blob

				      var blob = new Blob(chunks, { 'type' : 'audio/ogg; codecs=opus' });
				      chunks = [];
				      var audioURL = window.URL.createObjectURL(blob);
				      audio.src = audioURL;
				      console.log("recorder stopped");

							//we set an onclick handler on the delete button to be a function that deletes the whole clip HTML structure

				      deleteButton.onclick = function(e) {
				        evtTgt = e.target;
				        evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
				      }

							//giving to user the choice to rename his clip

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

						//As recording progresses, we need to collect the audio data. We register
						//an event handler to do this using mediaRecorder.ondataavailable

				    mediaRecorder.ondataavailable = function(e) {
				      chunks.push(e.data);
				    }

				},

				function (error) {
					alert('Unable to get the user media');
				}
			);
		}

		//The createAnalyser() method of the BaseAudioContext interface creates an AnalyserNode,
		//which can be used to expose audio time and frequency data and create data visualisations

			spectrumAudioAnalyser = audioContext.createAnalyser();
        	spectrumAudioAnalyser.fftSize = spectrumFFTSize;
        	spectrumAudioAnalyser.smoothingTimeConstant = spectrumSmoothing;

        	sonogramAudioAnalyser = audioContext.createAnalyser();
        	sonogramAudioAnalyser.fftSize = sonogramFFTSize;
        	sonogramAudioAnalyser.smoothingTimeConstant = sonogramSmoothing;

	};

//initializing processor function for pitch , overlap and grain audio effects

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

					//connecting pitch to spectrum , spectrum to sonogram and then to output

        	pitchShifterProcessor.connect(spectrumAudioAnalyser);
        	pitchShifterProcessor.connect(sonogramAudioAnalyser);
        	pitchShifterProcessor.connect(audioContext.destination);

	};

//init sliders function to initialize user input sliders

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

//init canvas function to initialize audio vizualizations

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

//render canvas function to give user the option of choosing his visualization preference

    renderCanvas = function () {


    	switch (audioVisualisationIndex) {

					//Spectrum visualization

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

						//Wave visualization

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

						//Sonogram visualization

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

				//The AudioContext interface represents an audio-processing graph built from audio modules
				//linked together, each represented by an AudioNode. An audio context controls both the
				//creation of the nodes it contains and the execution of the audio processing, or decoding.
				//You need to create an AudioContext before you do anything else, as everything happens inside a context

				audioContext = new AudioContext();
			} else {
				alert('Your browser does not support the Web Audio API');
				return;
			}

			//Initializing all functions

			initAudio();
			initProcessor();
			initSliders();
			initCanvas();

			window.requestAnimFrame(renderCanvas);
		}
	}

}());

//Animation when visualization option is changed

window.requestAnimFrame = (function () {

	return (window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			function (callback) {
				window.setTimeout(callback, 1000 / 60);
			});
})();

window.addEventListener("DOMContentLoaded", pitchShifter.init, true);
