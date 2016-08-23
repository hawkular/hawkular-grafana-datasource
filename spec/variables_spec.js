import {Variables} from "../variables";
import Q from "q";

describe('Variables', function () {
  let ctx = {
    templateSrv: {},
    variables: {}
  };

  beforeEach(function () {
    ctx.templateSrv = {
        replace: function(target, vars) {
          return target;
        }
    };
    ctx.variables = new Variables(ctx.templateSrv);
  });

  it('should resolve single variable', function (done) {
    ctx.templateSrv.replace = function(target, vars) {
      expect(target).to.equal('$app');
      return "{app_1,app_2}";
    };
    let resolved = ctx.variables.resolve("$app/memory/usage", {});
    expect(resolved).to.deep.equal(['app_1/memory/usage', 'app_2/memory/usage']);
    done();
  });

  it('should resolve multiple variables', function (done) {
    ctx.templateSrv.replace = function(target, vars) {
      if (target === '$app') {
        return "{app_1,app_2}";
      }
      if (target === '$container') {
        return "{1234,5678,90}";
      }
      return target;
    };
    let resolved = ctx.variables.resolve("$app/$container/memory/usage", {});
    expect(resolved).to.deep.equal([
      'app_1/1234/memory/usage',
      'app_2/1234/memory/usage',
      'app_1/5678/memory/usage',
      'app_2/5678/memory/usage',
      'app_1/90/memory/usage',
      'app_2/90/memory/usage'
    ]);
    done();
  });
});
