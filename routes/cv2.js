'use strict';

//Basic
var express = require('express');
var router = express.Router();

var env = require('../config/env.json');

//Watson converastion
var watson = require('../modules/watson_conversation');

//Routing POST
router.post('/', function(req, res, next) {

  //Response to sender
  res.header('Content-Type', 'application/json; charset=utf-8');
  res.send('ok-sky!!');

  //Connect AI & Get answer
  switch (env.ai) {
    case "watson":
      //Request to Watson Conversation API & Respons  
      watson.watosnConversationAPI(req);
      break;
  }
});

module.exports = router;
