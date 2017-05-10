'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HawkularDatasource = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _variables = require('./variables');

var _capabilities = require('./capabilities');

var _queryProcessor = require('./queryProcessor');

var _tagsKVPairsController = require('./tagsKVPairsController');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HawkularDatasource = exports.HawkularDatasource = function () {
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
    this.variables = new _variables.Variables(templateSrv);
    this.capabilitiesPromise = this.queryVersion().then(function (version) {
      return new _capabilities.Capabilities(version);
    });
    this.queryProcessor = new _queryProcessor.QueryProcessor($q, backendSrv, this.variables, this.capabilitiesPromise, this.url, this.headers, this.typeResources);
  }

  _createClass(HawkularDatasource, [{
    key: 'query',
    value: function query(options) {
      var _this = this;

      var validTargets = options.targets.filter(function (target) {
        return !target.hide;
      }).map(function (target) {
        if (target.id === undefined && target.target !== 'select metric') {
          // backward compatibility
          target.id = target.target;
        } else if (target.id === '-- none --') {
          delete target.id;
        }
        return target;
      }).filter(function (target) {
        return target.id !== undefined || target.tags !== undefined && target.tags.length > 0 || target.tagsQL !== undefined && target.tagsQL.length > 0;
      });

      if (validTargets.length === 0) {
        return this.q.when({ data: [] });
      }

      var promises = validTargets.map(function (target) {
        return _this.queryProcessor.run(target, options);
      });

      return this.q.all(promises).then(function (responses) {
        return { data: _lodash2.default.flatten(responses).sort(function (m1, m2) {
            return m1.target.localeCompare(m2.target);
          }) };
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
      var url = this.url + '/metrics?type=' + target.type;
      if (target.tagsQL && target.tagsQL.length > 0) {
        url += "&tags=" + this.variables.resolveToString(target.tagsQL, {});
      } else if (target.tags && target.tags.length > 0) {
        url += "&tags=" + (0, _tagsKVPairsController.modelToString)(target.tags, this.variables, {});
      }
      return this.backendSrv.datasourceRequest({
        url: url,
        method: 'GET',
        headers: this.headers
      }).then(function (response) {
        return response.status == 200 ? response.data : [];
      }).then(function (result) {
        return result.map(function (m) {
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
        return this.q.when([]);
      }
      return this.backendSrv.datasourceRequest({
        url: this.url + '/' + this.typeResources[type] + '/tags/' + key + ':*',
        method: 'GET',
        headers: this.headers
      }).then(function (result) {
        return result.data.hasOwnProperty(key) ? result.data[key] : [];
      }).then(function (tags) {
        return tags.map(function (tag) {
          return { text: tag, value: tag };
        });
      });
    }
  }, {
    key: 'suggestTagKeys',
    value: function suggestTagKeys(type) {
      return this.backendSrv.datasourceRequest({
        url: this.url + '/metrics/tags',
        method: 'GET',
        headers: this.headers
      }).then(function (response) {
        return response.status == 200 ? response.data : [];
      }).then(function (result) {
        return result.map(function (key) {
          return { text: key, value: key };
        });
      });
    }
  }, {
    key: 'metricFindQuery',
    value: function metricFindQuery(query) {
      var _this2 = this;

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
      return this.runWithResolvedVariables(params, function (p) {
        return _this2.backendSrv.datasourceRequest({
          url: _this2.url + '/metrics' + p,
          method: 'GET',
          headers: _this2.headers
        }).then(function (result) {
          return _lodash2.default.map(result.data, function (metric) {
            return { text: metric.id, value: metric.id };
          });
        });
      });
    }
  }, {
    key: 'findTags',
    value: function findTags(pattern) {
      var _this3 = this;

      return this.runWithResolvedVariables(pattern, function (p) {
        return _this3.backendSrv.datasourceRequest({
          url: _this3.url + '/metrics/tags/' + p,
          method: 'GET',
          headers: _this3.headers
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
      var resolved = this.variables.resolve(target, {});
      return this.q.all(resolved.map(function (p) {
        return func(p);
      })).then(function (result) {
        return _lodash2.default.flatten(result);
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
}();
//# sourceMappingURL=datasource.js.map
