'use strict';

//Basic
var express = require('express');
var router = express.Router();

//Environment
var env = require('../config/env.json');
var ai = env.ai;

//Watson converastion
var ai_module = require('../modules/' + ai);

//Routing POST
router.post('/', function(req, res, next) {

  //Response to sender
  res.header('Content-Type', 'application/json; charset=utf-8');
  res.send('ok-sky!!');

  //Connect AI & QA
  ai_module.conversationAPI(req);
  
});

module.exports = router;
