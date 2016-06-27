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
  }

  _createClass(GenericDatasource, [{
    key: 'query',
    value: function query(options) {
      var _this = this;

      var promises = _lodash2.default.chain(options.targets).filter(function (target) {
        return !target.hide;
      }).filter(function (target) {
        return target.target !== 'select metric';
      }).map(function (target) {

        var uri = [];
        uri.push(target.type + 's'); // gauges or counters
        uri.push(target.rate ? 'rate' : 'raw'); // raw or rate
        uri.push('query');

        var url = _this.url + '/' + uri.join('/');

        return _this.backendSrv.datasourceRequest({
          url: url,
          data: {
            ids: [target.target],
            start: options.range.from.valueOf(),
            end: options.range.to.valueOf()
          },
          method: 'POST',
          headers: _this.createHeaders()
        }).then(function (response) {
          return {
            refId: target.refId,
            target: target.target,
            response: response
          };
        });
      }).value();

      if (promises.length <= 0) {
        return this.q.when({ data: [] });
      }

      return this.q.all(promises).then(function (richResponses) {
        var result = _lodash2.default.map(richResponses, function (richResponse) {
          var response = richResponse.response;
          var datapoints;
          if (response.data.length != 0) {
            datapoints = _lodash2.default.map(response.data[0].data, function (point) {
              return [point.value, point.timestamp];
            });
          } else {
            datapoints = [];
          }
          return {
            refId: richResponse.refId,
            target: richResponse.target,
            datapoints: datapoints
          };
        });
        return { data: result };
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
  }]);

  return GenericDatasource;
}();
//# sourceMappingURL=datasource.js.map
