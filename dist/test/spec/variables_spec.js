"use strict";

var _variables = require("../variables");

var _q = require("q");

var _q2 = _interopRequireDefault(_q);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('Variables', function () {
  var ctx = {
    templateSrv: {},
    variables: {}
  };

  beforeEach(function () {
    ctx.templateSrv = {
      replace: function replace(target, vars) {
        return target;
      }
    };
    ctx.variables = new _variables.Variables(ctx.templateSrv);
  });

  it('should resolve single variable', function (done) {
    ctx.templateSrv.replace = function (target, vars) {
      expect(target).to.equal('$app');
      return "{app_1,app_2}";
    };
    var resolved = ctx.variables.resolve("$app/memory/usage", {});
    expect(resolved).to.deep.equal(['app_1/memory/usage', 'app_2/memory/usage']);
    done();
  });

  it('should resolve multiple variables', function (done) {
    ctx.templateSrv.replace = function (target, vars) {
      if (target === '$app') {
        return "{app_1,app_2}";
      }
      if (target === '$container') {
        return "{1234,5678,90}";
      }
      return target;
    };
    var resolved = ctx.variables.resolve("$app/$container/memory/usage", {});
    expect(resolved).to.deep.equal(['app_1/1234/memory/usage', 'app_2/1234/memory/usage', 'app_1/5678/memory/usage', 'app_2/5678/memory/usage', 'app_1/90/memory/usage', 'app_2/90/memory/usage']);
    done();
  });
});
//# sourceMappingURL=variables_spec.js.map
