require("should");
var path = require("path");
var runLoaders = require("../").runLoaders;
//var getContext = require("../").getContext;
var fixtures = path.resolve(__dirname, "fixtures");

runLoaders({
	resource: path.resolve(fixtures, "resource.bin") + "?query",
	loaders: [
		path.resolve(fixtures, "keys-loader.js") + "?loader-query",
		path.resolve(fixtures, "simple-loader.js")
	]
}, function(err, result) {
	if(err) return console.log(err);
	try {
		JSON.parse(result.result[0]).should.be.eql({
			context: fixtures,
			resource: path.resolve(fixtures, "resource.bin") + "?query",
			resourcePath: path.resolve(fixtures, "resource.bin"),
			resourceQuery: "?query",
			loaderIndex: 0,
			query: "?loader-query",
			currentRequest: path.resolve(fixtures, "keys-loader.js") + "?loader-query!" +
				path.resolve(fixtures, "simple-loader.js") + "!" +
				path.resolve(fixtures, "resource.bin") + "?query",
			remainingRequest: path.resolve(fixtures, "simple-loader.js") + "!" +
				path.resolve(fixtures, "resource.bin") + "?query",
			previousRequest: "",
			request: path.resolve(fixtures, "keys-loader.js") + "?loader-query!" +
				path.resolve(fixtures, "simple-loader.js") + "!" +
				path.resolve(fixtures, "resource.bin") + "?query",
			data: null,
			loaders: [{
				request: path.resolve(fixtures, "keys-loader.js") + "?loader-query",
				path: path.resolve(fixtures, "keys-loader.js"),
				query: "?loader-query",
				data: null,
				pitchExecuted: true,
				normalExecuted: true
			}, {
				request: path.resolve(fixtures, "simple-loader.js"),
				path: path.resolve(fixtures, "simple-loader.js"),
				query: "",
				data: null,
				pitchExecuted: true,
				normalExecuted: true
			}]
		});
	} catch(e) {
		return console.log(e);
	}
});
