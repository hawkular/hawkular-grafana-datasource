import {modelToString as tagsModelToString} from './tagsKVPairsController';

const STATS_BUCKETS = 60;

export class QueryProcessor {

  constructor(q, backendSrv, variablesHelper, capabilities, url, headers, typeResources) {
    this.q = q;
    this.backendSrv = backendSrv;
    this.variablesHelper = variablesHelper;
    this.capabilities = capabilities;
    this.url = url;
    this.headers = headers;
    this.typeResources = typeResources;
    this.numericMapping = point => [point.value, point.timestamp];
    this.availMapping = point => [point.value == 'up' ? 1 : 0, point.timestamp];
  }

  run(target, options) {
    return this.capabilities.then(caps => {
      let postData = {
        start: options.range.from.valueOf(),
        end: options.range.to.valueOf(),
        order: 'ASC'
      };
      let multipleMetrics = true;
      if (target.id) {
        const metricIds = this.variablesHelper.resolve(target.id, options);
        if (caps.QUERY_POST_ENDPOINTS) {
          if (target.raw) {
            postData.ids = metricIds;
            return this.rawQuery(target, postData);
          } else if (target.timeAggFn == 'live') {
            // Need to change postData
            return this.singleStatLiveQuery(target, {ids: metricIds, limit: 1});
          } else if (target.timeAggFn) {
            // Query single stat
            postData.metrics = metricIds;
            return this.singleStatQuery(target, postData);
          } else {
            // Query stats for chart
            postData.metrics = metricIds;
            return this.statsQuery(target, postData);
          }
        } else {
          return this.rawQueryLegacy(target, options.range, metricIds);
        }
      } else {
        if (caps.TAGS_QUERY_LANGUAGE) {
          if (target.tagsQL !== undefined && target.tagsQL.length > 0) {
            postData.tags = this.variablesHelper.resolveForQL(target.tagsQL, options);
          } else {
            return this.q.when([]);
          }
        } else {
          if (target.tags !== undefined && target.tags.length > 0) {
            postData.tags = tagsModelToString(target.tags, this.variablesHelper, options);
          } else {
            return this.q.when([]);
          }
        }
        if (target.raw) {
          return this.rawQuery(target, postData);
        } else if (target.timeAggFn == 'live') {
          // Need to change postData
          return this.singleStatLiveQuery(target, {tags: postData.tags, limit: 1});
        } else if (target.timeAggFn) {
          // Query single stat
          return this.singleStatQuery(target, postData);
        } else {
          // Query stats for chart
          return this.statsQuery(target, postData);
        }
      }
    });
  }

  rawQuery(target, postData) {
    const uri = [
      this.typeResources[target.type],   // gauges or counters
      target.rate ? 'rate' : 'raw', // raw or rate
      'query'
    ];
    const url = this.url + '/' + uri.join('/');

    return this.backendSrv.datasourceRequest({
      url: url,
      data: postData,
      method: 'POST',
      headers: this.headers
    }).then(response => this.processRawResponse(target, response.status == 200 ? response.data : []));
  }

  rawQueryLegacy(target, range, metricIds) {
    return this.q.all(metricIds.map(metric => {
      const uri = [
        this.typeResources[target.type],  // gauges, counters or availability
        encodeURIComponent(metric).replace('+', '%20'), // metric name
        'data'];
      const url = this.url + '/' + uri.join('/');

      return this.backendSrv.datasourceRequest({
        url: url,
        params: {
          start: range.from.valueOf(),
          end: range.to.valueOf()
        },
        method: 'GET',
        headers: this.headers
      }).then(response => this.processRawResponseLegacy(target, metric, response.status == 200 ? response.data : []));
    }));
  }

  processRawResponse(target, data) {
    return data.map(timeSerie => {
      return {
        refId: target.refId,
        target: timeSerie.id,
        datapoints: timeSerie.data.map(target.type == 'availability' ? this.availMapping : this.numericMapping)
      };
    });
  }

  processRawResponseLegacy(target, metric, data) {
    let datapoints;
    if (target.type == 'availability') {
      datapoints = data.map(this.availMapping);
    } else if (!target.rate) {
      datapoints = data.map(this.numericMapping);
    } else {
      let sortedData = data.sort((p1, p2)=> p1.timestamp - p2.timestamp);
      datapoints = _.chain(sortedData)
        .zip(sortedData.slice(1))
        .filter(pair => {
          return pair[1] // Exclude the last pair
            && (target.type != 'counter' || pair[0].value <= pair[1].value); // Exclude counter resets
        })
        .map(pair => {
          let point1 = pair[0], point2 = pair[1];
          let timestamp = point2.timestamp;
          let value_diff = point2.value - point1.value;
          let time_diff = point2.timestamp - point1.timestamp;
          let rate = 60000 * value_diff / time_diff;
          return [rate, timestamp];
        })
        .value();
    }
    return {
      refId: target.refId,
      target: metric,
      datapoints: datapoints
    };
  }

  statsQuery(target, postData) {
    if (target.seriesAggFn === 'none') {
      return this.statsQueryUnmerged(target, postData);
    }
    const url = `${this.url}/${this.typeResources[target.type]}/stats/query`;
    delete postData.order;
    postData.buckets = STATS_BUCKETS;
    postData.stacked = target.seriesAggFn === 'sum';
    const percentiles = this.getPercentilesToQuery(target.stats);
    if (percentiles.length > 0) {
      postData.percentiles = percentiles.join(',');
    }
    return this.backendSrv.datasourceRequest({
      url: url,
      data: postData,
      method: 'POST',
      headers: this.headers
    }).then(response => this.processStatsResponse(target, response.status == 200 ? response.data : []));
  }

  processStatsResponse(target, data) {
    // Response example: [{start:1234, end:5678, avg:100.0, min:90.0, max:110.0, (...), percentiles:[{value: 105.0, (...)}]}]
    return target.stats.map(stat => {
      const percentile = this.getPercentileValue(stat);
      if (percentile) {
        return {
          refId: target.refId,
          target: stat,
          datapoints: data.filter(bucket => !bucket.empty)
            .map(bucket => [this.findQuantileInBucket(percentile, bucket), bucket.start])
        };
      } else {
        return {
          refId: target.refId,
          target: stat,
          datapoints: data.filter(bucket => !bucket.empty).map(bucket => [bucket[stat], bucket.start])
        };
      }
    });
  }

  statsQueryUnmerged(target, postData) {
    const url = `${this.url}/metrics/stats/query`;
    delete postData.order;
    postData.buckets = STATS_BUCKETS;
    postData.types = [target.type];
    if (postData.metrics) {
      const metricsPerType = {};
      metricsPerType[target.type] = postData.metrics;
      postData.metrics = metricsPerType;
    }
    const percentiles = this.getPercentilesToQuery(target.stats);
    if (percentiles.length > 0) {
      postData.percentiles = percentiles.join(',');
    }
    return this.backendSrv.datasourceRequest({
      url: url,
      data: postData,
      method: 'POST',
      headers: this.headers
    }).then(response => this.processUnmergedStatsResponse(target, response.status == 200 ? response.data : []));
  }

  processUnmergedStatsResponse(target, data) {
    // Response example:
    // {"gauge": {"my_metric": [
    //    {start:1234, end:5678, avg:100.0, min:90.0, max:110.0, (...), percentiles:[{value: 105.0, (...)}]}
    // ]}}
    const series = [];
    const allMetrics = data[target.type];
    for (let metricId in allMetrics) {
      if (allMetrics.hasOwnProperty(metricId)) {
        const buckets = allMetrics[metricId];
        target.stats.forEach(stat => {
          const percentile = this.getPercentileValue(stat);
          if (percentile) {
            series.push({
              refId: target.refId,
              target: `${metricId} [${stat}]`,
              datapoints: buckets.filter(bucket => !bucket.empty)
                .map(bucket => [this.findQuantileInBucket(percentile, bucket), bucket.start])
            });
          } else {
            series.push({
              refId: target.refId,
              target: `${metricId} [${stat}]`,
              datapoints: buckets.filter(bucket => !bucket.empty).map(bucket => [bucket[stat], bucket.start])
            });
          }
        });
      }
    }
    return series;
  }

  getPercentilesToQuery(stats) {
    return stats.map(this.getPercentileValue).filter(perc => perc != null);
  }

  getPercentileValue(percentileName) {
    const idx = percentileName.indexOf(' %ile');
    return (idx >= 0) ? percentileName.substring(0, idx) : null;
  }

  findQuantileInBucket(quantile, bucket) {
    if (bucket.percentiles) {
      const percObj = bucket.percentiles.find(p => p.quantile.toString().indexOf(quantile) >= 0);
      if (percObj) {
        return percObj.value;
      }
    }
    return null;
  }

  singleStatQuery(target, postData) {
    // Query for singlestat => we just ask for a single bucket
    // But because of that we need to override Grafana behaviour, and manage ourselves the min/max/avg/etc. selection
    let fnBucket;
    if (target.timeAggFn == 'avg') {
      fnBucket = bucket => bucket.avg;
    } else if (target.timeAggFn == 'min') {
      fnBucket = bucket => bucket.min;
    } else if (target.timeAggFn == 'max') {
      fnBucket = bucket => bucket.max;
    } // no else case. "live" case was handled before
    const url = this.url + '/' + this.typeResources[target.type] + '/stats/query';
    delete postData.order;
    postData.buckets = 1;
    postData.stacked = target.seriesAggFn === 'sum';
    return this.backendSrv.datasourceRequest({
      url: url,
      data: postData,
      method: 'POST',
      headers: this.headers
    }).then(response => this.processSingleStatResponse(target, fnBucket, response.status == 200 ? response.data : []));
  }

  processSingleStatResponse(target, fnBucket, data) {
    return data.map(bucket => {
      return {
        refId: target.refId,
        target: "Aggregate",
        datapoints: [[fnBucket(bucket), bucket.start]]
      };
    });
  }

  singleStatLiveQuery(target, postData) {
    const uri = [
      this.typeResources[target.type], // gauges, counters or availability
      target.rate ? 'rate' : 'raw', // raw or rate
      'query'
    ];
    const url = this.url + '/' + uri.join('/');
    // Set start to now - 5m
    postData.start = Date.now() - 300000;
    return this.backendSrv.datasourceRequest({
      url: url,
      data: postData,
      method: 'POST',
      headers: this.headers
    }).then(response => this.processSingleStatLiveResponse(target, response.status == 200 ? response.data : []));
  }

  processSingleStatLiveResponse(target, data) {
    let reduceFunc;
    if (target.seriesAggFn === 'sum') {
      reduceFunc = (presentValues => presentValues.reduce((a,b) => a+b));
    } else {
      reduceFunc = (presentValues => presentValues.reduce((a,b) => a+b) / presentValues.length);
    }
    let datapoints;
    const latestPoints = data.filter(timeSeries => timeSeries.data.length > 0)
        .map(timeSeries => timeSeries.data[0]);
    if (latestPoints.length === 0) {
      datapoints = [];
    } else {
      datapoints = [[reduceFunc(latestPoints.map(dp => dp.value)), latestPoints[0].timestamp]];
    }
    return [{
      refId: target.refId,
      target: "Aggregate",
      datapoints: datapoints
    }];
  }
}
