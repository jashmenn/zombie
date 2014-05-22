// Generated by CoffeeScript 1.6.3
var File, HTML, HTTP, Path, QS, Request, Resources, URL, Zlib, assert, encoding,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

encoding = require("encoding");

File = require("fs");

HTML = require("jsdom").dom.level3.html;

Path = require("path");

QS = require("querystring");

Request = require("request");

URL = require("url");

HTTP = require('http');

Zlib = require("zlib");

assert = require("assert");

Resources = (function(_super) {
  __extends(Resources, _super);

  function Resources(browser) {
    this.browser = browser;
    this.pipeline = Resources.pipeline.slice();
    this.urlMatchers = [];
  }

  Resources.prototype.request = function(method, url, options, callback) {
    var request, resource, _ref,
      _this = this;
    if (!callback) {
      _ref = [{}, options], options = _ref[0], callback = _ref[1];
    }
    request = {
      method: method.toUpperCase(),
      url: url,
      headers: options.headers || {},
      params: options.params,
      body: options.body,
      time: Date.now(),
      timeout: options.timeout || 0,
      strictSSL: this.browser.strictSSL
    };
    resource = {
      request: request,
      target: options.target
    };
    this.push(resource);
    this.browser.emit("request", request);
    this.runPipeline(request, function(error, response) {
      if (error) {
        resource.error = error;
        return callback(error);
      } else {
        response.url || (response.url = request.url);
        response.statusCode || (response.statusCode = 200);
        response.statusText = HTTP.STATUS_CODES[response.statusCode] || "Unknown";
        response.headers || (response.headers = {});
        response.redirects || (response.redirects = 0);
        response.time = Date.now();
        resource.response = response;
        _this.browser.emit("response", request, response);
        return callback(null, resource.response);
      }
    });
  };

  Resources.prototype.get = function(url, options, callback) {
    this.request("get", url, options, callback);
  };

  Resources.prototype.post = function(url, options, callback) {
    this.request("post", url, options, callback);
  };

  Resources.prototype.fail = function(url, message) {
    var failTheRequest;
    failTheRequest = function(request, next) {
      return next(new Error(message || "This request was intended to fail"));
    };
    this.urlMatchers.push([url, failTheRequest]);
  };

  Resources.prototype.delay = function(url, delay) {
    var delayTheResponse;
    if (delay == null) {
      delay = 10;
    }
    delayTheResponse = function(request, next) {
      return setTimeout(next, delay);
    };
    this.urlMatchers.push([url, delayTheResponse]);
  };

  Resources.prototype.mock = function(url, result) {
    var mockTheResponse;
    if (result == null) {
      result = {};
    }
    mockTheResponse = function(request, next) {
      return next(null, result);
    };
    this.urlMatchers.push([url, mockTheResponse]);
  };

  Resources.prototype.restore = function(url) {
    this.urlMatchers = this.urlMatchers.filter(function(_arg) {
      var match, _;
      match = _arg[0], _ = _arg[1];
      return match !== url;
    });
  };

  Resources.prototype.dump = function(output) {
    var error, name, request, resource, response, sample, target, value, _i, _len, _ref, _results;
    if (output == null) {
      output = process.stdout;
    }
    _results = [];
    for (_i = 0, _len = this.length; _i < _len; _i++) {
      resource = this[_i];
      request = resource.request, response = resource.response, error = resource.error, target = resource.target;
      if (response) {
        output.write("" + request.method + " " + response.url + " - " + response.statusCode + " " + response.statusText + " - " + (response.time - request.time) + "ms\n");
      } else {
        output.write("" + resource.request.method + " " + resource.request.url + "\n");
      }
      if (target instanceof HTML.Document) {
        output.write("  Loaded as HTML document\n");
      } else if (target) {
        if (target.id) {
          output.write("  Loading by element #" + target.id + "\n");
        } else {
          output.write("  Loading as " + target.tagName + " element\n");
        }
      }
      if (response) {
        if (response.redirects) {
          output.write("  Followed " + response.redirects + " redirects\n");
        }
        _ref = response.headers;
        for (name in _ref) {
          value = _ref[name];
          output.write("  " + name + ": " + value + "\n");
        }
        output.write("\n");
        sample = response.body.slice(0, 250).toString("utf8").split("\n").map(function(line) {
          return "  " + line;
        }).join("\n");
        output.write(sample);
      } else if (error) {
        output.write("  Error: " + error.message + "\n");
      } else {
        output.write("  Pending since " + (new Date(request.time)) + "\n");
      }
      _results.push(output.write("\n\n"));
    }
    return _results;
  };

  Resources.prototype.addHandler = function(handler) {
    assert(handler.call, "Handler must be a function");
    assert(handler.length === 2 || handler.length === 3, "Handler function takes 2 (request handler) or 3 (reponse handler) arguments");
    return this.pipeline.push(handler);
  };

  Resources.prototype.runPipeline = function(request, callback) {
    var nextRequestHandler, nextResponseHandler, requestHandlers, response, responseHandlers,
      _this = this;
    requestHandlers = this.pipeline.filter(function(fn) {
      return fn.length === 2;
    });
    requestHandlers.push(Resources.makeHTTPRequest);
    responseHandlers = this.pipeline.filter(function(fn) {
      return fn.length === 3;
    });
    response = null;
    nextRequestHandler = function(error, responseFromHandler) {
      var handler;
      if (error) {
        return callback(error);
      } else if (responseFromHandler) {
        response = responseFromHandler;
        response.url || (response.url = request.url);
        return nextResponseHandler();
      } else {
        handler = requestHandlers.shift();
        try {
          return handler.call(_this.browser, request, nextRequestHandler);
        } catch (_error) {
          error = _error;
          return callback(error);
        }
      }
    };
    nextResponseHandler = function(error) {
      var handler;
      if (error) {
        return callback(error);
      } else {
        handler = responseHandlers.shift();
        if (handler) {
          try {
            return handler.call(_this.browser, request, response, nextResponseHandler);
          } catch (_error) {
            error = _error;
            return callback(error);
          }
        } else {
          return callback(null, response);
        }
      }
    };
    nextRequestHandler();
  };

  return Resources;

})(Array);

Resources.addHandler = function(handler) {
  assert(handler.call, "Handler must be a function");
  assert(handler.length === 2 || handler.length === 3, "Handler function takes 2 (request handler) or 3 (response handler) arguments");
  return this.pipeline.push(handler);
};

Resources.normalizeURL = function(request, next) {
  var method, name, uri, value, _ref;
  if (/^file:/.test(request.url)) {
    request.url = request.url.replace(/^file:\/{1,3}/, "file:///");
  } else {
    if (this.document) {
      request.url = HTML.resourceLoader.resolve(this.document, request.url);
    } else {
      request.url = URL.resolve(this.site || "http://localhost", request.url);
    }
  }
  if (request.params) {
    method = request.method;
    if (method === "GET" || method === "HEAD" || method === "DELETE") {
      uri = URL.parse(request.url, true);
      _ref = request.params;
      for (name in _ref) {
        value = _ref[name];
        uri.query[name] = value;
      }
      request.url = URL.format(uri);
    }
  }
  next();
};

Resources.mergeHeaders = function(request, next) {
  var credentials, headers, host, name, value, _ref, _ref1;
  headers = {
    "user-agent": this.userAgent
  };
  _ref = this.headers;
  for (name in _ref) {
    value = _ref[name];
    headers[name.toLowerCase()] = value;
  }
  if (request.headers) {
    _ref1 = request.headers;
    for (name in _ref1) {
      value = _ref1[name];
      headers[name.toLowerCase()] = value;
    }
  }
  host = URL.parse(request.url).host;
  headers.host = host;
  if (credentials = this.authenticate(host, false)) {
    credentials.apply(headers);
  }
  request.headers = headers;
  next();
};

Resources.createBody = function(request, next) {
  var binary, boundary, disp, headers, method, mimeType, multipart, name, params, value, values, _i, _len;
  method = request.method;
  if (method === "POST" || method === "PUT") {
    headers = request.headers;
    headers["content-type"] || (headers["content-type"] = "application/x-www-form-urlencoded");
    mimeType = headers["content-type"].split(";")[0];
    if (!request.body) {
      switch (mimeType) {
        case "application/x-www-form-urlencoded":
          request.body = QS.stringify(request.params || {});
          headers["content-length"] = request.body.length;
          break;
        case "multipart/form-data":
          params = request.params || {};
          if (Object.keys(params).length === 0) {
            headers["content-type"] = "text/plain";
            request.body = "";
          } else {
            boundary = "" + (new Date().getTime()) + "." + (Math.random());
            headers["content-type"] += "; boundary=" + boundary;
            multipart = [];
            for (name in params) {
              values = params[name];
              for (_i = 0, _len = values.length; _i < _len; _i++) {
                value = values[_i];
                disp = "form-data; name=\"" + name + "\"";
                if (value.read) {
                  binary = value.read();
                  multipart.push({
                    "Content-Disposition": "" + disp + "; filename=\"" + value + "\"",
                    "Content-Type": value.mime || "application/octet-stream",
                    "Content-Length": binary.length,
                    body: binary
                  });
                } else {
                  multipart.push({
                    "Content-Disposition": disp,
                    "Content-Type": "text/plain; charset=utf8",
                    "Content-Length": value.length,
                    body: value
                  });
                }
              }
            }
            request.multipart = multipart;
          }
          break;
        case "text/plain":
          break;
        default:
          next(new Error("Unsupported content type " + mimeType));
          return;
      }
    }
  }
  next();
};

Resources.specialURLHandlers = function(request, next) {
  var handler, url, _i, _len, _ref, _ref1;
  _ref = this.resources.urlMatchers;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    _ref1 = _ref[_i], url = _ref1[0], handler = _ref1[1];
    if (URL.resolve(request.url, url) === request.url) {
      handler(request, next);
      return;
    }
  }
  return next();
};

Resources.decompressBody = function(request, response, next) {
  var contentEncoding, transferEncoding;
  if (response.body && response.headers) {
    transferEncoding = response.headers["transfer-encoding"];
    contentEncoding = response.headers["content-encoding"];
  }
  switch (transferEncoding || contentEncoding) {
    case "deflate":
      Zlib.inflate(response.body, function(error, buffer) {
        if (!error) {
          response.body = buffer;
        }
        return next(error);
      });
      break;
    case "gzip":
      Zlib.gunzip(response.body, function(error, buffer) {
        if (!error) {
          response.body = buffer;
        }
        return next(error);
      });
      break;
    default:
      next();
  }
};

Resources.decodeBody = function(request, response, next) {
  var charset, contentType, mimeType, subtype, type, typeOption, typeOptions, _i, _len, _ref, _ref1;
  if (response.body && response.headers) {
    contentType = response.headers["content-type"];
  }
  if (contentType) {
    _ref = contentType.split(/;\s*/), mimeType = _ref[0], typeOptions = 2 <= _ref.length ? __slice.call(_ref, 1) : [];
    _ref1 = contentType.split(/\//, 2), type = _ref1[0], subtype = _ref1[1];
    if (!(mimeType === "application/octet-stream" || type === "image")) {
      for (_i = 0, _len = typeOptions.length; _i < _len; _i++) {
        typeOption = typeOptions[_i];
        if (/^charset=/.test(typeOption)) {
          charset = typeOption.split("=")[1];
          break;
        }
      }
      response.body = encoding.convert(response.body.toString(), null, charset || "utf-8").toString();
    }
  }
  next();
};

Resources.pipeline = [Resources.normalizeURL, Resources.mergeHeaders, Resources.createBody, Resources.specialURLHandlers, Resources.decompressBody, Resources.decodeBody];

Resources.makeHTTPRequest = function(request, callback) {
  var cookies, filename, hostname, httpRequest, pathname, protocol, _ref,
    _this = this;
  _ref = URL.parse(request.url), protocol = _ref.protocol, hostname = _ref.hostname, pathname = _ref.pathname;
  if (protocol === "file:") {
    if (request.method === "GET") {
      filename = Path.normalize(decodeURI(pathname));
      File.exists(filename, function(exists) {
        if (exists) {
          return File.readFile(filename, function(error, buffer) {
            if (error) {
              resource.error = error;
              return callback(error);
            } else {
              return callback(null, {
                body: buffer
              });
            }
          });
        } else {
          return callback(null, {
            statusCode: 404
          });
        }
      });
    } else {
      callback(resource.error);
    }
  } else {
    cookies = this.cookies;
    request.headers.cookie = cookies.serialize(hostname, pathname);
    httpRequest = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      multipart: request.multipart,
      proxy: this.proxy,
      jar: false,
      followRedirect: false,
      encoding: null,
      strictSSL: request.strictSSL,
      timeout: request.timeout || 0
    };
    Request(httpRequest, function(error, response) {
      var name, redirectHeaders, redirectRequest, redirects, setCookie, value, _ref1;
      if (error) {
        callback(error);
        return;
      }
      setCookie = response.headers["set-cookie"];
      if (setCookie) {
        cookies.update(setCookie, hostname, pathname);
      }
      redirects = request.redirects || 0;
      switch (response.statusCode) {
        case 301:
        case 307:
          if (request.method === "GET" || request.method === "HEAD") {
            response.url = URL.resolve(request.url, response.headers.location);
          }
          break;
        case 302:
        case 303:
          response.url = URL.resolve(request.url, response.headers.location);
      }
      if (response.url) {
        ++redirects;
        if (redirects > _this.maxRedirects) {
          callback(new Error("More than " + _this.maxRedirects + " redirects, giving up"));
          return;
        }
        redirectHeaders = {};
        _ref1 = request.headers;
        for (name in _ref1) {
          value = _ref1[name];
          redirectHeaders[name] = value;
        }
        redirectHeaders.referer = request.url;
        delete redirectHeaders["content-type"];
        delete redirectHeaders["content-length"];
        delete redirectHeaders["content-transfer-encoding"];
        redirectRequest = {
          method: "GET",
          url: response.url,
          headers: redirectHeaders,
          redirects: redirects,
          strictSSL: request.strictSSL,
          time: request.time,
          timeout: request.timeout
        };
        _this.emit("redirect", response, redirectRequest);
        return _this.resources.runPipeline(redirectRequest, callback);
      } else {
        response = {
          url: request.url,
          statusCode: response.statusCode,
          headers: response.headers,
          body: response.body,
          redirects: redirects
        };
        return callback(null, response);
      }
    });
  }
};

module.exports = Resources;