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
	var roomsData = {}
	// Initialize a new socket.io application, named 'room'
	var rooms = io.of('/socket').on('connection', function (socket) {



		//инициалищация клиента
		socket.on('load',function(data){

			var room = findClientsSocket(io,data,'/socket');

			socket.emit('peopleinroom', {
				id: data
			});

		});




		socket.on('login', function(data) {

			var room = findClientsSocket(io, data.id, '/socket');
			
			socket.username = data.user;
			socket.room = data.id;
			
			//создаем комнату, если не сущесвтвует для хранения данных на сервере
			if(empty(roomsData[socket.room])){
				roomsData[socket.room]={
					startRound: false,
					users: {},
					usersVoted:{},
					carts: app.locals.carts,
					roundInfo:''
				}
			}

			if(!empty(roomsData[data.id].users[socket.username])){
				//такое имя существует
				socket.emit('peopleinroom', {
					id: data,
					message: "Имя занято, попробуйте другое"
				});
				return;
			}

			socket.join(data.id);
			roomsData[socket.room].users[socket.username]=0;

			rooms.in(data.id).emit('update-users', {
				id: data.id,
				users: roomsData[socket.room].users
			});
			
			if(room.length ==0){
				rooms.in(data.id).emit('invite', {
					id: data.id
				});
			}else{
				if(roomsData[socket.room].startRound == false){
					rooms.in(data.id).emit('offer-begin-round', {
						id: data.id
					});
				}else{
					socket.emit('begin-round', {
						id: data.id,
						carts:app.locals.carts,
						roundInfo:roomsData[socket.room].roundInfo
					});
				}
			}
		});
		



		//начало раунда
		socket.on('begin-round', function(data) {
			var room = findClientsSocket(io, data.id, '/socket');
			if(roomsData[socket.room].startRound){
				return;
			}

			roomsData[socket.room].startRound=true;
			roomsData[socket.room].roundInfo=data.roundInfo;

			rooms.in(data.id).emit('begin-round', {
				id: data.id,
				carts:app.locals.carts,
				roundInfo:data.roundInfo
			});

		})





		socket.on('reset-round', function(data) {
			var room = findClientsSocket(io, data.id, '/socket');
			socket.room = data.id;
			for (var user in roomsData[socket.room].users) {
				roomsData[socket.room].users[user] = 0;
				roomsData[socket.room].usersVoted[user] = null;
			}
			roomsData[socket.room].startRound=false;
			if(room.length ==0){
				rooms.in(data.id).emit('invite', {
					id: data.id
				});
			}else{
				rooms.in(data.id).emit('offer-begin-round', {
					id: data.id
				});	
			}

			rooms.in(data.id).emit('update-users', {
				id: data.id,
				users: roomsData[socket.room].users
			});
		})





		socket.on('seleced-value', function(data) {
			socket.username = this.username;
			socket.room = data.id;

			roomsData[socket.room].users[socket.username]=1;
			roomsData[socket.room].usersVoted[socket.username]=data.i;

			rooms.in(data.id).emit('update-users', {
				id: data.id,
				users: roomsData[socket.room].users
			});

			for (var user in roomsData[socket.room].users) {
				if(roomsData[socket.room].users[user] == false){
					//Если еще кто-то не проголосовал выход
					return
				}
			};

			rooms.in(data.id).emit('finish-round', {
				id: data.id,
				users: roomsData[socket.room].users,
				usersVoted:roomsData[socket.room].usersVoted,
				carts:app.locals.carts,
			});
		})




		socket.on('disconnect', function() {

			// отправляем другим игрокам уведомление об отключении, если такие есть
			
			if(!empty(roomsData[this.room]) && !empty(roomsData[this.room].users[this.username])){
				roomsData[this.room].users[this.username]=null;
				delete(roomsData[this.room].users[this.username])
			}

			if(!empty(roomsData[this.room])){
				socket.broadcast.to(this.room).emit('update-users', {
					room: this.room,
					users: roomsData[this.room].users
				});
				var room = findClientsSocket(io, this.room, '/socket');
				if(room.length <=1){
					roomsData[socket.room].startRound=false;
					rooms.in(this.room).emit('invite', {
						id: this.room
					});
				}
			}
			// leave the room
			socket.leave(socket.room);
		});

	});
};

function findClientsSocket(io,roomId, namespace) {
	var res = [],
		ns = io.of(namespace ||"/");    // the default namespace is "/"

	if (ns) {
		for (var id in ns.connected) {
			if(roomId) {
				var index = ns.connected[id].rooms.indexOf(roomId) ;
				if(index !== -1) {
					res.push(ns.connected[id]);
				}
			}
			else {
				res.push(ns.connected[id]);
			}
		}
	}
	return res;
}

function empty (value){
	return typeof(value)==="undefined" || value === null
}