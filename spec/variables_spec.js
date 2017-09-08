import {VariablesHelper} from "../variablesHelper";
import Q from "q";

describe('Variables', () => {
  const ctx = {
    templateSrv: {
      variables: [{
        name: 'app',
        values: ['app_1', 'app_2']
      },{
        name: 'container',
        values: ['1234', '5678', '90']
      },{
        name: 'host',
        values: 'cartago'
      }],
      replace: (target, scopedVars, fmt) => {
        // Quick & simple emulation of the real templateSrv.replace
        let result = target;
        if (!fmt) {
          fmt = values => (typeof values == "string") ? values : `{${values.join(',')}}`;
        }
        ctx.templateSrv.variables.forEach(v => {
          const values = scopedVars[v.name] ? scopedVars[v.name].value : v.values;
          result = result.replace('$' + v.name, fmt(values));
        });
        return result;
      }
    },
    options: {
      scopedVars: {}
    }
  };
  ctx.variablesHelper = new VariablesHelper(ctx.templateSrv);

  it('should mock correctly', done => {
    // (Testing the test)
    const replaced = ctx.templateSrv.replace("$app", ctx.templateSrv.variables);
    expect(replaced).to.equal('{app_1,app_2}');
    done();
  });

  it('should resolve single variable', done => {
    const resolved = ctx.variablesHelper.resolve("$app/memory/usage", ctx.options);
    expect(resolved).to.deep.equal(['app_1/memory/usage', 'app_2/memory/usage']);
    done();
  });

  it('should resolve single variable with single value', done => {
    const resolved = ctx.variablesHelper.resolve("$host/memory/usage", ctx.options);
    expect(resolved).to.deep.equal(['cartago/memory/usage']);
    done();
  });

  it('should resolve multiple variables', done => {
    const resolved = ctx.variablesHelper.resolve("$app/$container/memory/usage", ctx.options);
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

  it('should resolve to string', done => {
    const resolved = ctx.variablesHelper.resolveForQL("app IN [$app] AND container NOT IN ['a', $container, 'z']", ctx.options);
    expect(resolved).to.deep.equal("app IN ['app_1','app_2'] AND container NOT IN ['a', '1234','5678','90', 'z']");
    done();
  });

  it('should resolve to string with single value', done => {
    const resolved = ctx.variablesHelper.resolveForQL("host IN [$host]", ctx.options);
    expect(resolved).to.deep.equal("host IN ['cartago']");
    done();
  });

  it('should resolve variable in word with multiple occurrences', done => {
    const resolved = ctx.variablesHelper.resolve("$app/$app_memory_usage", ctx.options);
    expect(resolved).to.deep.equal(['app_1/app_1_memory_usage', 'app_2/app_2_memory_usage']);
    done();
  });

  it('should resolve with scopedVars', done => {
    const resolved = ctx.variablesHelper.resolve("$host/$app/memory/usage", {
      scopedVars: {
        app: {
          value: "app_1"
        }
      }
    });
    expect(resolved).to.deep.equal(['cartago/app_1/memory/usage']);
    done();
  });

  it('should resolve to string with scopedVars', done => {
    const resolved = ctx.variablesHelper.resolveForQL("app IN [$app] AND container NOT IN ['a', $container, 'z']", {
      scopedVars: {
        container: {
          value: "1234"
        }
      }
    });
    expect(resolved).to.deep.equal("app IN ['app_1','app_2'] AND container NOT IN ['a', '1234', 'z']");
    done();
  });
});
