import _ from "lodash";

export class GenericDatasource {

  constructor(instanceSettings, $q, backendSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.tenant = instanceSettings.jsonData.tenant;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.bearer = instanceSettings.jsonData.token
  }

  query(options) {
    var promises = _.chain(options.targets)
      .filter(target => !target.hide)
      .filter(target => target.target !== 'select metric')
      .map(target => {

        var uri = [];
        uri.push(target.type + 's'); // gauges or counter
        uri.push(encodeURIComponent(target.target).replace('+', '%20')); // metric name
        uri.push(target.rate ? 'rate' : 'raw'); // raw or rate

        var url = this.url + '/' + uri.join('/');

        return this.backendSrv.datasourceRequest({
          url: url,
          params: {start: options.range.from.valueOf(), end: options.range.to.valueOf()},
          method: 'GET',
          headers: {'Content-Type': 'application/json', 'Hawkular-Tenant': this.tenant, 'Authorization': 'Bearer ' + this.token}

        });
      })
      .value();

    if (promises.length <= 0) {
      return this.q.when({data: []});
    }

    return this.q.all(promises).then(responses => {
      var result = _.map(responses, (response, index) => {
        var datapoints = _.map(response.data, point => [point.value, point.timestamp]);
        return {
          target: options.targets[index].target,
          datapoints: datapoints
        };
      });
      return {data: result};
    });
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
      headers: {'Content-Type': 'application/json', 'Hawkular-Tenant': this.tenant, 'Authorization': 'Bearer ' + this.token}
    }).then(result => {
      return _.map(result.data, metric => {
        return {text: metric.id, value: metric.id};
      });
    });
  }
}
