require("should");
var path = require("path");
var runLoaders = require("../").runLoaders;
//var getContext = require("../").getContext;

var fixtures = path.resolve(__dirname, "fixtures");

runLoaders({
	resource: path.resolve(fixtures, "style.css"),
	loaders: [
    path.resolve(fixtures, "to-string-loader.js"),
		path.resolve(__dirname, "../node_modules/css-loader/dist/cjs.js")
	]
}, function(err, result) {
	if(err) {
		console.log("error take place");
		return console.log(err);
	}
	console.log(`${result.result}`);
});
