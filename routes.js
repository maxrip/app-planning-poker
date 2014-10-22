// This file is required by app.js. It sets up event listeners
// for the two main URL endpoints of the application - /create and /room/:id
// and listens for socket.io messages.


// Export a function, so that we can pass 
// the app and io instances from the app.js file:

module.exports = function(app,io){

	app.get('/', function(req, res){

		// Render views/home.html
		res.render('home');
	});

	app.get('/create', function(req,res){

		// Generate unique id for the room
		var id = Math.round((Math.random() * 1000000));

		// Redirect to the random room
		res.redirect('/room/'+id);
	});

	app.get('/room/:id', function(req,res){

		// Render the chant.html view
		res.render('room');
	});
}