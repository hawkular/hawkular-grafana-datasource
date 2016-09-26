import _ from "lodash";
import {Variables} from './variables';
import {Capabilities} from './capabilities';
import {QueryProcessor} from './queryProcessor';

export class HawkularDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.tenant = instanceSettings.jsonData.tenant;
    this.token = instanceSettings.jsonData.token;
    this.q = $q;
    this.backendSrv = backendSrv;
    let variables = new Variables(templateSrv);
    let capabilities = this.queryVersion()
      .then(version => new Capabilities(version));
    this.queryProcessor = new QueryProcessor($q, backendSrv, variables, capabilities, this.url, this.createHeaders());
  }

  query(options) {
    let validTargets = options.targets
      .filter(target => !target.hide)
      .filter(target => target.target !== 'select metric');

    if (validTargets.length === 0) {
      return this.q.when({data: []});
    }

    let promises = validTargets.map(target => {
      return this.queryProcessor.run(target, options);
    });

    return this.q.all(promises).then(responses => {
      let flatten = [].concat.apply([], responses);
      return {data: flatten};
    });
  }

  getDataLegacy(target, start, end) {
    var uri = [];
    uri.push(target.type + 's'); // gauges or counters
    uri.push(encodeURIComponent(target.target).replace('+', '%20')); // metric name
    uri.push('data');

    var url = this.url + '/' + uri.join('/');

    return this.backendSrv.datasourceRequest({
      url: url,
      params: {
        start: start,
        end: end
      },
      method: 'GET',
      headers: this.createHeaders()
    }).then(response => {
      var datapoints;
      if (!target.rate) {
        datapoints = _.map(response.data, point => [point.value, point.timestamp]);
      } else {
        var sortedData = response.data.sort((p1, p2)=> p1.timestamp - p2.timestamp);
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
        target: target.target,
        datapoints: datapoints
      };
    });
  }

  createHeaders() {
    var headers = {
      'Content-Type': 'application/json',
      'Hawkular-Tenant': this.tenant
    };
    if (typeof this.token === 'string' && this.token.length > 0) {
      headers.Authorization = 'Bearer ' + this.token;
    }
    return headers;
  }

  testDatasource() {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/status',
      method: 'GET'
    }).then(response => {
      if (response.status === 200) {
        return { status: "success", message: "Data source is working", title: "Success" };
      }
    });
  }

  annotationQuery(options) {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/annotations',
      method: 'POST',
      data: options
    }).then(result => {
      return result.data;
    });
  }

  suggestQueries(target) {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/metrics?type=' + target.type,
      method: 'GET',
      headers: this.createHeaders()
    }).then(result => {
      return _.map(result.data, metric => {
        return {text: metric.id, value: metric.id};
      });
    });
  }

  suggestTags(type, key) {
    if (!key) {
      // Need at least some characters typed in order to suggest something
      return this.q.when([]);
    }
    return this.backendSrv.datasourceRequest({
      url: this.url + '/' + type + 's/tags/' + key + ':*',
      method: 'GET',
      headers: this.createHeaders()
    }).then(result => {
      if (result.data.hasOwnProperty(key)) {
        return [' *'].concat(result.data[key]).map(value => {
          return {text: value, value: value};
        });
      }
      return [];
    });
  }

  metricFindQuery(query) {
    var params = "";
    if (query !== undefined) {
      if (query.startsWith("tags/")) {
        return this.findTags(query.substr(5).trim());
      }
      if (query.startsWith("?")) {
        params = query;
      } else {
        params = "?" + query;
      }
    }
    return this.backendSrv.datasourceRequest({
      url: this.url + '/metrics' + params,
      method: 'GET',
      headers: this.createHeaders()
    }).then(result => {
      return _.map(result.data, metric => {
        return {text: metric.id, value: metric.id};
      });
    });
  }

  findTags(pattern) {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/metrics/tags/' + pattern,
      method: 'GET',
      headers: this.createHeaders()
    }).then(result => {
      var flatTags = [];
      if (result.data) {
        var data = result.data;
        for (var property in data) {
          if (data.hasOwnProperty(property)) {
            flatTags = flatTags.concat(data[property]);
          }
        }
      }
      return flatTags.map(tag => {
        return {text: tag, value: tag};
      });
    });
  }

  queryVersion() {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/status',
      method: 'GET',
      headers: {'Content-Type': 'application/json'}
    }).then(response => response.data['Implementation-Version'])
    .catch(response => "Unknown");
  }
}
