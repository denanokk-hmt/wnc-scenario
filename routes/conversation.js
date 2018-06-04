'use strict';

var express = require('express');
var router = express.Router();
var pt = require('promise-timeout');
var logger = require('../modules/log.js');
var dateformat = require('dateformat');

//System variables
var env = require('../config/watson.json');
var conf = require('../config/config.json');
var default_msg = require('../config/default.message.json');
var valid = require('../modules/validation.js');

//Instance watson conversation
var ConversationV1 = require('watson-developer-cloud/conversation/v1');
var conversation = new ConversationV1({
  username : env.CONVERSATION_USERNAME,
  password : env.CONVERSATION_PASSWORD,
  version_date : '2018-05-23'
});

//Roting from /conversation?serach={user input word}
router.get('/', function(req, res, next) {
  //Request to Watson Conversation API & Respons  
  watosnConversationAPI(req, res);
});

//Watson Conversation Q & A
function watosnConversationAPI(req, res) {

  //Logging Data
  var logID = '[' + Math.floor(Math.random()*Math.floor(100000)) + ']';
  var logDate = logID + dateformat(new Date(), 'yyyymmdd-HH:MM:ss:l');
  var localFlag = (req.headers.host.split(":")[0] == 'localhost' || '127.0.0.1')? true : false; 
  var req_url = decodeURIComponent(req.baseUrl);
  var quest = req.query.text.replace(/\r?\n/g,"");

  //Logging
  //logger.system('url:' + req_url, localFlag, true, logDate);
  //logger.system('quest:' + quest, localFlag, true, logDate);

  //Get Answer from Watson conversation
  var watsonAnswer = function(question) {

      //call watson conversation with Promise
      return new Promise(function(resolve, reject) {
        conversation.message({ 
          workspace_id : env.WORKSPACE_ID,
          input: { text: question} }, function(err, response) {

          //Return error
          if (err) {
            reject(err);
            return;
          }

          //Intents & Entities, Confidense setting
          if (!Object.keys(response.intents).length && !Object.keys(response.entities).length) {
            //intents & entities are both nothing.
            var intents = 'not understatnd';
            var entities = 'not understatnd';
            var confidence = [ 0, 0 ];
          } else if (Object.keys(response.intents).length && !Object.keys(response.entities).length) {
            //intents is, but entities is nothing.
            var intents = response.intents[0].intent;
            var entities = 'nothing';
            var confidence = [ response.intents[0].confidence, 0 ];
          } else if (!Object.keys(response.intents).length && Object.keys(response.entities).length) {
            //intents is nothing, but entities is.
            var intents = 'nothing';
            var entities = response.entities[0].entity;
            var confidence = [ 0, response.entities[0].confidence ];
          } else {
            var intents = response.intents[0].intent;
            var entities = response.entities[0].entity;
            var confidence = [ response.intents[0].confidence, response.entities[0].confidence];
          }

          //Return success message with OK-SKY responce format
          resolve(
            {
              conversation_id : response.context.conversation_id,
              intents : intents,
              entities : entities,
              confidence : confidence,
              text : response.output.text[0],
              nodes_visited : response.output.nodes_visited[0]
            }
          );
      });
    });
  };

  //Answer Formatting to JSON
  var answerFormat2Json = function(result) {

    //Error result setting
    if (result.conversation_id == 'not enough question length') {
      //Not enough Question length
      result.text = default_msg.min_length_error;
    } else if (result instanceof pt.TimeoutError) {
      //Timeout Error
      result.text = default_msg.timeout_error;
      result.intents = 'Timeout of 10sec';
      result.entities = 'Timeout of 10sec';
      result.confidence = [ 0, 0 ];
    } else if (result.error) {
      //Watson Converation API Error
      result.text = default_msg.watson_converation_api_error;
      result.intents = 'Watson Assistant error';
      result.entities = 'Watson Assistant error';
      result.confidence = [ 0, 0 ];
    } else if (result.confidence < conf.confidence_exclusion) {
      //Confidence Error
      result.text = default_msg.confidence_error;
      result.intents = 'Not enough Confidene(<' + conf.confidence_exclusion + ')'; 
      result.entities = 'Not enough Confidene(<' + conf.confidence_exclusion + ')'; 
    }

    //Case Silence Answer
    var result_text = (result.text)? result.text.replace(/\r?\n/g,"") : "";

    //Logging 
    //logger.systemJSON(result, localFlag, true, logDate);    
    var logOutStr = 'quest:' + quest + 
                    '|' + 'answer:' + result_text + 
                    '|' + 'intents:' + result.intents + 
                    '|' + 'entities:' + result.entities;
    logger.system(logOutStr, localFlag, true, logDate);

    //Retrun formatting JSON answers
    return {
      searcher_id: result.conversation_id,
      url: req_url,
      text: quest,
      answer_list: [
        {
          answer: result_text,
          intents: result.intents,
          entities: result.entities,
          cos_similarity: 0.8,
          confidence: result.confidence,
          answer_altered: true,
          question: null
        }
      ]
    };
  };

  //Response sendding
  var resResult = function(result) {
    res.header('Content-Type', 'application/json; charset=utf-8')
    res.send(answerFormat2Json(result));
  };

  //Needs minimus quest length & care of exclusion strings.
  if (valid.func(quest)) {
    process.on('unhandledRejection', console.dir);

    //Call Watson Answer & response send(Timeout 10second)
    pt.timeout(watsonAnswer(quest), conf.watson_timeout)
    .then(function(answer) {
      resResult(answer);
    }).catch(function(error) {
      console.log(error);
      //console.error(error); //erorr log to STDERR 
      logger.error(error, localFlag, true, logDate);
      //set default error result
      var result = [];
      result.error = error;
      resResult(result);
    });

  } else {
    resResult(conf.under_min_length);
  }

}

module.exports = router;
