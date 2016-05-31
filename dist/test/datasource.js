'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GenericDatasource = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GenericDatasource = exports.GenericDatasource = function () {
  function GenericDatasource(instanceSettings, $q, backendSrv) {
    _classCallCheck(this, GenericDatasource);

    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
  }

  // Called once per panel (graph)


  _createClass(GenericDatasource, [{
    key: 'query',
    value: function query(options) {
      var query = this.buildQueryParameters(options);

      if (query.targets.length <= 0) {
        return this.q.when([]);
      }

      return this.backendSrv.datasourceRequest({
        url: this.url + '/query',
        data: query,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Required
    // Used for testing datasource in datasource configuration pange

  }, {
    key: 'testDatasource',
    value: function testDatasource() {
      return this.backendSrv.datasourceRequest({
        url: this.url + '/',
        method: 'GET'
      }).then(function (response) {
        if (response.status === 200) {
          return { status: "success", message: "Data source is working", title: "Success" };
        }
      });
    }
  }, {
    key: 'annotationQuery',
    value: function annotationQuery(options) {
      return this.backendSrv.datasourceRequest({
        url: this.url + '/annotations',
        method: 'POST',
        data: options
      }).then(function (result) {
        return result.data;
      });
    }

    // Optional
    // Required for templating

  }, {
    key: 'metricFindQuery',
    value: function metricFindQuery(options) {
      return this.backendSrv.datasourceRequest({
        url: this.url + '/search',
        data: options,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(this.mapToTextValue);
    }
  }, {
    key: 'mapToTextValue',
    value: function mapToTextValue(result) {
      return _lodash2.default.map(result.data, function (d, i) {
        return { text: d, value: i };
      });
    }
  }, {
    key: 'buildQueryParameters',
    value: function buildQueryParameters(options) {
      //remove placeholder targets
      options.targets = _lodash2.default.filter(options.targets, function (target) {
        return target.target !== 'select metric';
      });

      return options;
    }
  }]);

  return GenericDatasource;
}();
//# sourceMappingURL=datasource.js.map
