'use strict';

System.register(['lodash'], function (_export, _context) {
  "use strict";

  var _, _createClass, GenericDatasource;

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

      _export('GenericDatasource', GenericDatasource = function () {
        function GenericDatasource(instanceSettings, $q, backendSrv) {
          _classCallCheck(this, GenericDatasource);

          this.type = instanceSettings.type;
          this.url = instanceSettings.url;
          this.name = instanceSettings.name;
          this.tenant = instanceSettings.jsonData.tenant;
          this.q = $q;
          this.backendSrv = backendSrv;
        }

        _createClass(GenericDatasource, [{
          key: 'query',
          value: function query(options) {
            var _this = this;

            var promises = _.chain(options.targets).filter(function (target) {
              return !target.hide;
            }).filter(function (target) {
              return target.target !== 'select metric';
            }).map(function (target) {

              var uri = [];
              uri.push(target.type + 's'); // gauges or counter
              uri.push(encodeURIComponent(target.target).replace('+', '%20')); // metric name
              uri.push(target.rate ? 'rate' : 'raw'); // raw or rate

              var url = _this.url + '/' + uri.join('/');

              return _this.backendSrv.datasourceRequest({
                url: url,
                params: { start: options.range.from.valueOf(), end: options.range.to.valueOf() },
                method: 'GET',
                headers: { 'Content-Type': 'application/json', 'Hawkular-Tenant': _this.tenant }

              });
            }).value();

            if (promises.length <= 0) {
              return this.q.when({ data: [] });
            }

            return this.q.all(promises).then(function (responses) {
              var result = _.map(responses, function (response, index) {
                var datapoints = _.map(response.data, function (point) {
                  return [point.value, point.timestamp];
                });
                return {
                  target: options.targets[index].target,
                  datapoints: datapoints
                };
              });
              return { data: result };
            });
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
              headers: { 'Content-Type': 'application/json', 'Hawkular-Tenant': this.tenant }
            }).then(function (result) {
              return _.map(result.data, function (metric) {
                return { text: metric.id, value: metric.id };
              });
            });
          }
        }]);

        return GenericDatasource;
      }());

      _export('GenericDatasource', GenericDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
