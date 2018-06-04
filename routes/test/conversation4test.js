'use strict';

var express = require('express');
var router = express.Router();
var pt = require('promise-timeout');

//System variables
var env = require('../../config/watson.json');
var conf = require('../../config/config.json');
var default_msg = require('../../config/default.message.json');
var valid = require('../../modules/validation.js');


//Instance watson conversation
var ConversationV1 = require('watson-developer-cloud/conversation/v1');
var conversation = new ConversationV1({
  username : env.CONVERSATION_USERNAME,
  password : env.CONVERSATION_PASSWORD,
  path : { workspace_id : env.WORKSPACE_ID },
  version_date : '2018-04-01'
});

//Roting from /conversation?serach={user input word}
router.get('/', function(req, res, next) {

  //Request to Watson Conversation API & Respons  
  watosnConversationAPI(req, res); 
});

//Watson Conversation Q & A
function watosnConversationAPI(req, res) {

  //User Question
  var req_url = decodeURIComponent(req.url);
  var search = req.query.text.replace(/\r?\n/g,"");
  //console.log(req);
  console.log(search);

  /*
  //Sentence func testing
  var sentence = require('../modules/sentence.js');
  sentence.func(search);
  */

  //Get Answer from Watson conversation
  var watsonAnswer = function(question) {

      //call watson conversation with Promise
      return new Promise(function(resolve, reject) {
        conversation.message({ input: { text: question} }, function(err, response) {

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

          //Return messages wiht success
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
      result.intents = 'Watson conversation error';
      result.entities = 'Watson conversation error';
      result.confidence = [ 0, 0 ];
    } else if (result.confidence < conf.confidence_exclusion) {
      //Confidence Error
      result.text = default_msg.confidence_error;
      result.intents = 'Not enough Confidene(<' + conf.confidence_exclusion + ')'; 
      result.entities = 'Not enough Confidene(<' + conf.confidence_exclusion + ')'; 
    }

    //result log to STDOUT
    console.log(result); 

    //
    if (result.text) {
      var answer = result.text.replace(/\r?\n/g,"");
      answer = answer.replace(/,/g,"");
    } else {
      var answer = '';
    }
    //Retrun results
    //質問文、Intents、Intent Confidence、Entities、Entity Confidence、回答文
    return search + ',' + result.intents + ',' + result.confidence[0]  + ',' + result.entities + ',' + result.confidence[1] + ',' + answer;
  };

  //Response sendding
  var resResult = function(result) {
    res.header('Content-Type', 'application/json; charset=utf-8')
    res.send(answerFormat2Json(result));
  };

  //Needs minimus search length & care of exclusion strings.
  if (valid.func(search)) {

    //Call Watson Answer & response send(Timeout 10second)
    pt.timeout(watsonAnswer(search), conf.watson_timeout)
    .then(function(answer) {
      resResult(answer);
    }).catch(function(error) {
      console.error(error); //erorr log to STDERR 
      resResult(error);
    });

  } else {
    resResult(conf.under_min_length);
  }

}

module.exports = router;
