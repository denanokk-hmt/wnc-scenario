
var express = require('express');
var router = express.Router();

//SAMPLE1
router.get('/', function(req, res, next) {
  var param = {"値":"これはサンプルだぞ"};
  res.header('Content-Type', 'application/json; charset=utf-8');
  res.send(param);
});

//SAMPLE2
router.get('/hello', function(req, res, next) {
  var param = {"result":"Hello world"};
  res.header('Content-Type', 'application/json; charset=utf-8')
  res.send(param);
});

//SAMPLE3
router.get('/hello/:place', function(req, res, next) {
  var param = {"result":"Hello " + req.params.place + " !","shop name":req.query.shop};
  res.header('Content-Type', 'application/json; charset=utf-8')
  res.send(param);
});

//SAMPLE4
router.post('/', function(req, res, next) {
  var param = {"値":"POSTメソッドのリクエストを受け付けました","cardの値":req.body.card,"requidの値":req.body.requid};
  res.header('Content-Type', 'application/json; charset=utf-8');
  res.send(param);
});

module.exports = router;

