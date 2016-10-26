'use strict';

System.register([], function (_export, _context) {
  "use strict";

  var _createClass, Variables;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [],
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

      _export('Variables', Variables = function () {
        function Variables(templateSrv) {
          _classCallCheck(this, Variables);

          this.templateSrv = templateSrv;
        }

        _createClass(Variables, [{
          key: 'resolve',
          value: function resolve(target, options) {
            var _this = this;

            var variables = options.scopedVars || this.templateSrv.variables;
            // For each variable in target, and each values of a given variable, build a resolved target string
            var variableNames = target.match(/\$\w+/g);
            var resolved = [target];
            if (variableNames) {
              variableNames.forEach(function (name) {
                var values = _this.getVarValues(name, variables);
                var newResolved = [];
                values.forEach(function (val) {
                  resolved.forEach(function (target) {
                    newResolved.push(target.replace(name, val));
                  });
                });
                resolved = newResolved;
              });
            }
            return resolved;
          }
        }, {
          key: 'getVarValues',
          value: function getVarValues(name, variables) {
            var values = this.templateSrv.replace(name, variables);
            // result might be in like "{id1,id2,id3}" (as string)
            if (values.charAt(0) === '{') {
              return values.substring(1, values.length - 1).split(',');
            }
            return [values];
          }
        }]);

        return Variables;
      }());

      _export('Variables', Variables);
    }
  };
});
//# sourceMappingURL=variables.js.map
