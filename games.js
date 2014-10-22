
var Game = function() {
	this._run = false;
	this._users = {};
	this._usersVoted = {};
	this._carts = [];
	this._roundInfo = '';
}
	Game.prototype.statusRound = function(){
		return this._run;
	}

	Game.prototype.startRound = function(users,carts,roundInfo) {
		this._users=users;
		for(id in this._users){
			this._users[id].isVoted=false;
		}
		this._carts = carts || ["1/2", "1", "2", "3", "5", "8", "13", "20", "40", "100", "?", "∞"];
		this._roundInfo = roundInfo || "";
		this._run = true;
		return true;
	}

	Game.prototype.addUser = function(id){
		this._users[id].isVoted=false;
	}

	Game.prototype.changeCarts = function(carts){
		this._carts = carts || this._carts;
	}

	Game.prototype.getCarts = function(carts){
		return this._carts;
	}

	Game.prototype.getRoundInfo = function(){
		return this._roundInfo;
	}

	Game.prototype.userVoted = function(id,value) {
		if(this._users[id].isVoted){
			return false;
		}
		this._usersVoted[id]=value;
		this._users[id].isVoted = true;
		return true;
	}

	Game.prototype.isGameEnd = function(){
		if(this._run  ==  false){
			return false;
		}
		for (var user in this._users) {
			if(this._users[user].isVoted  ==  false){
				return false;
			}
		}
		return true;
	}
	Game.prototype.getResult = function(){
		for(user in this._users){
			this._users[user].value=this._usersVoted[user];
		}
		return this._users;
	}


var Room = function(io,roomId,connection){
	this._users = {};
	this.io=io;
	this.roomId=roomId;
	this.connection=connection;
}


	//методы
	Room.prototype.sendRoom = function(type,data){
		data= data || {};
		this.io.to(this.roomId).emit(type,data);
	}

	Room.prototype.sendUpdateUsers = function (){
		this.sendRoom('update-users',{users:this._users});
	}


	Room.prototype.clearUsers = function(){
		for(user in this._users){
			delete(this._users[user].isVoted);
			delete(this._users[user].value);
		}
	}

	Room.prototype.getUsers = function (){
		return this._users;
	}

	//события
	Room.prototype.onJoinUser = function(id,name){
		this.connection[id].socket.join(this.roomId);
		this._users[id]={name:name};
		this.sendUpdateUsers()
	}

	Room.prototype.onDisconnectUser = function(id){
		if(this._users[id]){
			this._users[id]=null;
			delete(this._users[id]);
			this.connection[id].socket.leave(this.roomId)
			this.sendUpdateUsers();
			if(this.count()==1){
				this.sendRoom('invite');
			}
		}
	}
	//служебные
	Room.prototype.count = function(){
		var count=0;
		for(user in this._users){
			count++;
		}
		return count;
	}


var Games = function(io){
	var rooms = {},
		games = {},
		connection = {},
		_io;
	function createId(){
		return Math.round((Math.random() * 1000000));
	}

	function createRoom(roomId){
		rooms[roomId] = {
			"room":new Room(_io,roomId,connection),
			"game":new Game()
		}
	}

	function sendCurentUser(id,type,data){
		data=data || {};
		connection[id].socket.emit(type,data);
	}

	function destroyRoom(roomId){
		rooms[roomId].rooms=null;
		rooms[roomId].games=null;
		rooms[roomId]=null;
		delete(rooms[roomId])
	}

	function testGame(roomId){
		if(rooms[roomId].game.isGameEnd()){
			rooms[roomId].room.sendRoom('finish-round',{
				users:rooms[roomId].game.getResult(),
				carts:rooms[roomId].game.getCarts()
			})
		}
	}

	//события в игре
	function onJoinRoom(roomId,id,name,socket){
		if(rooms[roomId] === undefined){
			createRoom(roomId);
		}
		rooms[roomId].room.onJoinUser(id,name);
		connection[id].roomId = roomId;
		if(rooms[roomId].room.count()==1){
			//Всего один игрок отправляем инвайт
			rooms[roomId].room.sendRoom('invite');
		}else{
			if(rooms[roomId].game.statusRound()){
				//Игра запущена, отправляем данные новому игроку
				if(rooms[roomId].game.isGameEnd()){
					//Вывод результатов
					rooms[roomId].room.sendRoom('finish-round',{
					users:rooms[roomId].game.getResult(),
					carts:rooms[roomId].game.getCarts()
					})
				}else{
					//Вывод карт
					rooms[roomId].game.addUser(id);
					socket.emit('begin-round',{
						roundInfo:rooms[roomId].game.getRoundInfo(),
						carts:rooms[roomId].game.getCarts()
					});
				}
			}else{
				//Приглашение начать игру
				rooms[roomId].room.sendRoom('offer-begin-round');
			}
		}
	}
	
	function onDisconnectUser(id){
		var roomId=connection[id].roomId;
		if(rooms[roomId]){
			rooms[roomId].room.onDisconnectUser(id);
			if(rooms[roomId].room.count()==0){
				destroyRoom(roomId);
			}else{
				testGame(roomId);
			}
			
		}
		
	}
	function onBeginRound(roomId,id,roundInfo,socket,carts){

		if(rooms[roomId].game.statusRound()){
			//sendCurentUser(id,'error',{message:"Игра уже запущена"})
			return
		}

		if(rooms[roomId].room.count()<2){
			//sendCurentUser(id,'error',{message:"Игру можно начать когда пользователей не меньше двух"})
			return
		}
		//Запуску игры
		rooms[roomId].game.startRound(rooms[roomId].room.getUsers(),carts,roundInfo);
		//Проверка запущена игра или нет
		if(rooms[roomId].game.statusRound()){
			rooms[roomId].room.sendRoom('begin-round',{
				roundInfo:roundInfo,
				carts:rooms[roomId].game.getCarts()
			})
		}
	}
	function onSelectValue(roomId,id,value){
		if(rooms[roomId].game.userVoted(id,value)){
			rooms[roomId].room.sendUpdateUsers();
			testGame(roomId);
		}
	}

	function onGameReset(roomId){
		rooms[roomId].games=new Game();
		rooms[roomId].room.clearUsers();
		rooms[roomId].room.sendUpdateUsers();
		rooms[roomId].room.sendRoom('offer-begin-round');
	}

	_io=io.of('/socket').on('connection', function (socket) {
		//Заносим в хешь сокет для общения с клиентом
		connection[socket.id.toString()]={socket:socket};
		socket.on("load",function(){
			sendCurentUser(socket.id.toString(),"showloginform")
		})

		socket.on("disconnect",function(){
			onDisconnectUser(socket.id.toString())
			connection[socket.id.toString()]=null;
			delete(connection[socket.id.toString()]);
		})

		socket.on("login",function(data){
			onJoinRoom(data.roomId,socket.id.toString(),data.name,socket);
		})

		socket.on("begin-round",function(data){
			onBeginRound(data.roomId,socket.id.toString(),data.roundInfo,socket);
		})
		
		socket.on("seleced-value",function(data){
			onSelectValue(data.roomId,socket.id.toString(),data.value);
		})
		socket.on('reset-round', function(data) {
			onGameReset(data.roomId);
		})
	})
}
module.exports = function(app,io){
	games = new Games(io);	
}