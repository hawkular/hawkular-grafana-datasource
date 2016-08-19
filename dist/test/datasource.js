'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HawkularDatasource = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _aggregations = require('./aggregations');

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
    this.templateSrv = templateSrv;
    this.aggregations = new _aggregations.Aggregations();
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
        return _this.queryOnTarget(target, options).then(function (response) {
          return _this.processResponse(target, response);
        });
      });

      return this.q.all(promises).then(function (responses) {
        var flatten = [].concat.apply([], responses);
        return { data: flatten };
      });
    }
  }, {
    key: 'queryOnTarget',
    value: function queryOnTarget(target, options) {
      var uri = [target.type + 's', // gauges or counters
      target.rate ? 'rate' : 'raw', // raw or rate
      'query'];
      var url = this.url + '/' + uri.join('/');
      var metricIds = this.resolveVariables(target.target, options.scopedVars || this.templateSrv.variables);

      return this.backendSrv.datasourceRequest({
        url: url,
        data: {
          ids: metricIds,
          start: options.range.from.valueOf(),
          end: options.range.to.valueOf()
        },
        method: 'POST',
        headers: this.createHeaders()
      }).then(function (response) {
        return {
          target: metricIds[0],
          hawkularJson: response.status == 200 ? response.data : []
        };
      });
    }
  }, {
    key: 'processResponse',
    value: function processResponse(target, response) {
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
      var multipleSeries = hawkularJson.length > 1;
      return hawkularJson.map(function (timeSerie) {
        return {
          refId: target.refId,
          target: multipleSeries ? timeSerie.id : response.target,
          datapoints: timeSerie.data.map(function (point) {
            return [point.value, point.timestamp];
          })
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
    key: 'resolveVariables',
    value: function resolveVariables(target, scopedVars) {
      var _this2 = this;

      var variables = target.match(/\$\w+/g);
      var resolved = [target];
      if (variables) {
        variables.forEach(function (v) {
          var values = _this2.getVarValues(v, scopedVars);
          var newResolved = [];
          values.forEach(function (val) {
            resolved.forEach(function (target) {
              newResolved.push(target.replace(v, val));
            });
          });
          resolved = newResolved;
        });
      }
      return resolved;
    }
  }, {
    key: 'getVarValues',
    value: function getVarValues(variable, scopedVars) {
      var values = this.templateSrv.replace(variable, scopedVars);
      // result might be in like "{id1,id2,id3}" (as string)
      if (values.startsWith('{')) {
        return values.substring(1, values.length - 1).split(',');
      }
      return [values];
    }
  }]);

  return HawkularDatasource;
}();
//# sourceMappingURL=datasource.js.map
