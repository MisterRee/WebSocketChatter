var http = require('http');
var fs = require('fs');
var socketio = require('socket.io');
var port = process.env.PORT || process.env.NODE_PORT || 3000;
var index = fs.readFileSync(__dirname + '/../client/client.html');

function onRequest(request, responce){
	responce.writeHead(200, {"Content-Type": "text/html"});
	responce.write(index);
	responce.end();
}

var app = http.createServer(onRequest).listen(port);
console.log("Listening on 127.0.0.1:" + port);
var io = socketio(app);

var rooms = [];

io.sockets.on('connection', function(socket){
	onJoined(socket);
	onMsg(socket);
	onRoomChange(socket);
	onDisconnect(socket);
});

var onJoined = function(socket){
	socket.on('join', function(data){
		
		// Create room if none exists
		if(rooms.length == 0 || rooms[0].number != 0){
			var room = {
				number: 0,
				users: []
			};
			
			rooms.push(room);
		}
		
		socket.username = data.name;
		rooms[0].users.push(socket);
		joinRoom(socket, 0);
	});
}

function joinRoom(socket, roomIndex){
	var roomOfUser;
	socket.currentRoom = roomIndex;

	for(var i = 0; i < rooms.length; i++){
		if(rooms[i].number == roomIndex){
			roomOfUser = rooms[i];
		}
	}
	
	socket.emit('msg', "Server: There are " + roomOfUser.users.length + " users online");
		
	socket.join("Room" + roomOfUser.number);
		
	socket.broadcast.to("Room" + roomOfUser.number).emit('msg', "Server: " + socket.username + " has joined the room");
	socket.emit('msg', "Server: You have joined Room " + roomOfUser.number);
}

var onMsg = function(socket){
	socket.on('msgToServer', function(data){
		var roomOfUser;
		for(var i = 0; i < rooms.length; i++){
			if(rooms[i].number == socket.currentRoom){
				roomOfUser = rooms[i];
			}
		}
		
		switch(data.msg){
			case "/help":
				socket.emit('msg', "type '/poproom' to get the number of users in your current room: Room" + socket.currentRoom);
				socket.emit('msg', "type '/changeroom' to change your chat room");
				socket.emit('msg', "type '/openroom' to get the current open rooms on the server");
				socket.emit('msg', "type '/clear' to wipe your text box");
			break;
			case "/poproom":
				var sendMessage = data.name + "/Console: Room " + socket.currentRoom + " has a population of " + roomOfUser.users.length;
				socket.emit('msg', sendMessage);
			break;
			case "/changeroom":
				socket.emit('promptRoomChange');
			break;
			case "/openroom":
				var output = "The current open rooms are:";
				for(var i = 0; i < rooms.length; i++){
					output += "\n   Room " + rooms[i].number + " with " + rooms[i].users.length + " users.";
				}
				socket.emit('msg', output);
			break;
			case "/clear":
				socket.emit('clear');
			break;
			default:
				var sendMessage = data.name + ": " + data.msg;
				socket.emit('msg', sendMessage);
				socket.broadcast.to("Room" + roomOfUser.number).emit('msg', sendMessage);
			break;
		}
	});
};

var onRoomChange = function(socket){
	socket.on('roomChange', function(roomNumber){
		var successful = false;
		
		// Sift through current rooms and remove socket id
		for(var i = 0; i < rooms.length; i++){
			if(rooms[i].number == socket.currentRoom){
				socket.broadcast.to("Room" + rooms[i].number).emit('msg', "Server: " + socket.username + " has disconnected");
				socket.broadcast.to("Room" + rooms[i].number).emit('msg', "Server: There are " + rooms[i].users.length + " users online in Room " + rooms[i].number);
				rooms[i].users.splice(socket, 1);
				
				if(rooms[i].users.length == 0){
					rooms.splice(i, 1);
				}
				
				break;
			}
		}
		
		// Search if roomNumber exists
		for(var i = 0; i < rooms.length; i++){
			if(rooms[i].number == roomNumber){
				rooms[i].users.push(socket);
				joinRoom(socket, roomNumber);
				successful = true;
			}
		}
		
		// If not, Create room
		if(!successful){
			var room = {
				number: roomNumber,
				users: []
			};
			
			room.users.push(socket);
			rooms.push(room);
			joinRoom(socket, roomNumber);
		}
	});
};

var onDisconnect = function(socket){
	socket.on('disconnect', function(){
		var roomOfUser;
		
		for(var i = 0; i < rooms.length; i++){
			if(rooms[i].number == socket.currentRoom){
				roomOfUser = rooms[i];
			}
		}
		
		var currentUser = roomOfUser.users.indexOf(socket);

		socket.broadcast.to("Room" + roomOfUser.number).emit('msg', "Server: " + socket.username + " has disconnected");
		
		roomOfUser.users.splice(currentUser, 1);
		socket.broadcast.to("Room" + roomOfUser.number).emit('msg', "Server: There are " + roomOfUser.users.length + " users online in Room " + roomOfUser.number);
	});
};

console.log('websocket server started');

