//Making functions whith the help of Pizzicato

//Pizzicato white noise

	 var whiteNoise = new Pizzicato.Sound(function(e) {

	    var output = e.outputBuffer.getChannelData(0);
	   for (var i = 0; i < e.outputBuffer.length; i++)
	        output[i] = Math.random();
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
