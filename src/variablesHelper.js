import _ from 'lodash';

export class VariablesHelper {

  constructor(templateSrv) {
    this.templateSrv = templateSrv;
  }

  resolve(target, options) {
    const variableNames = (this.templateSrv.variables || []).map(v => '$' + v.name);
    // For each variable in target, and each values of a given variable, build a resolved target string
    let resolved = [target];
    if (variableNames) {
      variableNames.forEach(name => {
        if (target.indexOf(name) >= 0) {
          const values = this.getVarValues(name, options.scopedVars);
          const newResolved = [];
          const regex = new RegExp('\\' + name, 'g');
          values.forEach(val => {
            resolved.forEach(newTarget => {
              newResolved.push(newTarget.replace(regex, val));
            });
          });
          resolved = newResolved;
        }
      });
    }
    return resolved;
  }

  resolveForQL(target, options) {
    return this.templateSrv.replace(target, options.scopedVars, values => {
      if (_.isArray(values)) {
        return values.map(v => `'${v}'`).join(',');
      }
      return `'${values}'`;
    });
  }

  getVarValues(name, scopedVars) {
    const values = this.templateSrv.replace(name, scopedVars);
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
