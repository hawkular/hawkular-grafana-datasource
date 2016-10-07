export class QueryProcessor {

  constructor(q, backendSrv, variables, capabilities, url, baseHeaders) {
    this.q = q;
    this.backendSrv = backendSrv;
    this.variables = variables;
    this.capabilities = capabilities;
    this.url = url;
    this.baseHeaders = baseHeaders;
  }

  run(target, options) {
    return this.capabilities.then(caps => {
      if (target.queryBy === 'ids') {
        let metricIds = this.variables.resolve(target.target, options);
        if (caps.QUERY_POST_ENDPOINTS) {
          return this.rawQuery(target, options.range, metricIds);
        } else {
          return this.rawQueryLegacy(target, options.range, metricIds);
        }
      } else {
        if (target.tags.length === 0) {
          return this.q.when([]);
        }
        let strTags = this.hawkularFormatTags(target.tags, options);
        return this.rawQueryByTags(target, options.range, strTags);
      }
    });
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
        end: range.to.valueOf(),
        order: 'ASC'
      },
      method: 'POST',
      headers: this.baseHeaders
    }).then(response => this.processRawResponse(target, response.status == 200 ? response.data : []));
  }

  rawQueryLegacy(target, range, metricIds) {
    return this.q.all(metricIds.map(metric => {
      let uri = [
        target.type + 's',            // gauges or counters
        encodeURIComponent(metric).replace('+', '%20'), // metric name
        'data'];
      let url = this.url + '/' + uri.join('/');

      return this.backendSrv.datasourceRequest({
        url: url,
        params: {
          start: range.from.valueOf(),
          end: range.to.valueOf()
        },
        method: 'GET',
        headers: this.baseHeaders
      }).then(response => this.processRawResponseLegacy(target, metric, response.status == 200 ? response.data : []));
    }));
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
        end: range.to.valueOf(),
        order: 'ASC'
      },
      method: 'POST',
      headers: this.baseHeaders
    }).then(response => this.processRawResponse(target, response.status == 200 ? response.data : []));
  }

  processRawResponse(target, data) {
    return data.map(timeSerie => {
      return {
        refId: target.refId,
        target: timeSerie.id,
        datapoints: timeSerie.data.map(point => [point.value, point.timestamp])
      };
    });
  }

  processRawResponseLegacy(target, metric, data) {
    var datapoints;
    if (!target.rate) {
      datapoints = _.map(data, point => [point.value, point.timestamp]);
    } else {
      var sortedData = data.sort((p1, p2)=> p1.timestamp - p2.timestamp);
      datapoints = _.chain(sortedData)
        .zip(sortedData.slice(1))
        .filter(pair => {
          return pair[1] // Exclude the last pair
            && (target.type == 'gauge' || pair[0].value <= pair[1].value); // Exclude counter resets
        })
        .map(pair => {
          var point1 = pair[0], point2 = pair[1];
          var timestamp = point2.timestamp;
          var value_diff = point2.value - point1.value;
          var time_diff = point2.timestamp - point1.timestamp;
          var rate = 60000 * value_diff / time_diff;
          return [rate, timestamp];
        })
        .value();
    }
    return {
      refId: target.refId,
      target: metric,
      datapoints: datapoints
    };
  }
}
