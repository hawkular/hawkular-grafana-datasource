import _ from 'lodash';
import {VariablesHelper} from './variablesHelper';
import {Capabilities} from './capabilities';
import {QueryProcessor} from './queryProcessor';
import {modelToString as tagsModelToString} from './tagsKVPairsController';

export class HawkularDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type;
    this.metricsUrl = instanceSettings.url + '/metrics';
    this.alertsUrl = instanceSettings.url + '/alerts';
    this.name = instanceSettings.name;
    this.tenant = instanceSettings.jsonData.tenant;
    this.isTenantPerQuery = instanceSettings.jsonData.isTenantPerQuery;
    this.authorization = null;
    if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
      this.authorization = instanceSettings.basicAuth;
    } else if (typeof instanceSettings.jsonData.token === 'string' && instanceSettings.jsonData.token.length > 0) {
      this.authorization = 'Bearer ' + instanceSettings.jsonData.token;
    }
    this.q = $q;
    this.backendSrv = backendSrv;
    this.typeResources = {
      'gauge': 'gauges',
      'counter': 'counters',
      'availability': 'availability'
    };
    this.variablesHelper = new VariablesHelper(templateSrv);
    this.capabilitiesPromise = this.queryVersion().then(version => new Capabilities(version));
    this.queryProcessor = new QueryProcessor($q, this.multiTenantsQuery.bind(this), this.variablesHelper, this.capabilitiesPromise, this.metricsUrl,
            this.typeResources);
  }

  getHeaders(tenant) {
    const headers = {
      'Content-Type': 'application/json'
    }
    if (tenant && this.isTenantPerQuery) {
      headers['Hawkular-Tenant'] = tenant;
    } else {
      headers['Hawkular-Tenant'] = this.tenant;
    }
    if (this.authorization) {
      headers['Authorization'] = this.authorization;
    }
    return headers;
  }

  multiTenantsQuery(tenants, url, params, data, method) {
    return this.q.all(tenants.map(tenant => {
      return this.backendSrv.datasourceRequest({
        url: url,
        params: params,
        data: data,
        method: method,
        headers: this.getHeaders(tenant)
      }).then(response => {
        return {
          tenant: tenant,
          result: (response.status == 200) ? response.data : null
        }
      });
    }));
  }

  query(options) {
    const validTargets = options.targets
      .filter(target => !target.hide)
      .map(this.sanitizeTarget)
      .filter(target => target.id !== undefined
         || (target.tags !== undefined && target.tags.length > 0)
         || (target.tagsQL !== undefined && target.tagsQL.length > 0));

    if (validTargets.length === 0) {
      return this.q.when({data: []});
    }

    const promises = validTargets.map(target => this.queryProcessor.run(target, options));

    return this.q.all(promises)
      .then(responses => ({data: _.flatten(responses).sort((m1, m2) => m1.target.localeCompare(m2.target))}));
  }

  sanitizeTarget(target) {
    // Create sane target, providing backward compatibility
    if (target.id === undefined && target.target !== 'select metric') {
      target.id = target.target;
    } else if (target.id === '-- none --') {
      delete target.id;
    }
    delete target.target;
    target.stats = target.stats || [];
    target.type = target.type || 'gauge';
    target.rate = target.rate === true;
    target.tags = target.tags || [];
    target.tagsQL = target.tagsQL || '';
    target.seriesAggFn = target.seriesAggFn || 'none';
    if (target.raw === undefined) {
      // Compatibility note: previously default was timeAggFn=avg and seriesAggFn=none
      if (target.seriesAggFn === 'none' && target.timeAggFn === 'avg') {
        delete target.timeAggFn;
      }
      target.raw = (target.timeAggFn === undefined);
    }
    return target;
  }

  testDatasource() {
    // If tenants is unknown at this point (when having per-query tenants)
    // We do a more basic check to / endpoint, which checks authentication in basic-auth mode but not with token/OpenShift
    // Else, it's full connectivity with tenant check
    const endpoint = this.isTenantPerQuery ? '/' : '/metrics';
    return this.backendSrv.datasourceRequest({
      url: this.metricsUrl + endpoint,
      method: 'GET',
      headers: this.getHeaders()
    }).then(response => {
      if (response.status === 200 || response.status === 204) {
        return { status: 'success', message: 'Data source is working', title: 'Success' };
      } else {
        return { status: 'error', message: `Connection failed (${response.status})`, title: 'Error' };
      }
    });
  }

  annotationQuery(options) {
    const metricIds = this.variablesHelper.resolve(options.annotation.query, options);
    if (options.annotation.type === 'alert') {
      return this.queryAlerts(metricIds, options);
    }
    return this.backendSrv.datasourceRequest({
      url: `${this.metricsUrl}/${options.annotation.type}/raw/query`,
      data: {
        start: options.range.from.valueOf(),
        end: options.range.to.valueOf(),
        order: 'ASC',
        ids: metricIds
      },
      method: 'POST',
      headers: this.getHeaders(options.annotation.tenant)
    }).then(response => response.status == 200 ? response.data : [])
    .then(metrics => {
      let allAnnotations = [];
      metrics.forEach(metric => {
        metric.data.forEach(dp => {
          let annot = {
            annotation: options.annotation,
            time: dp.timestamp,
            title: options.annotation.name,
            text: dp.value
          };
          let tags = [];
          if (metricIds.length > 1) {
            tags.push(metric.id);
          }
          if (dp.tags) {
            for (let key in dp.tags) {
              if (dp.tags.hasOwnProperty(key)) {
                tags.push(dp.tags[key].replace(' ', '_'));
              }
            }
          }
          if (tags.length > 0) {
            annot.tags = tags.join(' ');
          }
          allAnnotations.push(annot);
        });
      });
      return allAnnotations;
    });
  }

  queryAlerts(ids, options) {
    return this.backendSrv.datasourceRequest({
      url: `${this.alertsUrl}/events`,
      params: {
        startTime: options.range.from.valueOf(),
        endTime: options.range.to.valueOf(),
        triggerIds: ids
      },
      method: 'GET',
      headers: this.getHeaders(options.annotation.tenant)
    }).then(response => response.status == 200 ? response.data : [])
    .then(events => {
      return events.map(event => {
        return {
          annotation: options.annotation,
          time: event.ctime,
          title: options.annotation.name,
          text: event.text,
          tags: event.status
        };
      });
    });
  }

  getTargetTenants(target) {
    if (target.tenant) {
      return this.variablesHelper.resolve(target.tenant, {});
    }
    return [null];
  }

  suggestMetrics(target) {
    let url = this.metricsUrl + '/metrics?type=' + target.type;
    if (target.tagsQL && target.tagsQL.length > 0) {
      url += '&tags=' + this.variablesHelper.resolveForQL(target.tagsQL, {});
    } else if (target.tags && target.tags.length > 0) {
      url += '&tags=' + tagsModelToString(target.tags, this.variablesHelper, {});
    }
    const tenants = this.getTargetTenants(target);
    return this.multiTenantsQuery(tenants, url, null, null, 'GET')
      .then(multiTenantsData => {
        // Eliminate possible duplicates from multi-tenancy
        let ids = {};
        multiTenantsData.forEach(tenantData => {
          if (tenantData.result) {
            tenantData.result.forEach(metric => {
              ids[metric.id] = true;
            });
          }
        });
        return Object.keys(ids)
          .sort()
          .map(id => {
            return {text: id, value: id};
          });
      });
  }

  suggestTags(target, key) {
    if (!key) {
      return this.q.when([]);
    }
    const tenants = this.getTargetTenants(target);
    const url = `${this.metricsUrl}/${this.typeResources[target.type]}/tags/${key}:*`;
    return this.multiTenantsQuery(tenants, url, null, null, 'GET')
      .then(multiTenantsData => {
        // Eliminate possible duplicates from multi-tenancy
        let mergedTags = {};
        multiTenantsData.forEach(tenantData => {
          if (tenantData.result) {
            if (tenantData.result.hasOwnProperty(key)) {
              tenantData.result[key].forEach(tag => {
                mergedTags[tag] = true;
              });
            }
          }
        });
        return Object.keys(mergedTags)
          .sort()
          .map(tag => {
            return {text: tag, value: tag};
          });
      });
  }

  suggestTagKeys(target) {
    const tenants = this.getTargetTenants(target);
    return this.multiTenantsQuery(tenants, this.metricsUrl + '/metrics/tags', null, null, 'GET')
      .then(multiTenantsData => {
        // Eliminate possible duplicates from multi-tenancy
        let mergedTags = {};
        multiTenantsData.forEach(tenantData => {
          if (tenantData.result) {
            tenantData.result.forEach(tag => {
              mergedTags[tag] = true;
            });
          }
        });
        return Object.keys(mergedTags)
          .map(tag => {
            return {text: tag, value: tag};
          });
      });
  }

  metricFindQuery(query) {
    let params = '';
    if (query !== undefined) {
      if (query.substr(0, 5) === 'tags/') {
        return this.findTags(query.substr(5).trim());
      }
      if (query.charAt(0) === '?') {
        params = query;
      } else {
        params = '?' + query;
      }
    }
    return this.runWithResolvedVariables(params, p => this.backendSrv.datasourceRequest({
      url: `${this.metricsUrl}/metrics${p}`,
      method: 'GET',
      headers: this.getHeaders()
    }).then(result => {
      return _.map(result.data, metric => {
        return {text: metric.id, value: metric.id};
      });
    }));
  }

  findTags(pattern) {
    return this.runWithResolvedVariables(pattern, p => this.backendSrv.datasourceRequest({
      url: `${this.metricsUrl}/metrics/tags/${p}`,
      method: 'GET',
      headers: this.getHeaders()
    }).then(result => {
      let flatTags = [];
      if (result.data) {
        let data = result.data;
        for (let property in data) {
          if (data.hasOwnProperty(property)) {
            flatTags = flatTags.concat(data[property]);
          }
        }
      }
      return flatTags.map(tag => {
        return {text: tag, value: tag};
      });
    }));
  }

  runWithResolvedVariables(target, func) {
    const resolved = this.variablesHelper.resolve(target, {});
    return this.q.all(resolved.map(p => func(p)))
      .then(result => _.flatten(result));
  }

  queryVersion() {
    return this.backendSrv.datasourceRequest({
      url: this.metricsUrl + '/status',
      method: 'GET',
      headers: {'Content-Type': 'application/json'}
    }).then(response => response.data['Implementation-Version'])
    .catch(response => 'Unknown');
  }

  getCapabilities() {
    return this.capabilitiesPromise;
  }
}
