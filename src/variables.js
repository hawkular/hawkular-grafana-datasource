export class Variables {

  constructor(templateSrv) {
    this.templateSrv = templateSrv;
  }

  resolve(target, options) {
    let variables = options.scopedVars || this.templateSrv.variables;
    // For each variable in target, and each values of a given variable, build a resolved target string
    let variableNames = target.match(/\$\w+/g);
    var resolved = [target];
    if (variableNames) {
      variableNames.forEach(name => {
        let values = this.getVarValues(name, variables);
        let newResolved = [];
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

  getVarValues(name, variables) {
    let values = this.templateSrv.replace(name, variables);
    // result might be in like "{id1,id2,id3}" (as string)
    if (values.charAt(0) === '{') {
        return values.substring(1, values.length-1).split(',');
    }
    return [values];
  }
}
