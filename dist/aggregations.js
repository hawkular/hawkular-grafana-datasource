"use strict";

System.register(["lodash"], function (_export, _context) {
  "use strict";

  var _, _createClass, Aggregations;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export("Aggregations", Aggregations = function () {
        function Aggregations() {
          _classCallCheck(this, Aggregations);
        }

        _createClass(Aggregations, [{
          key: "on",
          value: function on(timeSeries, f) {
            if (timeSeries.length <= 1) {
              return timeSeries;
            }
            // TODO: iterate over timestamps with interpolation when necessary
            // It can be very time-consuming if there's too much data
            // Does hawkular-metrics do it?
            return [timeSeries[0]];
          }
        }, {
          key: "sum",
          value: function sum(values) {
            if (values.length === 0) {
              return null;
            }
            return values.reduce(function (a, b) {
              return a + b;
            });
          }
        }, {
          key: "average",
          value: function average(values) {
            if (values.length === 0) {
              return null;
            }
            return values.reduce(function (a, b) {
              return a + b;
            }) / values.length;
          }
        }, {
          key: "min",
          value: function min(values) {
            if (values.length === 0) {
              return null;
            }
            return values.reduce(function (a, b) {
              return a < b ? a : b;
            });
          }
        }, {
          key: "max",
          value: function max(values) {
            if (values.length === 0) {
              return null;
            }
            return values.reduce(function (a, b) {
              return a > b ? a : b;
            });
          }
        }]);

        return Aggregations;
      }());

      _export("Aggregations", Aggregations);
    }
  };
});
//# sourceMappingURL=aggregations.js.map
