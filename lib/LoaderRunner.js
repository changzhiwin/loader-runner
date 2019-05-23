/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var fs = require("fs");
var readFile = fs.readFile.bind(fs);
var loadLoader = require("./loadLoader");

function utf8BufferToString(buf) {
	var str = buf.toString("utf-8");
	if(str.charCodeAt(0) === 0xFEFF) {
		return str.substr(1);
	} else {
		return str;
	}
}

function splitQuery(req) {
	var i = req.indexOf("?");
	if(i < 0) return [req, ""];
	return [req.substr(0, i), req.substr(i)];
}

function dirname(path) {
	if(path === "/") return "/";
	var i = path.lastIndexOf("/");
	var j = path.lastIndexOf("\\");
	var i2 = path.indexOf("/");
	var j2 = path.indexOf("\\");
	var idx = i > j ? i : j;
	var idx2 = i > j ? i2 : j2;
	if(idx < 0) return path;
	if(idx === idx2) return path.substr(0, idx + 1);
	return path.substr(0, idx);
}

//@param {*} loader string; 由字符串转换成对象
function createLoaderObject(loader) {
	var obj = {
		path: null,
		query: null,
		options: null,
		ident: null,
		normal: null,
		pitch: null,
		raw: null,
		data: null,
		pitchExecuted: false,
		normalExecuted: false
	};
	Object.defineProperty(obj, "request", {
		enumerable: true,
		get: function() {
			return obj.path + obj.query;
		},
		set: function(value) {
			if(typeof value === "string") {
				var splittedRequest = splitQuery(value);
				obj.path = splittedRequest[0];
				obj.query = splittedRequest[1];
				obj.options = undefined;
				obj.ident = undefined;
			} else {
				if(!value.loader)
					throw new Error("request should be a string or object with loader and object (" + JSON.stringify(value) + ")");
				obj.path = value.loader;
				obj.options = value.options;
				obj.ident = value.ident;
				if(obj.options === null)
					obj.query = "";
				else if(obj.options === undefined)
					obj.query = "";
				else if(typeof obj.options === "string")
					obj.query = "?" + obj.options;
				else if(obj.ident)
					obj.query = "??" + obj.ident;
				else if(typeof obj.options === "object" && obj.options.ident)
					obj.query = "??" + obj.options.ident;
				else
					obj.query = "?" + JSON.stringify(obj.options);
			}
		}
	});
	obj.request = loader;
	if(Object.preventExtensions) {
		Object.preventExtensions(obj);
	}
	return obj;
}

function runSyncOrAsync(fn, context, args, callback) {
	var isSync = true;
	var isDone = false;
	var isError = false; // internal error
	var reportedError = false;
	context.async = function async() {
		if(isDone) {
			if(reportedError) return; // ignore
			throw new Error("async(): The callback was already called.");
		}
		isSync = false;
		return innerCallback;
	};
	var innerCallback = context.callback = function() {
		if(isDone) {
			if(reportedError) return; // ignore
			throw new Error("callback(): The callback was already called.");
		}
		isDone = true;
		isSync = false;
		try {
			callback.apply(null, arguments);
		} catch(e) {
			isError = true;
			throw e;
		}
	};
	try {
		// 为啥要写这个？直接调用不就可以吗？
		var result = (function LOADER_EXECUTION() {
			return fn.apply(context, args);
		}());
		if(isSync) {
			isDone = true;
			if(result === undefined)
				return callback();
			if(result && typeof result === "object" && typeof result.then === "function") {
				return result.then(function(r) {
					callback(null, r);
				}, callback);
			}
			return callback(null, result);
		}
	} catch(e) {
		if(isError) throw e;
		if(isDone) {
			// loader is already "done", so we cannot use the callback function
			// for better debugging we print the error on the console
			if(typeof e === "object" && e.stack) console.error(e.stack);
			else console.error(e);
			return;
		}
		isDone = true;
		reportedError = true;
		callback(e);
	}

}

function convertArgs(args, raw) {
	//args是数组，都是为了传给函数调用的apply方法的
	if(!raw && Buffer.isBuffer(args[0]))
		args[0] = utf8BufferToString(args[0]);
	else if(raw && typeof args[0] === "string")
		args[0] = Buffer.from(args[0], "utf-8");
}

function iteratePitchingLoaders(options, loaderContext, callback) {
	console.log(`debug::LoaderRunner1 iteratePitchingLoaders, loaderIndex = ${loaderContext.loaderIndex}`);
	// abort after last loader, loaderIndex 初始化是 0
	if(loaderContext.loaderIndex >= loaderContext.loaders.length)
		return processResource(options, loaderContext, callback);

	//取当前，需要处理的
	var currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];

	//iterate，pitchExecuted默认false
	if(currentLoaderObject.pitchExecuted) {
		loaderContext.loaderIndex++;
		return iteratePitchingLoaders(options, loaderContext, callback);
	}

	//load loader module
	//先把loader执行代码加载进来，会去default和pitch
	loadLoader(currentLoaderObject, function(err) {
		if(err) {
			loaderContext.cacheable(false);
			return callback(err);
		}
		//先取pitch，为何？
		var fn = currentLoaderObject.pitch;
		// 置为true，为何？
		currentLoaderObject.pitchExecuted = true;
		// 如果fn为空，递归调用
		if(!fn) return iteratePitchingLoaders(options, loaderContext, callback);

		//执行pitch和正常loader时，传的参数不一样！
		runSyncOrAsync(
			fn,
			loaderContext, [loaderContext.remainingRequest, loaderContext.previousRequest, currentLoaderObject.data = {}],
			function(err) {
				if(err) return callback(err);
				var args = Array.prototype.slice.call(arguments, 1);
				// Determine whether to continue the pitching process based on
				// argument values (as opposed to argument presence) in order
				// to support synchronous and asynchronous usages.
				var hasArg = args.some(function(value) {
					return value !== undefined;
				});
				console.log(`debug::LoaderRunner1.1 hasArg ${hasArg}`);
				// 这里一旦有值，后面的loader就不执行了哦2019-05-22 22:37:23
				if(hasArg) {
					loaderContext.loaderIndex--;
					iterateNormalLoaders(options, loaderContext, args, callback);
				} else {
					iteratePitchingLoaders(options, loaderContext, callback);
				}
			}
		);
	});
}

//接下就是读取待处理的原始文件，然后从后到前一个一个loader依次处理
function processResource(options, loaderContext, callback) {
	console.log(`debug::LoaderRunner3 processResource, loaderIndex = ${loaderContext.loaderIndex}`);
	// set loader index to last loader
	// loader的执行顺序，和写的顺相反
	loaderContext.loaderIndex = loaderContext.loaders.length - 1;

	// 这个是入口文件名
	var resourcePath = loaderContext.resourcePath;
	if(resourcePath) {
		loaderContext.addDependency(resourcePath);
		// 这里读取了原始文件，不是某个loader的入口文件！！
		options.readResource(resourcePath, function(err, buffer) {
			if(err) return callback(err);
			console.log("debug:LoaderRunner3.1 readResource(...)");
			options.resourceBuffer = buffer;
			iterateNormalLoaders(options, loaderContext, [buffer], callback);
		});
	} else {
		iterateNormalLoaders(options, loaderContext, [null], callback);
	}
}

function iterateNormalLoaders(options, loaderContext, args, callback) {
	console.log(`debug::LoaderRunner2 iterateNormalLoaders, loaderIndex = ${loaderContext.loaderIndex}`);
	if(loaderContext.loaderIndex < 0)
		return callback(null, args);

	//从当期执行到的loader往前执行
	var currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];

	// iterate
	if(currentLoaderObject.normalExecuted) {
		//这个函数的设计，会导致每个loaderIndex会执行两次：第一次执行fn，第二次就这这里递减index
		loaderContext.loaderIndex--;
		return iterateNormalLoaders(options, loaderContext, args, callback);
	}

	var fn = currentLoaderObject.normal;
	currentLoaderObject.normalExecuted = true;
	//fn为空就不需要执行，直接走剩下的loader
	if(!fn) {
		return iterateNormalLoaders(options, loaderContext, args, callback);
	}

	//raw有什么特殊用途了？这里主要是看是否需要处理类似二进制的文件
	convertArgs(args, currentLoaderObject.raw);

	runSyncOrAsync(fn, loaderContext, args, function(err) {
		if(err) return callback(err);

		//args为啥要处理了？这就是去掉第一个参数err吗
		var args = Array.prototype.slice.call(arguments, 1);
		iterateNormalLoaders(options, loaderContext, args, callback);
	});
}

exports.getContext = function getContext(resource) {
	var splitted = splitQuery(resource);
	return dirname(splitted[0]);
};

exports.runLoaders = function runLoaders(options, callback) {
	// read options
	var resource = options.resource || "";
	var loaders = options.loaders || [];
	var loaderContext = options.context || {};
	var readResource = options.readResource || readFile;

	//
	var splittedResource = resource && splitQuery(resource);
	var resourcePath = splittedResource ? splittedResource[0] : undefined;
	var resourceQuery = splittedResource ? splittedResource[1] : undefined;
	var contextDirectory = resourcePath ? dirname(resourcePath) : null;

	// execution state
	var requestCacheable = true;
	var fileDependencies = [];
	var contextDependencies = [];

	// prepare loader objects
	// 原始是一个loader绝对路径的字符串数组，转换成对象了
	loaders = loaders.map(createLoaderObject);

	loaderContext.context = contextDirectory;
	loaderContext.loaderIndex = 0;
	loaderContext.loaders = loaders;
	loaderContext.resourcePath = resourcePath; //解析源文件名
	loaderContext.resourceQuery = resourceQuery;//解析源文件带的参数
	loaderContext.async = null;
	loaderContext.callback = null;
	loaderContext.cacheable = function cacheable(flag) {
		if(flag === false) {
			requestCacheable = false;
		}
	};
	loaderContext.dependency = loaderContext.addDependency = function addDependency(file) {
		fileDependencies.push(file);
	};
	loaderContext.addContextDependency = function addContextDependency(context) {
		contextDependencies.push(context);
	};
	loaderContext.getDependencies = function getDependencies() {
		return fileDependencies.slice();
	};
	loaderContext.getContextDependencies = function getContextDependencies() {
		return contextDependencies.slice();
	};
	loaderContext.clearDependencies = function clearDependencies() {
		fileDependencies.length = 0;
		contextDependencies.length = 0;
		requestCacheable = true;
	};
	Object.defineProperty(loaderContext, "resource", {
		enumerable: true,
		get: function() {
			if(loaderContext.resourcePath === undefined)
				return undefined;
			return loaderContext.resourcePath + loaderContext.resourceQuery;
		},
		set: function(value) {
			var splittedResource = value && splitQuery(value);
			loaderContext.resourcePath = splittedResource ? splittedResource[0] : undefined;
			loaderContext.resourceQuery = splittedResource ? splittedResource[1] : undefined;
		}
	});
	Object.defineProperty(loaderContext, "request", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders.map(function(o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
	});
	Object.defineProperty(loaderContext, "remainingRequest", {
		enumerable: true,
		get: function() {
			if(loaderContext.loaderIndex >= loaderContext.loaders.length - 1 && !loaderContext.resource)
				return "";
			return loaderContext.loaders.slice(loaderContext.loaderIndex + 1).map(function(o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
	});
	Object.defineProperty(loaderContext, "currentRequest", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders.slice(loaderContext.loaderIndex).map(function(o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
	});
	Object.defineProperty(loaderContext, "previousRequest", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders.slice(0, loaderContext.loaderIndex).map(function(o) {
				return o.request;
			}).join("!");
		}
	});
	Object.defineProperty(loaderContext, "query", {
		enumerable: true,
		get: function() {
			var entry = loaderContext.loaders[loaderContext.loaderIndex];
			return entry.options && typeof entry.options === "object" ? entry.options : entry.query;
		}
	});
	Object.defineProperty(loaderContext, "data", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders[loaderContext.loaderIndex].data;
		}
	});

	// finish loader context
	if(Object.preventExtensions) {
		Object.preventExtensions(loaderContext);
	}

	var processOptions = {
		resourceBuffer: null,
		readResource: readResource
	};
	iteratePitchingLoaders(processOptions, loaderContext, function(err, result) {
		if(err) {
			return callback(err, {
				cacheable: requestCacheable,
				fileDependencies: fileDependencies,
				contextDependencies: contextDependencies
			});
		}
		callback(null, {
			result: result,
			resourceBuffer: processOptions.resourceBuffer,
			cacheable: requestCacheable,
			fileDependencies: fileDependencies,
			contextDependencies: contextDependencies
		});
	});
};
