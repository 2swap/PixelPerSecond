console.log("running js...");
var socket = io('45.79.174.161:10500');
var canvas = document.getElementById('ctx');
var ctx = canvas.getContext("2d");



var sz = 1, zoom = 1, cx = sz/2, cy = sz/2, lineWidth = .015625;
var ga = .5, tcx = sz/2, tcy = sz/2, tzoom = 12;
var mx = 0, my = 0, col = 60, button = 0;
var w = canvas.width = sz * zoom, h = canvas.height = sz * zoom;
var colors = [];
var playerCount = 0;
var playerCoords = 0;
var queue = {};
var grid = 5;

var chatArr = [];
var chatindex = 0;
for(var i = 0; i < 30; i++)chatArr.push("");

for(var i = 0; i < 64; i++){
	var rv = i&3;
	if(Math.floor(i>>2)&1) rv = 3 - rv;
	var r = fixColor(255-(rv)*85);
	var g = fixColor(255-(Math.floor(i>>2)&3)*85);
	var b = fixColor(255-(Math.floor(i>>4)&3)*85);
	colors[i] = "rgb(" + [r, g, b].join(",") + ")";
}



socket.emit("join",{});
socket.on('u', function (data) {
	if(sz == 1) return;
	for(var i in data){
		var point = parseFloat(i);
		grid[Math.floor(point / sz)][point % sz] = data[i];
	}
});
socket.on('b', function (data) {
	sz = data.sz;
	if(data.center) tcx = tcy = cx = cy = sz/2;
	grid = new Array(sz);
	for(var y = 0; y < sz; y++){
		grid[y] = new Array(sz);
		for(var x = 0; x < sz; x++) grid[y][x] = data.grid[y][x];
	}
});
socket.on('p', function (data){
	playerCount = data.amt;
	playerCoords = data.playerCoords;
});
socket.on('chat', function (data){
	chatArr[chatindex] = data.msg;
	var chatstring = "";
	for(var i = 1; i < 31; i++) chatstring += chatArr[(i+chatindex)%30] + "\n";
	chatindex = (chatindex+1)%30;
	chathistory.value = chatstring;
});



setInterval(function(){
	w = window.innerWidth;
	h = window.innerHeight;
	if(canvas.width != w-200 || canvas.height != h){
		canvas.width = w-200;
		canvas.height = h;
	}
	render();
	sendQueue();	
	if(button == 2 && gx >= 0 && gx < sz && gy >= 0 && gy < sz) col = grid[gy][gx]; // mouse wheel color pickr
},40);



function sendQueue(){
	//even send empty queues as a ping
	socket.emit('put', queue);
	queue = {};
}
function correctBounds(){
	var minZoom = Math.max(w/sz, h/sz);
	if(tzoom > 100) tzoom = 100;
	if(tzoom < minZoom/2) tzoom = minZoom/2;
	
	if(cy<0)cy=0;
	if(cx<0)cx=0;
	if(cy>sz)cy=sz;
	if(cx>sz)cx=sz;
}
function render(){
	if(sz == 1) return;
	cx = (cx * 3 + tcx) / 4;
	cy = (cy * 3 + tcy) / 4;
	zoom = (zoom * 3 + tzoom) / 4;
	correctBounds();
	rBG();
	rBounds();
	rGrid();
	rPlayers();
	rGUI();
	rPlayerCount();
}
function rPlayerCount(){
	ctx.textAlign = "left"
	ctx.fillStyle = "black"
	ctx.font = "24px Blogger";
	ctx.fillText(playerCount+" Player" + (playerCount==1?"":"s") + " Online!",32,h-32);
}
function rPlayers(){
	ctx.textAlign = "center";
	ctx.strokeStyle = "black";
	ctx.font = zoom*1.5+"px Blogger";
	if(playerCoords === 0) return;
	for(var i in playerCoords){
		var p = playerCoords[i];
		ctx.strokeWidth = lineWidth*4*zoom;

		ctx.fillStyle = colors[p.col];
		ctx.fillRect((p.x-cx-.1)*zoom+w/2,(p.y-cy-.1)*zoom+h/2,zoom*1.2,zoom*1.2);
		ctx.strokeRect((p.x-cx-.1)*zoom+w/2,(p.y-cy-.1)*zoom+h/2,zoom*1.2,zoom*1.2);
		
		ctx.strokeWidth = lineWidth*1*zoom;
		ctx.fillStyle = "white";
		ctx.fillText(p.name, (p.x-cx+.5)*zoom+w/2, (p.y-cy+3.5)*zoom+h/2);
		ctx.strokeText(p.name, (p.x-cx+.5)*zoom+w/2, (p.y-cy+3.5)*zoom+h/2);
	}
}
function rBG(){
	ctx.fillStyle = "#c0c0c0";
	ctx.fillRect(0,0,w,h);
}
function rBounds(){
	ctx.strokeStyle = "Black";
	ctx.fillStyle = "white";
	ctx.strokeWidth = lineWidth;
	ctx.fillRect(-cx*zoom+w/2,-cy*zoom+h/2,zoom*sz,zoom*sz);
	ctx.strokeRect(-cx*zoom+w/2,-cy*zoom+h/2,zoom*sz,zoom*sz);
}
function rGrid(){
	for(var y = 0; y < sz; y++) for(var x = 0; x < sz; x++){
		if(grid[y][x] == 0) continue;
		ctx.fillStyle = colors[grid[y][x]];
		ctx.fillRect((lineWidth+x-cx)*zoom+w/2,(lineWidth+y-cy)*zoom+h/2,zoom*(1-2*lineWidth),zoom*(1-2*lineWidth));
	}
}
function rGUI(){
	if(mx<w/2-256||mx>=w/2+256||my<h-192||my>=h-64) ga = (ga*3 + .5)/4; // lerp towards 0.5
	ctx.globalAlpha = ga;
	ctx.fillStyle = '#808080';
	ctx.fillRect(w/2-256,h-192,512,128);
	ctx.fillStyle = '#000000';
	ctx.fillRect(w/2-256+(col&15)*32,h-192+Math.floor(col>>4)*32,32,32);
	for(var y = 0; y < 4; y++) for(var x = 0; x < 16; x++){
		ctx.fillStyle = colors[x+y*16];
		ctx.fillRect(w/2-256+x*32+2,h-192+y*32+2,32-4,32-4);
	}
	ga = (ga*3 + 1)/4;
	ctx.globalAlpha = 1;
}



function fixColor(x){
	return Math.floor(Math.sqrt(x*255));
}
function put(){
	if(gx >= sz || gy >= sz || gx < 0 || gy < 0) return;
	queue[gx+gy*sz] = col;
}
function flood(){
	if(gx >= sz || gy >= sz || gx < 0 || gy < 0) return;
	socket.emit('flood', {loc: gx+gy*sz, col:col});
}
function chooseCol(){
	var px = Math.floor((mx-(w/2-256))/32);
	var py = Math.floor((my-(h-192))/32);
	col = px + py * 16;
}



document.addEventListener('keyup', function (evt) {
	if (event.key === 'z') socket.emit('undo', {});
	if (event.key === 'Enter') {
		if (document.activeElement === document.getElementById("chatbox")) {
			socket.emit('chat', {msg: document.getElementById("chatbox").value});
			document.activeElement.blur();
			document.getElementById("chatbox").value = "";
		}
		document.getElementById("chatbox").focus();
	}
}, false);
document.addEventListener('mousemove', function (evt) {
	getMousePos(canvas, evt, false);
	if(button == 1) put();
}, false);
document.addEventListener('mouseup', function (evt) {
	button = 0;
	getMousePos(canvas, evt, true);
}, false);
document.addEventListener('mousedown', function (evt) {
	button = event.which;
	getMousePos(canvas, evt, false);
	if(mx<w/2-256||mx>=w/2+256||my<h-192||my>=h-64){
		if(button == 1)put(); else if(button == 3) flood(); else if(button == 2) chooseCol();
	}
	else chooseCol();
}, false);
document.addEventListener('mousewheel', onwheel, false);
document.addEventListener('DOMMouseScroll', onwheel, false);

function onwheel(evt){
	var d = Math.sign(evt.wheelDelta);
	if(Number.isNaN(d)) d = -Math.sign(evt.detail);
	getMousePos(canvas, evt);
	tcx += (mx - w/2) / tzoom;
	tcy += (my - h/2) / tzoom;
	tzoom*=Math.pow(1.125,d);
	tcx -= (mx - w/2) / tzoom;
	tcy -= (my - h/2) / tzoom;
	correctBounds();
	render();
}

function getMousePos(canvas, evt, resetButton) {
	var rect = canvas.getBoundingClientRect();
	mx = evt.clientX - rect.left;
	my = evt.clientY - rect.top;
	gx = Math.floor((mx - w/2) / zoom + cx);
	gy = Math.floor((my - h/2) / zoom + cy);
}
