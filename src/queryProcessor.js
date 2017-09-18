import _ from 'lodash';
import {modelToString as tagsModelToString} from './tagsKVPairsController';

const STATS_BUCKETS = 60;

export class QueryProcessor {

  constructor(q, multiTenantsQuery, variablesHelper, capabilities, url, typeResources) {
    this.q = q;
    this.multiTenantsQuery = multiTenantsQuery;
    this.variablesHelper = variablesHelper;
    this.capabilities = capabilities;
    this.url = url;
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
      let tenants = [null];
      if (target.tenant) {
        tenants = this.variablesHelper.resolve(target.tenant, options);
      }
      if (target.id) {
        const metricIds = this.variablesHelper.resolve(target.id, options);
        if (caps.QUERY_POST_ENDPOINTS) {
          if (target.raw) {
            postData.ids = metricIds;
            return this.rawQuery(target, postData, tenants);
          } else if (target.timeAggFn == 'live') {
            // Need to change postData
            return this.singleStatLiveQuery(target, {ids: metricIds, limit: 1}, tenants);
          } else if (target.timeAggFn) {
            // Query single stat
            postData.metrics = metricIds;
            return this.singleStatQuery(target, postData, tenants);
          } else {
            // Query stats for chart
            postData.metrics = metricIds;
            return this.statsQuery(target, postData, tenants);
          }
        } else {
          return this.rawQueryLegacy(target, options.range, metricIds, tenants);
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
          return this.rawQuery(target, postData, tenants);
        } else if (target.timeAggFn == 'live') {
          // Need to change postData
          return this.singleStatLiveQuery(target, {tags: postData.tags, limit: 1}, tenants);
        } else if (target.timeAggFn) {
          // Query single stat
          return this.singleStatQuery(target, postData, tenants);
        } else {
          // Query stats for chart
          return this.statsQuery(target, postData, tenants);
        }
      }
    });
  }

  rawQuery(target, postData, tenants) {
    const url = `${this.url}/${this.typeResources[target.type]}/${target.rate ? 'rate' : 'raw'}/query`;
    return this.multiTenantsQuery(tenants, url, null, postData, 'POST')
      .then(res => this.tenantsPrefixer(res))
      .then(allSeries => this.processRawResponse(target, allSeries));
  }

  rawQueryLegacy(target, range, metricIds, tenants) {
    return this.q.all(metricIds.map(metric => {
      const url = `${this.url}/${this.typeResources[target.type]}/${encodeURIComponent(metric).replace('+', '%20')}/data`;
      const params = {
        start: range.from.valueOf(),
        end: range.to.valueOf()
      };
      return this.multiTenantsQuery(tenants, url, params, null, 'GET')
        .then(res => this.tenantsPrefixer(res))
        .then(allSeries => this.processRawResponseLegacy(target, metric, allSeries));
    }));
  }

  processRawResponse(target, allSeries) {
    return allSeries.map(timeSerie => {
      return {
        refId: target.refId,
        target: timeSerie.prefix + timeSerie.id,
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

  statsQuery(target, postData, tenants) {
    if (target.seriesAggFn === 'none') {
      return this.statsQueryUnmerged(target, postData, tenants);
    }
    const url = `${this.url}/${this.typeResources[target.type]}/stats/query`;
    delete postData.order;
    postData.buckets = STATS_BUCKETS;
    postData.stacked = target.seriesAggFn === 'sum';
    const percentiles = this.getPercentilesToQuery(target.stats);
    if (percentiles.length > 0) {
      postData.percentiles = percentiles.join(',');
    }
    return this.multiTenantsQuery(tenants, url, null, postData, 'POST')
      .then(multiTenantsData => this.processStatsResponse(target, multiTenantsData));
  }

  processStatsResponse(target, multiTenantsData) {
    // Response example: [ { tenant: 't1', result: [...] }, { tenant: 't2', result: [...] } ]
    // Detailed `data[i].result`: [{start:1234, end:5678, avg:100.0, min:90.0, max:110.0, (...), percentiles:[{quantile: 90, value: 105.0}]}]
    const flatten = [];
    const prefixer = multiTenantsData.length > 1 ? (tenant) => `[${tenant}] ` : (tenant) => '';
    multiTenantsData.forEach(tenantData => {
      if (tenantData.result) {
        target.stats.forEach(stat => {
          const percentile = this.getPercentileValue(stat);
          if (percentile) {
            flatten.push({
              refId: target.refId,
              target: prefixer(tenantData.tenant) + stat,
              datapoints: tenantData.result.filter(bucket => !bucket.empty)
                .map(bucket => [this.findQuantileInBucket(percentile, bucket), bucket.start])
            });
          } else {
            flatten.push({
              refId: target.refId,
              target: prefixer(tenantData.tenant) + stat,
              datapoints: tenantData.result.filter(bucket => !bucket.empty).map(bucket => [bucket[stat], bucket.start])
            });
          }
        });
      }
    });
    return flatten;
  }

  statsQueryUnmerged(target, postData, tenants) {
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
    return this.multiTenantsQuery(tenants, url, null, postData, 'POST')
      .then(multiTenantsData => this.processUnmergedStatsResponse(target, multiTenantsData));
  }

  processUnmergedStatsResponse(target, multiTenantsData) {
    // Response example: [ { tenant: 't1', result: {...} }, { tenant: 't2', result: {...} } ]
    // Detailed `data[i].result`:
    // {"gauge": {"my_metric": [
    //    {start:1234, end:5678, avg:100.0, min:90.0, max:110.0, (...), percentiles:[{quantile: 90, value: 105.0}]}
    // ]}}
    const series = [];
    const prefixer = multiTenantsData.length > 1 ? (tenant) => `[${tenant}] ` : (tenant) => '';
    multiTenantsData.forEach(tenantData => {
      if (tenantData.result) {
        const allMetrics = tenantData.result[target.type];
        const prefix = prefixer(tenantData.tenant);
        for (let metricId in allMetrics) {
          if (allMetrics.hasOwnProperty(metricId)) {
            const buckets = allMetrics[metricId];
            target.stats.forEach(stat => {
              const percentile = this.getPercentileValue(stat);
              if (percentile) {
                series.push({
                  refId: target.refId,
                  target: `${prefix}${metricId} [${stat}]`,
                  datapoints: buckets.filter(bucket => !bucket.empty)
                    .map(bucket => [this.findQuantileInBucket(percentile, bucket), bucket.start])
                });
              } else {
                series.push({
                  refId: target.refId,
                  target: `${prefix}${metricId} [${stat}]`,
                  datapoints: buckets.filter(bucket => !bucket.empty).map(bucket => [bucket[stat], bucket.start])
                });
              }
            });
          }
        }
      }
    });
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

  singleStatQuery(target, postData, tenants) {
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
    const url = `${this.url}/${this.typeResources[target.type]}/stats/query`;
    delete postData.order;
    postData.buckets = 1;
    postData.stacked = target.seriesAggFn === 'sum';
    return this.multiTenantsQuery(tenants, url, null, postData, 'POST')
      .then(multiTenantsData => this.processSingleStatResponse(target, fnBucket, multiTenantsData));
  }

  processSingleStatResponse(target, fnBucket, multiTenantsData) {
    return _.flatten(multiTenantsData.map(tenantData => {
      if (tenantData.result) {
        return tenantData.result.map(bucket => {
          return {
            refId: target.refId,
            target: 'Aggregate',
            datapoints: [[fnBucket(bucket), bucket.start]]
          };
        });
      }
    }));
  }

  singleStatLiveQuery(target, postData, tenants) {
    const url = `${this.url}/${this.typeResources[target.type]}/${target.rate ? 'rate' : 'raw'}/query`;
    // Set start to now - 5m
    postData.start = Date.now() - 300000;
    return this.multiTenantsQuery(tenants, url, null, postData, 'POST')
      .then(multiTenantsData => this.processSingleStatLiveResponse(target, multiTenantsData));
  }

  processSingleStatLiveResponse(target, multiTenantsData) {
    let reduceFunc;
    if (target.seriesAggFn === 'sum') {
      reduceFunc = (presentValues => presentValues.reduce((a,b) => a+b));
    } else {
      reduceFunc = (presentValues => presentValues.reduce((a,b) => a+b) / presentValues.length);
    }
    return _.flatten(multiTenantsData.map(tenantData => {
      if (tenantData.result) {
        let datapoints;
        const latestPoints = tenantData.result.filter(timeSeries => timeSeries.data.length > 0)
            .map(timeSeries => timeSeries.data[0]);
        if (latestPoints.length === 0) {
          datapoints = [];
        } else {
          datapoints = [[reduceFunc(latestPoints.map(dp => dp.value)), latestPoints[0].timestamp]];
        }
        return [{
          refId: target.refId,
          target: 'Aggregate',
          datapoints: datapoints
        }];
      }
    }));
  }

  tenantsPrefixer(allTenantTimeSeries) {
    // Exemple of input:
    // [ { tenant: 't1', result: [ {id: metricA, data: []} ] }, { tenant: 't2', result: [ {id: metricB, data: []} ] } ]
    const flatten = [];
    const prefixer = allTenantTimeSeries.length > 1 ? (tenant) => `[${tenant}] ` : (tenant) => '';
    allTenantTimeSeries.forEach(oneTenantTimeSeries => {
      if (oneTenantTimeSeries.result) {
        oneTenantTimeSeries.result.forEach(timeSeries => {
          timeSeries.prefix = prefixer(oneTenantTimeSeries.tenant);
          flatten.push(timeSeries);
        })
      }
    })
    return flatten;
  }
}
