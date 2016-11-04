'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HawkularDatasourceQueryCtrl = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _sdk = require('app/plugins/sdk');

require('./css/query-editor.css!');

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

    _this.queryByTagCapability = false;
    _this.statsPostCapability = false;
    _this.datasource.getCapabilities().then(function (caps) {
      _this.queryByTagCapability = caps.QUERY_BY_TAGS;
      _this.statsPostCapability = caps.QUERY_STATS_POST_ENDPOINTS;
    });

    _this.listQueryBy = [{ value: 'ids', text: 'Search by name' }, { value: 'tags', text: 'Search by tags' }];
    _this.metricTypes = [{ value: 'gauge', text: 'Gauge' }, { value: 'counter', text: 'Counter' }, { value: 'availability', text: 'Availability' }];
    _this.seriesAggFns = [{ value: 'none', text: 'None' }, { value: 'sum', text: 'Sum' }, { value: 'avg', text: 'Average' }];
    _this.timeAggFns = [{ value: 'avg', text: 'Average' }, { value: 'min', text: 'Min' }, { value: 'max', text: 'Max' }, { value: 'live', text: 'Live' }];

    _this.target.queryBy = _this.target.queryBy || _this.listQueryBy[0].value;
    _this.target.type = _this.target.type || _this.metricTypes[0].value;
    _this.target.target = _this.target.target || 'select metric';
    _this.target.rate = _this.target.rate === true;
    _this.target.tags = _this.target.tags || [];
    _this.target.seriesAggFn = _this.target.seriesAggFn || _this.seriesAggFns[0].value;
    _this.target.timeAggFn = _this.target.timeAggFn || _this.timeAggFns[0].value;

    _this.tagsSegments = _.reduce(_this.target.tags, function (list, tag) {
      list.push(uiSegmentSrv.newKey(tag.name));
      list.push(uiSegmentSrv.newOperator(':'));
      list.push(uiSegmentSrv.newKeyValue(tag.value));
      list.push(uiSegmentSrv.newOperator(','));
      return list;
    }, []);
    _this.tagsSegments.push(uiSegmentSrv.newPlusButton());
    _this.removeTagsSegment = uiSegmentSrv.newSegment({ fake: true, value: '-- Remove tag --' });
    return _this;
  }

  _createClass(HawkularDatasourceQueryCtrl, [{
    key: 'getTagsSegments',
    value: function getTagsSegments(segment, $index) {
      if (segment.type === 'plus-button') {
        return this.$q.when([]);
      } else if (segment.type === 'key') {
        return this.$q.when([angular.copy(this.removeTagsSegment)]);
      } else if (segment.type === 'value') {
        var key = this.tagsSegments[$index - 2].value;
        return this.datasource.suggestTags(this.target.type, key).then(this.uiSegmentSrv.transformToSegments(false));
      }
    }
  }, {
    key: 'tagsSegmentChanged',
    value: function tagsSegmentChanged(segment, index) {
      if (segment.value === this.removeTagsSegment.value) {
        this.tagsSegments.splice(index, 4);
      } else if (segment.type === 'plus-button') {
        this.tagsSegments.splice(index, 1, this.uiSegmentSrv.newOperator(','));
        this.tagsSegments.splice(index, 0, this.uiSegmentSrv.newKeyValue(' *'));
        this.tagsSegments.splice(index, 0, this.uiSegmentSrv.newOperator(':'));
        this.tagsSegments.splice(index, 0, this.uiSegmentSrv.newKey(segment.value));
        this.tagsSegments.push(this.uiSegmentSrv.newPlusButton());
      } else {
        this.tagsSegments[index] = segment;
      }
      this.tagsToModel();
      this.onChangeInternal();
    }
  }, {
    key: 'tagsToModel',
    value: function tagsToModel() {
      this.target.tags = [];
      for (var i = 0; i < this.tagsSegments.length - 2; i += 4) {
        var key = this.tagsSegments[i].value;
        var val = this.tagsSegments[i + 2].fake ? '*' : this.tagsSegments[i + 2].value || '*';
        this.target.tags.push({ name: key, value: val });
      }
    }
  }, {
    key: 'getOptions',
    value: function getOptions() {
      return this.datasource.suggestQueries(this.target).then(this.uiSegmentSrv.transformToSegments(false));
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
  }]);

  return HawkularDatasourceQueryCtrl;
}(_sdk.QueryCtrl);

HawkularDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
//# sourceMappingURL=query_ctrl.js.map
