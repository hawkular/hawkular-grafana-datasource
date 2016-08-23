export class QueryProcessor {

  constructor(q, backendSrv, variables, url, baseHeaders) {
    this.q = q;
    this.backendSrv = backendSrv;
    this.variables = variables;
    this.url = url;
    this.baseHeaders = baseHeaders;
  }

  run(target, options) {
    if (target.queryBy === 'ids') {
      let metricIds = this.variables.resolve(target.target, options);
      return this.rawQuery(target, options.range, metricIds)
        .then(response => this.processRawResponse(target, response));
    } else {
      if (target.tags.length === 0) {
        return this.q.when([]);
      }
      let strTags = this.hawkularFormatTags(target.tags, options);
      return this.rawQueryByTags(target, options.range, strTags)
        .then(response => this.processRawResponse(target, response));
    }
  }

  hawkularFormatTags(tags, options) {
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

  rawQuery(target, range, metricIds) {
    let uri = [
      target.type + 's',            // gauges or counters
      target.rate ? 'rate' : 'raw', // raw or rate
      'query'
    ];
    let url = this.url + '/' + uri.join('/');

    return this.backendSrv.datasourceRequest({
      url: url,
      data: {
        ids: metricIds,
        start: range.from.valueOf(),
        end: range.to.valueOf()
      },
      method: 'POST',
      headers: this.baseHeaders
    }).then(response => {
      return response.status == 200 ? response.data : [];
    });
  }

  rawQueryByTags(target, range, tags) {
    let uri = [
      target.type + 's',            // gauges or counters
      target.rate ? 'rate' : 'raw', // raw or rate
      'query'
    ];
    let url = this.url + '/' + uri.join('/');

    return this.backendSrv.datasourceRequest({
      url: url,
      data: {
        tags: tags,
        start: range.from.valueOf(),
        end: range.to.valueOf()
      },
      method: 'POST',
      headers: this.baseHeaders
    }).then(response => {
      return response.status == 200 ? response.data : [];
    });
  }

  processRawResponse(target, response) {
    var datapoints = timeSerie => timeSerie.data.map(point => [point.value, point.timestamp]);
    return response.map(timeSerie => {
      return {
        refId: target.refId,
        target: timeSerie.id,
        datapoints: datapoints(timeSerie)
      };
    });
  }
}
