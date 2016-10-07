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
        function QueryProcessor(q, backendSrv, variables, capabilities, url, baseHeaders) {
          _classCallCheck(this, QueryProcessor);

          this.q = q;
          this.backendSrv = backendSrv;
          this.variables = variables;
          this.capabilities = capabilities;
          this.url = url;
          this.baseHeaders = baseHeaders;
        }

        _createClass(QueryProcessor, [{
          key: 'run',
          value: function run(target, options) {
            var _this = this;

            return this.capabilities.then(function (caps) {
              if (target.queryBy === 'ids') {
                var metricIds = _this.variables.resolve(target.target, options);
                if (caps.QUERY_POST_ENDPOINTS) {
                  return _this.rawQuery(target, options.range, metricIds);
                } else {
                  return _this.rawQueryLegacy(target, options.range, metricIds);
                }
              } else {
                if (target.tags.length === 0) {
                  return _this.q.when([]);
                }
                var strTags = _this.hawkularFormatTags(target.tags, options);
                return _this.rawQueryByTags(target, options.range, strTags);
              }
            });
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
            var _this3 = this;

            var uri = [target.type + 's', // gauges or counters
            target.rate ? 'rate' : 'raw', // raw or rate
            'query'];
            var url = this.url + '/' + uri.join('/');

            return this.backendSrv.datasourceRequest({
              url: url,
              data: {
                ids: metricIds,
                start: range.from.valueOf(),
                end: range.to.valueOf(),
                order: 'ASC'
              },
              method: 'POST',
              headers: this.baseHeaders
            }).then(function (response) {
              return _this3.processRawResponse(target, response.status == 200 ? response.data : []);
            });
          }
        }, {
          key: 'rawQueryLegacy',
          value: function rawQueryLegacy(target, range, metricIds) {
            var _this4 = this;

            return this.q.all(metricIds.map(function (metric) {
              var uri = [target.type + 's', // gauges or counters
              encodeURIComponent(metric).replace('+', '%20'), // metric name
              'data'];
              var url = _this4.url + '/' + uri.join('/');

              return _this4.backendSrv.datasourceRequest({
                url: url,
                params: {
                  start: range.from.valueOf(),
                  end: range.to.valueOf()
                },
                method: 'GET',
                headers: _this4.baseHeaders
              }).then(function (response) {
                return _this4.processRawResponseLegacy(target, metric, response.status == 200 ? response.data : []);
              });
            }));
          }
        }, {
          key: 'rawQueryByTags',
          value: function rawQueryByTags(target, range, tags) {
            var _this5 = this;

            var uri = [target.type + 's', // gauges or counters
            target.rate ? 'rate' : 'raw', // raw or rate
            'query'];
            var url = this.url + '/' + uri.join('/');

            return this.backendSrv.datasourceRequest({
              url: url,
              data: {
                tags: tags,
                start: range.from.valueOf(),
                end: range.to.valueOf(),
                order: 'ASC'
              },
              method: 'POST',
              headers: this.baseHeaders
            }).then(function (response) {
              return _this5.processRawResponse(target, response.status == 200 ? response.data : []);
            });
          }
        }, {
          key: 'processRawResponse',
          value: function processRawResponse(target, data) {
            return data.map(function (timeSerie) {
              return {
                refId: target.refId,
                target: timeSerie.id,
                datapoints: timeSerie.data.map(function (point) {
                  return [point.value, point.timestamp];
                })
              };
            });
          }
        }, {
          key: 'processRawResponseLegacy',
          value: function processRawResponseLegacy(target, metric, data) {
            var datapoints;
            if (!target.rate) {
              datapoints = _.map(data, function (point) {
                return [point.value, point.timestamp];
              });
            } else {
              var sortedData = data.sort(function (p1, p2) {
                return p1.timestamp - p2.timestamp;
              });
              datapoints = _.chain(sortedData).zip(sortedData.slice(1)).filter(function (pair) {
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
              target: metric,
              datapoints: datapoints
            };
          }
        }]);

        return QueryProcessor;
      }());

      _export('QueryProcessor', QueryProcessor);
    }
  };
});
//# sourceMappingURL=queryProcessor.js.map
