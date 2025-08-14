// Reuse the same handler
const proxy = require("./proxy.js");
exports.handler = proxy.handler;
