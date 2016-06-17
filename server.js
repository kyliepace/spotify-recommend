//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var path = require('path');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');
var unirest = require('unirest');
var events = require('events');

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

router.use(express.static(path.resolve(__dirname, 'client')));
var messages = [];
var sockets = [];

io.on('connection', function (socket) {
    messages.forEach(function (data) {
      socket.emit('message', data);
    });

    sockets.push(socket);

    socket.on('disconnect', function () {
      sockets.splice(sockets.indexOf(socket), 1);
      updateRoster();
    });

    socket.on('message', function (msg) {
      var text = String(msg || '');

      if (!text)
        return;

      socket.get('name', function (err, name) {
        var data = {
          name: name,
          text: text
        };

        broadcast('message', data);
        messages.push(data);
      });
    });

    socket.on('identify', function (name) {
      socket.set('name', String(name || 'Anonymous'), function (err) {
        updateRoster();
      });
    });
  });

function updateRoster() {
  async.map(
    sockets,
    function (socket, callback) {
      socket.get('name', callback);
    },
    function (err, names) {
      broadcast('roster', names);
    }
  );
}

function broadcast(event, data) {
  sockets.forEach(function (socket) {
    socket.emit(event, data);
  });
}

var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/' + endpoint)
           .qs(args)
           .end(function(response) {
                if (response.ok) {
                    emitter.emit('end', response.body);
                }
                else {
                    emitter.emit('error', response.code);
                }
            });
    return emitter;
};


var app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    searchReq.on('end', function(item) {
        var artist = item.artists.items[0];
        //res.json(artist);
        //now get related artists by making request to a new endpoint
        //I'm not adding a new listener because I want to have access to the artist variable
        var relatedArtists = getFromApi(artist.href+"/related-artists");
        
        relatedArtists.on("end", function(items){
          artist.related = items.aritsts;
          console.log(artist.related);
          res.json(artist);
          //now send out parallel requests to find top tracks from each related artist
          onRelArtComplete(artist);
          
          
          
          
        });
        
        relatedArtists.on("error", function(){
          console.log("error getting related artists");
          res.status(404).send("error");
        });
    });

    searchReq.on('error', function(code) {
        res.sendStatus(code);
    });
    
    var onRelArtComplete = function(persons){
    var counter = 0;
  
    var checkComplete = function(){
      if(counter === persons.related.length){
        res.json(persons); //when all related artists are done, send the complete artist object back to client
      }
    };
  
    persons[related].forEach(function(person){
      var tracks = getFromApi(endpoint, args);  //need to read documentation to send correct endpoint and arguments 
    
      tracks.on("end", function(item){
        person.tracks = item.tracks; //when each related artist is done, set artist.related[i].tracks=item.tracks
        counter++;
        checkComplete(); //check to see if we've exhausted the number of related artists
      });
    
      tracks.on("error", function(code){
        res.sendStatus(code); //deal with errors
      });
    });
  }; 
});




app.listen(8080);

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});
