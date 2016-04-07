/*
	
	This is the beginning of the Phased FB abstraction module.
	Currently it only provides static meta values from the DB,
	but as we develop our server, we can put more abstractions in hurr.

	Let's try to keep it clean. (Don't load the whole DB into memory;
	don't make 30 FB calls when you can make 3, etc)

*/

var config = require('../../config/environment');
var promise = require('promise');
var FBRef = require('../phasedFBRef').getRef();


/*
**
**	PUBLIC PROPERTIES
**
*/

module.exports = {
	// replicates the FB meta key
	meta : {}
}



/*
**
**	Server init
**	(to be called only on server startup)
**
*/
module.exports.init = function init () {

	// load in base FB vals to be used elsewhere on the server
	var loadBaseVals = function(authData) {
		if (!authData) return;
		FBRef.offAuth(loadBaseVals); // deregister ONLY THIS callback

		FBRef.child('meta').once('value', function(snap){
			module.exports.meta = snap.val();
		});
	}

	// do loadBaseVals when appropriate
	if (!FBRef.getAuth()) {
		FBRef.onAuth(loadBaseVals);
	} else {
		loadBaseVals(true);
	}
}