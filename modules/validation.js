
var conf = require('../config/config.json');

var validation = function (question) {

	//var arryValidErr = {　'min_len' : 'true' };
	var exclusion_judge = false; 

	//Matching exclusion words to question.
	for (var key in conf.exclusion_min_length_strings) {
		//console.log(key + " : " + conf.exclusion_min_length_strings[key]);
		if (question == conf.exclusion_min_length_strings[key]) {
			exclusion_judge = true; 
			break;
		} else {
			exclusion_judge = false; 
		}
	}
	//Validation minimum question length
	if (!exclusion_judge && conf.question_min_length > question.length) {
		//arryValidErr['min_len'] = false;
		return false;
	} else {
		//arryValidErr['min_len'] = true;
		return true;
	}

};

module.exports.func = validation;