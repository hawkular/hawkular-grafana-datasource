import _ from "lodash";

export class GenericDatasource {

  constructor(instanceSettings, $q, backendSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.tenant = instanceSettings.jsonData.tenant;
    this.token = instanceSettings.jsonData.token;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.queryFunc = this.selectQueryFunc();
  }

  query(options) {
    var targets = _.chain(options.targets)
      .filter(target => !target.hide)
      .filter(target => target.target !== 'select metric')
      .value();

    if (targets.length == 0) {
      return this.q.when({data: []});
    }

    var start = options.range.from.valueOf();
    var end = options.range.to.valueOf();

    var promises = _.map(targets, target => this.queryFunc.then(func => func.call(this, target, start, end)));

    return this.q.all(promises).then(result => {
      return {data: result};
    });
  }

  getData(target, start, end) {
    var uri = [];
    uri.push(target.type + 's'); // gauges or counters
    uri.push(target.rate ? 'rate' : 'raw'); // raw or rate
    uri.push('query');

    var url = this.url + '/' + uri.join('/');

    return this.backendSrv.datasourceRequest({
      url: url,
      data: {
        ids: [target.target],
        start: start,
        end: end
      },
      method: 'POST',
      headers: this.createHeaders()
    }).then(response => {
      var datapoints;
      if (response.data.length != 0) {
        datapoints = _.map(response.data[0].data, point => [point.value, point.timestamp]);
      } else {
        datapoints = [];
      }
      return {
        refId: target.refId,
        target: target.target,
        datapoints: datapoints
      };
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

  selectQueryFunc() {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/status',
      method: 'GET',
      headers: {'Content-Type': 'application/json'}
    }).then(response => {
      var version = response.data['Implementation-Version'];
      var regExp = new RegExp('([0-9]+)\.([0-9]+)\.(.+)');
      if (version.match(regExp)) {
        var versionInfo = regExp.exec(version);
        var major = versionInfo[1];
        var minor = versionInfo[2];
        if (major == 0) {
          if (minor < 17) {
            return this.getDataLegacy;
          }
        }
      }
      return this.getData;
    }).catch(response => this.getData);
  }
}
