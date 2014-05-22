// Generated by CoffeeScript 1.6.3
var Interaction;

Interaction = (function() {
  function Interaction(browser) {
    var alertFns, confirmCanned, confirmFns, promptCanned, promptFns, prompts;
    prompts = [];
    alertFns = [];
    this.onalert = function(fn) {
      return alertFns.push(fn);
    };
    confirmFns = [];
    confirmCanned = {};
    this.onconfirm = function(question, response) {
      if (typeof question === "function") {
        return confirmFns.push(question);
      } else {
        return confirmCanned[question] = !!response;
      }
    };
    promptFns = [];
    promptCanned = {};
    this.onprompt = function(message, response) {
      if (typeof message === "function") {
        return promptFns.push(message);
      } else {
        return promptCanned[message] = response;
      }
    };
    this.prompted = function(message) {
      return prompts.indexOf(message) >= 0;
    };
    this.extend = function(window) {
      window.alert = function(message) {
        var fn, _i, _len;
        browser.emit("alert", message);
        prompts.push(message);
        for (_i = 0, _len = alertFns.length; _i < _len; _i++) {
          fn = alertFns[_i];
          fn(message);
        }
      };
      window.confirm = function(question) {
        var fn, response, _i, _len;
        browser.emit("confirm", question);
        prompts.push(question);
        response = confirmCanned[question];
        if (!(response || response === false)) {
          for (_i = 0, _len = confirmFns.length; _i < _len; _i++) {
            fn = confirmFns[_i];
            response = fn(question);
            if (response || response === false) {
              break;
            }
          }
        }
        return !!response;
      };
      return window.prompt = function(message, defaultValue) {
        var fn, response, _i, _len;
        browser.emit("prompt", message);
        prompts.push(message);
        response = promptCanned[message];
        if (!(response || response === false)) {
          for (_i = 0, _len = promptFns.length; _i < _len; _i++) {
            fn = promptFns[_i];
            response = fn(message, defaultValue);
            if (response || response === false) {
              break;
            }
          }
        }
        if (response) {
          return response.toString();
        }
        if (response === false) {
          return null;
        }
        return defaultValue || "";
      };
    };
  }

  return Interaction;

})();

exports.use = function(browser) {
  return new Interaction(browser);
};