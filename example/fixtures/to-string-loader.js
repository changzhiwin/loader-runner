var loaderUtils = require("loader-utils");

module.exports = function() {};

module.exports.pitch = function(remainingRequest) {
  if(this.cacheable) {
    this.cacheable();
  }

  return `
        var result = require(${loaderUtils.stringifyRequest(this, "!!" + remainingRequest)});
        if (typeof result === "string") {
            module.exports = result;
        } else {
            module.exports = result.toString();
        }
    `;
};
