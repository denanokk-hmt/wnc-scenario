
var conf = require('../config/config.json');

var sentence = function (question) {

	console.log("BAGOOOON"); 
	
	question = question.replace(/。$/, "");

	//Ready Arry
	var sentenceArry = question.replace(/、/g, '<|>').split('<|>').filter(function(element, index, array) {
		return (element.length > 3);
	});
	
	console.log(sentenceArry); 

	//for (var i )
	var filtered = [12, 5, 8, 130, 44].filter(function(element, index, array) {
	    return (element >= 10);
	});
	//console.log(filtered);

	var total = ["AA", "BBB", "C", "DDDD"].reduce(function(previousValue, currentValue, index, array) {
	    var r;
	    if (currentValue.length >= 3) {
	    	r = [previousValue + currentValue];
	    }
	    return r;
	});
	console.log(total);

	console.log("DWAGOOOON"); 
};

module.exports.func = sentence;