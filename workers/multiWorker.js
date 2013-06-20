// Helper methods to find max and min value in an array
Array.max = function( array ) {
	return Math.max.apply( Math, array );
};
Array.min = function( array ) {
	return Math.min.apply( Math, array );
};
// Variables
var wid = null,
	gid = null;
// Width and height
var width = 600,
	height = 600,
	// Color mapping [R, G, B]
	// Defines the escape value for each color
	rgb_levels = [ 50, 200, 500 ],
	// Escape value = max(rgb_levels)
	escape_val = 0,
	// Number of samples
	samples = 1000000,
	// Real stage
	real_l = -2.0,
	real_h = 2.0,
	// Imaginary stage
	imaginary_l = -2.0,
	imaginary_h = 2.0,
	// C complex
	Cr = 0.0,
	Ci = 0.0,
	// Z complex
	Zr = 0.0,
	Zi = 0.0,
	// Value of Z from previous iteration
	ZrPrev = 0.0,
	ZiPrev = 0.0,
	// Counter of hits for each pixel per color component
	pixelDensityR = [ ],
	pixelDensityG = [ ],
	pixelDensityB = [ ],
	// Composit of density map
	pixelBuffer = [ ],
	// Orbits = Trajectories = Hits, call it as you wish
	trajectories = [ ],
	start = new Date( ).getTime( );
// Init method
// Resets all major variables to their initial state.
// Also responsible for allocating arrays depending on the stage size
var init = function( ) {
	//console.log( 'Worker(' + wid + ') initalizing' );
	// Find max value in rgb_levels
	escape_val = getEscapeValue( );
	//console.log( 'Worker(' + wid + ') got max escapes' );
	// Resets
	pixelDensityR = [ ];
	pixelDensityG = [ ];
	pixelDensityB = [ ];
	trajectories = [ ];
	try {
		pixelBuffer = new Uint8ClampedArray( width * height * 3 );
		//console.log( 'Worker(' + wid + ') pixel buffer initialized' );
	} catch ( e ) {
		//console.log(e);
	}
	var i, j;
	// Make trajectories a two dimensional array
	for ( i = 0; i < escape_val; i++ ) {
		trajectories[ i ] = [ ];
	}
	//console.log( 'defining density maps' );
	// Density maps and the pixel buffer are 3D
	for ( i = 0; i < width; i++ ) {
		pixelDensityR[ i ] = [ ];
		pixelDensityG[ i ] = [ ];
		pixelDensityB[ i ] = [ ];
		for ( j = 0; j < height; j++ ) {
			pixelDensityR[ i ][ j ] = 0;
			pixelDensityG[ i ][ j ] = 0;
			pixelDensityB[ i ][ j ] = 0;
		}
	}
	for ( i = 0; i < width * height * 3; i++ ) {
		pixelBuffer[ i ] = 0;
	}
};
// Generate random float64 in range
var getRandomArbitrary = function( min, max ) {
	return Math.random( ) * ( max - min ) + min;
};
// Generate random complex number, R: float64, I: float64
var getRandomArbitraryComplex = function( min, max ) {
	return [ Math.random( ) * ( max - min ) + min, Math.random( ) * ( max - min ) + min ];
};
// Find escape value
var getEscapeValue = function( ) {
	return Array.max( rgb_levels );
};
// The magic function. All Buddhabrot related calculations are done here.
var evaluate = function( ) {
	//console.log( 'Worker(' + wid + ') evaluating work at hand' );
	var n = 0,
		i = 0,
		sample = 0;
	// In case you wish to sample all points in order you need this
	// var incrementX = Math.abs(real_h - real_l) / width;
	// var incrementY = Math.abs(imaginary_h - imaginary_l) / height;
	// Start sampling
	// Note: replace this with a for loop and iterate through Cr and Ci with incrementX, incrementY
	// for non-random sampling
	while ( sample++ < samples ) {
		// Get random values for Cr and Ci
		Cr = getRandomArbitrary( real_l, real_h );
		Ci = getRandomArbitrary( imaginary_l, imaginary_h );
		// Reset
		ZrPrev = ZiPrev = 0.0; // Z sub 0
		// Basic Mandelbrot, but we store the trajectories as well
		for ( n = 0; n < escape_val; n++ ) {
			Zr = ZrPrev * ZrPrev - ZiPrev * ZiPrev + Cr;
			Zi = 2 * ZrPrev * ZiPrev + Ci;
			trajectories[ n ][ 0 ] = ZrPrev = Zr;
			trajectories[ n ][ 1 ] = ZiPrev = Zi;
			if ( Zr * Zr + Zi * Zi > 4 ) break;
		}
		// After evaluating the Mandelbrot set let's find the affected pixels
		if ( n < escape_val ) {
			for ( i = 0; i < n; i++ ) {
				// Translate R and I coordinates into pixel coords.
				var coordX = Math.floor( ( ( trajectories[ i ][ 0 ] + 2 ) / Math.abs( real_h - real_l ) ) * width );
				var coordY = Math.floor( ( ( trajectories[ i ][ 1 ] + 2 ) / Math.abs( imaginary_h - imaginary_l ) ) * height );
				// Just be sure we are not out of bounds
				if ( coordX < 0 || coordX >= width || coordY < 0 || coordY >= height )
					continue;
				// If the count is below the value defined in the color levels then color the pixel
				if ( n < rgb_levels[ 0 ] ) {
					if ( pixelDensityR[ coordX ][ coordY ] === undefined ) pixelDensityR[ coordX ][ coordY ] = 0;
					pixelDensityR[ coordX ][ coordY ]++;
				}
				if ( n < rgb_levels[ 1 ] ) {
					if ( pixelDensityG[ coordX ][ coordY ] === undefined ) pixelDensityG[ coordX ][ coordY ] = 0;
					pixelDensityG[ coordX ][ coordY ]++;
				}
				if ( n < rgb_levels[ 2 ] ) {
					if ( pixelDensityB[ coordX ][ coordY ] === undefined ) pixelDensityB[ coordX ][ coordY ] = 0;
					pixelDensityB[ coordX ][ coordY ]++;
				}
			}
		}
	}
};
// Find max hit counter for a color
var findMaxColor = function( forColor ) {
	//console.log( 'Determining max interation for ' + forColor );
	var i = 0,
		j = 0,
		max = 0;
	for ( i = 0; i < width; i++ ) {
		for ( j = 0; j < height; j++ ) {
			if ( forColor === 'red' ) if ( pixelDensityR[ i ][ j ] > max ) max = pixelDensityR[ i ][ j ];
			if ( forColor === 'green' ) if ( pixelDensityG[ i ][ j ] > max ) max = pixelDensityG[ i ][ j ];
			if ( forColor === 'blue' ) if ( pixelDensityB[ i ][ j ] > max ) max = pixelDensityB[ i ][ j ];
		}
	}
	return max;
};
// Merge pixel densities into one pixel map
var produceImage = function( ) {
	//console.log( 'Mapping computed escape trajectories' );
	var i = 0,
		j = 0;
	// Get factor for scaling hit counter to fit in the range of 0..255
	var factorColorR = 255.0 / findMaxColor( 'red' );
	var factorColorG = 255.0 / findMaxColor( 'green' );
	var factorColorB = 255.0 / findMaxColor( 'blue' );
	//	iterate each pixel in map
	for ( i = 0; i < width; i++ ) {
		for ( j = 0; j < height; j++ ) {
			// Calculate scaled hit counter value
			var colorR = Math.floor( pixelDensityR[ i ][ j ] * factorColorR );
			var colorG = Math.floor( pixelDensityG[ i ][ j ] * factorColorG );
			var colorB = Math.floor( pixelDensityB[ i ][ j ] * factorColorB );
			// Write pixels
			pixelBuffer[ ( j * width + i ) * 3 + 0 ] = colorR;
			pixelBuffer[ ( j * width + i ) * 3 + 1 ] = colorG;
			pixelBuffer[ ( j * width + i ) * 3 + 2 ] = colorB;
		}
	}
	// var nowTime = new Date( ).getTime( );
	// var totalTime = ( nowTime - start ) / 1000;
	// console.log( 'Worker(' + gid + ') returning render took: ' + totalTime + 's' );
	// Send message to main thread with the generated pixel map
	self.postMessage( {
		buffer: pixelBuffer,
		wid: wid,
		id: gid,
		action: 'complete'
	} );
	self.close( );
};
// Set up the generator on a message
onmessage = function( event ) {
	start = new Date( ).getTime( );
	wid = event.data.wid;
	gid = event.data.gid + 1;
	width = event.data.opt[ 0 ];
	height = event.data.opt[ 1 ];
	samples = event.data.opt[ 2 ];
	var totalComp = ( ( width * height ) * samples ) * ( ( event.data.opt[ 3 ] + event.data.opt[ 4 ] + event.data.opt[ 5 ] ) / 3 );
	console.log( 'Worker(' + gid + ') received instruction to begin rendering ' + samples + ' iterations,  approximate necessary computations: ' + totalComp );
	rgb_levels = [ event.data.opt[ 3 ], event.data.opt[ 4 ], event.data.opt[ 5 ] ];
	init( );
	for ( var i = 0; i <= event.data.passes; i++ ) {
		$progress( i + 1, event.data.passes );
		evaluate( );
		if ( i === event.data.passes ) {
			//	render to canvas
			produceImage( );
		}
	}
};

function $log( m ) {
	self.postMessage( {
		action: 'log',
		msg: m
	} );
	return;
}

function $progress( current, limit ) {
	if ( ( current % 5 ) === 0 ) {
		self.postMessage( {
			action: 'progress',
			current: current,
			limit: limit
		} );
		$log( 'Worker(' + gid + ') running pass #' + current + '/' + limit );
	}
}