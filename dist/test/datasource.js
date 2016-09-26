'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HawkularDatasource = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _variables = require('./variables');

var _capabilities = require('./capabilities');

var _queryProcessor = require('./queryProcessor');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HawkularDatasource = exports.HawkularDatasource = function () {
  function HawkularDatasource(instanceSettings, $q, backendSrv, templateSrv) {
    _classCallCheck(this, HawkularDatasource);

    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.tenant = instanceSettings.jsonData.tenant;
    this.token = instanceSettings.jsonData.token;
    this.q = $q;
    this.backendSrv = backendSrv;
    var variables = new _variables.Variables(templateSrv);
    var capabilities = this.queryVersion().then(function (version) {
      return new _capabilities.Capabilities(version);
    });
    this.queryProcessor = new _queryProcessor.QueryProcessor($q, backendSrv, variables, capabilities, this.url, this.createHeaders());
  }

  _createClass(HawkularDatasource, [{
    key: 'query',
    value: function query(options) {
      var _this = this;

      var validTargets = options.targets.filter(function (target) {
        return !target.hide;
      }).filter(function (target) {
        return target.target !== 'select metric';
      });

      if (validTargets.length === 0) {
        return this.q.when({ data: [] });
      }

      var promises = validTargets.map(function (target) {
        return _this.queryProcessor.run(target, options);
      });

      return this.q.all(promises).then(function (responses) {
        var flatten = [].concat.apply([], responses);
        return { data: flatten };
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
    key: 'suggestQueries',
    value: function suggestQueries(target) {
      return this.backendSrv.datasourceRequest({
        url: this.url + '/metrics?type=' + target.type,
        method: 'GET',
        headers: this.createHeaders()
      }).then(function (result) {
        return _lodash2.default.map(result.data, function (metric) {
          return { text: metric.id, value: metric.id };
        });
      });
    }
  }, {
    key: 'suggestTags',
    value: function suggestTags(type, key) {
      if (!key) {
        // Need at least some characters typed in order to suggest something
        return this.q.when([]);
      }
      return this.backendSrv.datasourceRequest({
        url: this.url + '/' + type + 's/tags/' + key + ':*',
        method: 'GET',
        headers: this.createHeaders()
      }).then(function (result) {
        if (result.data.hasOwnProperty(key)) {
          return [' *'].concat(result.data[key]).map(function (value) {
            return { text: value, value: value };
          });
        }
        return [];
      });
    }
  }, {
    key: 'metricFindQuery',
    value: function metricFindQuery(query) {
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
      }).then(function (result) {
        return _lodash2.default.map(result.data, function (metric) {
          return { text: metric.id, value: metric.id };
        });
      });
    }
  }, {
    key: 'findTags',
    value: function findTags(pattern) {
      return this.backendSrv.datasourceRequest({
        url: this.url + '/metrics/tags/' + pattern,
        method: 'GET',
        headers: this.createHeaders()
      }).then(function (result) {
        var flatTags = [];
        if (result.data) {
          var data = result.data;
          for (var property in data) {
            if (data.hasOwnProperty(property)) {
              flatTags = flatTags.concat(data[property]);
            }
          }
        }
        return flatTags.map(function (tag) {
          return { text: tag, value: tag };
        });
      });
    }
  }, {
    key: 'queryVersion',
    value: function queryVersion() {
      return this.backendSrv.datasourceRequest({
        url: this.url + '/status',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }).then(function (response) {
        return response.data['Implementation-Version'];
      }).catch(function (response) {
        return "Unknown";
      });
    }
  }]);

  return HawkularDatasource;
}();
//# sourceMappingURL=datasource.js.map
