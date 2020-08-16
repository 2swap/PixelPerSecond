const fs = require('fs');
const express = require('express');
var app = express();

app.use('/pps',express.static(__dirname + '/client'));
var server = app.listen(parseInt(process.argv[2]));
const io = require('socket.io').listen(server);

console.log("Running on " + parseInt(process.argv[2]));

var alph = " abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#";
var playerCount = 0;
var sockets = {};
var sz = 128, numColors = 64;
var fly = -1, flx = -1;
var grid = new Array(sz);

init();
function init(){
	loadGrid();
}
function loadGrid(){
	var data = fs.readFileSync("board.txt","utf8");
	for(var y = 0; y < sz; y++){
		grid[y] = new Array(sz);
		for(var x = 0; x < sz; x++) grid[y][x] = alph.indexOf(data.charAt(x+y*(sz+1)));
	}
}



setInterval(function(){
	playerCount = Object.keys(sockets).length;
	for(var i in sockets){
		playerCoords = {};
		for(var i in sockets) playerCoords[i] = {x:sockets[i].x, y:sockets[i].y, col:sockets[i].col, name:sockets[i].name};
		send(i, 'p', {amt:playerCount, playerCoords:playerCoords});
	}
	for(var i = 0; i < 10; i++) grid[Math.floor(Math.random()*sz)][Math.floor(Math.random()*sz)] = 0;
},500);
setInterval(function(){
	fs.writeFileSync("board.txt", "", function(err){});
	for(var y = 0; y < sz; y++){
		var str = "";
		for(var x = 0; x < sz; x++) str += alph.charAt(grid[y][x]);
		fs.appendFileSync("board.txt", str+"\n", function(err){});
	}
},30000);



io.sockets.on('connection', function(socket){
	var id = socket.id = Math.random();
	sockets[id]=socket;
	sockets[id].x = sockets[id].y = sz/2;
	sockets[id].col = "black";
	sockets[id].name = "Guest " + Math.floor(Math.random()*1000);
	playerCount++;
	var ip = socket.request.connection.remoteAddress;
	console.log(ip + " connected!");

	socket.on('join',function(data){ send(id, 'b', {grid:grid, sz:sz, center:true}); });
	
	socket.on('chat',function(data){
		if(typeof data.msg !== "string" || data.msg.length == 0) return;
		data.msg = data.msg.trim();
		if(data.msg.startsWith("/name")) {sockets[id].name = data.msg.substring(6); return;}
		var msg = sockets[id].name + ": " + data.msg;
		for(var s in sockets) send(s, 'chat', {msg:msg});
	});
	
	socket.on('undo',function(data){
		loadGrid();
		for(var s in sockets) send(s, 'b', {grid:grid, sz:sz, center:false});
	});
	
	socket.on('flood',function(data){
		if(typeof sockets[id] === 'undefined') return;

		if(typeof data === "undefined" || data.constructor != Object) {console.log("Malformed fill!"); return;}
		if(typeof data.col != 'number' || data.col != Math.floor(data.col) || data.col < 0 || data.col >= numColors) {console.log("Bad put color: " + data.col); return;}
		if(typeof data.loc != 'number' || data.loc != Math.floor(data.loc) || data.loc >= sz * sz || data.loc < 0)   {console.log("Bad put index: " + data.loc); return;}
		fly = data.loc/sz;
		flx = data.loc%sz;
		flood(data.loc, data.col, 0);
		for(var s in sockets) send(s, 'b', {grid:grid, sz:sz, center:false});
		fly = flx = -1;
	});

	socket.on('put',function(data){
		if(typeof sockets[id] === 'undefined') return;

		if(typeof data === "undefined" || data.constructor != Object) {console.log("Malformed queue!"); return;}
		var pixChanged = 0;
		for(var i in data){
			if(typeof i !== "string") return; // not a dict
			var point = parseFloat(i);
			if(typeof data[i] != 'number' || data[i] != Math.floor(data[i]) || data[i] < 0 || data[i] >= numColors) {console.log("Bad put color: " + data[i]); return;}
			if(typeof point != 'number' || point != Math.floor(point) || point >= sz * sz || point < 0) {console.log("Bad put index: " + point); return;}

			pixChanged++;
			grid[Math.floor(point / sz)][point % sz] = data[i];
			if(pixChanged == 1) {
				sockets[id].x = point%sz;
				sockets[id].y = Math.floor(point/sz);
				sockets[id].col = data[i];
			}
		}
		for(var s in sockets) send(s, 'u', data);
	});



	socket.on('disconnect', function(data){ leave(id); });
});



function leave(i){
	delete sockets[i];
}
function flood(loc, col){
	if(Math.hypot(fly-loc/sz,flx-loc%sz)>3.99) return;
	var u = loc>=sz      ? grid[Math.floor(loc / sz) - 1][loc % sz    ]:-1;
	var l = loc%sz>0     ? grid[Math.floor(loc / sz)    ][loc % sz - 1]:-1;
	var d = loc<sz*sz-sz ? grid[Math.floor(loc / sz) + 1][loc % sz    ]:-1;
	var r = loc%sz<sz-1  ? grid[Math.floor(loc / sz)    ][loc % sz + 1]:-1;
	var h = grid[Math.floor(loc / sz)][loc % sz];
	if(h == col) return;
	grid[Math.floor(loc / sz)][loc % sz] = col;
	if(u == h) flood(loc-sz, col);
	if(l == h) flood(loc-1 , col);
	if(r == h) flood(loc+1 , col);
	if(d == h) flood(loc+sz, col);
}

function send(id, type, dict){
	if(typeof sockets[id] !== "undefined") sockets[id].emit(type,dict);
}
