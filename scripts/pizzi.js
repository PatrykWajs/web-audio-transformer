//Making functions whith the help of Pizzicato

//Pizzicato white noise

	 var whiteNoise = new Pizzicato.Sound(function(e) {

	 	//The getChannelData() method of the AudioBuffer Interface 
	 	//returns a Float32Array containing the PCM data associated 
	 	//with the channel, defined by the channel parameter (with 0 
	 	//representing the first channel)

	    var output = e.outputBuffer.getChannelData(0);
	   for (var i = 0; i < e.outputBuffer.length; i++)
	        output[i] = Math.random() * 2 - 1;
	 });

//Pizzicato pink noise

	var pinkNoise = new Pizzicato.Sound(function(e) {

		var b0, b1, b2, b3, b4, b5, b6;
    	b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;

		var output =  e.outputBuffer.getChannelData(0);

		for (var i = 0; i < e.outputBuffer.length; i++){
	        var white = Math.random() * 2 - 1;

	    	b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            output[i] *= 0.11; // (roughly) compensate for gain
            b6 = white * 0.115926;
        }
	 });

//Pizzicato brown noise

	var brownNoise = new Pizzicato.Sound(function(e) {

		var lastOut = 0.0;

		var output =  e.outputBuffer.getChannelData(0);

		for (var i = 0; i < e.outputBuffer.length; i++){
	        var white = Math.random() * 2 - 1;

	    	output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; // (roughly) compensate for gain
        }
	 });

//Pizzicato annoying sound

	 var annoyingSound = new Pizzicato.Sound(
	 {
	    source: 'wave',
	    options: {
	       type: 'sine',
	        frequency: 10000,
	        volume: 0.7,
	        attack: 0.9
	    }
	 }
	 );
