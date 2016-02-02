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
  var dataKeys = Object.keys(dataJson);
  console.log(dataJson);
  res.send(dataJson);
  //console.log(dataJson);
 //  var dataCsv = [];
 //  var fields = ['task', 'time', 'date'];
 //  for(var i = 0; i < dataKeys.length; i++){
 //  	console.log('new task');
 //  	var task = dataJson[dataKeys[i]];
 //  	var obj = {}
 //  	obj.time = new Date(task.time).toLocaleTimeString();
 //  	obj.date = new Date(task.time).toLocaleDateString();
 //  	obj.task = task.name;
 //  	dataCsv.push(obj);
 //  	console.log(dataCsv);
 //
 //  }
 //  console.log(dataCsv);
 //  json2csv({ data: dataCsv, fields: fields }, function(err, csv) {
 // if (err) console.log(err);
 // fs.writeFile('file.csv', csv, function(err) {
 //    if (err) throw err;
 // //    console.log('file saved');
 // //    res.set('Content-Type', 'application/octet-stream');
 // // res.set('Content-Disposition', 'attachment;filename=\"file.csv\"');
 // // res.download('file.csv');
 // res.send('file.csv');
  	//});

		  // console.log(csv);
	//});



};
exports.dwl = function(req, res) {
	var file = req.param('file');
    res.set('Content-Type', 'application/octet-stream');
	res.set('Content-Disposition', 'attachment;filename=\"file.csv\"');
	res.download(file);

};
