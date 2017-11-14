'use strict';

System.register(['lodash', './variablesHelper', './capabilities', './queryProcessor', './tagsKVPairsController'], function (_export, _context) {
  "use strict";

  var _, VariablesHelper, Capabilities, QueryProcessor, tagsModelToString, _createClass, HawkularDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_variablesHelper) {
      VariablesHelper = _variablesHelper.VariablesHelper;
    }, function (_capabilities) {
      Capabilities = _capabilities.Capabilities;
    }, function (_queryProcessor) {
      QueryProcessor = _queryProcessor.QueryProcessor;
    }, function (_tagsKVPairsController) {
      tagsModelToString = _tagsKVPairsController.modelToString;
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
          this.capabilitiesPromise = this.queryVersion().then(function (version) {
            return new Capabilities(version);
          });
          this.queryProcessor = new QueryProcessor($q, this.multiTenantsQuery.bind(this), this.variablesHelper, this.capabilitiesPromise, this.metricsUrl, this.typeResources);
        }

        _createClass(HawkularDatasource, [{
          key: 'getHeaders',
          value: function getHeaders(tenant) {
            var headers = {
              'Content-Type': 'application/json'
            };
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
        }, {
          key: 'multiTenantsQuery',
          value: function multiTenantsQuery(tenants, url, params, data, method) {
            var _this = this;

            return this.q.all(tenants.map(function (tenant) {
              return _this.backendSrv.datasourceRequest({
                url: url,
                params: params,
                data: data,
                method: method,
                headers: _this.getHeaders(tenant)
              }).then(function (response) {
                return {
                  tenant: tenant,
                  result: response.status == 200 ? response.data : null
                };
              });
            }));
          }
        }, {
          key: 'query',
          value: function query(options) {
            var _this2 = this;

            var validTargets = options.targets.filter(function (target) {
              return !target.hide;
            }).map(this.sanitizeTarget).filter(function (target) {
              return target.id !== undefined || target.tags !== undefined && target.tags.length > 0 || target.tagsQL !== undefined && target.tagsQL.length > 0;
            });

            if (validTargets.length === 0) {
              return this.q.when({ data: [] });
            }

            var promises = validTargets.map(function (target) {
              return _this2.queryProcessor.run(target, options);
            });

            return this.q.all(promises).then(function (responses) {
              return { data: _.flatten(responses).sort(function (m1, m2) {
                  return m1.target.localeCompare(m2.target);
                }) };
            });
          }
        }, {
          key: 'sanitizeTarget',
          value: function sanitizeTarget(target) {
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
              target.raw = target.timeAggFn === undefined;
            }
            return target;
          }
        }, {
          key: 'testDatasource',
          value: function testDatasource() {
            // If tenants is unknown at this point (when having per-query tenants)
            // We do a more basic check to / endpoint, which checks authentication in basic-auth mode but not with token/OpenShift
            // Else, it's full connectivity with tenant check
            var endpoint = this.isTenantPerQuery ? '/' : '/metrics';
            return this.backendSrv.datasourceRequest({
              url: this.metricsUrl + endpoint,
              method: 'GET',
              headers: this.getHeaders()
            }).then(function (response) {
              if (response.status === 200 || response.status === 204) {
                return { status: 'success', message: 'Data source is working', title: 'Success' };
              } else {
                return { status: 'error', message: 'Connection failed (' + response.status + ')', title: 'Error' };
              }
            });
          }
        }, {
          key: 'annotationQuery',
          value: function annotationQuery(options) {
            var metricIds = this.variablesHelper.resolve(options.annotation.query, options);
            if (options.annotation.type === 'alert') {
              return this.queryAlerts(metricIds, options);
            }
            return this.backendSrv.datasourceRequest({
              url: this.metricsUrl + '/' + options.annotation.type + '/raw/query',
              data: {
                start: options.range.from.valueOf(),
                end: options.range.to.valueOf(),
                order: 'ASC',
                ids: metricIds
              },
              method: 'POST',
              headers: this.getHeaders(options.annotation.tenant)
            }).then(function (response) {
              return response.status == 200 ? response.data : [];
            }).then(function (metrics) {
              var allAnnotations = [];
              metrics.forEach(function (metric) {
                metric.data.forEach(function (dp) {
                  var annot = {
                    annotation: options.annotation,
                    time: dp.timestamp,
                    title: options.annotation.name,
                    text: dp.value
                  };
                  var tags = [];
                  if (metricIds.length > 1) {
                    tags.push(metric.id);
                  }
                  if (dp.tags) {
                    for (var key in dp.tags) {
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
        }, {
          key: 'queryAlerts',
          value: function queryAlerts(ids, options) {
            return this.backendSrv.datasourceRequest({
              url: this.alertsUrl + '/events',
              params: {
                startTime: options.range.from.valueOf(),
                endTime: options.range.to.valueOf(),
                triggerIds: ids
              },
              method: 'GET',
              headers: this.getHeaders(options.annotation.tenant)
            }).then(function (response) {
              return response.status == 200 ? response.data : [];
            }).then(function (events) {
              return events.map(function (event) {
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
        }, {
          key: 'getTargetTenants',
          value: function getTargetTenants(target) {
            if (target.tenant) {
              return this.variablesHelper.resolve(target.tenant, {});
            }
            return [null];
          }
        }, {
          key: 'suggestMetrics',
          value: function suggestMetrics(target) {
            var url = this.metricsUrl + '/metrics?type=' + target.type;
            if (target.tagsQL && target.tagsQL.length > 0) {
              url += '&tags=' + this.variablesHelper.resolveForQL(target.tagsQL, {});
            } else if (target.tags && target.tags.length > 0) {
              url += '&tags=' + tagsModelToString(target.tags, this.variablesHelper, {});
            }
            var tenants = this.getTargetTenants(target);
            return this.multiTenantsQuery(tenants, url, null, null, 'GET').then(function (multiTenantsData) {
              // Eliminate possible duplicates from multi-tenancy
              var ids = {};
              multiTenantsData.forEach(function (tenantData) {
                if (tenantData.result) {
                  tenantData.result.forEach(function (metric) {
                    ids[metric.id] = true;
                  });
                }
              });
              return Object.keys(ids).sort().map(function (id) {
                return { text: id, value: id };
              });
            });
          }
        }, {
          key: 'suggestTags',
          value: function suggestTags(target, key) {
            if (!key) {
              return this.q.when([]);
            }
            var tenants = this.getTargetTenants(target);
            var url = this.metricsUrl + '/' + this.typeResources[target.type] + '/tags/' + key + ':*';
            return this.multiTenantsQuery(tenants, url, null, null, 'GET').then(function (multiTenantsData) {
              // Eliminate possible duplicates from multi-tenancy
              var mergedTags = {};
              multiTenantsData.forEach(function (tenantData) {
                if (tenantData.result) {
                  if (tenantData.result.hasOwnProperty(key)) {
                    tenantData.result[key].forEach(function (tag) {
                      mergedTags[tag] = true;
                    });
                  }
                }
              });
              return Object.keys(mergedTags).sort().map(function (tag) {
                return { text: tag, value: tag };
              });
            });
          }
        }, {
          key: 'suggestTagKeys',
          value: function suggestTagKeys(target) {
            var tenants = this.getTargetTenants(target);
            return this.multiTenantsQuery(tenants, this.metricsUrl + '/metrics/tags', null, null, 'GET').then(function (multiTenantsData) {
              // Eliminate possible duplicates from multi-tenancy
              var mergedTags = {};
              multiTenantsData.forEach(function (tenantData) {
                if (tenantData.result) {
                  tenantData.result.forEach(function (tag) {
                    mergedTags[tag] = true;
                  });
                }
              });
              return Object.keys(mergedTags).map(function (tag) {
                return { text: tag, value: tag };
              });
            });
          }
        }, {
          key: 'metricFindQuery',
          value: function metricFindQuery(query) {
            var _this3 = this;

            var params = '';
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
            return this.runWithResolvedVariables(params, function (p) {
              return _this3.backendSrv.datasourceRequest({
                url: _this3.metricsUrl + '/metrics' + p,
                method: 'GET',
                headers: _this3.getHeaders()
              }).then(function (result) {
                return _.map(result.data, function (metric) {
                  return { text: metric.id, value: metric.id };
                });
              });
            });
          }
        }, {
          key: 'findTags',
          value: function findTags(pattern) {
            var _this4 = this;

            return this.runWithResolvedVariables(pattern, function (p) {
              return _this4.backendSrv.datasourceRequest({
                url: _this4.metricsUrl + '/metrics/tags/' + p,
                method: 'GET',
                headers: _this4.getHeaders()
              }).then(function (result) {
                var flatTags = [];
                if (result.data) {
                  var data = result.data;
                  for (var property in data) {
                    if (data.hasOwnProperty(property)) {
                      flatTags = flatTags.concat(data[property]);
                    }
                  }
                }
                return flatTags.map(function (tag) {
                  return { text: tag, value: tag };
                });
              });
            });
          }
        }, {
          key: 'runWithResolvedVariables',
          value: function runWithResolvedVariables(target, func) {
            var resolved = this.variablesHelper.resolve(target, {});
            return this.q.all(resolved.map(function (p) {
              return func(p);
            })).then(function (result) {
              return _.flatten(result);
            });
          }
        }, {
          key: 'queryVersion',
          value: function queryVersion() {
            return this.backendSrv.datasourceRequest({
              url: this.metricsUrl + '/status',
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            }).then(function (response) {
              return response.data['Implementation-Version'];
            }).catch(function (response) {
              return 'Unknown';
            });
          }
        }, {
          key: 'getCapabilities',
          value: function getCapabilities() {
            return this.capabilitiesPromise;
          }
        }]);

        return HawkularDatasource;
      }());

      _export('HawkularDatasource', HawkularDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
