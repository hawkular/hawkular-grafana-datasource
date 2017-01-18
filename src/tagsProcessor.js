export class TagsProcessor {

  constructor(variables) {
    this.variables = variables;
  }

  toHawkular(tags, options) {
    return tags.map(tag => {
      var value;
      if (tag.value === ' *') {
        // '*' character get a special treatment in grafana so we had to use ' *' instead
        value = '*';
      } else {
        value = this.variables.resolve(tag.value, options).join('|');
      }
      return tag.name + ':' + value;
    }).join(',');
  }
}
