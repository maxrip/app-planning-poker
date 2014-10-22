
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
		if (this.nameIsAvailable(name)){
			this.connection[id].socket.join(this.roomId);
			this._users[id]={name:name};
			this.sendUpdateUsers()	
			return true
		}else{
			return "Имя занято, попробуйте другое";
		}
	}

	Room.prototype.nameIsAvailable = function(name){
		for(id in this._users){
			if(this._users[id].name == name){
				return false;
			}
		}
		return true;
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


var Games = function(){
	this.rooms = {},
	this.games = {},
	this.connection = {},
	this.io;
}

Games.prototype = {

	createId: function(){
		return Math.round((Math.random() * 1000000));
	},

	createRoom: function(roomId){
		this.rooms[roomId] = {
			"room":new Room(this.io,this.roomId,this.connection),
			"game":new Game()
		}
	},

	sendCurentUser: function(id,type,data){
		data=data || {};
		this.connection[id].socket.emit(type,data);
	},

	destroyRoom: function(roomId){
		this.rooms[roomId].rooms=null;
		this.rooms[roomId].game=null;
		this.rooms[roomId]=null;
		delete(this.rooms[roomId])
	},

	testGame: function(roomId){
		if(this.rooms[roomId].game.isGameEnd()){
			this.rooms[roomId].room.sendRoom('finish-round',{
				users:this.rooms[roomId].game.getResult(),
				carts:this.rooms[roomId].game.getCarts()
			})
		}
	},

	//события в игре
	onJoinRoom: function(roomId,id,name,socket){
		if(this.rooms[roomId] === undefined){
			this.createRoom(roomId);
		}
		var status = this.rooms[roomId].room.onJoinUser(id,name);
		if(status === true){
			this.connection[id].roomId = roomId;
			if(this.rooms[roomId].room.count()==1){
				//Всего один игрок отправляем инвайт
				this.rooms[roomId].room.sendRoom('invite');
			}else{
				if(this.rooms[roomId].game.statusRound()){
					//Игра запущена, отправляем данные новому игроку
					if(this.rooms[roomId].game.isGameEnd()){
						//Вывод результатов
						this.rooms[roomId].room.sendRoom('finish-round',{
						users:this.rooms[roomId].game.getResult(),
						carts:this.rooms[roomId].game.getCarts()
						})
					}else{
						//Вывод карт
						this.rooms[roomId].game.addUser(id);
						socket.emit('begin-round',{
							roundInfo:this.rooms[roomId].game.getRoundInfo(),
							carts:this.rooms[roomId].game.getCarts()
						});
					}
				}else{
					//Приглашение начать игру
					this.rooms[roomId].room.sendRoom('offer-begin-round');
				}
			}
		}else{
			this.sendCurentUser(id,"showloginform",{message:status})
		}
	},
	
	onDisconnectUser: function(id){
		var roomId=this.connection[id].roomId;
		if(this.rooms[roomId]){
			this.rooms[roomId].room.onDisconnectUser(id);
			if(this.rooms[roomId].room.count()==0){
				this.destroyRoom(roomId);
			}else{
				this.testGame(roomId);
			}
			
		}
		
	},
	onBeginRound: function(roomId,id,roundInfo,socket,carts){
		if(this.rooms[roomId].game.statusRound()){
			//sendCurentUser(id,'error',{message:"Игра уже запущена"})
			return
		}
		if(this.rooms[roomId].room.count()<2){
			//sendCurentUser(id,'error',{message:"Игру можно начать когда пользователей не меньше двух"})
			return
		}
		//Запуску игры
		this.rooms[roomId].game.startRound(this.rooms[roomId].room.getUsers(),carts,roundInfo);
		//Проверка запущена игра или нет
		if(this.rooms[roomId].game.statusRound()){
			this.rooms[roomId].room.sendRoom('begin-round',{
				roundInfo:roundInfo,
				carts:this.rooms[roomId].game.getCarts()
			})
		}
	},

	onSelectValue: function(roomId,id,value){
		if(this.rooms[roomId].game.userVoted(id,value)){
			this.rooms[roomId].room.sendUpdateUsers();
			this.testGame(roomId);
		}
	},

	onGameReset: function(roomId){
		this.rooms[roomId].game=new Game();
		this.rooms[roomId].room.clearUsers();
		this.rooms[roomId].room.sendUpdateUsers();
		this.rooms[roomId].room.sendRoom('offer-begin-round');
	}
}

module.exports = function(io){
	games = new Games(io);
	games.io=io.of('/socket').on('connection', function (socket) {
		//Заносим в хешь сокет для общения с клиентом
		games.connection[socket.id.toString()]={socket:socket};
		socket.on("load",function(){
			games.sendCurentUser(socket.id.toString(),"showloginform")
		})

		socket.on("disconnect",function(){
			games.onDisconnectUser(socket.id.toString())
			games.connection[socket.id.toString()]=null;
			delete(games.connection[socket.id.toString()]);
		})

		socket.on("login",function(data){
			games.onJoinRoom(data.roomId,socket.id.toString(),data.name,socket);
		})

		socket.on("begin-round",function(data){
			games.onBeginRound(data.roomId,socket.id.toString(),data.roundInfo,socket);
		})
		
		socket.on("seleced-value",function(data){
			games.onSelectValue(data.roomId,socket.id.toString(),data.value);
		})
		socket.on('reset-round', function(data) {
			games.onGameReset(data.roomId);
		})
	})
}