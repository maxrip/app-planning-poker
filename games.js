
var Game = function() {
		_run = false;
		_users = {};
		_usersVoted = {};
		_carts = [];
		_roundInfo = '';

	this.statusRound = function(){
		return _run;
	}

	this.startRound = function(users,carts,roundInfo) {
		_users=users;
		for(id in _users){
			_users[id].isVoted=false;
		}
		_carts = carts || ["1/2", "1", "2", "3", "5", "8", "13", "20", "40", "100", "?", "∞"];
		_roundInfo = roundInfo || "";
		_run = true;
		return true;
	}

	this.changeCarts = function(carts){
		_carts = carts || _carts;
	}

	this.getCarts = function(carts){
		return _carts;
	}

	this.getRoundInfo = function(){
		return _roundInfo;
	}

	this.userVoted = function(id,value) {
		if(_users[id].isVoted){
			return false;
		}
		_usersVoted[id]=value;
		_users[id].isVoted = true;
		return true;
	}

	this.isGameEnd = function(){
		if(_run  ==  false){
			return false;
		}
		for (var user in _users) {
			if(_users[user].isVoted  ==  false){
				return false;
			}
		}
		return true;
	}
	this.getResult = function(){
		for(user in _users){
			_users[user].value=_usersVoted[user];
		}
		return _users;
	}
}

var Room = function(io,roomId,connection){
	var _users = {}

	//методы
	this.sendRoom = function(type,data){
		data= data || {};
		io.to(roomId).emit(type,data);
	}

	this.sendUpdateUsers = function (){
		this.sendRoom('update-users',{users:_users});
	}

	this.sendCurentUser = function (id,type,data){
		data=data || {};
		connection[id].socket.emit(type,data);
	}

	this.clearUsers = function(){
		for(user in _users){
			delete(_users[user].isVoted);
			delete(_users[user].value);
		}
	}

	this.getUsers = function (){
		return _users;
	}

	//события
	this.onJoinUser = function(id,name){
		connection[id].socket.join(roomId);
		_users[id]={name:name};
		this.sendUpdateUsers()
	}

	this.onDisconnectUser = function(id){
		if(_users[id]){
			_users[id]=null;
			delete(_users[id]);
			connection[id].socket.leave(roomId)
			this.sendUpdateUsers();
			if(this.count()==1){
				this.sendRoom('invite');
			}
		}
	}
	//служебные
	this.count = function(){
		var count=0;
		for(user in _users){
			count++;
		}
		return count;
	}
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