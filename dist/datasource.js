'use strict';

System.register(['lodash'], function (_export, _context) {
  "use strict";

  var _, _createClass, HawkularDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('HawkularDatasource', HawkularDatasource = function () {
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
        }

        _createClass(HawkularDatasource, [{
          key: 'query',
          value: function query(options) {
            var _this = this;

            var promises = _.chain(options.targets).filter(function (target) {
              return !target.hide;
            }).filter(function (target) {
              return target.target !== 'select metric';
            }).map(function (target) {

              var uri = [];
              var metricIds = _this.resolveVariables(target.target);
              uri.push(target.type + 's'); // gauges or counters
              uri.push(target.rate ? 'rate' : 'raw'); // raw or rate
              uri.push('query');

              var url = _this.url + '/' + uri.join('/');

              return _this.backendSrv.datasourceRequest({
                url: url,
                data: {
                  ids: metricIds,
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
              var result = _.map(richResponses, function (richResponse) {
                return {
                  refId: richResponse.refId,
                  target: richResponse.target,
                  // The javascript's flatMap
                  datapoints: [].concat.apply([], richResponse.response.data.map(function (d) {
                    return d.data;
                  })).map(function (point) {
                    return [point.value, point.timestamp];
                  })
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
              return _.map(result.data, function (metric) {
                return { text: metric.id, value: metric.id };
              });
            });
          }
        }, {
          key: 'resolveVariables',
          value: function resolveVariables(target) {
            var result = this.templateSrv.replace(target, this.templateSrv.variables);
            // result might be in like "{id1,id2,id3}" (as string)
            if (result.startsWith('{')) {
              return result.substring(1, result.length - 1).split(',');
            }
            return [result];
          }
        }]);

        return HawkularDatasource;
      }());

      _export('HawkularDatasource', HawkularDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
