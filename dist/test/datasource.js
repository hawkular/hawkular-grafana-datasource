'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GenericDatasource = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GenericDatasource = exports.GenericDatasource = function () {
  function GenericDatasource(instanceSettings, $q, backendSrv) {
    _classCallCheck(this, GenericDatasource);

    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.tenant = instanceSettings.jsonData.tenant;
    this.token = instanceSettings.jsonData.token;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.queryFunc = this.selectQueryFunc();
  }

  _createClass(GenericDatasource, [{
    key: 'query',
    value: function query(options) {
      var _this = this;

      var targets = _lodash2.default.chain(options.targets).filter(function (target) {
        return !target.hide;
      }).filter(function (target) {
        return target.target !== 'select metric';
      }).value();

      if (targets.length == 0) {
        return this.q.when({ data: [] });
      }

      var start = options.range.from.valueOf();
      var end = options.range.to.valueOf();

      var promises = _lodash2.default.map(targets, function (target) {
        return _this.queryFunc.then(function (func) {
          return func.call(_this, target, start, end);
        });
      });

      return this.q.all(promises).then(function (result) {
        return { data: result };
      });
    }
  }, {
    key: 'getData',
    value: function getData(target, start, end) {
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
      }).then(function (response) {
        var datapoints;
        if (response.data.length != 0) {
          datapoints = _lodash2.default.map(response.data[0].data, function (point) {
            return [point.value, point.timestamp];
          });
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
  }, {
    key: 'getDataLegacy',
    value: function getDataLegacy(target, start, end) {
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
      }).then(function (response) {
        var datapoints;
        if (!target.rate) {
          datapoints = _lodash2.default.map(response.data, function (point) {
            return [point.value, point.timestamp];
          });
        } else {
          var sortedData = response.data.sort(function (p1, p2) {
            return p1.timestamp - p2.timestamp;
          });
          datapoints = _lodash2.default.chain(sortedData).zip(sortedData.slice(1)).filter(function (pair) {
            return pair[1] // Exclude the last pair
             && (target.type == 'gauge' || pair[0].value <= pair[1].value); // Exclude counter resets
          }).map(function (pair) {
            var point1 = pair[0],
                point2 = pair[1];
            var timestamp = point2.timestamp;
            var value_diff = point2.value - point1.value;
            var time_diff = point2.timestamp - point1.timestamp;
            var rate = 60000 * value_diff / time_diff;
            return [rate, timestamp];
          }).value();
        }
        return {
          refId: target.refId,
          target: target.target,
          datapoints: datapoints
        };
      });
    }
  }, {
    key: 'createHeaders',
    value: function createHeaders() {
      var headers = {
        'Content-Type': 'application/json',
        'Hawkular-Tenant': this.tenant
      };
      if (typeof this.token === 'string' && this.token.length > 0) {
        headers.Authorization = 'Bearer ' + this.token;
      }
      return headers;
    }
  }, {
    key: 'testDatasource',
    value: function testDatasource() {
      return this.backendSrv.datasourceRequest({
        url: this.url + '/status',
        method: 'GET'
      }).then(function (response) {
        if (response.status === 200) {
          return { status: "success", message: "Data source is working", title: "Success" };
        }
      });
    }
  }, {
    key: 'annotationQuery',
    value: function annotationQuery(options) {
      return this.backendSrv.datasourceRequest({
        url: this.url + '/annotations',
        method: 'POST',
        data: options
      }).then(function (result) {
        return result.data;
      });
    }
  }, {
    key: 'metricFindQuery',
    value: function metricFindQuery(options) {
      return this.backendSrv.datasourceRequest({
        url: this.url + '/metrics',
        params: { type: options.type },
        method: 'GET',
        headers: this.createHeaders()
      }).then(function (result) {
        return _lodash2.default.map(result.data, function (metric) {
          return { text: metric.id, value: metric.id };
        });
      });
    }
  }, {
    key: 'selectQueryFunc',
    value: function selectQueryFunc() {
      var _this2 = this;

      return this.backendSrv.datasourceRequest({
        url: this.url + '/status',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }).then(function (response) {
        var version = response.data['Implementation-Version'];
        var regExp = new RegExp('([0-9]+)\.([0-9]+)\.(.+)');
        if (version.match(regExp)) {
          var versionInfo = regExp.exec(version);
          var major = versionInfo[1];
          var minor = versionInfo[2];
          if (major == 0) {
            if (minor < 17) {
              return _this2.getDataLegacy;
            }
          }
        }
        return _this2.getData;
      }).catch(function (response) {
        return _this2.getData;
      });
    }
  }]);

  return GenericDatasource;
}();
//# sourceMappingURL=datasource.js.map
