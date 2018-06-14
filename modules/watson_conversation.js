'use strict'

var pt = require('promise-timeout');
var logger = require('./log.js');
var dateformat = require('dateformat');

//System variables
var watson = require('../config/watson.json');
var conf = require('../config/config.json');
var default_msg = require('../config/default.message.json');
var valid = require('./validation.js');

//Redis Server
var kvs = require('./redis.js');

//Instance watson conversation
var ConversationV1 = require('watson-developer-cloud/conversation/v1');
var conversation = new ConversationV1({
  username : watson.CONVERSATION_USERNAME,
  password : watson.CONVERSATION_PASSWORD,
  version_date : '2018-05-23'
});

 //Get response context
function getResContext(room_id) {
    //Get context before quest's from redis hash.
    return new Promise((resolve, reject) => {
      kvs.redis_client.hget(room_id, 'res_context', function(err, val) {
        if (err) reject(err);
        resolve(val);
      });
    });
  }
  
//Watson Conversation Q & A
function watosnConversationAPI(req) {

  //Logging Data
  var logID = '[' + Math.floor(Math.random()*Math.floor(100000)) + ']';
  var logDate = logID + dateformat(new Date(), 'yyyymmdd-HH:MM:ss:l');
  var localFlag = (req.headers.host.split(":")[0] == 'localhost' || '127.0.0.1')? true : false; 
  var req_url = decodeURIComponent(req.baseUrl);
  
  //Get post data
  var room_id = 'room:' + req.body.room_id;
  var quest = req.body.quest.replace(/\r?\n/g,"");

  //Get Answer from Watson conversation
  var watsonAnswer = function(question, res_context) {

    //Convert to Object
    if (!res_context[0]) {
      //case exist room_id = res_context is null
      res_context = {"conversation":""};
    } else {
      res_context = JSON.parse(res_context || "null");
    }
    
    //call watson conversation with Promise
    return new Promise(function(resolve, reject) {
      conversation.message(
        { 
          workspace_id : watson.WORKSPACE_ID,
          input: { text: question},
          context: res_context 
        },
        //getting response 
        function(err, response) {
          //Return error
          if (err) {
            reject(err);
            return;
          }
          //Set this quest's context into redis hash
          res_context = JSON.stringify(response.context);
          kvs.redis_client.hset(room_id, "res_context", res_context);

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

          //Answer text
          var response_text = '';
          for (var i = 0, len = response.output.text.length; i < len; i++) {
            response_text += '\\n' + response.output.text[i];
          }
          response_text = response_text.substr(2);

          //Return success message with OK-SKY responce format
          resolve(
            {
              conversation_id : response.context.conversation_id,
              intents : intents,
              entities : entities,
              confidence : confidence,
              text : response_text,
              nodes_visited : response.output.nodes_visited[0]
            }
          );
        }
      );
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
      result.text = default_msg.converation_api_error;
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
          confidence: result.confidence[0],
          answer_altered: true,
          question: null
        }
      ]
    };
  };

  //Response sendding
  var resResult = function(result) {

    //
    // 出力方法未実装
    //

    //Response from GET Request
    //res.header('Content-Type', 'application/json; charset=utf-8');
    //res.send(answerFormat2Json(result));

    console.log(result.confidence);
    console.log(answerFormat2Json(result));
    
    //curl???
  };

  //Needs minimus quest length & care of exclusion strings.
  if (valid.func(quest)) {
    process.on('unhandledRejection', console.dir);
    
    //Get befor one response context of watson answer from redis hash 
    var resContext = function(room_id) {
      return getResContext(room_id);
    }

    //Call function(resContext ==> watsonAnswer ==> resResult)
    Promise.all([resContext(room_id)]).then((context) => {    
      
      //Call Watson Answer & response send(Timeout 10second)
      pt.timeout(watsonAnswer(quest, context), conf.timeout)
      .then(function(answer) {
        resResult(answer);
      }).catch(function(error) {
        //console.error(error); //erorr log to STDERR 
        logger.error(error, localFlag, true, logDate);
        //set default error result
        var result = [];
        result.error = error;
        resResult(result);
      });      
    }).catch(function(error){
      console.error(error);
    });
  } else {
    resResult(conf.under_min_length);
  }

}

module.exports.conversationAPI = watosnConversationAPI;