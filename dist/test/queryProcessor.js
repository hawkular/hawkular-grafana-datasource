'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.QueryProcessor = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _tagsKVPairsController = require('./tagsKVPairsController');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var STATS_BUCKETS = 60;

var QueryProcessor = exports.QueryProcessor = function () {
  function QueryProcessor(q, multiTenantsQuery, variablesHelper, capabilities, url, typeResources) {
    _classCallCheck(this, QueryProcessor);

    this.q = q;
    this.multiTenantsQuery = multiTenantsQuery;
    this.variablesHelper = variablesHelper;
    this.capabilities = capabilities;
    this.url = url;
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
        var tenants = [null];
        if (target.tenant) {
          tenants = _this.variablesHelper.resolve(target.tenant, options);
        }
        if (target.id) {
          var metricIds = _this.variablesHelper.resolve(target.id, options);
          if (caps.QUERY_POST_ENDPOINTS) {
            if (target.raw) {
              postData.ids = metricIds;
              return _this.rawQuery(target, postData, tenants);
            } else if (target.timeAggFn == 'live') {
              // Need to change postData
              return _this.singleStatLiveQuery(target, { ids: metricIds, limit: 1 }, tenants);
            } else if (target.timeAggFn) {
              // Query single stat
              postData.metrics = metricIds;
              return _this.singleStatQuery(target, postData, tenants);
            } else {
              // Query stats for chart
              postData.metrics = metricIds;
              return _this.statsQuery(target, postData, tenants);
            }
          } else {
            return _this.rawQueryLegacy(target, options.range, metricIds, tenants);
          }
        } else {
          if (caps.TAGS_QUERY_LANGUAGE) {
            if (target.tagsQL !== undefined && target.tagsQL.length > 0) {
              postData.tags = _this.variablesHelper.resolveForQL(target.tagsQL, options);
            } else {
              return _this.q.when([]);
            }
          } else {
            if (target.tags !== undefined && target.tags.length > 0) {
              postData.tags = (0, _tagsKVPairsController.modelToString)(target.tags, _this.variablesHelper, options);
            } else {
              return _this.q.when([]);
            }
          }
          if (target.raw) {
            return _this.rawQuery(target, postData, tenants);
          } else if (target.timeAggFn == 'live') {
            // Need to change postData
            return _this.singleStatLiveQuery(target, { tags: postData.tags, limit: 1 }, tenants);
          } else if (target.timeAggFn) {
            // Query single stat
            return _this.singleStatQuery(target, postData, tenants);
          } else {
            // Query stats for chart
            return _this.statsQuery(target, postData, tenants);
          }
        }
      });
    }
  }, {
    key: 'rawQuery',
    value: function rawQuery(target, postData, tenants) {
      var _this2 = this;

      var url = this.url + '/' + this.typeResources[target.type] + '/' + (target.rate ? 'rate' : 'raw') + '/query';
      return this.multiTenantsQuery(tenants, url, null, postData, 'POST').then(function (res) {
        return _this2.tenantsPrefixer(res);
      }).then(function (allSeries) {
        return _this2.processRawResponse(target, allSeries);
      });
    }
  }, {
    key: 'rawQueryLegacy',
    value: function rawQueryLegacy(target, range, metricIds, tenants) {
      var _this3 = this;

      return this.q.all(metricIds.map(function (metric) {
        var url = _this3.url + '/' + _this3.typeResources[target.type] + '/' + encodeURIComponent(metric).replace('+', '%20') + '/data';
        var params = {
          start: range.from.valueOf(),
          end: range.to.valueOf()
        };
        return _this3.multiTenantsQuery(tenants, url, params, null, 'GET').then(function (res) {
          return _this3.tenantsPrefixer(res);
        }).then(function (allSeries) {
          return _this3.processRawResponseLegacy(target, metric, allSeries);
        });
      }));
    }
  }, {
    key: 'processRawResponse',
    value: function processRawResponse(target, allSeries) {
      var _this4 = this;

      return allSeries.map(function (timeSerie) {
        return {
          refId: target.refId,
          target: timeSerie.prefix + timeSerie.id,
          datapoints: timeSerie.data.map(target.type == 'availability' ? _this4.availMapping : _this4.numericMapping)
        };
      });
    }
  }, {
    key: 'processRawResponseLegacy',
    value: function processRawResponseLegacy(target, metric, data) {
      var datapoints = void 0;
      if (target.type == 'availability') {
        datapoints = data.map(this.availMapping);
      } else if (!target.rate) {
        datapoints = data.map(this.numericMapping);
      } else {
        var sortedData = data.sort(function (p1, p2) {
          return p1.timestamp - p2.timestamp;
        });
        datapoints = _lodash2.default.chain(sortedData).zip(sortedData.slice(1)).filter(function (pair) {
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
    key: 'statsQuery',
    value: function statsQuery(target, postData, tenants) {
      var _this5 = this;

      if (target.seriesAggFn === 'none') {
        return this.statsQueryUnmerged(target, postData, tenants);
      }
      var url = this.url + '/' + this.typeResources[target.type] + '/stats/query';
      delete postData.order;
      postData.buckets = STATS_BUCKETS;
      postData.stacked = target.seriesAggFn === 'sum';
      var percentiles = this.getPercentilesToQuery(target.stats);
      if (percentiles.length > 0) {
        postData.percentiles = percentiles.join(',');
      }
      return this.multiTenantsQuery(tenants, url, null, postData, 'POST').then(function (multiTenantsData) {
        return _this5.processStatsResponse(target, multiTenantsData);
      });
    }
  }, {
    key: 'processStatsResponse',
    value: function processStatsResponse(target, multiTenantsData) {
      var _this6 = this;

      // Response example: [ { tenant: 't1', result: [...] }, { tenant: 't2', result: [...] } ]
      // Detailed `data[i].result`: [{start:1234, end:5678, avg:100.0, min:90.0, max:110.0, (...), percentiles:[{quantile: 90, value: 105.0}]}]
      var flatten = [];
      var prefixer = multiTenantsData.length > 1 ? function (tenant) {
        return '[' + tenant + '] ';
      } : function (tenant) {
        return '';
      };
      multiTenantsData.forEach(function (tenantData) {
        if (tenantData.result) {
          target.stats.forEach(function (stat) {
            var percentile = _this6.getPercentileValue(stat);
            if (percentile) {
              flatten.push({
                refId: target.refId,
                target: prefixer(tenantData.tenant) + stat,
                datapoints: tenantData.result.filter(function (bucket) {
                  return !bucket.empty;
                }).map(function (bucket) {
                  return [_this6.findQuantileInBucket(percentile, bucket), bucket.start];
                })
              });
            } else {
              flatten.push({
                refId: target.refId,
                target: prefixer(tenantData.tenant) + stat,
                datapoints: tenantData.result.filter(function (bucket) {
                  return !bucket.empty;
                }).map(function (bucket) {
                  return [bucket[stat], bucket.start];
                })
              });
            }
          });
        }
      });
      return flatten;
    }
  }, {
    key: 'statsQueryUnmerged',
    value: function statsQueryUnmerged(target, postData, tenants) {
      var _this7 = this;

      var url = this.url + '/metrics/stats/query';
      delete postData.order;
      postData.buckets = STATS_BUCKETS;
      postData.types = [target.type];
      if (postData.metrics) {
        var metricsPerType = {};
        metricsPerType[target.type] = postData.metrics;
        postData.metrics = metricsPerType;
      }
      var percentiles = this.getPercentilesToQuery(target.stats);
      if (percentiles.length > 0) {
        postData.percentiles = percentiles.join(',');
      }
      return this.multiTenantsQuery(tenants, url, null, postData, 'POST').then(function (multiTenantsData) {
        return _this7.processUnmergedStatsResponse(target, multiTenantsData);
      });
    }
  }, {
    key: 'processUnmergedStatsResponse',
    value: function processUnmergedStatsResponse(target, multiTenantsData) {
      var _this8 = this;

      // Response example: [ { tenant: 't1', result: {...} }, { tenant: 't2', result: {...} } ]
      // Detailed `data[i].result`:
      // {"gauge": {"my_metric": [
      //    {start:1234, end:5678, avg:100.0, min:90.0, max:110.0, (...), percentiles:[{quantile: 90, value: 105.0}]}
      // ]}}
      var series = [];
      var prefixer = multiTenantsData.length > 1 ? function (tenant) {
        return '[' + tenant + '] ';
      } : function (tenant) {
        return '';
      };
      multiTenantsData.forEach(function (tenantData) {
        if (tenantData.result) {
          (function () {
            var allMetrics = tenantData.result[target.type];
            var prefix = prefixer(tenantData.tenant);

            var _loop = function _loop(metricId) {
              if (allMetrics.hasOwnProperty(metricId)) {
                var buckets = allMetrics[metricId];
                target.stats.forEach(function (stat) {
                  var percentile = _this8.getPercentileValue(stat);
                  if (percentile) {
                    series.push({
                      refId: target.refId,
                      target: '' + prefix + metricId + ' [' + stat + ']',
                      datapoints: buckets.filter(function (bucket) {
                        return !bucket.empty;
                      }).map(function (bucket) {
                        return [_this8.findQuantileInBucket(percentile, bucket), bucket.start];
                      })
                    });
                  } else {
                    series.push({
                      refId: target.refId,
                      target: '' + prefix + metricId + ' [' + stat + ']',
                      datapoints: buckets.filter(function (bucket) {
                        return !bucket.empty;
                      }).map(function (bucket) {
                        return [bucket[stat], bucket.start];
                      })
                    });
                  }
                });
              }
            };

            for (var metricId in allMetrics) {
              _loop(metricId);
            }
          })();
        }
      });
      return series;
    }
  }, {
    key: 'getPercentilesToQuery',
    value: function getPercentilesToQuery(stats) {
      return stats.map(this.getPercentileValue).filter(function (perc) {
        return perc != null;
      });
    }
  }, {
    key: 'getPercentileValue',
    value: function getPercentileValue(percentileName) {
      var idx = percentileName.indexOf(' %ile');
      return idx >= 0 ? percentileName.substring(0, idx) : null;
    }
  }, {
    key: 'findQuantileInBucket',
    value: function findQuantileInBucket(quantile, bucket) {
      if (bucket.percentiles) {
        var percObj = bucket.percentiles.find(function (p) {
          return p.quantile.toString().indexOf(quantile) >= 0;
        });
        if (percObj) {
          return percObj.value;
        }
      }
      return null;
    }
  }, {
    key: 'singleStatQuery',
    value: function singleStatQuery(target, postData, tenants) {
      var _this9 = this;

      // Query for singlestat => we just ask for a single bucket
      // But because of that we need to override Grafana behaviour, and manage ourselves the min/max/avg/etc. selection
      var fnBucket = void 0;
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
      return this.multiTenantsQuery(tenants, url, null, postData, 'POST').then(function (multiTenantsData) {
        return _this9.processSingleStatResponse(target, fnBucket, multiTenantsData);
      });
    }
  }, {
    key: 'processSingleStatResponse',
    value: function processSingleStatResponse(target, fnBucket, multiTenantsData) {
      return _lodash2.default.flatten(multiTenantsData.map(function (tenantData) {
        if (tenantData.result) {
          return tenantData.result.map(function (bucket) {
            return {
              refId: target.refId,
              target: 'Aggregate',
              datapoints: [[fnBucket(bucket), bucket.start]]
            };
          });
        }
      }));
    }
  }, {
    key: 'singleStatLiveQuery',
    value: function singleStatLiveQuery(target, postData, tenants) {
      var _this10 = this;

      var url = this.url + '/' + this.typeResources[target.type] + '/' + (target.rate ? 'rate' : 'raw') + '/query';
      // Set start to now - 5m
      postData.start = Date.now() - 300000;
      return this.multiTenantsQuery(tenants, url, null, postData, 'POST').then(function (multiTenantsData) {
        return _this10.processSingleStatLiveResponse(target, multiTenantsData);
      });
    }
  }, {
    key: 'processSingleStatLiveResponse',
    value: function processSingleStatLiveResponse(target, multiTenantsData) {
      var reduceFunc = void 0;
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
      return _lodash2.default.flatten(multiTenantsData.map(function (tenantData) {
        if (tenantData.result) {
          var datapoints = void 0;
          var latestPoints = tenantData.result.filter(function (timeSeries) {
            return timeSeries.data.length > 0;
          }).map(function (timeSeries) {
            return timeSeries.data[0];
          });
          if (latestPoints.length === 0) {
            datapoints = [];
          } else {
            datapoints = [[reduceFunc(latestPoints.map(function (dp) {
              return dp.value;
            })), latestPoints[0].timestamp]];
          }
          return [{
            refId: target.refId,
            target: 'Aggregate',
            datapoints: datapoints
          }];
        }
      }));
    }
  }, {
    key: 'tenantsPrefixer',
    value: function tenantsPrefixer(allTenantTimeSeries) {
      // Exemple of input:
      // [ { tenant: 't1', result: [ {id: metricA, data: []} ] }, { tenant: 't2', result: [ {id: metricB, data: []} ] } ]
      var flatten = [];
      var prefixer = allTenantTimeSeries.length > 1 ? function (tenant) {
        return '[' + tenant + '] ';
      } : function (tenant) {
        return '';
      };
      allTenantTimeSeries.forEach(function (oneTenantTimeSeries) {
        if (oneTenantTimeSeries.result) {
          oneTenantTimeSeries.result.forEach(function (timeSeries) {
            timeSeries.prefix = prefixer(oneTenantTimeSeries.tenant);
            flatten.push(timeSeries);
          });
        }
      });
      return flatten;
    }
  }]);

  return QueryProcessor;
}();
//# sourceMappingURL=queryProcessor.js.map
