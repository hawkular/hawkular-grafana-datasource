'use strict';

System.register([], function (_export, _context) {
  "use strict";

  var _createClass, QueryProcessor;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [],
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

      _export('QueryProcessor', QueryProcessor = function () {
        function QueryProcessor(q, backendSrv, variables, url, baseHeaders) {
          _classCallCheck(this, QueryProcessor);

          this.q = q;
          this.backendSrv = backendSrv;
          this.variables = variables;
          this.url = url;
          this.baseHeaders = baseHeaders;
        }

        _createClass(QueryProcessor, [{
          key: 'run',
          value: function run(target, options) {
            var _this = this;

            if (target.queryBy === 'ids') {
              var metricIds = this.variables.resolve(target.target, options);
              return this.rawQuery(target, options.range, metricIds).then(function (response) {
                return _this.processRawResponse(target, response);
              });
            } else {
              if (target.tags.length === 0) {
                return this.q.when([]);
              }
              var strTags = this.hawkularFormatTags(target.tags, options);
              return this.rawQueryByTags(target, options.range, strTags).then(function (response) {
                return _this.processRawResponse(target, response);
              });
            }
          }
        }, {
          key: 'hawkularFormatTags',
          value: function hawkularFormatTags(tags, options) {
            var _this2 = this;

            return tags.map(function (tag) {
              var value;
              if (tag.value === ' *') {
                // '*' character get a special treatment in grafana so we had to use ' *' instead
                value = '*';
              } else {
                value = _this2.variables.resolve(tag.value, options).join('|');
              }
              return tag.name + ':' + value;
            }).join(',');
          }
        }, {
          key: 'rawQuery',
          value: function rawQuery(target, range, metricIds) {
            var uri = [target.type + 's', // gauges or counters
            target.rate ? 'rate' : 'raw', // raw or rate
            'query'];
            var url = this.url + '/' + uri.join('/');

            return this.backendSrv.datasourceRequest({
              url: url,
              data: {
                ids: metricIds,
                start: range.from.valueOf(),
                end: range.to.valueOf()
              },
              method: 'POST',
              headers: this.baseHeaders
            }).then(function (response) {
              return response.status == 200 ? response.data : [];
            });
          }
        }, {
          key: 'rawQueryByTags',
          value: function rawQueryByTags(target, range, tags) {
            var uri = [target.type + 's', // gauges or counters
            target.rate ? 'rate' : 'raw', // raw or rate
            'query'];
            var url = this.url + '/' + uri.join('/');

            return this.backendSrv.datasourceRequest({
              url: url,
              data: {
                tags: tags,
                start: range.from.valueOf(),
                end: range.to.valueOf()
              },
              method: 'POST',
              headers: this.baseHeaders
            }).then(function (response) {
              return response.status == 200 ? response.data : [];
            });
          }
        }, {
          key: 'processRawResponse',
          value: function processRawResponse(target, response) {
            var datapoints = function datapoints(timeSerie) {
              return timeSerie.data.map(function (point) {
                return [point.value, point.timestamp];
              });
            };
            return response.map(function (timeSerie) {
              return {
                refId: target.refId,
                target: timeSerie.id,
                datapoints: datapoints(timeSerie)
              };
            });
          }
        }]);

        return QueryProcessor;
      }());

      _export('QueryProcessor', QueryProcessor);
    }
  };
});
//# sourceMappingURL=queryProcessor.js.map
