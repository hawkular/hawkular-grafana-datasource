import _ from "lodash";
import {Aggregations} from './aggregations';

export class HawkularDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.tenant = instanceSettings.jsonData.tenant;
    this.token = instanceSettings.jsonData.token;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.aggregations = new Aggregations();
  }

  query(options) {
    let validTargets = options.targets
      .filter(target => !target.hide)
      .filter(target => target.target !== 'select metric');

    if (validTargets.length === 0) {
      return this.q.when({data: []});
    }

    let promises = validTargets.map(target =>
      this.queryOnTarget(target, options)
        .then(response => this.processResponse(target, response)));

    return this.q.all(promises).then(responses => {
      let flatten = [].concat.apply([], responses);
      return {data: flatten};
    });
  }

  queryOnTarget(target, options) {
    let uri = [
      target.type + 's',            // gauges or counters
      target.rate ? 'rate' : 'raw', // raw or rate
      'query'
    ];
    let url = this.url + '/' + uri.join('/');
    let metricIds = this.resolveVariables(target.target, options.scopedVars || this.templateSrv.variables);

    return this.backendSrv.datasourceRequest({
      url: url,
      data: {
        ids: metricIds,
        start: options.range.from.valueOf(),
        end: options.range.to.valueOf()
      },
      method: 'POST',
      headers: this.createHeaders()
    }).then(response => {
      return {
        target: metricIds[0],
        hawkularJson: response.status == 200 ? response.data : []
      };
    });
  }

  processResponse(target, response) {
    var hawkularJson;
    if (target.reduce === 'sum') {
      hawkularJson = this.aggregations.on(response.hawkularJson, this.aggregations.sum);
    } else if (target.reduce === 'average') {
      hawkularJson = this.aggregations.on(response.hawkularJson, this.aggregations.average);
    } else if (target.reduce === 'min') {
      hawkularJson = this.aggregations.on(response.hawkularJson, this.aggregations.min);
    } else if (target.reduce === 'max') {
      hawkularJson = this.aggregations.on(response.hawkularJson, this.aggregations.max);
    } else {
      hawkularJson = response.hawkularJson;
    }
    let multipleSeries = hawkularJson.length > 1;
    return hawkularJson.map(timeSerie => {
      return {
        refId: target.refId,
        target: multipleSeries ? timeSerie.id : response.target,
        datapoints: timeSerie.data.map(point => [point.value, point.timestamp])
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

  metricFindQuery(options) {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/metrics',
      params: {type: options.type},
      method: 'GET',
      headers: this.createHeaders()
    }).then(result => {
      return _.map(result.data, metric => {
        return {text: metric.id, value: metric.id};
      });
    });
  }

  resolveVariables(target, scopedVars) {
    let variables = target.match(/\$\w+/g);
    var resolved = [target];
    if (variables) {
      variables.forEach(v => {
        let values = this.getVarValues(v, scopedVars);
        let newResolved = [];
        values.forEach(val => {
          resolved.forEach(target => {
            newResolved.push(target.replace(v, val));
          });
        });
        resolved = newResolved;
      });
    }
    return resolved;
  }

  getVarValues(variable, scopedVars) {
    let values = this.templateSrv.replace(variable, scopedVars);
    // result might be in like "{id1,id2,id3}" (as string)
    if (values.startsWith('{')) {
        return values.substring(1, values.length-1).split(',');
    }
    return [values];
  }
}
