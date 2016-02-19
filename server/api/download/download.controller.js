'use strict';

var _ = require('lodash');
var fs = require('fs');
var json2csv = require('json2csv');


// Get list of downloads
exports.index = function(req, res) {
  res.json([]);
};

// WE NEED TO FIND A WAY TO DO TIME ZONES!
exports.send = function(req, res) {
  console.log('got it');
  var dataJson = req.body.hose;
  var users = Object.keys(dataJson.data);
  // get users
  //console.log(dataJson);
  res.send(dataJson);
  //console.log(dataJson);
  var dataCsv = [];
  var theCSV = '';
  var fields = ['task','category', 'time', 'date'];
  //Go through all users given to you
  for (var y = 0; y < users.length; y++) {
    //console.log();
    // Figure out the names of all the keys
    dataCsv = [];
    if(dataJson.data[users[y]]){
      var keys = Object.keys(dataJson.data[users[y]]);
      console.log('hit that');
      for(var i = 0; i < keys.length; i++){
      	//console.log('new task');
      	var task = dataJson.data[users[y]][keys[i]];
      	var obj = {}
        if (task.cat != "" && dataJson.cat[task.cat].name) {
          obj.category = dataJson.cat[task.cat].name;
        }
      	obj.time = new Date(task.time).toLocaleTimeString();
      	obj.date = new Date(task.time).toLocaleDateString();
      	obj.task = task.name;
      	dataCsv.push(obj);
      	//console.log(dataCsv);

      }
      json2csv({ data: dataCsv, fields: fields }, function(err, csv) {
         if (err) console.log(err);

         theCSV = theCSV +"\n"+ dataJson.dict[users[y]].name + ", , ,\n"+csv;
        //  fs.writeFile('file.csv', csv, function(err) {
        //     if (err) throw err;
        //  //    console.log('file saved');
        //  //    res.set('Content-Type', 'application/octet-stream');
        //  // res.set('Content-Disposition', 'attachment;filename=\"file.csv\"');
        //  // res.download('file.csv');
        //  res.send('file.csv');
      	//});

    		  //console.log(csv);
    	});
      //console.log(dataCsv);
    }


  }
   fs.writeFile('file.csv', theCSV, function(err) {
      if (err) throw err;
   //    console.log('file saved');
   //    res.set('Content-Type', 'application/octet-stream');
   // res.set('Content-Disposition', 'attachment;filename=\"file.csv\"');
   // res.download('file.csv');
   //res.send('file.csv');
  });
  console.log(theCSV);
  //res.send(theCSV);



};
exports.dwl = function(req, res) {
    console.log('happed');
	//var file = req.param('file');
  var filestream = fs.createReadStream('file.csv');

    res.set('Content-Type', 'application/octet-stream');
	res.set('Content-Disposition', 'attachment;filename=\"file.csv\"');
  filestream.pipe(res);
	//res.download('file.csv');

};
