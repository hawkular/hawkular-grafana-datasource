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
        function QueryProcessor(q, backendSrv, variables, capabilities, url, baseHeaders, typeResources) {
          _classCallCheck(this, QueryProcessor);

          this.q = q;
          this.backendSrv = backendSrv;
          this.variables = variables;
          this.capabilities = capabilities;
          this.url = url;
          this.baseHeaders = baseHeaders;
          this.typeResources = typeResources;
          this.numericMapping = function (point) {
            return [point.value, point.timestamp];
          };
          this.availMapping = function (point) {
            return [point.value == 'up' ? 1 : 0, point.timestamp];
          };
        }

        _createClass(QueryProcessor, [{
          key: 'run',
          value: function run(target, options) {
            var _this = this;

            return this.capabilities.then(function (caps) {
              var postData = {
                start: options.range.from.valueOf(),
                end: options.range.to.valueOf(),
                order: 'ASC'
              };
              var multipleMetrics = true;
              if (target.queryBy === 'ids') {
                var metricIds = _this.variables.resolve(target.target, options);
                if (caps.QUERY_POST_ENDPOINTS) {
                  if (!target.seriesAggFn || target.seriesAggFn === 'none') {
                    postData.ids = metricIds;
                    return _this.rawQuery(target, postData);
                  } else if (target.timeAggFn == 'live') {
                    // Need to change postData
                    return _this.singleStatLiveQuery(target, { ids: metricIds, limit: 1 });
                  } else {
                    // Need to perform multiple series aggregation
                    postData.metrics = metricIds;
                    return _this.singleStatQuery(target, postData);
                  }
                } else {
                  return _this.rawQueryLegacy(target, options.range, metricIds);
                }
              } else {
                if (target.tags.length === 0) {
                  return _this.q.when([]);
                }
                postData.tags = _this.hawkularFormatTags(target.tags, options);
                if (!target.seriesAggFn || target.seriesAggFn === 'none') {
                  return _this.rawQuery(target, postData);
                } else if (target.timeAggFn == 'live') {
                  // Need to change postData
                  return _this.singleStatLiveQuery(target, { tags: postData.tags, limit: 1 });
                } else {
                  // Need to perform multiple series aggregation
                  return _this.singleStatQuery(target, postData);
                }
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
          value: function rawQuery(target, postData) {
            var _this3 = this;

            var uri = [this.typeResources[target.type], // gauges or counters
            target.rate ? 'rate' : 'raw', // raw or rate
            'query'];
            var url = this.url + '/' + uri.join('/');

            return this.backendSrv.datasourceRequest({
              url: url,
              data: postData,
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
              var uri = [_this4.typeResources[target.type], // gauges, counters or availability
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
          key: 'processRawResponse',
          value: function processRawResponse(target, data) {
            var _this5 = this;

            return data.map(function (timeSerie) {
              return {
                refId: target.refId,
                target: timeSerie.id,
                datapoints: timeSerie.data.map(target.type == 'availability' ? _this5.availMapping : _this5.numericMapping)
              };
            });
          }
        }, {
          key: 'processRawResponseLegacy',
          value: function processRawResponseLegacy(target, metric, data) {
            var datapoints;
            if (target.type == 'availability') {
              datapoints = data.map(this.availMapping);
            } else if (!target.rate) {
              datapoints = data.map(this.numericMapping);
            } else {
              var sortedData = data.sort(function (p1, p2) {
                return p1.timestamp - p2.timestamp;
              });
              datapoints = _.chain(sortedData).zip(sortedData.slice(1)).filter(function (pair) {
                return pair[1] // Exclude the last pair
                && (target.type != 'counter' || pair[0].value <= pair[1].value); // Exclude counter resets
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
        }, {
          key: 'singleStatQuery',
          value: function singleStatQuery(target, postData) {
            var _this6 = this;

            // Query for singlestat => we just ask for a single bucket
            // But because of that we need to override Grafana behaviour, and manage ourselves the min/max/avg/etc. selection
            var fnBucket;
            if (target.timeAggFn == 'avg') {
              fnBucket = function fnBucket(bucket) {
                return bucket.avg;
              };
            } else if (target.timeAggFn == 'min') {
              fnBucket = function fnBucket(bucket) {
                return bucket.min;
              };
            } else if (target.timeAggFn == 'max') {
              fnBucket = function fnBucket(bucket) {
                return bucket.max;
              };
            } // no else case. "live" case was handled before
            var url = this.url + '/' + this.typeResources[target.type] + '/stats/query';
            delete postData.order;
            postData.buckets = 1;
            postData.stacked = target.seriesAggFn === 'sum';
            return this.backendSrv.datasourceRequest({
              url: url,
              data: postData,
              method: 'POST',
              headers: this.baseHeaders
            }).then(function (response) {
              return _this6.processSingleStatResponse(target, fnBucket, response.status == 200 ? response.data : []);
            });
          }
        }, {
          key: 'processSingleStatResponse',
          value: function processSingleStatResponse(target, fnBucket, data) {
            return data.map(function (bucket) {
              return {
                refId: target.refId,
                target: "Aggregate",
                datapoints: [[fnBucket(bucket), bucket.start]]
              };
            });
          }
        }, {
          key: 'singleStatLiveQuery',
          value: function singleStatLiveQuery(target, postData) {
            var _this7 = this;

            var uri = [this.typeResources[target.type], // gauges, counters or availability
            target.rate ? 'rate' : 'raw', // raw or rate
            'query'];
            var url = this.url + '/' + uri.join('/');
            // Set start to now - 5m
            postData.start = Date.now() - 300000;
            return this.backendSrv.datasourceRequest({
              url: url,
              data: postData,
              method: 'POST',
              headers: this.baseHeaders
            }).then(function (response) {
              return _this7.processSingleStatLiveResponse(target, response.status == 200 ? response.data : []);
            });
          }
        }, {
          key: 'processSingleStatLiveResponse',
          value: function processSingleStatLiveResponse(target, data) {
            var reduceFunc;
            if (target.seriesAggFn === 'sum') {
              reduceFunc = function reduceFunc(presentValues) {
                return presentValues.reduce(function (a, b) {
                  return a + b;
                });
              };
            } else {
              reduceFunc = function reduceFunc(presentValues) {
                return presentValues.reduce(function (a, b) {
                  return a + b;
                }) / presentValues.length;
              };
            }
            var datapoints;
            var latestPoints = data.filter(function (timeSeries) {
              return timeSeries.data.length > 0;
            }).map(function (timeSeries) {
              return timeSeries.data[0];
            });
            if (latestPoints.length === 0) {
              datapoints = [];
            } else {
              datapoints = [reduceFunc(latestPoints.map(function (dp) {
                return dp.value;
              })), latestPoints[0].timestamp];
            }
            return [{
              refId: target.refId,
              target: "Aggregate",
              datapoints: [datapoints]
            }];
          }
        }]);

        return QueryProcessor;
      }());

      _export('QueryProcessor', QueryProcessor);
    }
  };
});
//# sourceMappingURL=queryProcessor.js.map
