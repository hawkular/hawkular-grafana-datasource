'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HawkularDatasourceQueryCtrl = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _sdk = require('app/plugins/sdk');

require('./css/query-editor.css!');

var _capabilities = require('./capabilities');

var _tagsKVPairsController = require('./tagsKVPairsController');

var _tagsQLController = require('./tagsQLController');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var HawkularDatasourceQueryCtrl = exports.HawkularDatasourceQueryCtrl = function (_QueryCtrl) {
  _inherits(HawkularDatasourceQueryCtrl, _QueryCtrl);

  function HawkularDatasourceQueryCtrl($scope, $injector, uiSegmentSrv, $q) {
    _classCallCheck(this, HawkularDatasourceQueryCtrl);

    var _this = _possibleConstructorReturn(this, (HawkularDatasourceQueryCtrl.__proto__ || Object.getPrototypeOf(HawkularDatasourceQueryCtrl)).call(this, $scope, $injector));

    _this.scope = $scope;
    _this.uiSegmentSrv = uiSegmentSrv;
    _this.$q = $q;

    _this.target = _this.datasource.sanitizeTarget(_this.target);
    _this.caps = new _capabilities.Capabilities('');
    _this.datasource.getCapabilities().then(function (caps) {
      _this.caps = caps;
      if (caps.TAGS_QUERY_LANGUAGE) {
        _this.tagsController = new _tagsQLController.TagsQLController(uiSegmentSrv, _this.datasource, $q, function () {
          return _this.target;
        });
      } else {
        _this.tagsController = new _tagsKVPairsController.TagsKVPairsController(uiSegmentSrv, _this.datasource, $q, caps.FETCH_ALL_TAGS, function () {
          return _this.target;
        });
      }
      _this.tagsSegments = _this.tagsController.initTagsSegments();
    });

    _this.metricTypes = [{ value: 'gauge', text: 'Gauge' }, { value: 'counter', text: 'Counter' }, { value: 'availability', text: 'Availability' }];
    _this.seriesAggFns = [{ value: 'none', text: 'None' }, { value: 'sum', text: 'Sum' }, { value: 'avg', text: 'Average' }];
    _this.timeAggFns = [{ value: 'avg', text: 'Average' }, { value: 'min', text: 'Min' }, { value: 'max', text: 'Max' }, { value: 'live', text: 'Live' }];
    _this.availableStats = ['avg', 'min', 'max', 'median', 'sum', '75 %ile', '90 %ile', '95 %ile', '98 %ile', '99 %ile', '99.9 %ile'].map(function (val) {
      return { value: val, text: val };
    });
    _this.statsSegments = _this.initStatsSegments();
    _this.removeStatsSegment = _this.uiSegmentSrv.newSegment({ fake: true, value: '-- Remove --' });

    _this.target.type = _this.target.type || _this.metricTypes[0].value;
    _this.target.id = _this.target.id || '-- none --';
    if (_this.panel.type === 'singlestat') {
      _this.target.raw = false;
      _this.target.timeAggFn = _this.target.timeAggFn || _this.timeAggFns[0].value;
    }
    return _this;
  }

  _createClass(HawkularDatasourceQueryCtrl, [{
    key: 'getTagsSegments',
    value: function getTagsSegments(segment, $index) {
      return this.tagsController.getTagsSegments(this.tagsSegments, segment, $index);
    }
  }, {
    key: 'tagsSegmentChanged',
    value: function tagsSegmentChanged(segment, $index) {
      this.tagsController.tagsSegmentChanged(this.tagsSegments, segment, $index);
      this.onChangeInternal();
    }
  }, {
    key: 'initStatsSegments',
    value: function initStatsSegments() {
      var _this2 = this;

      var segments = this.target.stats.map(function (stat) {
        return _this2.uiSegmentSrv.newKey(stat);
      });
      segments.push(this.uiSegmentSrv.newPlusButton());
      return segments;
    }
  }, {
    key: 'getStatsSegments',
    value: function getStatsSegments(segment, $index) {
      var _this3 = this;

      if (segment.type === 'plus-button') {
        return this.getAvailableStats();
      }
      return this.getAvailableStats().then(function (keys) {
        return [angular.copy(_this3.removeStatsSegment)].concat(_toConsumableArray(keys));
      });
    }
  }, {
    key: 'statsSegmentChanged',
    value: function statsSegmentChanged(segment, index) {
      if (segment.value === this.removeStatsSegment.value) {
        this.statsSegments.splice(index, 1);
      } else if (segment.type === 'plus-button') {
        this.statsSegments.splice(index, 1);
        this.statsSegments.splice(index, 0, this.uiSegmentSrv.newKey(segment.value), this.uiSegmentSrv.newPlusButton());
      } else {
        this.statsSegments[index] = segment;
      }
      this.target.stats = this.statsSegments.filter(function (s) {
        return !s.fake;
      }).map(function (s) {
        return s.value;
      });
      this.onChangeInternal();
    }
  }, {
    key: 'getAvailableStats',
    value: function getAvailableStats() {
      var _this4 = this;

      // Filter out already selected stats
      return this.$q.when(this.availableStats.filter(function (stat) {
        return _this4.target.stats.indexOf(stat.value) < 0;
      })).then(this.uiSegmentSrv.transformToSegments(false));
    }
  }, {
    key: 'getMetricOptions',
    value: function getMetricOptions() {
      return this.datasource.suggestMetrics(this.target).then(function (metrics) {
        return [{ value: '-- none --', text: '-- none --' }].concat(metrics);
      }).then(this.uiSegmentSrv.transformToSegments(false));
      // Options have to be transformed by uiSegmentSrv to be usable by metric-segment-model directive
    }
  }, {
    key: 'onChangeInternal',
    value: function onChangeInternal() {
      if (this.target.type == 'availability') {
        // Disable multiple series aggregation
        this.target.seriesAggFn = this.seriesAggFns[0].value;
      }
      this.panelCtrl.refresh(); // Asks the panel to refresh data.
    }
  }, {
    key: 'toggleEditorMode',
    value: function toggleEditorMode() {
      if (this.caps.TAGS_QUERY_LANGUAGE) {
        this.target.rawTagsQuery = !this.target.rawTagsQuery;
        if (!this.target.rawTagsQuery) {
          try {
            this.tagsSegments = this.tagsController.initTagsSegments();
          } catch (err) {
            this.target.rawTagsQuery = true;
            console.log('Cannot parse query: ' + err);
          }
        }
      } else {
        this.target.rawTagsQuery = false;
      }
    }
  }]);

  return HawkularDatasourceQueryCtrl;
}(_sdk.QueryCtrl);

HawkularDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
//# sourceMappingURL=query_ctrl.js.map
