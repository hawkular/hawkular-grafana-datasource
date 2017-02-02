'use strict';

System.register(['lodash', './variables', './capabilities', './queryProcessor'], function (_export, _context) {
  "use strict";

  var _, Variables, Capabilities, QueryProcessor, _createClass, HawkularDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_variables) {
      Variables = _variables.Variables;
    }, function (_capabilities) {
      Capabilities = _capabilities.Capabilities;
    }, function (_queryProcessor) {
      QueryProcessor = _queryProcessor.QueryProcessor;
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
          this.q = $q;
          this.backendSrv = backendSrv;
          this.headers = {
            'Content-Type': 'application/json',
            'Hawkular-Tenant': instanceSettings.jsonData.tenant
          };
          if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
            this.headers['Authorization'] = instanceSettings.basicAuth;
          } else if (typeof instanceSettings.jsonData.token === 'string' && instanceSettings.jsonData.token.length > 0) {
            this.headers['Authorization'] = 'Bearer ' + instanceSettings.jsonData.token;
          }
          this.typeResources = {
            "gauge": "gauges",
            "counter": "counters",
            "availability": "availability"
          };
          var variables = new Variables(templateSrv);
          this.capabilitiesPromise = this.queryVersion().then(function (version) {
            return new Capabilities(version);
          });
          this.queryProcessor = new QueryProcessor($q, backendSrv, variables, this.capabilitiesPromise, this.url, this.headers, this.typeResources);
        }

        _createClass(HawkularDatasource, [{
          key: 'query',
          value: function query(options) {
            var _this = this;

            var validTargets = options.targets.filter(function (target) {
              return !target.hide;
            }).filter(function (target) {
              return target.queryBy === 'tags' && target.tags.length > 0 || target.target !== 'select metric';
            });

            if (validTargets.length === 0) {
              return this.q.when({ data: [] });
            }

            var promises = validTargets.map(function (target) {
              return _this.queryProcessor.run(target, options);
            });

            return this.q.all(promises).then(function (responses) {
              var flatten = [].concat.apply([], responses).sort(function (m1, m2) {
                return m1.target.localeCompare(m2.target);
              });
              return { data: flatten };
            });
          }
        }, {
          key: 'testDatasource',
          value: function testDatasource() {
            return this.backendSrv.datasourceRequest({
              url: this.url + '/metrics',
              method: 'GET',
              headers: this.headers
            }).then(function (response) {
              if (response.status === 200 || response.status === 204) {
                return { status: "success", message: "Data source is working", title: "Success" };
              } else {
                return { status: "error", message: "Connection failed (" + response.status + ")", title: "Error" };
              }
            });
          }
        }, {
          key: 'annotationQuery',
          value: function annotationQuery(options) {
            return this.backendSrv.datasourceRequest({
              url: this.url + '/strings/raw/query',
              data: {
                start: options.range.from.valueOf(),
                end: options.range.to.valueOf(),
                order: 'ASC',
                ids: [options.annotation.query]
              },
              method: 'POST',
              headers: this.headers
            }).then(function (response) {
              return response.status == 200 ? response.data[0].data : [];
            }).then(function (data) {
              return data.map(function (dp) {
                var annot = {
                  annotation: options.annotation,
                  time: dp.timestamp,
                  title: options.annotation.name,
                  tags: undefined,
                  text: dp.value
                };
                if (dp.tags) {
                  var tags = [];
                  for (var key in dp.tags) {
                    if (dp.tags.hasOwnProperty(key)) {
                      tags.push(dp.tags[key].replace(' ', '_'));
                    }
                  }
                  if (tags.length > 0) {
                    annot.tags = tags.join(' ');
                  }
                }
                return annot;
              });
            });
          }
        }, {
          key: 'suggestQueries',
          value: function suggestQueries(target) {
            return this.backendSrv.datasourceRequest({
              url: this.url + '/metrics?type=' + target.type,
              method: 'GET',
              headers: this.headers
            }).then(function (result) {
              return result.data.map(function (m) {
                return m.id;
              }).sort().map(function (id) {
                return { text: id, value: id };
              });
            });
          }
        }, {
          key: 'suggestTags',
          value: function suggestTags(type, key) {
            if (!key) {
              // Need at least some characters typed in order to suggest something
              return this.q.when([]);
            }
            return this.backendSrv.datasourceRequest({
              url: this.url + '/' + this.typeResources[type] + '/tags/' + key + ':*',
              method: 'GET',
              headers: this.headers
            }).then(function (result) {
              if (result.data.hasOwnProperty(key)) {
                return [' *'].concat(result.data[key]).map(function (value) {
                  return { text: value, value: value };
                });
              }
              return [];
            });
          }
        }, {
          key: 'metricFindQuery',
          value: function metricFindQuery(query) {
            var params = "";
            if (query !== undefined) {
              if (query.substr(0, 5) === "tags/") {
                return this.findTags(query.substr(5).trim());
              }
              if (query.charAt(0) === '?') {
                params = query;
              } else {
                params = "?" + query;
              }
            }
            return this.backendSrv.datasourceRequest({
              url: this.url + '/metrics' + params,
              method: 'GET',
              headers: this.headers
            }).then(function (result) {
              return _.map(result.data, function (metric) {
                return { text: metric.id, value: metric.id };
              });
            });
          }
        }, {
          key: 'findTags',
          value: function findTags(pattern) {
            return this.backendSrv.datasourceRequest({
              url: this.url + '/metrics/tags/' + pattern,
              method: 'GET',
              headers: this.headers
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
          }
        }, {
          key: 'queryVersion',
          value: function queryVersion() {
            return this.backendSrv.datasourceRequest({
              url: this.url + '/status',
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            }).then(function (response) {
              return response.data['Implementation-Version'];
            }).catch(function (response) {
              return "Unknown";
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
