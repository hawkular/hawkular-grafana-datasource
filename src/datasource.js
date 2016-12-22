import _ from "lodash";
import {Variables} from './variables';
import {Capabilities} from './capabilities';
import {QueryProcessor} from './queryProcessor';

export class HawkularDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.headers = {
      'Content-Type': 'application/json',
      'Hawkular-Tenant': instanceSettings.jsonData.tenant
    };
    if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
      this.headers['Authorization'] = instanceSettings.basicAuth;
    } else if (typeof instanceSettings.jsonData.username === 'string' && instanceSettings.jsonData.username.length > 0) {
      this.headers['Authorization'] = 'Basic ' + window.btoa(instanceSettings.jsonData.username + ':' + instanceSettings.jsonData.password);
    } else if (typeof instanceSettings.jsonData.token === 'string' && instanceSettings.jsonData.token.length > 0) {
      this.headers['Authorization'] = 'Bearer ' + instanceSettings.jsonData.token;
    }
    this.typeResources = {
      "gauge": "gauges",
      "counter": "counters",
      "availability": "availability"
    };
    let variables = new Variables(templateSrv);
    this.capabilitiesPromise = this.queryVersion()
      .then(version => new Capabilities(version));
    this.queryProcessor = new QueryProcessor($q, backendSrv, variables, this.capabilitiesPromise, this.url, this.headers, this.typeResources);
  }

  query(options) {
    let validTargets = options.targets
      .filter(target => !target.hide)
      .filter(target => (target.queryBy === 'tags' && target.tags.length > 0) || target.target !== 'select metric');

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

  testDatasource() {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/metrics',
      method: 'GET',
      headers: this.headers
    }).then(response => {
      if (response.status === 200 || response.status === 204) {
        return { status: "success", message: "Data source is working", title: "Success" };
      } else {
        return { status: "error", message: "Connection failed (" + response.status + ")", title: "Error" };
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
      headers: this.headers
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
      url: this.url + '/' + this.typeResources[type] + '/tags/' + key + ':*',
      method: 'GET',
      headers: this.headers
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
      if (query.substr(0, 5) === "tags/") {
        return this.findTags(query.substr(5).trim());
      }
      if (query.charAt(0) === '?') {
        params = query;
      } else {
        params = "?" + query;
      }
    }
    return this.backendSrv.datasourceRequest({
      url: this.url + '/metrics' + params,
      method: 'GET',
      headers: this.headers
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
      headers: this.headers
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

  getCapabilities() {
    return this.capabilitiesPromise;
  }
}
