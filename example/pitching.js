require("should");
var path = require("path");
var runLoaders = require("../").runLoaders;
//var getContext = require("../").getContext;

var fixtures = path.resolve(__dirname, "fixtures");

runLoaders({
	resource: path.resolve(fixtures, "resource.bin"),
	loaders: [
		path.resolve(fixtures, "simple-loader.js"),
		path.resolve(fixtures, "pitching-loader.js"),
		path.resolve(fixtures, "simple-async-loader.js"),
	]
}, function(err, result) {
	if(err) return console.log(err);

	console.log(result.result);
	/*
	result.result.should.be.eql([
		path.resolve(fixtures, "simple-async-loader.js") + "!" +
		path.resolve(fixtures, "resource.bin") + ":" +
		path.resolve(fixtures, "simple-loader.js") +
		"-simple"
	]);
	*/


});
