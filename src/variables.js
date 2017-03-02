export class Variables {

  constructor(templateSrv) {
    this.templateSrv = templateSrv;
  }

  resolve(target, options) {
    const variables = options.scopedVars || this.templateSrv.variables;
    // For each variable in target, and each values of a given variable, build a resolved target string
    const variableNames = target.match(/\$\w+/g);
    let resolved = [target];
    if (variableNames) {
      variableNames.forEach(name => {
        const values = this.getVarValues(name, variables);
        const newResolved = [];
        values.forEach(val => {
          resolved.forEach(target => {
            newResolved.push(target.replace(name, val));
          });
        });
        resolved = newResolved;
      });
    }
    return resolved;
  }

  resolveToString(target, options) {
    const variables = options.scopedVars || this.templateSrv.variables;
    return target.replace(/\$\w+/g, name => {
      const values = this.getVarValues(name, variables);
      return values.map(v => "'" + v + "'").join(',');
    });
  }

  getVarValues(name, variables) {
    const values = this.templateSrv.replace(name, variables);
    // result might be in like "{id1,id2,id3}" (as string)
    if (values.charAt(0) === '{') {
        return values.substring(1, values.length-1).split(',');
    }
    return [values];
  }

  exists(name) {
    return this.templateSrv.variableExists(name);
  }
}
