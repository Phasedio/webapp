/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /things              ->  index
 * POST    /things              ->  create
 * GET     /things/:id          ->  show
 * PUT     /things/:id          ->  update
 * DELETE  /things/:id          ->  destroy
 */

'use strict';



var _ = require('lodash');
var getURLs = require("get-urls");
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');

// Get list of things
exports.index = function(req, res) {
  console.log(req.body);
  var str = req.body.text;
  var link = getURLs(str);
  if (link.length > 0){
    console.log(link);
    var url = link[0];
    request(url, function(error, response, html){
          if(!error){
              var $ = cheerio.load(html);

              var title, release, rating;
              var json = { title : "", discript : "",url:url};

              // We'll use the unique header class as a starting point.
              json.title = $('title').text();
              json.discript = $('meta[property="og:description"]').attr('content');
            //   $('.header').filter(function(){
             //
            //  // Let's store the data we filter into a variable so we can easily see what's going on.
             //
            //       var data = $(this);
             //
            //  // In examining the DOM we notice that the title rests within the first child element of the header tag.
            //  // Utilizing jQuery we can easily navigate and get the text by writing the following code:
             //
            //       title = data.children().first().text();
             //
            //  // Once we have our title, we'll store it to the our json object.
             //
            //       json.title = title;
            //   })

              console.log(json);
              res.send(json);
          }else{
            console.log(error);
            res.send({});
          }
      });
  }else{
    res.send({});
    console.log('no url');
  }



};
